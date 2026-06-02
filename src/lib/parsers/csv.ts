// Parser de extrato CSV bancário
// Detecta automaticamente o formato (Itaú, Bradesco, Nubank, genérico)

import { OFXLancamento } from './ofx'

type CSVFormat = {
  nome: string
  detectar: (linhas: string[]) => boolean
  parsear: (linhas: string[]) => OFXLancamento[]
}

function inferirCategoria(descricao: string, tipo: 'entrada' | 'saida'): string {
  const upper = descricao.toUpperCase()
  const mapa: [string, string[]][] = [
    ['Venda de Mercadoria', ['PIX RECEBIDO', 'VENDA', 'CARTAO', 'CIELO', 'STONE', 'REDE', 'GETNET']],
    ['Pagamento Fornecedor', ['FORNECEDOR', 'BOLETO', 'PGTO']],
    ['Folha de Pagamento', ['FOLHA', 'SALARIO', 'FOPAG']],
    ['Aluguel', ['ALUGUEL', 'LOCACAO']],
    ['Imposto/Tributo', ['DAS', 'DARF', 'GPS', 'FGTS', 'SIMPLES']],
    ['Energia Elétrica', ['CELESC', 'CEMIG', 'LIGHT', 'CPFL', 'ENERGIA']],
  ]
  for (const [cat, palavras] of mapa) {
    if (palavras.some(p => upper.includes(p))) return cat
  }
  return tipo === 'entrada' ? 'Venda de Mercadoria' : 'Despesa Operacional'
}

function parseBRL(val: string): number {
  // Remove R$, pontos de milhar, substitui vírgula por ponto
  return parseFloat(val.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim()) || 0
}

function parseData(val: string): string {
  // Formatos: DD/MM/YYYY, YYYY-MM-DD
  const ddmmyyyy = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  return val
}

// ---- Formatos detectados ----

const formatoItau: CSVFormat = {
  nome: 'Itaú',
  detectar: (linhas) => linhas.some(l => l.toLowerCase().includes('itau') || l.toLowerCase().includes('itaú')),
  parsear: (linhas) => {
    // Itaú: Data;Histórico;Docto;Crédito;Débito;Saldo
    const inicio = linhas.findIndex(l => /data/i.test(l) && /hist/i.test(l))
    const dados = inicio >= 0 ? linhas.slice(inicio + 1) : linhas.slice(1)
    return dados.flatMap(linha => {
      const cols = linha.split(';')
      if (cols.length < 5) return []
      const data = parseData(cols[0]?.trim())
      const desc = cols[1]?.trim() || ''
      const credito = parseBRL(cols[3] || '0')
      const debito = parseBRL(cols[4] || '0')
      if (!data || (!credito && !debito)) return []
      const tipo: 'entrada' | 'saida' = credito > 0 ? 'entrada' : 'saida'
      const valor = credito || debito
      return [{ tipo, data, valor, descricao: desc, categoria: inferirCategoria(desc, tipo) }]
    })
  },
}

const formatoBradesco: CSVFormat = {
  nome: 'Bradesco',
  detectar: (linhas) => linhas.some(l => l.toLowerCase().includes('bradesco')),
  parsear: (linhas) => {
    // Bradesco: Data;Histórico;Valor;Ind
    const inicio = linhas.findIndex(l => /data/i.test(l))
    const dados = inicio >= 0 ? linhas.slice(inicio + 1) : linhas.slice(1)
    return dados.flatMap(linha => {
      const cols = linha.split(';')
      if (cols.length < 4) return []
      const data = parseData(cols[0]?.trim())
      const desc = cols[1]?.trim() || ''
      const valor = Math.abs(parseBRL(cols[2] || '0'))
      const ind = cols[3]?.trim() || '' // C = crédito, D = débito
      if (!data || !valor) return []
      const tipo: 'entrada' | 'saida' = ind === 'C' ? 'entrada' : 'saida'
      return [{ tipo, data, valor, descricao: desc, categoria: inferirCategoria(desc, tipo) }]
    })
  },
}

const formatoNubank: CSVFormat = {
  nome: 'Nubank',
  detectar: (linhas) => linhas[0]?.toLowerCase().includes('date,description,amount'),
  parsear: (linhas) => {
    // Nubank: Date,Description,Amount (valores negativos = débito)
    return linhas.slice(1).flatMap(linha => {
      const cols = linha.split(',')
      if (cols.length < 3) return []
      const data = parseData(cols[0]?.trim())
      const desc = cols[1]?.trim().replace(/^"|"$/g, '') || ''
      const amount = parseFloat(cols[2]?.trim() || '0')
      if (!data || isNaN(amount)) return []
      const tipo: 'entrada' | 'saida' = amount > 0 ? 'entrada' : 'saida'
      return [{ tipo, data, valor: Math.abs(amount), descricao: desc, categoria: inferirCategoria(desc, tipo) }]
    })
  },
}

const formatoGenerico: CSVFormat = {
  nome: 'Genérico',
  detectar: () => true,
  parsear: (linhas) => {
    // Tenta identificar colunas automaticamente pela primeira linha
    const header = linhas[0]?.toLowerCase() || ''
    const sep = header.includes(';') ? ';' : ','
    const cols = header.split(sep).map(c => c.trim())

    const iData = cols.findIndex(c => c.includes('data') || c.includes('date'))
    const iDesc = cols.findIndex(c => c.includes('hist') || c.includes('desc') || c.includes('memo'))
    const iValor = cols.findIndex(c => c.includes('valor') || c.includes('amount') || c.includes('vlr'))

    if (iData < 0 || iValor < 0) return []

    return linhas.slice(1).flatMap(linha => {
      const c = linha.split(sep)
      const data = parseData(c[iData]?.trim() || '')
      const desc = c[iDesc >= 0 ? iDesc : 1]?.trim() || ''
      const valor_raw = parseBRL(c[iValor]?.trim() || '0')
      if (!data || !valor_raw) return []
      const tipo: 'entrada' | 'saida' = valor_raw >= 0 ? 'entrada' : 'saida'
      return [{ tipo, data, valor: Math.abs(valor_raw), descricao: desc, categoria: inferirCategoria(desc, tipo) }]
    })
  },
}

const FORMATOS: CSVFormat[] = [formatoItau, formatoBradesco, formatoNubank, formatoGenerico]

export function parseCSV(content: string): OFXLancamento[] {
  const linhas = content.split(/\r?\n/).filter(l => l.trim())
  const formato = FORMATOS.find(f => f.detectar(linhas)) || formatoGenerico
  const lancamentos = formato.parsear(linhas)
  return lancamentos
    .filter(l => l.data && l.valor > 0)
    .sort((a, b) => a.data.localeCompare(b.data))
}

export async function parseCSVFile(file: File): Promise<OFXLancamento[]> {
  const content = await file.text()
  return parseCSV(content)
}
