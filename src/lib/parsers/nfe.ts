import { XMLParser, XMLBuilder } from 'fast-xml-parser'

export type NFeEndereco = {
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  uf: string
  cep: string
}

export type NFeTotais = {
  vBC: number
  vICMS: number
  vBCST: number
  vICMSST: number
  vProd: number
  vFrete: number
  vSeg: number
  vDesc: number
  vOutro: number
  vIPI: number
  vNF: number
}

export type NFeParsed = {
  chave_acesso: string
  numero: string
  serie: string
  data_emissao: string
  data_saida_entrada?: string
  cfop: string
  valor_total: number
  cnpj_emitente: string
  razao_emitente: string
  ie_emitente?: string
  ender_emitente?: NFeEndereco
  cnpj_destinatario?: string
  razao_destinatario?: string
  ie_destinatario?: string
  ender_destinatario?: NFeEndereco
  natureza_operacao: string
  tipo: 'entrada' | 'saida'
  tipo_ambiente?: string  // 1 = Produção, 2 = Homologação
  formato: 'nfe' | 'nfse'   // distingue produto x serviço
  totais?: NFeTotais
  modalidade_frete?: string
  info_complementares?: string
  protocolo?: string
  data_autorizacao?: string
  itens: NFeItem[]
  erro?: string
  xmlOriginal?: string
}

export type NFeItem = {
  codigo?: string
  descricao: string
  cfop: string
  cst?: string
  valor: number
  quantidade: number
  unidade: string
  ncm?: string
  vUnit?: number
  vBC?: number
  vICMS?: number
  pICMS?: number
  vIPI?: number
  pIPI?: number
  classificacao?: string
  acumulador?: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  // Mantém valores de tags como string — evita perder zeros à esquerda em
  // campos como CST, CEP e NCM (ex.: "00" virando 0, "01000000" virando 1000000)
  parseTagValue: false,
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
  return parseFloat(getText(obj)) || 0
}

function parseEndereco(end: Record<string, unknown> | undefined): NFeEndereco | undefined {
  if (!end) return undefined
  return {
    logradouro: getText(end.xLgr),
    numero: getText(end.nro),
    bairro: getText(end.xBairro),
    municipio: getText(end.xMun),
    uf: getText(end.UF),
    cep: getText(end.CEP),
  }
}

// ICMS/IPI vêm em uma sub-tag cujo nome varia pelo CST (ICMS00, ICMS40, IPITrib, etc.)
function primeiroFilho(obj: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!obj) return {}
  const chave = Object.keys(obj)[0]
  return chave ? (obj[chave] as Record<string, unknown>) || {} : {}
}

// Busca infNFe em qualquer nível da estrutura parseada
function encontrarInfoNFe(obj: unknown, profundidade = 0): unknown {
  if (profundidade > 6 || !obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (o.infNFe) return o.infNFe
  // Procura em cada chave filha
  for (const val of Object.values(o)) {
    const found = encontrarInfoNFe(val, profundidade + 1)
    if (found) return found
  }
  return null
}

// ─── NF-e (produtos) ─────────────────────────────────────────────────────────
function parseNFe(result: Record<string, unknown>): NFeParsed {
  // Tenta os caminhos mais comuns primeiro (rápido)
  const root = result.nfeProc || result.NFeProc || result
  const nfe = (root as Record<string, unknown>).NFe || (root as Record<string, unknown>).nfe
    || result.NFe || result.nfe
  const infNFe = (nfe as Record<string, unknown>)?.infNFe
    // Fallback: busca recursiva em toda a árvore (cobre variações de estrutura)
    || encontrarInfoNFe(result)

  if (!infNFe) {
    const chaves = Object.keys(result).join(', ')
    throw new Error(`Estrutura NF-e inválida — infNFe não encontrado. Chaves no root: [${chaves}]`)
  }

  const inf = infNFe as Record<string, unknown>
  const chave = getText(inf['@_Id'] || '').replace('NFe', '')
  const ide = (inf.ide || {}) as Record<string, unknown>
  const emit = (inf.emit || {}) as Record<string, unknown>
  const dest = (inf.dest || {}) as Record<string, unknown>
  const transp = (inf.transp || {}) as Record<string, unknown>
  const infAdic = (inf.infAdic || {}) as Record<string, unknown>
  const total = (((inf.total || {}) as Record<string, unknown>).ICMSTot || {}) as Record<string, unknown>

  const det = inf.det
  const detArray = Array.isArray(det) ? det : det ? [det] : []
  const itens: NFeItem[] = detArray.map((d: unknown) => {
    const prod = ((d as Record<string, unknown>).prod || {}) as Record<string, unknown>
    const imposto = ((d as Record<string, unknown>).imposto || {}) as Record<string, unknown>
    const icms = primeiroFilho(imposto.ICMS as Record<string, unknown> | undefined)
    const ipi = primeiroFilho((imposto.IPI as Record<string, unknown> | undefined)?.IPITrib
      ? { IPITrib: (imposto.IPI as Record<string, unknown>).IPITrib } : undefined)
    const quantidade = getNum(prod.qCom)
    const valor = getNum(prod.vProd)
    return {
      codigo: getText(prod.cProd) || undefined,
      descricao: getText(prod.xProd),
      cfop: getText(prod.CFOP),
      cst: getText(icms.CST !== undefined ? icms.CST : icms.CSOSN) || undefined,
      valor,
      quantidade,
      unidade: getText(prod.uCom),
      ncm: getText(prod.NCM),
      vUnit: getNum(prod.vUnCom) || (quantidade ? valor / quantidade : undefined),
      vBC: getNum(icms.vBC) || undefined,
      vICMS: getNum(icms.vICMS) || undefined,
      pICMS: getNum(icms.pICMS) || undefined,
      vIPI: getNum(ipi.vIPI) || undefined,
      pIPI: getNum(ipi.pIPI) || undefined,
    }
  })

  // Protocolo de autorização — fica em protNFe.infProt na raiz do XML
  const protNFe = ((result.nfeProc || result.NFeProc || result) as Record<string, unknown>).protNFe as Record<string, unknown> | undefined
  const infProt = (protNFe?.infProt || {}) as Record<string, unknown>

  return {
    chave_acesso: chave,
    numero: getText(ide.nNF),
    serie: getText(ide.serie),
    data_emissao: getText(ide.dhEmi || ide.dEmi).substring(0, 10),
    data_saida_entrada: getText(ide.dhSaiEnt || ide.dSaiEnt).substring(0, 10) || undefined,
    // Prefere o CFOP de venda quando há itens mistos (ex: venda + remessa)
    cfop: itens.find(it => ['5101','5102','5103','5104','5105','5106','6101','6102','6103','6104','6105','6106','6107','6108','5401','5403','5405','6401','6403','5124','6124'].includes(it.cfop))?.cfop || itens[0]?.cfop || '',
    // vNFTot inclui IBS+CBS (reforma tributária 2026) — preferir quando disponível
    valor_total: getNum(
      (inf.total as Record<string, unknown>)?.vNFTot ||
      (total as Record<string, unknown>).vNF ||
      (total as Record<string, unknown>).vProd
    ),
    cnpj_emitente: getText(emit.CNPJ).replace(/\D/g, ''),
    razao_emitente: getText(emit.xNome || emit.xFant),
    ie_emitente: getText(emit.IE) || undefined,
    ender_emitente: parseEndereco(emit.enderEmit as Record<string, unknown> | undefined),
    cnpj_destinatario: getText(dest.CNPJ).replace(/\D/g, '') || undefined,
    razao_destinatario: getText(dest.xNome) || undefined,
    ie_destinatario: getText(dest.IE) || undefined,
    ender_destinatario: parseEndereco(dest.enderDest as Record<string, unknown> | undefined),
    natureza_operacao: getText(ide.natOp),
    tipo: getText(ide.tpNF) === '0' ? 'entrada' : 'saida',
    tipo_ambiente: getText(ide.tpAmb) || undefined,
    formato: 'nfe',
    totais: {
      vBC: getNum(total.vBC),
      vICMS: getNum(total.vICMS),
      vBCST: getNum(total.vBCST),
      vICMSST: getNum(total.vST),
      vProd: getNum(total.vProd),
      vFrete: getNum(total.vFrete),
      vSeg: getNum(total.vSeg),
      vDesc: getNum(total.vDesc),
      vOutro: getNum(total.vOutro),
      vIPI: getNum(total.vIPI),
      vNF: getNum(total.vNF || total.vProd),
    },
    modalidade_frete: getText(transp.modFrete) || undefined,
    info_complementares: getText(infAdic.infCpl) || undefined,
    protocolo: getText(infProt.nProt) || undefined,
    data_autorizacao: getText(infProt.dhRecbto).substring(0, 10) || undefined,
    itens,
  }
}

// ─── NFS-e (serviços) — padrão nacional SPED/ABRASF ─────────────────────────
function parseNFSe(result: Record<string, unknown>): NFeParsed {
  // Suporta raiz NFSe ou CompNfse
  const root = result.NFSe || result.CompNfse || result
  const infNFSe = (root as Record<string, unknown>).infNFSe
    || ((root as Record<string, unknown>).NFSe as Record<string, unknown>)?.infNFSe

  if (!infNFSe) throw new Error('Estrutura NFS-e inválida — infNFSe não encontrado')

  const inf = infNFSe as Record<string, unknown>

  // Emitente
  const emit = (inf.emit || {}) as Record<string, unknown>

  // Tomador (dentro de DPS > infDPS > toma)
  const dps = inf.DPS as Record<string, unknown> | undefined
  const infDPS = dps?.infDPS as Record<string, unknown> | undefined
  const toma = infDPS?.toma as Record<string, unknown> | undefined

  // Serviço
  const serv = infDPS?.serv as Record<string, unknown> | undefined
  const cServ = (serv?.cServ || {}) as Record<string, unknown>
  const descServico = getText(cServ.xDescServ) || 'Serviço'
  const cTribNac = getText(cServ.cTribNac) || ''

  // Valores — tenta na raiz e dentro de DPS
  const valoresRaiz = (inf.valores || {}) as Record<string, unknown>
  const valoresDPS = (infDPS?.valores || {}) as Record<string, unknown>
  const vServPrest = (valoresDPS.vServPrest || {}) as Record<string, unknown>

  const valor = getNum(valoresRaiz.vLiq || valoresRaiz.vServ || vServPrest.vServ || 0)

  // Data — dhProc é data de processamento; dhEmi dentro de infDPS é data de emissão
  const dhEmi = getText(infDPS?.dhEmi || inf.dhProc || '')
  const dataEmissao = dhEmi.substring(0, 10)

  // Número
  const numero = getText(inf.nNFSe || inf.nDFSe || '')

  // Chave — usa o atributo Id do infNFSe
  const chave = getText(inf['@_Id'] || `NFS${numero}`)

  const cfop = '5933'

  return {
    chave_acesso: chave,
    numero,
    serie: getText(infDPS?.serie || ''),
    data_emissao: dataEmissao,
    cfop,
    valor_total: valor,
    cnpj_emitente: getText(emit.CNPJ).replace(/\D/g, ''),
    razao_emitente: getText(emit.xNome || emit.xFant),
    cnpj_destinatario: getText(toma?.CNPJ || '').replace(/\D/g, '') || undefined,
    razao_destinatario: getText(toma?.xNome || '') || undefined,
    natureza_operacao: descServico.substring(0, 80),
    tipo: 'saida', // NFS-e emitida = saída de serviço
    formato: 'nfse',
    itens: [{
      descricao: descServico.substring(0, 120),
      cfop,
      valor,
      quantidade: 1,
      unidade: 'UN',
    }],
  }
}

export type NFeEvento = {
  tipo: 'cancelamento' | 'carta_correcao' | 'outro'
  chave_nfe: string        // chave da NF afetada
  numero_protocolo?: string
  data_evento?: string
  justificativa?: string
  descricao: string
}

// Tenta parsear um XML de evento (procEventoNFe / procEventoNFCe)
export function parseEventoNFe(xmlContent: string): NFeEvento | null {
  try {
    const result = parser.parse(xmlContent) as Record<string, unknown>
    const root = (result.procEventoNFe || result.procEventoNFCe) as Record<string, unknown> | undefined
    if (!root) return null

    const evento = root.evento as Record<string, unknown> | undefined
    const retEvento = root.retEvento as Record<string, unknown> | undefined
    const infEvento = (evento?.infEvento || {}) as Record<string, unknown>
    const infRetEvento = (retEvento as Record<string, unknown>)?.infEvento as Record<string, unknown> | undefined

    const chave = getText(infEvento.chNFe)
    const tpEvento = getText(infEvento.tpEvento)
    const dhEvento = getText(infEvento.dhEvento || '').substring(0, 10)
    const nProt = getText(infRetEvento?.nProt || '')

    // detEvento contém a justificativa (cancelamento) ou a correção
    const detEvento = (infEvento.detEvento || {}) as Record<string, unknown>
    const xJust = getText(detEvento.xJust || detEvento.xCorrecao || '')

    // tpEvento: 110111 = Cancelamento NF-e, 110110 = Cancelamento NFC-e, 110112 = CCe
    const tipo: NFeEvento['tipo'] =
      tpEvento === '110111' || tpEvento === '110110' ? 'cancelamento'
      : tpEvento === '110112' ? 'carta_correcao'
      : 'outro'

    const descricao =
      tipo === 'cancelamento' ? `Cancelamento — Protocolo ${nProt || '?'}` :
      tipo === 'carta_correcao' ? `Carta de Correção — Protocolo ${nProt || '?'}` :
      `Evento ${tpEvento}`

    return { tipo, chave_nfe: chave, numero_protocolo: nProt, data_evento: dhEvento, justificativa: xJust, descricao }
  } catch {
    return null
  }
}

// XMLs que não são NF emitida e não são eventos — ignorar silenciosamente
const RAIZES_IGNORAR = new Set(['retInutNFe','inutNFe','retConsStatServ','retConsCad','retEnvLote','consStatServ'])

// ─── Detector automático ──────────────────────────────────────────────────────
export async function parseNFeXML(xmlContent: string): Promise<NFeParsed> {
  try {
    const result = parser.parse(xmlContent) as Record<string, unknown>

    // Ignora XMLs de consulta/inutilização sem reportar erro
    for (const key of RAIZES_IGNORAR) {
      if (result[key] !== undefined) {
        return {
          chave_acesso: '', numero: '', serie: '', data_emissao: '',
          cfop: '', valor_total: 0, cnpj_emitente: '', razao_emitente: '',
          natureza_operacao: '', tipo: 'saida', formato: 'nfe', itens: [],
          erro: 'Arquivo ignorado: XML de consulta/inutilização',
        }
      }
    }

    // Eventos (cancelamento, CCe) — sinaliza para o importador tratar separadamente
    if (result.procEventoNFe !== undefined || result.procEventoNFCe !== undefined) {
      return {
        chave_acesso: '', numero: '', serie: '', data_emissao: '',
        cfop: '', valor_total: 0, cnpj_emitente: '', razao_emitente: '',
        natureza_operacao: '', tipo: 'saida', formato: 'nfe', itens: [],
        erro: '__evento__',  // flag especial — o importador vai tratar
      }
    }

    // Detecta pelo namespace ou elemento raiz
    const isNFSe =
      xmlContent.includes('nfse.gov.br') ||
      xmlContent.includes('<NFSe') ||
      xmlContent.includes('<CompNfse') ||
      xmlContent.includes('infNFSe')

    const parsed = isNFSe ? parseNFSe(result) : parseNFe(result)
    parsed.xmlOriginal = xmlContent
    return parsed
  } catch (err) {
    return {
      chave_acesso: '', numero: '', serie: '', data_emissao: '',
      cfop: '', valor_total: 0, cnpj_emitente: '', razao_emitente: '',
      natureza_operacao: '', tipo: 'saida', formato: 'nfe', itens: [],
      erro: err instanceof Error ? err.message : 'Erro desconhecido ao parsear XML',
    }
  }
}

// ─── Processa múltiplos arquivos ──────────────────────────────────────────────
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

// ─── Categoria do documento (entrada / saída / cupom) ─────────────────────────
// O modelo do documento fica nas posições 21-22 da chave de acesso (44 dígitos):
// 55 = NF-e, 65 = NFC-e (cupom fiscal eletrônico)
export type CategoriaDanfe = 'entrada' | 'saida' | 'cupom'

export function getCategoriaDanfe(nf: NFeParsed): CategoriaDanfe {
  const modelo = nf.chave_acesso?.length === 44 ? nf.chave_acesso.substring(20, 22) : ''
  if (modelo === '65') return 'cupom'
  return nf.tipo === 'entrada' ? 'entrada' : 'saida'
}

// Competência (mês/ano) de emissão, formato "YYYY-MM"
export function getCompetencia(nf: NFeParsed): string {
  return nf.data_emissao?.substring(0, 7) || ''
}

// ─── Exporta o XML com os itens editados ──────────────────────────────────────
// Preserva atributos como string (evita "versao=4.00" virar "versao=4")
const parserPreservaAtributos = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
})

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true,
})

// Reaplica os valores editados de nf.itens sobre o XML original e devolve o XML resultante.
// Observação: a edição invalida a assinatura digital da NF-e — o arquivo gerado serve para
// conferência/registro interno, não para reenvio à SEFAZ.
export function gerarXmlEditado(nf: NFeParsed): string {
  if (!nf.xmlOriginal) throw new Error('XML original não disponível para esta nota')

  const result = parserPreservaAtributos.parse(nf.xmlOriginal) as Record<string, unknown>
  delete result['?xml']
  const infNFe = encontrarInfoNFe(result) as Record<string, unknown> | null
  if (!infNFe) return nf.xmlOriginal

  const det = infNFe.det
  const detArray = Array.isArray(det) ? det : det ? [det] : []

  detArray.forEach((d, i) => {
    const item = nf.itens[i]
    const prod = ((d as Record<string, unknown>).prod || {}) as Record<string, unknown>
    if (!item || !prod) return
    prod.xProd = item.descricao
    if (item.ncm) prod.NCM = item.ncm
    prod.CFOP = item.cfop
    prod.vProd = item.valor.toFixed(2)
    if (item.vUnit) prod.vUnCom = item.vUnit.toFixed(10)
  })

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(result)
}
