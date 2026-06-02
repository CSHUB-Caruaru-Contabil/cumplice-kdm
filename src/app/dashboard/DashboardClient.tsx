'use client'

import { useState } from 'react'
import type { Cliente } from '@/lib/supabase/types'
import Sidebar from '@/components/Sidebar'
import VisaoGeral from '@/components/sections/VisaoGeral'
import Compras from '@/components/sections/Compras'
import NotasFiscais from '@/components/sections/NotasFiscais'
import Banco from '@/components/sections/Banco'
import Despesas from '@/components/sections/Despesas'
import Cruzamento from '@/components/sections/Cruzamento'
import Projecao from '@/components/sections/Projecao'
import Config from '@/components/sections/Config'

export type Section =
  | 'visao-geral' | 'compras' | 'notas' | 'banco'
  | 'despesas' | 'cruzamento' | 'projecao' | 'config'

const SECTION_TITLES: Record<Section, [string, string]> = {
  'visao-geral': ['Visão Geral', 'Painel de alertas e KPIs do mês'],
  'compras': ['Compras', 'Registro de compras e notas de entrada'],
  'notas': ['Notas Fiscais', 'NFs emitidas no período'],
  'banco': ['Banco', 'Movimentações bancárias'],
  'despesas': ['Despesas', 'Despesas operacionais do mês'],
  'cruzamento': ['Cruzamento de Dados', 'Divergências identificadas automaticamente'],
  'projecao': ['Projeção Tributária', 'Estimativa de impostos e recomendações'],
  'config': ['Perfil do Cliente', 'Configurações e thresholds de alerta'],
}

// Gera lista de períodos: mês atual + 11 meses anteriores
function gerarPeriodos(): { value: string; label: string }[] {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const periodos = []
  const hoje = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${meses[d.getMonth()]} / ${d.getFullYear()}`
    periodos.push({ value, label })
  }
  return periodos
}

export const PERIODOS_LISTA = gerarPeriodos()

export default function DashboardClient({ clientes }: { clientes: Cliente[] }) {
  const [clienteAtivo, setClienteAtivo] = useState<Cliente | null>(clientes[0] || null)
  const [secao, setSecao] = useState<Section>('visao-geral')
  const [periodo, setPeriodo] = useState(PERIODOS_LISTA[0].value)
  const [refresh, setRefresh] = useState(0)

  function recarregar() { setRefresh(r => r + 1) }

  if (!clienteAtivo) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>Nenhum cliente cadastrado</div>
          <div style={{ fontSize: 13 }}>Adicione um cliente para começar</div>
        </div>
      </div>
    )
  }

  const [titulo, subtitulo] = SECTION_TITLES[secao]

  const sectionProps = { clienteId: clienteAtivo.id, periodo, refresh, onRecarregar: recarregar }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        clientes={clientes}
        clienteAtivo={clienteAtivo}
        secao={secao}
        periodo={periodo}
        onCliente={setClienteAtivo}
        onSecao={setSecao}
        onPeriodo={setPeriodo}
      />

      <main style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div style={{
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          padding: '14px 28px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{titulo}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
              {subtitulo} · {clienteAtivo.razao_social}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={recarregar} style={btnStyle('ghost')}>🔄 Atualizar</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 28px', flex: 1 }}>
          {secao === 'visao-geral' && <VisaoGeral {...sectionProps} cliente={clienteAtivo} />}
          {secao === 'compras' && <Compras {...sectionProps} />}
          {secao === 'notas' && <NotasFiscais {...sectionProps} />}
          {secao === 'banco' && <Banco {...sectionProps} />}
          {secao === 'despesas' && <Despesas {...sectionProps} />}
          {secao === 'cruzamento' && <Cruzamento {...sectionProps} />}
          {secao === 'projecao' && <Projecao {...sectionProps} cliente={clienteAtivo} />}
          {secao === 'config' && <Config {...sectionProps} cliente={clienteAtivo} onAtualizar={recarregar} />}
        </div>
      </main>
    </div>
  )
}

function btnStyle(variant: 'primary' | 'ghost') {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
  }
  if (variant === 'primary') return { ...base, background: 'var(--accent)', color: 'white' }
  return { ...base, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }
}
