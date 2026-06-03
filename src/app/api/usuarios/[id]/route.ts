import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// PUT /api/usuarios/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { id: userId } = await params
  const { email, senha, papel } = await request.json()

  // Atualiza e-mail
  if (email) {
    await prisma.$executeRaw`
      UPDATE auth.users SET email = ${email}, updated_at = NOW() WHERE id = ${userId}::uuid
    `
  }

  // Atualiza senha
  if (senha && senha.trim() !== '') {
    await prisma.$executeRaw`
      UPDATE auth.users
      SET encrypted_password = crypt(${senha}, gen_salt('bf')), updated_at = NOW()
      WHERE id = ${userId}::uuid
    `
  }

  // Atualiza papel em TODOS os vínculos do usuário
  if (papel) {
    const vinculos = await prisma.usuarioCliente.findMany({ where: { usuario_id: userId } })

    if (vinculos.length > 0) {
      await prisma.usuarioCliente.updateMany({
        where: { usuario_id: userId },
        data: { papel },
      })
    } else {
      // Sem vínculos — vincula a todos os clientes com o novo papel
      const clientes = await prisma.cliente.findMany({ where: { ativo: true }, select: { id: true } })
      for (const { id: clienteId } of clientes) {
        await prisma.usuarioCliente.upsert({
          where: { usuario_id_cliente_id: { usuario_id: userId, cliente_id: clienteId } },
          update: { papel },
          create: { usuario_id: userId, cliente_id: clienteId, papel },
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/usuarios/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { id: userId } = await params

  if (userId === authUser.id) {
    return NextResponse.json({ erro: 'Você não pode excluir o próprio usuário' }, { status: 400 })
  }

  await prisma.usuarioCliente.deleteMany({ where: { usuario_id: userId } })
  await prisma.$executeRaw`DELETE FROM auth.users WHERE id = ${userId}::uuid`

  return NextResponse.json({ ok: true })
}
