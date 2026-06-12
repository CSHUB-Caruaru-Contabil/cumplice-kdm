// Gera um PDF de relatório com os lançamentos bancários selecionados
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import type { BancoLancamento } from '@/lib/supabase/types'

const PAGE_W = 841.89 // A4 paisagem (pt)
const PAGE_H = 595.28
const MARGIN = 30
const CONTENT_W = PAGE_W - MARGIN * 2
const PRETO = rgb(0, 0, 0)
const CINZA_LABEL = rgb(0.4, 0.4, 0.4)
const CINZA_TITULO = rgb(0.88, 0.88, 0.88)
const VERDE = rgb(0.13, 0.55, 0.13)
const VERMELHO = rgb(0.75, 0.18, 0.18)

type Fonts = { regular: PDFFont; bold: PDFFont }

function brl(v: number | undefined) {
  return `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtData(data: string | null | undefined) {
  if (!data) return '—'
  const s = data.substring(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return data
  return `${s.substring(8, 10)}/${s.substring(5, 7)}/${s.substring(0, 4)}`
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'Conciliado',
  parcial: 'Parcialmente',
  sem_nf: 'Sem NF',
  pendente: 'A conciliar',
}

function truncarPorLargura(texto: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(texto, size) <= maxWidth) return texto
  let resultado = texto
  while (resultado.length > 1 && font.widthOfTextAtSize(resultado + '…', size) > maxWidth) {
    resultado = resultado.slice(0, -1)
  }
  return resultado + '…'
}

const COLS = [
  { label: 'DATA',         w: 50,  key: 'data' as const,        align: 'left' as const },
  { label: 'DESCRIÇÃO',    w: 215, key: 'descricao' as const,   align: 'left' as const },
  { label: 'CATEGORIA',    w: 100, key: 'categoria' as const,   align: 'left' as const },
  { label: 'CONTA',        w: 100, key: 'conta' as const,       align: 'left' as const },
  { label: 'TIPO',         w: 50,  key: 'tipo' as const,        align: 'left' as const },
  { label: 'VALOR',        w: 75,  key: 'valor' as const,       align: 'right' as const },
  { label: 'STATUS',       w: 75,  key: 'status' as const,      align: 'left' as const },
  { label: 'COMPROVANTE',  w: 80,  key: 'comprovante' as const, align: 'left' as const },
]

function valorCampo(l: BancoLancamento, key: typeof COLS[number]['key']): string {
  switch (key) {
    case 'data': return fmtData(l.data)
    case 'descricao': return l.descricao
    case 'categoria': return l.categoria || '-'
    case 'conta': return l.conta || '-'
    case 'tipo': return l.tipo === 'entrada' ? 'Entrada' : 'Saída'
    case 'valor': return brl(l.valor)
    case 'status': return STATUS_LABEL[l.status] || l.status
    case 'comprovante': return l.tipo === 'entrada' ? '—' : (l.comprovante_url ? 'Sim' : 'Não')
    default: return ''
  }
}

function desenharCabecalhoTabela(page: PDFPage, y: number, fonts: Fonts): number {
  const h = 18
  let x = MARGIN
  for (const col of COLS) {
    page.drawRectangle({ x, y: y - h, width: col.w, height: h, color: CINZA_TITULO, borderColor: PRETO, borderWidth: 0.6 })
    page.drawText(col.label, { x: x + 4, y: y - 12, size: 7, font: fonts.bold, color: PRETO })
    x += col.w
  }
  return y - h
}

function desenharLinha(page: PDFPage, y: number, l: BancoLancamento, fonts: Fonts): number {
  const h = 16
  const size = 7.5
  let x = MARGIN
  for (const col of COLS) {
    page.drawRectangle({ x, y: y - h, width: col.w, height: h, borderColor: PRETO, borderWidth: 0.4 })
    const valor = truncarPorLargura(valorCampo(l, col.key), fonts.regular, size, col.w - 6)
    const textW = fonts.regular.widthOfTextAtSize(valor, size)
    const tx = col.align === 'right' ? x + col.w - 4 - textW : x + 4
    const cor = col.key === 'tipo' || col.key === 'valor'
      ? (l.tipo === 'entrada' ? VERDE : VERMELHO)
      : PRETO
    page.drawText(valor, { x: tx, y: y - h + 4.5, size, font: fonts.regular, color: cor })
    x += col.w
  }
  return y - h
}

type Opts = {
  titulo?: string
  subtitulo?: string
}

export async function gerarPdfLancamentosBancarios(lancamentos: BancoLancamento[], opts: Opts = {}): Promise<Blob> {
  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fonts: Fonts = { regular: fontRegular, bold: fontBold }

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  page.drawText(opts.titulo || 'Relatório de Lançamentos Bancários', { x: MARGIN, y, size: 14, font: fonts.bold, color: PRETO })
  y -= 18
  if (opts.subtitulo) {
    page.drawText(opts.subtitulo, { x: MARGIN, y, size: 9, font: fonts.regular, color: CINZA_LABEL })
    y -= 16
  } else {
    y -= 4
  }

  y = desenharCabecalhoTabela(page, y, fonts)

  for (const l of lancamentos) {
    if (y < MARGIN + 60) {
      page = doc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
      y = desenharCabecalhoTabela(page, y, fonts)
    }
    y = desenharLinha(page, y, l, fonts)
  }

  // ── Totais ──────────────────────────────────────────────────────────────
  const entradas = lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0)
  const saidas = lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0)
  const saldo = entradas - saidas

  if (y < MARGIN + 50) {
    page = doc.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
  }
  y -= 10
  page.drawText(`Total de lançamentos: ${lancamentos.length}`, { x: MARGIN, y, size: 9, font: fonts.regular, color: PRETO })
  y -= 16
  page.drawText(`Entradas: ${brl(entradas)}`, { x: MARGIN, y, size: 9, font: fonts.bold, color: VERDE })
  page.drawText(`Saídas: ${brl(saidas)}`, { x: MARGIN + 140, y, size: 9, font: fonts.bold, color: VERMELHO })
  page.drawText(`Saldo: ${brl(saldo)}`, { x: MARGIN + 280, y, size: 9, font: fonts.bold, color: saldo >= 0 ? VERDE : VERMELHO })

  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
