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

    if (!file)    return NextResponse.json({ erro: 'Arquivo não enviado' }, { status: 400 })
    if (!periodo) return NextResponse.json({ erro: 'Período obrigatório' }, { status: 400 })

    // Decode respeitando a codificação do arquivo
    let content: string
    const buffer = await file.arrayBuffer()
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch {
      content = new TextDecoder('windows-1252').decode(buffer)
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    let lancamentos: ReturnType<typeof parseCSV>

    if (ext === 'ofx') {
      const resultado = parseOFX(content)
      if (resultado.erro) {
        return NextResponse.json({ erro: resultado.erro }, { status: 422 })
      }
      lancamentos = resultado.lancamentos
    } else {
      lancamentos = parseCSV(content)
    }

    const total_lidos = lancamentos.length

    if (total_lidos === 0) {
      return NextResponse.json({
        inseridos: 0, total_lidos: 0,
        aviso: 'Nenhuma transação pôde ser lida do arquivo.',
      })
    }

    // Cada transação vai para o seu período real (data da transação)
    // Não filtra por período da UI — o extrato pode conter meses diferentes
    const criados = await prisma.bancoLancamento.createMany({
      data: lancamentos.map(l => ({
        cliente_id: clienteId,
        periodo: l.data.substring(0, 7),  // ← período da TRANSAÇÃO, não da UI
        data: new Date(l.data),
        descricao: l.descricao,
        categoria: l.categoria || null,
        tipo: l.tipo,
        valor: l.valor,
        status: 'pendente',
        conta,
      })),
      skipDuplicates: true,
    })

    // Conta por período para feedback
    const porPeriodo: Record<string, number> = {}
    for (const l of lancamentos) {
      const p = l.data.substring(0, 7)
      porPeriodo[p] = (porPeriodo[p] || 0) + 1
    }

    return NextResponse.json({
      inseridos: criados.count,
      total_lidos,
      por_periodo: porPeriodo,
      duplicados_ignorados: lancamentos.length - criados.count,
    })
  } catch (err) {
    console.error('[importar-banco]', err)
    return NextResponse.json({ erro: 'Erro interno ao processar arquivo' }, { status: 500 })
  }
}
