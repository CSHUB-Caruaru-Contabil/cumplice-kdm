import { NextRequest, NextResponse } from 'next/server'
import { guardCliente } from '@/lib/supabase/auth-guard'
import { conciliarPeriodo } from '@/lib/conciliar'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params
  const guard = await guardCliente(clienteId)
  if (!guard.ok) return guard.response

  try {
    const periodo = request.nextUrl.searchParams.get('periodo') ||
      (await request.json().catch(() => ({}))).periodo || ''

    if (!periodo) return NextResponse.json({ erro: 'Período obrigatório' }, { status: 400 })

    const resultado = await conciliarPeriodo(clienteId, periodo)
    return NextResponse.json({ ok: true, periodo, ...resultado })
  } catch (err) {
    console.error('[conciliar]', err)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
