'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Despesa } from '@/lib/supabase/types'
import { Badge, Btn, Card, CardTitle, Input, Select, Table, Td, Toast, Tr, brl } from '@/components/ui'

type Props = { clienteId: string; periodo: string; refresh: number; onRecarregar: () => void }

const hoje = new Date().toISOString().substring(0, 10)

export default function Despesas({ clienteId, periodo, refresh, onRecarregar }: Props) {
  const supabase = createClient()
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [toast, setToast] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [data, setData] = useState(hoje)
  const [desc, setDesc] = useState('')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState('Aluguel')
  const [doc, setDoc] = useState('')
  const [pagoBanco, setPagoBanco] = useState(true)
  const [dedutivel, setDedutivel] = useState<'sim' | 'parcial' | 'nao'>('sim')

  const carregar = useCallback(async () => {
    const { data: rows } = await supabase.from('despesas').select('*').eq('cliente_id', clienteId).eq('periodo', periodo).order('data', { ascending: false })
    setDespesas((rows || []) as Despesa[])
  }, [clienteId, periodo])

  useEffect(() => { carregar() }, [carregar, refresh])

  async function adicionar() {
    if (!desc || !valor) return
    setSalvando(true)
    await supabase.from('despesas').insert({
      cliente_id: clienteId, periodo, data, descricao: desc,
      valor: parseFloat(valor), categoria, documento: doc || null,
      pago_banco: pagoBanco, dedutivel,
    })
    setDesc(''); setValor(''); setDoc('')
    await carregar()
    onRecarregar()
    setToast('Despesa adicionada!')
    setSalvando(false)
  }

  const total = despesas.reduce((s, d) => s + d.valor, 0)
  const semDoc = despesas.filter(d => d.status === 'sem_doc').reduce((s, d) => s + d.valor, 0)

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <CardTitle>Registrar Despesa</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <Input label="Data" type="date" value={data} onChange={e => setData(e.target.value)} />
          <Input label="Descrição" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Aluguel, Energia..." />
          <Input label="Valor (R$)" type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
          <Select label="Categoria" value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option>Aluguel</option>
            <option>Energia Elétrica</option>
            <option>Folha de Pagamento</option>
            <option>Pró-Labore</option>
            <option>Telefone/Internet</option>
            <option>Contabilidade</option>
            <option>Marketing</option>
            <option>Manutenção</option>
            <option>Outro</option>
          </Select>
          <Input label="Documento Fiscal" value={doc} onChange={e => setDoc(e.target.value)} placeholder="NF, Recibo, Contrato (vazio = sem doc)" />
          <Select label="Pago pelo Banco?" value={pagoBanco ? 'sim' : 'nao'} onChange={e => setPagoBanco(e.target.value === 'sim')}>
            <option value="sim">Sim — Saiu da Conta</option>
            <option value="nao">Não — Caixa / Outro</option>
          </Select>
          <Select label="Dedutível?" value={dedutivel} onChange={e => setDedutivel(e.target.value as typeof dedutivel)}>
            <option value="sim">Sim</option>
            <option value="parcial">Parcialmente</option>
            <option value="nao">Não</option>
          </Select>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Btn onClick={adicionar} disabled={salvando || !desc || !valor} style={{ width: '100%', justifyContent: 'center' }}>
              + Adicionar
            </Btn>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle sub={`Total: ${brl(total)}${semDoc > 0 ? ` · ${brl(semDoc)} sem comprovante ⚠` : ''}`}>
          Despesas do Mês
        </CardTitle>
        <Table headers={['Data', 'Descrição', 'Categoria', 'Valor', 'Documento', 'No Banco', 'Status']}>
          {despesas.map(d => (
            <Tr key={d.id}>
              <Td>{d.data}</Td>
              <Td>{d.descricao}</Td>
              <Td>{d.categoria}</Td>
              <Td>{brl(d.valor)}</Td>
              <Td mono>{d.documento || <span style={{ color: 'var(--red)' }}>Sem doc ⚠</span>}</Td>
              <Td>{d.pago_banco ? '✓ Sim' : 'Não'}</Td>
              <Td><Badge variant={d.status === 'ok' ? 'ok' : 'err'}>{d.status === 'ok' ? '✓ OK' : '⚠ Sem comprovante'}</Badge></Td>
            </Tr>
          ))}
        </Table>
        {despesas.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Nenhuma despesa registrada</div>}
      </Card>

      {toast && <Toast msg={toast} onHide={() => setToast('')} />}
    </div>
  )
}
