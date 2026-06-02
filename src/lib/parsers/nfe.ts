import { XMLParser } from 'fast-xml-parser'

export type NFeParsed = {
  chave_acesso: string
  numero: string
  serie: string
  data_emissao: string
  cfop: string
  valor_total: number
  cnpj_emitente: string
  razao_emitente: string
  cnpj_destinatario?: string
  razao_destinatario?: string
  natureza_operacao: string
  tipo: 'entrada' | 'saida' // tpNF: 0=entrada, 1=saida
  itens: NFeItem[]
  erro?: string
}

export type NFeItem = {
  descricao: string
  cfop: string
  valor: number
  quantidade: number
  unidade: string
  ncm?: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
})

function getText(obj: unknown): string {
  if (typeof obj === 'string') return obj
  if (typeof obj === 'number') return String(obj)
  if (obj && typeof obj === 'object' && '#text' in (obj as Record<string, unknown>)) {
    return String((obj as Record<string, unknown>)['#text'])
  }
  return ''
}

function getNum(obj: unknown): number {
  const t = getText(obj)
  return parseFloat(t) || 0
}

export async function parseNFeXML(xmlContent: string): Promise<NFeParsed> {
  try {
    const result = parser.parse(xmlContent)

    // Suporte a nfeProc (XML com protocolo) e NFeProc
    const root = result.nfeProc || result.NFeProc || result
    const nfe = root.NFe || root.nfe || result.NFe || result.nfe
    const infNFe = nfe?.infNFe

    if (!infNFe) {
      throw new Error('Estrutura XML inválida — infNFe não encontrado')
    }

    const chave = getText(infNFe['@_Id'] || '').replace('NFe', '')

    const ide = infNFe.ide || {}
    const emit = infNFe.emit || {}
    const dest = infNFe.dest || {}
    const total = infNFe.total?.ICMSTot || {}

    // CFOP principal (primeiro item)
    const det = infNFe.det
    const detArray = Array.isArray(det) ? det : det ? [det] : []

    const itens: NFeItem[] = detArray.map((d: Record<string, unknown>) => {
      const prod = (d.prod || {}) as Record<string, unknown>
      return {
        descricao: getText(prod.xProd),
        cfop: getText(prod.CFOP),
        valor: getNum(prod.vProd),
        quantidade: getNum(prod.qCom),
        unidade: getText(prod.uCom),
        ncm: getText(prod.NCM),
      }
    })

    const cfop_principal = itens[0]?.cfop || getText(ide.CFOP) || ''

    return {
      chave_acesso: chave,
      numero: getText(ide.nNF),
      serie: getText(ide.serie),
      data_emissao: getText(ide.dhEmi || ide.dEmi).substring(0, 10),
      cfop: cfop_principal,
      valor_total: getNum(total.vNF || total.vProd),
      cnpj_emitente: getText(emit.CNPJ).replace(/\D/g, ''),
      razao_emitente: getText(emit.xNome || emit.xFant),
      cnpj_destinatario: getText(dest.CNPJ).replace(/\D/g, '') || undefined,
      razao_destinatario: getText(dest.xNome) || undefined,
      natureza_operacao: getText(ide.natOp),
      tipo: getText(ide.tpNF) === '0' ? 'entrada' : 'saida',
      itens,
    }
  } catch (err) {
    return {
      chave_acesso: '',
      numero: '',
      serie: '',
      data_emissao: '',
      cfop: '',
      valor_total: 0,
      cnpj_emitente: '',
      razao_emitente: '',
      natureza_operacao: '',
      tipo: 'saida',
      itens: [],
      erro: err instanceof Error ? err.message : 'Erro desconhecido ao parsear XML',
    }
  }
}

// Processa múltiplos XMLs e retorna resultados
export async function parseMultiplosXML(
  files: File[]
): Promise<{ sucesso: NFeParsed[]; erros: { arquivo: string; erro: string }[] }> {
  const sucesso: NFeParsed[] = []
  const erros: { arquivo: string; erro: string }[] = []

  for (const file of files) {
    const content = await file.text()
    const result = await parseNFeXML(content)
    if (result.erro) {
      erros.push({ arquivo: file.name, erro: result.erro })
    } else {
      sucesso.push(result)
    }
  }

  return { sucesso, erros }
}
