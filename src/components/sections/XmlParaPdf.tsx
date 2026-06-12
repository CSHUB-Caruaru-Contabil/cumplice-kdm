'use client'

import { useState, useEffect, Fragment } from 'react'
import { Card, CardTitle, Btn, Toast, UploadZone } from '@/components/ui'
import { parseMultiplosXML, getCategoriaDanfe, getCompetencia, gerarXmlEditado, type NFeParsed, type NFeItem, type CategoriaDanfe } from '@/lib/parsers/nfe'
import { gerarPdfNFe } from '@/lib/parsers/nfe-pdf'
import { classificarCFOP } from '@/lib/cfop'
import { FileDown, FileCode, Sparkles, Trash2 } from 'lucide-react'
import JSZip from 'jszip'

const STORAGE_KEY = 'xmlParaPdf:notas'

const FILTROS_CATEGORIA: { valor: CategoriaDanfe | 'todas'; label: string }[] = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'entrada', label: 'Entrada' },
  { valor: 'saida', label: 'Saída' },
  { valor: 'cupom', label: 'Cupons' },
]

function fmtCompetencia(comp: string): string {
  if (!/^\d{4}-\d{2}$/.test(comp)) return comp || '—'
  const [ano, mes] = comp.split('-')
  return `${mes}/${ano}`
}

type Props = { clienteId?: string }

export default function XmlParaPdf({ clienteId }: Props) {
  const [notas, setNotas] = useState<NFeParsed[]>([])
  const [erros, setErros] = useState<{ arquivo: string; erro: string }[]>([])
  const [processando, setProcessando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [gerandoNota, setGerandoNota] = useState<string | null>(null)
  const [classificandoNota, setClassificandoNota] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaDanfe | 'todas'>('todas')
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>('todas')

  // Restaura notas salvas localmente (persistência entre sessões)
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY)
      if (salvo) setNotas(JSON.parse(salvo))
    } catch {
      // ignora dados corrompidos
    }
  }, [])

  // Persiste alterações localmente
  useEffect(() => {
    try {
      if (notas.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notas))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // ignora falhas de armazenamento (ex: quota excedida)
    }
  }, [notas])

  async function onFiles(files: File[]) {
    setProcessando(true)
    try {
      const { sucesso, erros: errosParse } = await parseMultiplosXML(files)
      setNotas(prev => [...prev, ...sucesso])
      setErros(prev => [...prev, ...errosParse.filter(e => e.erro !== '__evento__')])
      if (sucesso.length === 0 && errosParse.length > 0) {
        setToast('Nenhuma NF-e válida encontrada nos arquivos selecionados')
      }
    } finally {
      setProcessando(false)
    }
  }

  async function baixarBlob(blob: Blob, nomeArquivo: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivo
    a.click()
    URL.revokeObjectURL(url)
  }

  // Gera um PDF (DANFE) individual para cada nota filtrada e baixa tudo em um .zip
  async function gerarPdf() {
    if (notasFiltradas.length === 0) return
    setGerando(true)
    try {
      const zip = new JSZip()
      for (const nf of notasFiltradas) {
        const blob = await gerarPdfNFe([nf])
        zip.file(`nfe-${nf.numero || 'produto'}.pdf`, blob)
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      await baixarBlob(zipBlob, `danfes-${new Date().toISOString().substring(0, 10)}.zip`)
    } catch {
      setToast('Erro ao gerar PDF')
    } finally {
      setGerando(false)
    }
  }

  async function gerarPdfNota(nf: NFeParsed) {
    setGerandoNota(nf.chave_acesso || nf.numero)
    try {
      const blob = await gerarPdfNFe([nf])
      await baixarBlob(blob, `nfe-${nf.numero || 'produto'}.pdf`)
    } catch {
      setToast('Erro ao gerar PDF')
    } finally {
      setGerandoNota(null)
    }
  }

  async function classificarNotaIA(nf: NFeParsed) {
    if (!clienteId) {
      setToast('Cliente não identificado — não foi possível chamar a IA')
      return
    }
    const ni = notas.indexOf(nf)
    setClassificandoNota(nf.chave_acesso || nf.numero)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/classificar-produtos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoDocumento: getCategoriaDanfe(nf),
          itens: nf.itens.map(it => ({ descricao: it.descricao, ncm: it.ncm, cfop: it.cfop })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast(data.erro || 'Erro ao classificar com IA')
        return
      }
      const sugestoes: { ncm: string; cfop: string }[] = data.sugestoes || []
      setNotas(prev => prev.map((n, i) => {
        if (i !== ni) return n
        return {
          ...n,
          itens: n.itens.map((item, idx) => {
            const s = sugestoes[idx]
            if (!s) return item
            return { ...item, ncm: s.ncm || item.ncm, cfop: s.cfop || item.cfop }
          }),
        }
      }))
      setToast('Classificação da IA aplicada — revise antes de gerar o PDF')
    } catch {
      setToast('Erro ao chamar a IA')
    } finally {
      setClassificandoNota(null)
    }
  }

  function baixarXmlNota(nf: NFeParsed) {
    try {
      const xml = gerarXmlEditado(nf)
      const blob = new Blob([xml], { type: 'application/xml' })
      baixarBlob(blob, `nfe-editada-${nf.numero || 'nota'}.xml`)
    } catch {
      setToast('XML original não disponível para esta nota')
    }
  }

  function atualizarItem(notaIdx: number, itemIdx: number, campo: keyof NFeItem, valor: string) {
    setNotas(prev => prev.map((nf, ni) => {
      if (ni !== notaIdx) return nf
      return {
        ...nf,
        itens: nf.itens.map((item, ii) => {
          if (ii !== itemIdx) return item
          if (campo === 'valor' || campo === 'quantidade' || campo === 'vUnit') {
            return { ...item, [campo]: parseFloat(valor.replace(',', '.')) || 0 }
          }
          return { ...item, [campo]: valor }
        }),
      }
    }))
  }

  function limpar() {
    setNotas([])
    setErros([])
  }

  function removerNota(nf: NFeParsed) {
    setNotas(prev => prev.filter(n => n !== nf))
  }

  const competencias = Array.from(new Set(notas.map(getCompetencia).filter(Boolean))).sort()

  const notasFiltradas = notas.filter(nf =>
    (filtroCategoria === 'todas' || getCategoriaDanfe(nf) === filtroCategoria) &&
    (filtroCompetencia === 'todas' || getCompetencia(nf) === filtroCompetencia)
  )

  const totalItens = notasFiltradas.reduce((s, n) => s + n.itens.length, 0)

  return (
    <div>
      <Card className="mb-4">
        <CardTitle sub="Converte XMLs de NF-e em um PDF com a lista de produtos, NCM e CFOP de cada item">
          Conversor XML → PDF (análise de produtos)
        </CardTitle>
        <p className="text-xs text-muted-foreground mb-3">
          Arraste os XMLs de NF-e (entrada ou saída) para gerar um PDF com a tabela de produtos
          de cada nota — descrição, NCM, CFOP e classificação fiscal — para conferência e
          reclassificação manual.
        </p>
        <UploadZone icon="📄" label="Importar XMLs de NF-e"
          sub={processando ? 'Processando...' : 'Arraste um ou mais arquivos .xml'}
          onFiles={onFiles} accept=".xml" />
      </Card>

      {erros.length > 0 && (
        <Card className="mb-4">
          <CardTitle>Arquivos não reconhecidos</CardTitle>
          {erros.map((e, i) => (
            <div key={i} className="text-xs text-red-400 py-1">
              {e.arquivo}: {e.erro}
            </div>
          ))}
        </Card>
      )}

      {notas.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle sub={`${notasFiltradas.length} de ${notas.length} nota(s) · ${totalItens} item(ns)`}>
              Produtos identificados
            </CardTitle>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={limpar}>Limpar</Btn>
              <Btn onClick={gerarPdf} disabled={gerando || notasFiltradas.length === 0} className="gap-1.5">
                <FileDown className="h-3.5 w-3.5" />
                {gerando ? 'Gerando...' : 'Gerar PDF'}
              </Btn>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex gap-1">
              {FILTROS_CATEGORIA.map(f => (
                <button
                  key={f.valor}
                  onClick={() => setFiltroCategoria(f.valor)}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                    filtroCategoria === f.valor
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {competencias.length > 1 && (
              <select
                value={filtroCompetencia}
                onChange={e => setFiltroCompetencia(e.target.value)}
                className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none"
              >
                <option value="todas">Todas as competências</option>
                {competencias.map(c => (
                  <option key={c} value={c}>{fmtCompetencia(c)}</option>
                ))}
              </select>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">NF</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Produto</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">NCM</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">CFOP</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Classificação</th>
                  <th className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Acumulador</th>
                  <th className="text-right py-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Valor</th>
                </tr>
              </thead>
              <tbody>
                {notasFiltradas.map((nf, idx) => {
                  const ni = notas.indexOf(nf)
                  const chave = nf.chave_acesso || nf.numero
                  return (
                    <Fragment key={`nota-${idx}-${chave}`}>
                      <tr className="bg-secondary/40">
                        <td colSpan={7} className="py-1.5 px-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">
                              NF {nf.numero} · {fmtCompetencia(getCompetencia(nf))}
                            </span>
                            <div className="flex items-center gap-3">
                              {nf.xmlOriginal && (
                                <button
                                  onClick={() => baixarXmlNota(nf)}
                                  title="Baixar XML com os itens editados"
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                                >
                                  <FileCode className="h-3.5 w-3.5" />
                                  XML
                                </button>
                              )}
                              <button
                                onClick={() => classificarNotaIA(nf)}
                                disabled={classificandoNota !== null}
                                title="Classificar NCM/CFOP dos itens com IA"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                {classificandoNota === chave ? 'Classificando...' : 'IA'}
                              </button>
                              <button
                                onClick={() => gerarPdfNota(nf)}
                                disabled={gerandoNota !== null}
                                title="Gerar PDF apenas desta nota"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                              >
                                <FileDown className="h-3.5 w-3.5" />
                                PDF
                              </button>
                              <button
                                onClick={() => removerNota(nf)}
                                title="Remover esta nota da lista"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {nf.itens.map((item, i) => {
                        const info = classificarCFOP(item.cfop)
                        return (
                          <tr key={`${chave}-${idx}-${i}`} className="border-b border-border hover:bg-secondary/50 transition-colors">
                            <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{nf.numero}</td>
                            <td className="py-2 px-3 max-w-[320px]">
                              <input
                                value={item.descricao}
                                onChange={e => atualizarItem(ni, i, 'descricao', e.target.value)}
                                title={item.descricao}
                                className="w-full bg-transparent text-sm text-foreground border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 text-xs whitespace-nowrap">
                              <input
                                value={item.ncm || ''}
                                onChange={e => atualizarItem(ni, i, 'ncm', e.target.value)}
                                className="w-20 bg-transparent text-xs text-muted-foreground border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 text-xs whitespace-nowrap">
                              <input
                                value={item.cfop || ''}
                                onChange={e => atualizarItem(ni, i, 'cfop', e.target.value)}
                                className="w-16 bg-transparent text-xs border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <input
                                value={item.classificacao ?? info.badge}
                                onChange={e => atualizarItem(ni, i, 'classificacao', e.target.value)}
                                className={`w-24 bg-transparent text-[11px] font-semibold ${info.cor} border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 outline-none`}
                              />
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <input
                                value={item.acumulador || ''}
                                onChange={e => atualizarItem(ni, i, 'acumulador', e.target.value)}
                                placeholder="—"
                                className="w-24 bg-transparent text-xs border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 text-right text-sm whitespace-nowrap">
                              <input
                                value={item.valor}
                                onChange={e => atualizarItem(ni, i, 'valor', e.target.value)}
                                className="w-24 bg-transparent text-sm text-right border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 outline-none"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Os campos de produto, NCM, CFOP, classificação, acumulador e valor podem ser editados antes de gerar o PDF. &quot;Gerar PDF&quot; baixa
            um .zip com um PDF (DANFE) para cada nota filtrada. Use o botão &quot;PDF&quot; no cabeçalho de cada nota
            para gerar o PDF de apenas aquela nota. As notas importadas ficam salvas neste navegador entre sessões.
          </p>
        </Card>
      )}

      {toast && <Toast msg={toast} onHide={() => setToast('')} />}
    </div>
  )
}
