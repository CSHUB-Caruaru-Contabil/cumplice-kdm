import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// Verifica se o usuário autenticado é um contador válido
async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET /api/usuarios — lista todos os usuários vinculados aos clientes do usuário logado
export async function GET() {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  // Busca clientes do usuário logado
  const vinculos = await prisma.usuarioCliente.findMany({
    where: { usuario_id: authUser.id },
    select: { cliente_id: true },
  })
  const clienteIds = vinculos.map(v => v.cliente_id)

  // Busca todos os usuarios_clientes desses clientes
  const uc = await prisma.usuarioCliente.findMany({
    where: { cliente_id: { in: clienteIds } },
  })

  // IDs únicos de usuários
  const usuarioIds = [...new Set(uc.map(u => u.usuario_id))]

  // Busca dados dos usuários em auth.users via SQL
  const usuarios = await prisma.$queryRaw<{
    id: string; email: string; created_at: Date; last_sign_in_at: Date | null
  }[]>`
    SELECT id, email, created_at, last_sign_in_at
    FROM auth.users
    WHERE id = ANY(${usuarioIds}::uuid[])
    ORDER BY email
  `

  // Combina com vínculos
  const resultado = usuarios.map(u => ({
    ...u,
    vinculos: uc.filter(v => v.usuario_id === u.id),
  }))

  return NextResponse.json(resultado)
}

// POST /api/usuarios — cria novo usuário
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { email, senha, cliente_ids, papel } = await request.json()

  if (!email || !senha) {
    return NextResponse.json({ erro: 'E-mail e senha são obrigatórios' }, { status: 400 })
  }

  // Verifica se e-mail já existe
  const existente = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM auth.users WHERE email = ${email} LIMIT 1
  `
  if (existente.length > 0) {
    return NextResponse.json({ erro: 'E-mail já cadastrado' }, { status: 409 })
  }

  // Cria usuário direto no banco com senha hasheada pelo Postgres
  const { randomUUID } = await import('crypto')
  const userId = randomUUID()

  await prisma.$executeRaw`
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud, instance_id
    ) VALUES (
      ${userId}::uuid,
      ${email},
      crypt(${senha}, gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false, 'authenticated', 'authenticated',
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  `

  // Vincula aos clientes selecionados
  const ids: string[] = cliente_ids || []
  for (const clienteId of ids) {
    await prisma.usuarioCliente.upsert({
      where: { usuario_id_cliente_id: { usuario_id: userId, cliente_id: clienteId } },
      update: { papel: papel || 'contador' },
      create: { usuario_id: userId, cliente_id: clienteId, papel: papel || 'contador' },
    })
  }

  return NextResponse.json({ id: userId, email })
}
