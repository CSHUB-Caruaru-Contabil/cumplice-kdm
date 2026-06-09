'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DocumentoSped } from '@/lib/supabase/types'
import { Card, CardTitle, Table, Td, Toast, Tr, UploadZone, brl, fmtData } from '@/components/ui'

type Props = { clienteId: string; periodo: string; refresh: number; onRecarregar: () => void }

const CLASSIFICACAO_LABEL: Record<string, string> = {
  venda: 'Venda',
  compra: 'Compra',
  devolucao: 'Devolução (saída)',
  devolucao_entrada: 'Devolução (entrada)',
  remessa: 'Remessa',
  retorno_remessa: 'Retorno de remessa',
  entrada_remessa: 'Entrada de remessa',
  industrializacao: 'Industrialização',
  ativo_imobilizado: 'Ativo imobilizado',
  uso_consumo: 'Uso e consumo',
  outros: 'Outros',
}

const CLASSIFICACAO_COR: Record<string, string> = {
  venda: 'text-green-400',
  compra: 'text-blue-400',
  devolucao: 'text-orange-400',
  devolucao_entrada: 'text-orange-400',
  remessa: 'text-purple-400',
  retorno_remessa: 'text-purple-400',
  entrada_remessa: 'text-cyan-400',
  industrializacao: 'text-yellow-400',
  ativo_imobilizado: 'text-indigo-400',
  uso_consumo: 'text-slate-400',
  outros: 'text-muted-foreground',
}

export default function Sped({ clienteId, periodo, refresh, onRecarregar }: Props) {
  const supabase = createClient()
  const [documentos, setDocumentos] = useState<DocumentoSped[]>([])
  const [toast, setToast] = useState('')
  const [importando, setImportando] = useState(false)
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    const { data: rows } = await supabase.from('documentos_sped').select('*')
      .eq('cliente_id', clienteId).eq('periodo', periodo).order('data_emissao', { ascending: false }).limit(50000)
    setDocumentos((rows || []) as DocumentoSped[])
  }, [clienteId, periodo])

  useEffect(() => { carregar() }, [carregar, refresh])

  async function importarSped(files: File[]) {
    if (!files[0]) return
    setImportando(true)
    try {
      const formData = new FormData()
      formData.append('file', files[0])

      const res = await fetch(`/api/clientes/${clienteId}/importar-sped`, { method: 'POST', body: formData })
      const result = await res.json()

      if (result.erro) {
        setToast(`Erro: ${result.erro}`)
      } else if (result.aviso) {
        setToast(result.aviso)
      } else {
        let msg = `${result.empresa} (${result.periodo}) — ${result.inseridos} documento(s) importado(s)`
        if (result.atualizados > 0) msg += ` · ${result.atualizados} atualizado(s)`
        if (result.ignorados > 0) msg += ` · ${result.ignorados} ignorado(s) (sem CFOP)`
        setToast(msg)
        await carregar()
        onRecarregar()
      }
    } catch {
      setToast('Erro ao importar arquivo SPED')
    } finally {
      setImportando(false)
    }
  }

  const entradas = documentos.filter(d => d.tipo === 'entrada')
  const saidas = documentos.filter(d => d.tipo === 'saida')
  const totalEntradas = entradas.reduce((s, d) => s + d.valor_total, 0)
  const totalSaidas = saidas.reduce((s, d) => s + d.valor_total, 0)

  // Valor fiscal dos retornos de industrialização: CFOPs 1902, 2902 (retorno de mercadoria enviada
  // para industrialização) e 2923 (venda à ordem — fecha o ciclo da consignação industrial).
  // Os 15 docs CFOP 5929 têm VL_DOC=0 por serem transferências de crédito ICMS (Convênio 29),
  // não movimentação financeira. CFOPs 2911/2912 (remessa para venda/demonstração) são excluídos
  // por representarem operações distintas do ciclo de industrialização.
  const CFOPS_RETORNO_INDUSTRIALIZACAO = ['1902', '2902', '2923']
  const valorRetornoRemessa = documentos
    .filter(d => CFOPS_RETORNO_INDUSTRIALIZACAO.includes(d.cfop))
    .reduce((s, d) => s + d.valor_total, 0)

  // CF-e SAT (MOD=65) são exibidos em card próprio e excluídos do card Venda
  const cupons = documentos.filter(d => d.modelo === '65')
  const totalCupons = cupons.reduce((s, d) => s + d.valor_total, 0)

  const saldosPorClassificacao = (() => {
    const mapa = new Map<string, { qtd: number; valor: number }>()
    for (const d of documentos) {
      if (d.modelo === '65') continue  // CF-e SAT tratado separadamente
      const atual = mapa.get(d.classificacao) || { qtd: 0, valor: 0 }
      atual.qtd += 1
      atual.valor += d.valor_total
      mapa.set(d.classificacao, atual)
    }
    return [...mapa.entries()].sort((a, b) => b[1].valor - a[1].valor)
  })()

  const visiveis = busca.trim()
    ? documentos.filter(d =>
        (d.numero || '').toLowerCase().includes(busca.toLowerCase()) ||
        (d.participante_nome || '').toLowerCase().includes(busca.toLowerCase()) ||
        (d.cfop || '').toLowerCase().includes(busca.toLowerCase())
      )
    : documentos

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <CardTitle>Importar SPED EFD ICMS/IPI</CardTitle>
        <div style={{ marginTop: 14 }}>
          <UploadZone icon="📑" label="Importar SPED EFD ICMS/IPI"
            sub={importando ? 'Processando arquivo...' : 'Arquivo .txt da escrituração fiscal digital — registros C100/C170/C190'}
            onFiles={importarSped} accept=".txt" />
        </div>
      </Card>

      {documentos.length > 0 && (
        <Card style={{ marginBottom: 18 }}>
          <CardTitle sub="Saldos consolidados a partir dos documentos escriturados no SPED">Saldos do Período</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 12 }}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Entradas</div>
              <div className="text-lg font-bold text-foreground">{brl(totalEntradas)}</div>
              <div className="text-xs text-muted-foreground">{entradas.length} documento(s)</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saídas</div>
              <div className="text-lg font-bold text-foreground">{brl(totalSaidas)}</div>
              <div className="text-xs text-muted-foreground">{saidas.length} documento(s)</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saldo (Saídas − Entradas)</div>
              <div className="text-lg font-bold text-foreground">{brl(totalSaidas - totalEntradas)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total de Documentos</div>
              <div className="text-lg font-bold text-foreground">{documentos.length}</div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {totalCupons > 0 && (
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs font-semibold text-green-400">CF-e SAT (Cupons)</div>
                <div className="text-base font-bold text-foreground mt-1">{brl(totalCupons)}</div>
                <div className="text-[11px] text-muted-foreground">{cupons.length} documento(s)</div>
                <div className="text-[10px] text-muted-foreground mt-1">vendas via PDV (MOD 65)</div>
              </div>
            )}
            {saldosPorClassificacao.filter(([c]) => c !== 'entrada_remessa').map(([classificacao, { qtd, valor }]) => {
              const isRetorno = classificacao === 'retorno_remessa'
              const valorExibido = isRetorno ? valorRetornoRemessa : valor
              return (
                <div key={classificacao} className="rounded-lg border border-border p-3">
                  <div className={`text-xs font-semibold ${CLASSIFICACAO_COR[classificacao] || 'text-muted-foreground'}`}>
                    {CLASSIFICACAO_LABEL[classificacao] || classificacao}
                  </div>
                  <div className="text-base font-bold text-foreground mt-1">{brl(valorExibido)}</div>
                  <div className="text-[11px] text-muted-foreground">{qtd} documento(s)</div>
                  {isRetorno && (
                    <div className="text-[10px] text-muted-foreground mt-1">ref. mercadorias retornadas ao estoque</div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <CardTitle sub={`${documentos.length} documento(s) escriturados no período`}>Documentos do SPED</CardTitle>
        </div>
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por número, participante ou CFOP..."
            className="w-full h-8 rounded-md border border-border bg-secondary text-foreground text-xs pl-8 pr-3 focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <Table headers={['Emissão', 'Tipo', 'Participante', 'CFOP', 'Classificação', 'Nº Doc', 'Valor']}>
          {visiveis.map(d => (
            <Tr key={d.id}>
              <Td>{fmtData(d.data_emissao)}</Td>
              <Td>
                <span className={d.tipo === 'entrada' ? 'text-blue-400 text-xs font-semibold' : 'text-green-400 text-xs font-semibold'}>
                  {d.tipo === 'entrada' ? '⬇ Entrada' : '⬆ Saída'}
                </span>
              </Td>
              <Td>{d.participante_nome || <span className="text-muted-foreground">—</span>}</Td>
              <Td mono>{d.cfop}</Td>
              <Td>
                <span className={`text-xs font-semibold ${CLASSIFICACAO_COR[d.classificacao] || 'text-muted-foreground'}`}>
                  {CLASSIFICACAO_LABEL[d.classificacao] || d.classificacao}
                </span>
              </Td>
              <Td mono>{d.numero}</Td>
              <Td>{brl(d.valor_total)}</Td>
            </Tr>
          ))}
        </Table>
        {visiveis.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhum documento SPED importado para este período.
          </div>
        )}
      </Card>

      {toast && <Toast msg={toast} onHide={() => setToast('')} />}
    </div>
  )
}
