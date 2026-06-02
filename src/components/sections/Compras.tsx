'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Compra } from '@/lib/supabase/types'
import { Badge, Btn, Card, CardTitle, Input, Select, Table, Td, Toast, Tr, UploadZone, brl } from '@/components/ui'
import { parseMultiplosXML } from '@/lib/parsers/nfe'

type Props = { clienteId: string; periodo: string; refresh: number; onRecarregar: () => void }

const hoje = new Date().toISOString().substring(0, 10)

export default function Compras({ clienteId, periodo, refresh, onRecarregar }: Props) {
  const supabase = createClient()
  const [compras, setCompras] = useState<Compra[]>([])
  const [toast, setToast] = useState('')

  // Form state
  const [data, setData] = useState(hoje)
  const [fornecedor, setFornecedor] = useState('')
  const [valor, setValor] = useState('')
  const [nf, setNF] = useState('')
  const [categoria, setCategoria] = useState('Mercadoria para Revenda')
  const [pagamento, setPagamento] = useState('À Vista (Banco)')
  const [cnpjFornecedor, setCNPJ] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)

  const carregar = useCallback(async () => {
    const { data: rows } = await supabase.from('compras').select('*').eq('cliente_id', clienteId).eq('periodo', periodo).order('data', { ascending: false })
    setCompras((rows || []) as Compra[])
  }, [clienteId, periodo])

  useEffect(() => { carregar() }, [carregar, refresh])

  async function adicionar() {
    if (!fornecedor || !valor) return
    setSalvando(true)
    await supabase.from('compras').insert({
      cliente_id: clienteId, periodo, data,
      fornecedor, valor: parseFloat(valor), nf_entrada: nf || null,
      categoria, pagamento, cnpj_fornecedor: cnpjFornecedor || null,
    })
    setFornecedor(''); setValor(''); setNF(''); setCNPJ('')
    await carregar()
    onRecarregar()
    setToast('Compra adicionada!')
    setSalvando(false)
  }

  async function importarXML(files: File[]) {
    setImportando(true)
    const { sucesso, erros } = await parseMultiplosXML(files)

    for (const nfe of sucesso) {
      // Só importa NFs de entrada (tipo 0 = entrada)
      if (nfe.tipo !== 'entrada') continue
      await supabase.from('compras').insert({
        cliente_id: clienteId, periodo,
        data: nfe.data_emissao,
        fornecedor: nfe.razao_emitente,
        cnpj_fornecedor: nfe.cnpj_emitente,
        valor: nfe.valor_total,
        nf_entrada: nfe.numero,
        categoria: 'Mercadoria para Revenda',
        pagamento: 'Importado XML',
      })
    }

    await carregar()
    onRecarregar()
    const msg = `${sucesso.length} NF(s) importada(s)${erros.length ? ` · ${erros.length} erro(s)` : ''}`
    setToast(msg)
    setImportando(false)
  }

  const total = compras.reduce((s, c) => s + c.valor, 0)
  const semNF = compras.filter(c => c.status === 'sem_nf').length

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <CardTitle>Registrar Compra de Mercadoria</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <Input label="Data" type="date" value={data} onChange={e => setData(e.target.value)} />
          <Input label="Fornecedor" value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
          <Input label="Valor (R$)" type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
          <Input label="Nº NF Entrada" value={nf} onChange={e => setNF(e.target.value)} placeholder="Ex: 001234 (vazio = sem NF)" />
          <Select label="Categoria" value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option>Mercadoria para Revenda</option>
            <option>Matéria-Prima</option>
            <option>Embalagens</option>
            <option>Higiene/Limpeza</option>
            <option>Outro</option>
          </Select>
          <Select label="Forma de Pagamento" value={pagamento} onChange={e => setPagamento(e.target.value)}>
            <option>À Vista (Banco)</option>
            <option>Boleto 30d</option>
            <option>Boleto 60d</option>
            <option>Cartão Empresarial</option>
          </Select>
          <Input label="CNPJ Fornecedor" value={cnpjFornecedor} onChange={e => setCNPJ(e.target.value)} placeholder="00.000.000/0001-00" />
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Btn onClick={adicionar} disabled={salvando || !fornecedor || !valor} style={{ width: '100%', justifyContent: 'center' }}>
              + Adicionar
            </Btn>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <UploadZone icon="📂" label="Importar XMLs de NF-e de Entrada" sub={importando ? 'Importando...' : 'Arraste ou clique — XML'}
            onFiles={importarXML} accept=".xml" />
        </div>
      </Card>

      <Card>
        <CardTitle sub={`Total: ${brl(total)} · ${compras.length} lançamentos${semNF > 0 ? ` · ${semNF} sem NF ⚠` : ''}`}>
          Compras do Mês
        </CardTitle>
        <Table headers={['Data', 'Fornecedor', 'Categoria', 'Valor', 'NF Entrada', 'Pagamento', 'Status']}>
          {compras.map(c => (
            <Tr key={c.id}>
              <Td>{c.data}</Td>
              <Td>{c.fornecedor}</Td>
              <Td>{c.categoria}</Td>
              <Td>{brl(c.valor)}</Td>
              <Td mono>{c.nf_entrada || <span style={{ color: 'var(--red)' }}>Sem NF ⚠</span>}</Td>
              <Td>{c.pagamento}</Td>
              <Td><Badge variant={c.status === 'ok' ? 'ok' : 'err'}>{c.status === 'ok' ? '✓ OK' : '⚠ Sem NF'}</Badge></Td>
            </Tr>
          ))}
        </Table>
        {compras.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Nenhuma compra registrada</div>}
      </Card>

      {toast && <Toast msg={toast} onHide={() => setToast('')} />}
    </div>
  )
}
