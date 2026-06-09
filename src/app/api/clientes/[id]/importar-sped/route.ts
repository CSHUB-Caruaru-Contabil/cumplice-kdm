import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseSpedEFD } from '@/lib/parsers/sped'
import { guardCliente } from '@/lib/supabase/auth-guard'
import { verificarPeriodoAberto } from '@/lib/supabase/periodo-guard'

export const maxDuration = 60

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

    if (!file) return NextResponse.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    // SPED EFD costuma vir em Windows-1252/ISO-8859-1 — decodifica respeitando a codificação
    let content: string
    const buffer = await file.arrayBuffer()
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch {
      content = new TextDecoder('windows-1252').decode(buffer)
    }

    const sped = parseSpedEFD(content)

    if (sped.erro) {
      return NextResponse.json({ erro: sped.erro }, { status: 422 })
    }
    if (!sped.empresa) {
      return NextResponse.json({ erro: 'Registro 0000 não encontrado — arquivo não parece ser um SPED EFD válido' }, { status: 422 })
    }

    const periodo = sped.empresa.periodo_inicio.substring(0, 7) // YYYY-MM

    const periodoGuard = await verificarPeriodoAberto(clienteId, periodo)
    if (!periodoGuard.ok) return periodoGuard.response

    // Documentos sem CFOP (ex.: cancelados sem item escriturado) não entram — nada a classificar
    const documentos = sped.documentos.filter(d => d.cfop_principal)
    const ignorados = sped.documentos.length - documentos.length

    if (documentos.length === 0) {
      return NextResponse.json({
        inseridos: 0, atualizados: 0, ignorados,
        empresa: sped.empresa.razao_social, periodo,
        aviso: 'Nenhum documento com CFOP foi encontrado no arquivo.',
      })
    }

    // Dedup: carrega documentos já importados deste cliente/período (por chave de acesso ou número+série+modelo)
    const existentes = await prisma.documentoSped.findMany({
      where: { cliente_id: clienteId, periodo },
      select: { id: true, chave_nfe: true, numero: true, serie: true, modelo: true },
    })
    const porChave = new Map(existentes.filter(e => e.chave_nfe).map(e => [e.chave_nfe!, e.id]))
    const porNumero = new Map(
      existentes.filter(e => !e.chave_nfe).map(e => [`${e.numero}|${e.serie}|${e.modelo}`, e.id])
    )

    let inseridos = 0
    let atualizados = 0

    for (const doc of documentos) {
      const dados = {
        cliente_id: clienteId,
        periodo,
        tipo: doc.tipo,
        emissao: doc.emissao,
        cod_participante: doc.cod_participante || null,
        participante_nome: doc.participante_nome || null,
        cnpj_participante: doc.cnpj_participante || null,
        modelo: doc.modelo || null,
        serie: doc.serie || null,
        numero: doc.numero,
        chave_nfe: doc.chave_nfe || null,
        data_emissao: new Date(doc.data_emissao),
        data_entrada_saida: doc.data_entrada_saida ? new Date(doc.data_entrada_saida) : null,
        valor_total: doc.valor_total,
        cfop: doc.cfop_principal,
        classificacao: doc.classificacao.tipo,
        cancelado: doc.cancelado,
      }

      const existenteId = doc.chave_nfe
        ? porChave.get(doc.chave_nfe)
        : porNumero.get(`${doc.numero}|${doc.serie}|${doc.modelo}`)

      if (existenteId) {
        await prisma.documentoSped.update({ where: { id: existenteId }, data: dados })
        atualizados++
      } else {
        await prisma.documentoSped.create({ data: { id: crypto.randomUUID(), ...dados } })
        inseridos++
      }
    }

    return NextResponse.json({
      inseridos, atualizados, ignorados,
      empresa: sped.empresa.razao_social, periodo,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[importar-sped]', msg)
    return NextResponse.json({ erro: `Erro interno: ${msg}` }, { status: 500 })
  }
}
