// Parser de extrato bancário OFX (Open Financial Exchange)
// Suporta OFX 1.x (SGML) e OFX 2.x (XML)

export type OFXLancamento = {
  tipo: 'entrada' | 'saida'
  data: string // YYYY-MM-DD
  valor: number
  descricao: string
  id_transacao?: string
  categoria?: string // inferida automaticamente
}

// Mapeamento de palavras-chave para categorias
const CATEGORIAS: Record<string, string[]> = {
  'Venda de Mercadoria': ['PIX RECEBIDO', 'CARTAO POS', 'VENDA', 'RECEBIMENTO', 'TEF', 'CIELO', 'REDE', 'STONE', 'GETNET'],
  'Pagamento Fornecedor': ['PGTO FORNECEDOR', 'PAGAMENTO FORNECEDOR', 'BOLETO FORNEC', 'NF PAGA'],
  'Folha de Pagamento': ['FOLHA', 'SALARIO', 'PAGTO FUNC', 'PGTO FUNC', 'FOPAG'],
  'Pró-Labore': ['PRO-LABORE', 'PROLABORE', 'PRO LABORE', 'RETIRADA SOCIO'],
  'Aluguel': ['ALUGUEL', 'LOCACAO', 'ALUG'],
  'Energia Elétrica': ['CELESC', 'CEMIG', 'LIGHT', 'ENERGIA ELETRICA', 'CPFL', 'COELBA', 'ENERGISA', 'CEEE'],
  'Telefone/Internet': ['VIVO', 'CLARO', 'TIM', 'OI ', 'EMBRATEL', 'NET COMBO', 'TELEFONE', 'INTERNET'],
  'Contabilidade': ['CONTABILIDADE', 'HONORARIOS', 'ESCRITORIO CONT'],
  'Imposto/Tributo': ['DAS ', 'DARF', 'GPS ', 'FGTS', 'TRIBUTO', 'IMPOSTO', 'SIMPLES NACIONAL', 'RECEITA FEDERAL'],
  'Empréstimo/Aporte': ['EMPRESTIMO', 'APORTE', 'CAPITAL', 'TED APORTE'],
}

function inferirCategoria(descricao: string, tipo: 'entrada' | 'saida'): string {
  const upper = descricao.toUpperCase()
  for (const [categoria, palavras] of Object.entries(CATEGORIAS)) {
    if (palavras.some(p => upper.includes(p))) return categoria
  }
  return tipo === 'entrada' ? 'Venda de Mercadoria' : 'Despesa Operacional'
}

function parseDataOFX(dataStr: string): string {
  // OFX date: YYYYMMDD ou YYYYMMDDHHMMSS ou YYYYMMDDHHMMSS.000[-03:America/Sao_Paulo]
  const clean = dataStr.replace(/\[.*\]/, '').trim()
  const year = clean.substring(0, 4)
  const month = clean.substring(4, 6)
  const day = clean.substring(6, 8)
  return `${year}-${month}-${day}`
}

export function parseOFX(content: string): OFXLancamento[] {
  const lancamentos: OFXLancamento[] = []

  // Detecta OFX 2.x (XML)
  if (content.trimStart().startsWith('<?xml') || content.includes('<OFX>')) {
    return parseOFXXML(content)
  }

  // OFX 1.x — SGML sem fechamento de tags
  const stmttrnSection = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g) || []

  for (const trn of stmttrnSection) {
    const getTag = (tag: string) => {
      const match = trn.match(new RegExp(`<${tag}>([^<\\n\\r]+)`))
      return match ? match[1].trim() : ''
    }

    const trntype = getTag('TRNTYPE') // CREDIT / DEBIT / DEP / CHECK / PAYMENT
    const dtposted = getTag('DTPOSTED')
    const trnamt = parseFloat(getTag('TRNAMT').replace(',', '.'))
    const memo = getTag('MEMO') || getTag('NAME') || ''
    const fitid = getTag('FITID')

    if (!dtposted || isNaN(trnamt)) continue

    const valor = Math.abs(trnamt)
    const tipo: 'entrada' | 'saida' =
      trnamt > 0 || ['CREDIT', 'DEP', 'INT', 'DIVIDEND'].includes(trntype) ? 'entrada' : 'saida'

    lancamentos.push({
      tipo,
      data: parseDataOFX(dtposted),
      valor,
      descricao: memo,
      id_transacao: fitid,
      categoria: inferirCategoria(memo, tipo),
    })
  }

  return lancamentos.sort((a, b) => a.data.localeCompare(b.data))
}

function parseOFXXML(content: string): OFXLancamento[] {
  const lancamentos: OFXLancamento[] = []
  const matches = [...content.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g)]

  for (const match of matches) {
    const block = match[1]
    const getTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`))
      return m ? m[1].trim() : ''
    }

    const trnamt = parseFloat(getTag('TRNAMT').replace(',', '.'))
    const memo = getTag('MEMO') || getTag('NAME') || ''
    const dtposted = getTag('DTPOSTED')

    if (!dtposted || isNaN(trnamt)) continue

    const valor = Math.abs(trnamt)
    const tipo: 'entrada' | 'saida' = trnamt > 0 ? 'entrada' : 'saida'

    lancamentos.push({
      tipo,
      data: parseDataOFX(dtposted),
      valor,
      descricao: memo,
      id_transacao: getTag('FITID'),
      categoria: inferirCategoria(memo, tipo),
    })
  }

  return lancamentos.sort((a, b) => a.data.localeCompare(b.data))
}

export async function parseOFXFile(file: File): Promise<OFXLancamento[]> {
  const content = await file.text()
  return parseOFX(content)
}
