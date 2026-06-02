import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// PUT /api/usuarios/[id] — atualiza e-mail, papel e clientes vinculados
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { id: userId } = await params
  const { email, senha, cliente_ids, papel } = await request.json()

  // Atualiza e-mail se fornecido
  if (email) {
    await prisma.$executeRaw`
      UPDATE auth.users SET email = ${email}, updated_at = NOW() WHERE id = ${userId}::uuid
    `
  }

  // Atualiza senha se fornecida
  if (senha && senha.trim() !== '') {
    await prisma.$executeRaw`
      UPDATE auth.users
      SET encrypted_password = crypt(${senha}, gen_salt('bf')), updated_at = NOW()
      WHERE id = ${userId}::uuid
    `
  }

  // Atualiza vínculos com clientes
  if (Array.isArray(cliente_ids)) {
    // Remove vínculos antigos
    await prisma.usuarioCliente.deleteMany({ where: { usuario_id: userId } })

    // Cria novos vínculos
    for (const clienteId of cliente_ids) {
      await prisma.usuarioCliente.create({
        data: { usuario_id: userId, cliente_id: clienteId, papel: papel || 'contador' },
      })
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/usuarios/[id] — remove usuário (desvincula dos clientes)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { id: userId } = await params

  // Impede auto-exclusão
  if (userId === authUser.id) {
    return NextResponse.json({ erro: 'Você não pode excluir o próprio usuário' }, { status: 400 })
  }

  // Remove todos os vínculos
  await prisma.usuarioCliente.deleteMany({ where: { usuario_id: userId } })

  // Deleta o usuário do Supabase Auth
  await prisma.$executeRaw`DELETE FROM auth.users WHERE id = ${userId}::uuid`

  return NextResponse.json({ ok: true })
}
