import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function getAuthUserAdmin(clienteId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, erro: 'Não autenticado', status: 401 }

  // Verifica se é admin
  const vinculo = await prisma.usuarioCliente.findFirst({
    where: { usuario_id: user.id, cliente_id: clienteId, papel: 'admin' },
  })
  if (!vinculo) return { ok: false as const, erro: 'Apenas administradores podem fechar/reabrir períodos', status: 403 }

  return { ok: true as const, userId: user.id }
}

// GET — verifica se período está fechado
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const periodo = request.nextUrl.searchParams.get('periodo') || ''

  const fechado = await prisma.periodoFechado.findUnique({
    where: { cliente_id_periodo: { cliente_id: clienteId, periodo } },
  })

  return NextResponse.json({ fechado: !!fechado, info: fechado || null })
}

// POST — fecha período
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const auth = await getAuthUserAdmin(clienteId)
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

  const { periodo } = await request.json()
  if (!periodo) return NextResponse.json({ erro: 'Período obrigatório' }, { status: 400 })

  const existente = await prisma.periodoFechado.findUnique({
    where: { cliente_id_periodo: { cliente_id: clienteId, periodo } },
  })
  if (existente) return NextResponse.json({ erro: 'Período já está fechado' }, { status: 409 })

  const criado = await prisma.periodoFechado.create({
    data: { cliente_id: clienteId, periodo, fechado_por: auth.userId },
  })

  return NextResponse.json({ ok: true, fechado: criado })
}

// DELETE — reabre período
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const auth = await getAuthUserAdmin(clienteId)
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

  const periodo = request.nextUrl.searchParams.get('periodo') || ''

  await prisma.periodoFechado.deleteMany({
    where: { cliente_id: clienteId, periodo },
  })

  return NextResponse.json({ ok: true })
}
