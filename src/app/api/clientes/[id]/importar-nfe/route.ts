import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseNFeXML } from '@/lib/parsers/nfe'
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
    const files = formData.getAll('files') as File[]
    const periodo = formData.get('periodo') as string

    if (!periodo) return NextResponse.json({ erro: 'Período obrigatório' }, { status: 400 })

    const importados: string[] = []
    const erros: { arquivo: string; erro: string }[] = []
    const duplicados: string[] = []

    for (const file of files) {
      const content = await file.text()
      const nfe = await parseNFeXML(content)

      if (nfe.erro) { erros.push({ arquivo: file.name, erro: nfe.erro }); continue }

      if (nfe.chave_acesso) {
        const existente = await prisma.notaFiscal.findUnique({
          where: { chave_acesso: nfe.chave_acesso },
          select: { id: true },
        })
        if (existente) { duplicados.push(`NF ${nfe.numero}`); continue }
      }

      await prisma.notaFiscal.create({
        data: {
          cliente_id: clienteId, periodo,
          data: new Date(nfe.data_emissao),
          numero: nfe.numero,
          chave_acesso: nfe.chave_acesso || null,
          cliente_nf: nfe.razao_destinatario || 'Consumidor Final',
          cfop: nfe.cfop, valor: nfe.valor_total, conciliada: false,
        },
      })
      importados.push(`NF ${nfe.numero} — R$ ${nfe.valor_total.toLocaleString('pt-BR')}`)
    }

    return NextResponse.json({ importados, erros, duplicados })
  } catch (err) {
    console.error('[importar-nfe]', err)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
