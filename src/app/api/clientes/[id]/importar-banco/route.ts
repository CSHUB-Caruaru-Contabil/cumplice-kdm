import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseOFX } from '@/lib/parsers/ofx'
import { parseCSV } from '@/lib/parsers/csv'
import { guardCliente } from '@/lib/supabase/auth-guard'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params

  const guard = await guardCliente(clienteId)
  if (!guard.ok) return guard.response

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const periodo = formData.get('periodo') as string
    const conta = (formData.get('conta') as string) || null

    if (!file) return NextResponse.json({ erro: 'Arquivo não enviado' }, { status: 400 })
    if (!periodo) return NextResponse.json({ erro: 'Período obrigatório' }, { status: 400 })

    const content = await file.text()
    const ext = file.name.split('.').pop()?.toLowerCase()
    const lancamentos = ext === 'ofx' ? parseOFX(content) : parseCSV(content)
    const filtrados = lancamentos.filter(l => l.data.startsWith(periodo))

    const criados = await prisma.bancoLancamento.createMany({
      data: filtrados.map(l => ({
        cliente_id: clienteId, periodo,
        data: new Date(l.data),
        descricao: l.descricao,
        categoria: l.categoria || null,
        tipo: l.tipo, valor: l.valor,
        status: 'pendente', conta,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({
      total: filtrados.length,
      inseridos: criados.count,
      fora_periodo: lancamentos.length - filtrados.length,
    })
  } catch (err) {
    console.error('[importar-banco]', err)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
