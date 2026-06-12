// Gera um PDF no modelo DANFE (Documento Auxiliar da Nota Fiscal Eletrônica)
// simplificado a partir de NF-e/NFC-e/NFS-e parseadas, para apoiar a conferência
// manual de classificação fiscal (CFOP/NCM) e dados gerais da nota.
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import type { NFeParsed, NFeItem } from './nfe'

const PAGE_W = 595.28 // A4 retrato (pt)
const PAGE_H = 841.89
const MARGIN = 20
const CONTENT_W = PAGE_W - MARGIN * 2
const PRETO = rgb(0, 0, 0)
const CINZA_LABEL = rgb(0.35, 0.35, 0.35)
const CINZA_TITULO = rgb(0.85, 0.85, 0.85)

type Fonts = { regular: PDFFont; bold: PDFFont }

function brl(v: number | undefined) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function num(v: number | undefined, dec = 2) {
  return (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function formatDoc(v: string | undefined) {
  const d = (v || '').replace(/\D/g, '')
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  return v || '-'
}

function formatChave(v: string) {
  return (v || '').replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatData(v: string | undefined) {
  if (!v || v.length < 10) return v || '-'
  const [y, m, d] = v.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function formatEndereco(end?: NFeParsed['ender_emitente']) {
  if (!end) return { linha1: '-', linha2: '-' }
  const linha1 = [end.logradouro, end.numero, end.bairro].filter(Boolean).join(', ') || '-'
  const linha2 = [end.municipio && end.uf ? `${end.municipio} - ${end.uf}` : end.municipio || end.uf, end.cep ? `CEP: ${end.cep}` : null]
    .filter(Boolean).join('  ') || '-'
  return { linha1, linha2 }
}

function truncar(texto: string, maxChars: number) {
  return texto.length > maxChars ? texto.slice(0, maxChars - 1) + '…' : texto
}

// Trunca por largura real do texto renderizado, evitando overflow em colunas estreitas
function truncarPorLargura(texto: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(texto, size) <= maxWidth) return texto
  let resultado = texto
  while (resultado.length > 1 && font.widthOfTextAtSize(resultado + '…', size) > maxWidth) {
    resultado = resultado.slice(0, -1)
  }
  return resultado + '…'
}

type Celula = { label?: string; valor: string; w: number; align?: 'left' | 'right' | 'center'; bold?: boolean; size?: number }

// Desenha uma linha de células com borda, label pequeno no topo e valor abaixo
function desenharGrid(page: PDFPage, x: number, yTop: number, h: number, celulas: Celula[], fonts: Fonts): number {
  let cx = x
  for (const c of celulas) {
    page.drawRectangle({ x: cx, y: yTop - h, width: c.w, height: h, borderColor: PRETO, borderWidth: 0.6 })
    const valSize = c.size ?? 8
    const font = c.bold ? fonts.bold : fonts.regular
    const valor = c.valor || ''
    const textW = font.widthOfTextAtSize(valor, valSize)
    let tx = cx + 3
    if (c.align === 'right') tx = cx + c.w - 3 - textW
    else if (c.align === 'center') tx = cx + (c.w - textW) / 2

    if (c.label) {
      page.drawText(c.label, { x: cx + 2, y: yTop - 8, size: 5.5, font: fonts.regular, color: CINZA_LABEL })
      page.drawText(valor, { x: tx, y: yTop - h + 4, size: valSize, font, color: PRETO })
    } else {
      page.drawText(valor, { x: tx, y: yTop - h / 2 - valSize / 2 + 1, size: valSize, font, color: PRETO })
    }
    cx += c.w
  }
  return yTop - h
}

// Barra cinza com o título da seção (ex.: "DESTINATÁRIO / REMETENTE")
function desenharTituloSecao(page: PDFPage, x: number, y: number, w: number, texto: string, fonts: Fonts): number {
  page.drawRectangle({ x, y: y - 11, width: w, height: 11, color: CINZA_TITULO, borderColor: PRETO, borderWidth: 0.6 })
  page.drawText(texto, { x: x + 3, y: y - 8.5, size: 6.5, font: fonts.bold, color: PRETO })
  return y - 11
}

const COLS_ITENS = [
  { label: 'CÓDIGO',   w: 35,  key: 'codigo' as const,    align: 'left' as const },
  { label: 'DESCRIÇÃO DO PRODUTO/SERVIÇO', w: 110, key: 'descricao' as const, align: 'left' as const },
  { label: 'NCM',      w: 42,  key: 'ncm' as const,       align: 'left' as const },
  { label: 'CST',      w: 26,  key: 'cst' as const,       align: 'left' as const },
  { label: 'CFOP',     w: 30,  key: 'cfop' as const,      align: 'left' as const },
  { label: 'UNID',     w: 26,  key: 'unidade' as const,   align: 'left' as const },
  { label: 'QUANT',    w: 35,  key: 'quantidade' as const, align: 'right' as const },
  { label: 'V. UNIT',  w: 45,  key: 'vUnit' as const,     align: 'right' as const },
  { label: 'V. TOTAL', w: 48,  key: 'valor' as const,     align: 'right' as const },
  { label: 'B. ICMS',  w: 42,  key: 'vBC' as const,       align: 'right' as const },
  { label: 'V. ICMS',  w: 38,  key: 'vICMS' as const,     align: 'right' as const },
  { label: 'V. IPI',   w: 35,  key: 'vIPI' as const,      align: 'right' as const },
  { label: '% ICMS',   w: 21,  key: 'pICMS' as const,     align: 'right' as const },
  { label: '% IPI',    w: 22,  key: 'pIPI' as const,      align: 'right' as const },
]

function desenharCabecalhoItens(page: PDFPage, y: number, fonts: Fonts): number {
  y = desenharTituloSecao(page, MARGIN, y, CONTENT_W, 'DADOS DO PRODUTO / SERVIÇO', fonts)
  let x = MARGIN
  const h = 24
  for (const col of COLS_ITENS) {
    page.drawRectangle({ x, y: y - h, width: col.w, height: h, color: CINZA_TITULO, borderColor: PRETO, borderWidth: 0.6 })
    const linhas = col.label.split(' ')
    let ty = y - 7
    for (const linha of linhas) {
      page.drawText(linha, { x: x + 2, y: ty, size: 5.5, font: fonts.bold, color: PRETO })
      ty -= 6
    }
    x += col.w
  }
  return y - h
}

function valorCampoItem(item: NFeItem, key: typeof COLS_ITENS[number]['key']): string {
  switch (key) {
    case 'codigo': return item.codigo || '-'
    case 'descricao': return item.descricao
    case 'ncm': return item.ncm || '-'
    case 'cst': return item.cst || '-'
    case 'cfop': return item.cfop || '-'
    case 'unidade': return item.unidade || '-'
    case 'quantidade': return item.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
    case 'vUnit': return num(item.vUnit)
    case 'valor': return num(item.valor)
    case 'vBC': return num(item.vBC)
    case 'vICMS': return num(item.vICMS)
    case 'vIPI': return num(item.vIPI)
    case 'pICMS': return item.pICMS ? num(item.pICMS) : '-'
    case 'pIPI': return item.pIPI ? num(item.pIPI) : '-'
    default: return ''
  }
}

function desenharLinhaItem(page: PDFPage, y: number, item: NFeItem, fonts: Fonts): number {
  const h = 16
  const size = 6.5
  let x = MARGIN
  for (const col of COLS_ITENS) {
    page.drawRectangle({ x, y: y - h, width: col.w, height: h, borderColor: PRETO, borderWidth: 0.4 })
    const valor = truncarPorLargura(valorCampoItem(item, col.key), fonts.regular, size, col.w - 4)
    const textW = fonts.regular.widthOfTextAtSize(valor, size)
    const tx = col.align === 'right' ? x + col.w - 3 - textW : x + 2
    page.drawText(valor, { x: tx, y: y - h + 5, size, font: fonts.regular, color: PRETO })
    x += col.w
  }
  return y - h
}

// Quebra texto em linhas que cabem em maxWidth
function quebrarLinhas(texto: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean)
  const linhas: string[] = []
  let atual = ''
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p
    if (font.widthOfTextAtSize(tentativa, size) > maxWidth && atual) {
      linhas.push(atual)
      atual = p
    } else {
      atual = tentativa
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

// ── Cabeçalho fixo do DANFE (emitente, identificação, chave, destinatário, impostos) ─
function desenharCabecalhoDanfe(page: PDFPage, nf: NFeParsed, fonts: Fonts): number {
  let y = PAGE_H - MARGIN

  // ── Linha 1: Emitente | Identificação DANFE | Chave de acesso ──────────────
  const h1 = 78
  const wEmit = CONTENT_W * 0.40
  const wDanfe = CONTENT_W * 0.22
  const wChave = CONTENT_W - wEmit - wDanfe

  // Emitente
  page.drawRectangle({ x: MARGIN, y: y - h1, width: wEmit, height: h1, borderColor: PRETO, borderWidth: 0.6 })
  const end = formatEndereco(nf.ender_emitente)
  let ty = y - 11
  page.drawText(truncar(nf.razao_emitente || '-', 48), { x: MARGIN + 4, y: ty, size: 9, font: fonts.bold, color: PRETO })
  ty -= 12
  page.drawText(truncar(end.linha1, 58), { x: MARGIN + 4, y: ty, size: 7, font: fonts.regular, color: PRETO })
  ty -= 10
  page.drawText(truncar(end.linha2, 58), { x: MARGIN + 4, y: ty, size: 7, font: fonts.regular, color: PRETO })
  ty -= 10
  page.drawText(`CNPJ: ${formatDoc(nf.cnpj_emitente)}`, { x: MARGIN + 4, y: ty, size: 7, font: fonts.regular, color: PRETO })
  ty -= 10
  page.drawText(`IE: ${nf.ie_emitente || '-'}`, { x: MARGIN + 4, y: ty, size: 7, font: fonts.regular, color: PRETO })

  // Identificação DANFE
  const xDanfe = MARGIN + wEmit
  page.drawRectangle({ x: xDanfe, y: y - h1, width: wDanfe, height: h1, borderColor: PRETO, borderWidth: 0.6 })
  page.drawText('DANFE', { x: xDanfe + wDanfe / 2 - fonts.bold.widthOfTextAtSize('DANFE', 13) / 2, y: y - 14, size: 13, font: fonts.bold, color: PRETO })
  const sub = 'Documento Auxiliar da Nota Fiscal Eletrônica'
  const linhasSub = quebrarLinhas(sub, fonts.regular, 6, wDanfe - 8)
  let tySub = y - 24
  for (const linha of linhasSub) {
    page.drawText(linha, { x: xDanfe + (wDanfe - fonts.regular.widthOfTextAtSize(linha, 6)) / 2, y: tySub, size: 6, font: fonts.regular, color: PRETO })
    tySub -= 7
  }
  const tipoTxt = nf.tipo === 'entrada' ? '0 - ENTRADA' : '1 - SAÍDA'
  page.drawText(tipoTxt, { x: xDanfe + (wDanfe - fonts.bold.widthOfTextAtSize(tipoTxt, 7.5)) / 2, y: y - 44, size: 7.5, font: fonts.bold, color: PRETO })
  const idNumSerie = `Nº ${nf.numero || '-'}     SÉRIE ${nf.serie || '-'}`
  page.drawText(idNumSerie, { x: xDanfe + (wDanfe - fonts.bold.widthOfTextAtSize(idNumSerie, 8)) / 2, y: y - 58, size: 8, font: fonts.bold, color: PRETO })
  const ambTxt = nf.tipo_ambiente === '2' ? 'AMBIENTE DE HOMOLOGAÇÃO' : 'AMBIENTE DE PRODUÇÃO'
  page.drawText(ambTxt, { x: xDanfe + (wDanfe - fonts.regular.widthOfTextAtSize(ambTxt, 5.5)) / 2, y: y - 70, size: 5.5, font: fonts.regular, color: CINZA_LABEL })

  // Chave de acesso / protocolo
  const xChave = xDanfe + wDanfe
  page.drawRectangle({ x: xChave, y: y - h1, width: wChave, height: h1, borderColor: PRETO, borderWidth: 0.6 })
  page.drawText('CHAVE DE ACESSO', { x: xChave + 4, y: y - 9, size: 5.5, font: fonts.regular, color: CINZA_LABEL })
  page.drawText(formatChave(nf.chave_acesso) || '-', { x: xChave + 4, y: y - 19, size: 7, font: fonts.bold, color: PRETO })
  const consulta = 'Consulte a autenticidade no portal nacional da NF-e: www.nfe.fazenda.gov.br'
  const linhasConsulta = quebrarLinhas(consulta, fonts.regular, 6, wChave - 8)
  let tyConsulta = y - 31
  for (const linha of linhasConsulta) {
    page.drawText(linha, { x: xChave + 4, y: tyConsulta, size: 6, font: fonts.regular, color: PRETO })
    tyConsulta -= 7
  }
  page.drawText('PROTOCOLO DE AUTORIZAÇÃO DE USO', { x: xChave + 4, y: y - 53, size: 5.5, font: fonts.regular, color: CINZA_LABEL })
  const protTxt = nf.protocolo ? `${nf.protocolo}  ${formatData(nf.data_autorizacao)}` : 'Não informado'
  page.drawText(truncar(protTxt, 40), { x: xChave + 4, y: y - 63, size: 7, font: fonts.regular, color: PRETO })

  y -= h1

  // ── Linha 2: Natureza da operação ───────────────────────────────────────────
  y = desenharGrid(page, MARGIN, y, 22, [
    { label: 'NATUREZA DA OPERAÇÃO', valor: truncar(nf.natureza_operacao || '-', 90), w: CONTENT_W },
  ], fonts)

  // ── Linha 3: Destinatário / Remetente ───────────────────────────────────────
  y = desenharTituloSecao(page, MARGIN, y, CONTENT_W, 'DESTINATÁRIO / REMETENTE', fonts)
  const endDest = formatEndereco(nf.ender_destinatario)
  y = desenharGrid(page, MARGIN, y, 22, [
    { label: 'NOME / RAZÃO SOCIAL', valor: truncar(nf.razao_destinatario || '-', 50), w: CONTENT_W * 0.5 },
    { label: 'CNPJ / CPF', valor: formatDoc(nf.cnpj_destinatario), w: CONTENT_W * 0.25 },
    { label: 'DATA DE EMISSÃO', valor: formatData(nf.data_emissao), w: CONTENT_W * 0.25 },
  ], fonts)
  y = desenharGrid(page, MARGIN, y, 22, [
    { label: 'ENDEREÇO', valor: truncar(endDest.linha1, 60), w: CONTENT_W * 0.55 },
    { label: 'MUNICÍPIO / UF / CEP', valor: truncar(endDest.linha2, 40), w: CONTENT_W * 0.30 },
    { label: 'INSCRIÇÃO ESTADUAL', valor: nf.ie_destinatario || '-', w: CONTENT_W * 0.15 },
  ], fonts)

  // ── Linha 4: Cálculo do Imposto ─────────────────────────────────────────────
  y = desenharTituloSecao(page, MARGIN, y, CONTENT_W, 'CÁLCULO DO IMPOSTO', fonts)
  const t = nf.totais
  const wTax = CONTENT_W / 5
  y = desenharGrid(page, MARGIN, y, 22, [
    { label: 'BASE DE CÁLC. DO ICMS', valor: brl(t?.vBC), w: wTax, align: 'right' },
    { label: 'VALOR DO ICMS', valor: brl(t?.vICMS), w: wTax, align: 'right' },
    { label: 'BASE DE CÁLC. ICMS ST', valor: brl(t?.vBCST), w: wTax, align: 'right' },
    { label: 'VALOR DO ICMS ST', valor: brl(t?.vICMSST), w: wTax, align: 'right' },
    { label: 'VALOR DO IPI', valor: brl(t?.vIPI), w: wTax, align: 'right' },
  ], fonts)
  const wTax2 = CONTENT_W / 6
  y = desenharGrid(page, MARGIN, y, 22, [
    { label: 'VALOR TOTAL PRODUTOS', valor: brl(t?.vProd), w: wTax2, align: 'right' },
    { label: 'VALOR DO FRETE', valor: brl(t?.vFrete), w: wTax2, align: 'right' },
    { label: 'VALOR DO SEGURO', valor: brl(t?.vSeg), w: wTax2, align: 'right' },
    { label: 'DESCONTO', valor: brl(t?.vDesc), w: wTax2, align: 'right' },
    { label: 'OUTRAS DESPESAS', valor: brl(t?.vOutro), w: wTax2, align: 'right' },
    { label: 'VALOR TOTAL DA NOTA', valor: brl(nf.valor_total ?? t?.vNF), w: wTax2, align: 'right', bold: true },
  ], fonts)

  // ── Linha 5: Transportador / Volumes ────────────────────────────────────────
  y = desenharTituloSecao(page, MARGIN, y, CONTENT_W, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS', fonts)
  const modFreteTxt: Record<string, string> = {
    '0': '0 - Contratação do Frete por conta do Remetente (CIF)',
    '1': '1 - Contratação do Frete por conta do Destinatário (FOB)',
    '2': '2 - Contratação do Frete por conta de Terceiros',
    '3': '3 - Transporte Próprio por conta do Remetente',
    '4': '4 - Transporte Próprio por conta do Destinatário',
    '9': '9 - Sem Ocorrência de Transporte',
  }
  y = desenharGrid(page, MARGIN, y, 22, [
    { label: 'MODALIDADE DO FRETE', valor: modFreteTxt[nf.modalidade_frete || ''] || '-', w: CONTENT_W },
  ], fonts)

  return y - 4
}

// ── Dados adicionais (informações complementares) ─────────────────────────────
function desenharDadosAdicionais(page: PDFPage, y: number, nf: NFeParsed, fonts: Fonts): number {
  const h = 60
  y = desenharTituloSecao(page, MARGIN, y, CONTENT_W, 'DADOS ADICIONAIS', fonts)
  page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, borderColor: PRETO, borderWidth: 0.6 })
  page.drawText('INFORMAÇÕES COMPLEMENTARES', { x: MARGIN + 3, y: y - 9, size: 5.5, font: fonts.regular, color: CINZA_LABEL })
  const linhas = quebrarLinhas(nf.info_complementares || '-', fonts.regular, 7, CONTENT_W - 8)
  let ty = y - 19
  for (const linha of linhas.slice(0, 6)) {
    page.drawText(linha, { x: MARGIN + 4, y: ty, size: 7, font: fonts.regular, color: PRETO })
    ty -= 9
  }
  return y - h
}

export async function gerarPdfNFe(notas: NFeParsed[]): Promise<Blob> {
  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fonts: Fonts = { regular: fontRegular, bold: fontBold }

  for (const nf of notas) {
    let page = doc.addPage([PAGE_W, PAGE_H])
    let y = desenharCabecalhoDanfe(page, nf, fonts)
    y = desenharCabecalhoItens(page, y, fonts)

    for (const item of nf.itens) {
      if (y < MARGIN + 14) {
        page = doc.addPage([PAGE_W, PAGE_H])
        y = PAGE_H - MARGIN
        y = desenharCabecalhoItens(page, y, fonts)
      }
      y = desenharLinhaItem(page, y, item, fonts)
    }

    if (y - 71 < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
    desenharDadosAdicionais(page, y, nf, fonts)
  }

  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
