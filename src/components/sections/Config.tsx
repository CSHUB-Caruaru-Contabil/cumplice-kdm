'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/lib/supabase/types'
import { Btn, Card, CardTitle, Input, Select, Toast } from '@/components/ui'

type Props = { clienteId: string; periodo: string; refresh: number; onRecarregar: () => void; cliente: Cliente; onAtualizar: () => void }

export default function Config({ cliente, onAtualizar }: Props) {
  const supabase = createClient()
  const [toast, setToast] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [razao, setRazao] = useState(cliente.razao_social)
  const [cnpj, setCNPJ] = useState(cliente.cnpj)
  const [regime, setRegime] = useState(cliente.regime)
  const [setor, setSetor] = useState(cliente.setor || 'Comércio – Mercado/Supermercado')
  const [responsavel, setResponsavel] = useState(cliente.responsavel || '')
  const [email, setEmail] = useState(cliente.email || '')
  const [telefone, setTelefone] = useState(cliente.telefone || '')
  const [banco, setBanco] = useState(cliente.banco_principal || '')
  const [limiteImposto, setLimiteImposto] = useState(String(cliente.limite_alerta_imposto || 5.5))

  // Thresholds
  const [threshBancoNF, setThreshBancoNF] = useState('500')
  const [threshComprasSemNF, setThreshComprasSemNF] = useState('200')
  const [threshDespSemDoc, setThreshDespSemDoc] = useState('300')
  const [threshSublimite, setThreshSublimite] = useState('80')

  async function salvarPerfil() {
    setSalvando(true)
    await supabase.from('clientes').update({
      razao_social: razao, cnpj, regime, setor, responsavel, email, telefone,
      banco_principal: banco, limite_alerta_imposto: parseFloat(limiteImposto),
    }).eq('id', cliente.id)
    onAtualizar()
    setToast('Perfil salvo com sucesso!')
    setSalvando(false)
  }

  async function salvarThresholds() {
    await supabase.from('thresholds').upsert({
      cliente_id: cliente.id,
      divergencia_banco_nf: parseFloat(threshBancoNF),
      compra_sem_nf: parseFloat(threshComprasSemNF),
      despesa_sem_doc: parseFloat(threshDespSemDoc),
      sublimite_simples_pct: parseFloat(threshSublimite),
    })
    setToast('Configurações salvas!')
  }

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <CardTitle>Perfil do Cliente Prime</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Input label="Razão Social" value={razao} onChange={e => setRazao(e.target.value)} />
          <Input label="CNPJ" value={cnpj} onChange={e => setCNPJ(e.target.value)} />
          <Select label="Regime Tributário" value={regime} onChange={e => setRegime(e.target.value)}>
            <option>Simples Nacional – Anexo I</option>
            <option>Simples Nacional – Anexo II</option>
            <option>Simples Nacional – Anexo III</option>
            <option>Lucro Presumido</option>
            <option>Lucro Real</option>
          </Select>
          <Select label="Setor" value={setor} onChange={e => setSetor(e.target.value)}>
            <option>Comércio – Mercado/Supermercado</option>
            <option>Comércio – Farmácia</option>
            <option>Comércio – Vestuário</option>
            <option>Serviços</option>
            <option>Indústria</option>
          </Select>
          <Input label="Responsável / Sócio" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
          <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} />
          <Input label="Conta Bancária Principal" value={banco} onChange={e => setBanco(e.target.value)} />
          <Input label="Limite Alerta Imposto (%)" type="number" value={limiteImposto} onChange={e => setLimiteImposto(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Btn variant="ghost">Cancelar</Btn>
          <Btn onClick={salvarPerfil} disabled={salvando}>Salvar Perfil</Btn>
        </div>
      </Card>

      <Card>
        <CardTitle>Thresholds de Alertas</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="Divergência Banco × NF acima de (R$)" type="number" value={threshBancoNF} onChange={e => setThreshBancoNF(e.target.value)} />
          <Input label="Compras sem NF acima de (R$)" type="number" value={threshComprasSemNF} onChange={e => setThreshComprasSemNF(e.target.value)} />
          <Input label="Despesas sem comprovante acima de (R$)" type="number" value={threshDespSemDoc} onChange={e => setThreshDespSemDoc(e.target.value)} />
          <Input label="Sublimite Simples — alerta (%)" type="number" value={threshSublimite} onChange={e => setThreshSublimite(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn onClick={salvarThresholds}>Salvar Alertas</Btn>
        </div>
      </Card>

      {toast && <Toast msg={toast} onHide={() => setToast('')} />}
    </div>
  )
}
