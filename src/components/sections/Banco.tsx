'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BancoLancamento } from '@/lib/supabase/types'
import {
  Badge, Btn, Card, CardTitle, ConfirmDelete, Input, Modal,
  RowActions, Select, Table, Td, Toast, Tr, UploadZone, brl,
} from '@/components/ui'

type Props = { clienteId: string; periodo: string; refresh: number; onRecarregar: () => void }

const hoje = new Date().toISOString().substring(0, 10)

export default function Banco({ clienteId, periodo, refresh, onRecarregar }: Props) {
  const supabase = createClient()
  const [lancamentos, setLancamentos] = useState<BancoLancamento[]>([])
  const [toast, setToast] = useState('')
  const [editando, setEditando] = useState<BancoLancamento | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)

  const [data, setData] = useState(hoje)
  const [desc, setDesc] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada')
  const [categoria, setCategoria] = useState('Venda de Mercadoria')
  const [nfVinc, setNFVinc] = useState('')
  const [conta, setConta] = useState('Principal')

  const carregar = useCallback(async () => {
    const { data: rows } = await supabase.from('banco_lancamentos').select('*')
      .eq('cliente_id', clienteId).eq('periodo', periodo).order('data', { ascending: false })
    setLancamentos((rows || []) as BancoLancamento[])
  }, [clienteId, periodo])

  useEffect(() => { carregar() }, [carregar, refresh])

  async function adicionar() {
    if (!desc || !valor) return
    setSalvando(true)
    const { error } = await supabase.from('banco_lancamentos').insert({
      cliente_id: clienteId, periodo, data, descricao: desc,
      categoria, tipo, valor: parseFloat(valor),
      nf_vinculada: nfVinc || null, conta,
      status: nfVinc ? 'ok' : (tipo === 'entrada' ? 'pendente' : 'ok'),
    })
    if (error) { setToast(`Erro: ${error.message}`); setSalvando(false); return }
    setDesc(''); setValor(''); setNFVinc('')
    await carregar(); onRecarregar(); setToast('Lançamento adicionado!'); setSalvando(false)
  }

  async function salvarEdicao() {
    if (!editando) return
    const { error } = await supabase.from('banco_lancamentos').update({
      data: editando.data, descricao: editando.descricao,
      categoria: editando.categoria, tipo: editando.tipo,
      valor: editando.valor, nf_vinculada: editando.nf_vinculada || null,
      conta: editando.conta,
    }).eq('id', editando.id)
    if (error) { setToast(`Erro: ${error.message}`); return }
    setEditando(null); await carregar(); onRecarregar(); setToast('Lançamento atualizado!')
  }

  async function confirmarExclusao() {
    if (!excluindo) return
    const { error } = await supabase.from('banco_lancamentos').delete().eq('id', excluindo)
    if (error) { setToast(`Erro: ${error.message}`); setExcluindo(null); return }
    setExcluindo(null); await carregar(); onRecarregar(); setToast('Lançamento excluído!')
  }

  async function importarOFX(files: File[]) {
    if (!files[0]) return
    setImportando(true)
    const formData = new FormData()
    formData.append('file', files[0])
    formData.append('periodo', periodo)
    formData.append('conta', conta)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/importar-banco`, { method: 'POST', body: formData })
      const result = await res.json()
      if (result.erro) {
        setToast(`Erro: ${result.erro}`)
      } else if (result.inseridos === 0 && result.aviso) {
        setToast(`Erro: ${result.aviso}`)
      } else {
        let msg = `${result.inseridos} lançamento(s) importado(s)`
        if (result.fora_periodo > 0) msg += ` · ${result.fora_periodo} fora do período`
        setToast(msg)
        await carregar(); onRecarregar()
      }
    } catch { setToast('Erro: não foi possível processar o arquivo') }
    setImportando(false)
  }

  const entradas = lancamentos.filter(b => b.tipo === 'entrada').reduce((s, b) => s + b.valor, 0)
  const saidas   = lancamentos.filter(b => b.tipo === 'saida').reduce((s, b) => s + b.valor, 0)

  return (
    <div>
      <Card className="mb-4">
        <CardTitle>Lançamento Bancário Manual</CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input label="Data" type="date" value={data} onChange={e => setData(e.target.value)} />
          <Input label="Descrição / Histórico" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Pix recebido..." className="col-span-2 md:col-span-1" />
          <Input label="Valor (R$)" type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
          <Select label="Tipo" value={tipo} onChange={e => setTipo(e.target.value as 'entrada' | 'saida')}>
            <option value="entrada">Entrada (Crédito)</option>
            <option value="saida">Saída (Débito)</option>
          </Select>
          <Select label="Categoria" value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option>Venda de Mercadoria</option>
            <option>Recebimento de Duplicata</option>
            <option>Empréstimo/Aporte</option>
            <option>Pagamento Fornecedor</option>
            <option>Despesa Operacional</option>
            <option>Imposto/Tributo</option>
            <option>Pró-Labore/Salário</option>
            <option>Outro</option>
          </Select>
          <Input label="NF Vinculada (opcional)" value={nfVinc} onChange={e => setNFVinc(e.target.value)} placeholder="Nº da NF" />
          <Input label="Conta Bancária" value={conta} onChange={e => setConta(e.target.value)} placeholder="Ex: Itaú CC 12345-6" />
          <div className="flex items-end">
            <Btn onClick={adicionar} disabled={salvando || !desc || !valor} className="w-full justify-center">
              + Adicionar
            </Btn>
          </div>
        </div>
        <div className="mt-4">
          <UploadZone icon="🏦" label="Importar Extrato Bancário (OFX / CSV)"
            sub={importando ? 'Importando...' : 'Exportado do internet banking'}
            onFiles={importarOFX} accept=".ofx,.csv" />
        </div>
      </Card>

      <Card>
        <CardTitle sub={`Entradas: ${brl(entradas)} · Saídas: ${brl(saidas)}`}>
          Movimentações Bancárias
        </CardTitle>
        <Table headers={['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'NF Vinc.', 'Status', '']}>
          {lancamentos.map(b => (
            <Tr key={b.id}>
              <Td>{b.data}</Td>
              <Td>{b.descricao}</Td>
              <Td>{b.categoria}</Td>
              <Td>
                <span className={b.tipo === 'entrada' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {b.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                </span>
              </Td>
              <Td><span className="font-semibold">{brl(b.valor)}</span></Td>
              <Td mono>{b.nf_vinculada || <span className="text-muted-foreground">—</span>}</Td>
              <Td>
                <Badge variant={b.status === 'ok' ? 'ok' : b.status === 'parcial' ? 'warn' : b.status === 'sem_nf' ? 'err' : 'pending'}>
                  {b.status === 'ok' ? '✓ OK' : b.status === 'parcial' ? '⚠ Parcial' : b.status === 'sem_nf' ? '⚠ Sem NF' : '⏳ Pendente'}
                </Badge>
              </Td>
              <Td><RowActions onEdit={() => setEditando({ ...b })} onDelete={() => setExcluindo(b.id)} /></Td>
            </Tr>
          ))}
        </Table>
        {lancamentos.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhum lançamento registrado</p>}
      </Card>

      {editando && (
        <Modal title="Editar Lançamento Bancário" onClose={() => setEditando(null)}>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <Input label="Data" type="date" value={editando.data} onChange={e => setEditando({ ...editando, data: e.target.value })} />
            <Input label="Descrição" value={editando.descricao} onChange={e => setEditando({ ...editando, descricao: e.target.value })} />
            <Input label="Valor (R$)" type="number" value={String(editando.valor)} onChange={e => setEditando({ ...editando, valor: parseFloat(e.target.value) || 0 })} />
            <Select label="Tipo" value={editando.tipo} onChange={e => setEditando({ ...editando, tipo: e.target.value as 'entrada' | 'saida' })}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </Select>
            <Select label="Categoria" value={editando.categoria || ''} onChange={e => setEditando({ ...editando, categoria: e.target.value })}>
              <option>Venda de Mercadoria</option><option>Recebimento de Duplicata</option>
              <option>Empréstimo/Aporte</option><option>Pagamento Fornecedor</option>
              <option>Despesa Operacional</option><option>Imposto/Tributo</option>
              <option>Pró-Labore/Salário</option><option>Outro</option>
            </Select>
            <Input label="NF Vinculada" value={editando.nf_vinculada || ''} onChange={e => setEditando({ ...editando, nf_vinculada: e.target.value || null })} placeholder="Nº da NF" />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <Btn variant="ghost" onClick={() => setEditando(null)}>Cancelar</Btn>
            <Btn onClick={salvarEdicao}>Salvar</Btn>
          </div>
        </Modal>
      )}

      {excluindo && (
        <ConfirmDelete onConfirm={confirmarExclusao} onCancel={() => setExcluindo(null)} />
      )}

      {toast && <Toast msg={toast} onHide={() => setToast('')} />}
    </div>
  )
}
