'use client'

import type { Cliente } from '@/lib/supabase/types'
import type { Section } from '@/app/dashboard/DashboardClient'
import { PERIODOS_LISTA } from '@/app/dashboard/DashboardClient'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  clientes: Cliente[]
  clienteAtivo: Cliente
  secao: Section
  periodo: string
  onCliente: (c: Cliente) => void
  onSecao: (s: Section) => void
  onPeriodo: (p: string) => void
}

export default function Sidebar({ clientes, clienteAtivo, secao, periodo, onCliente, onSecao, onPeriodo }: Props) {
  const supabase = createClient()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function NavItem({ id, icon, label, badge }: { id: Section; icon: string; label: string; badge?: string | number }) {
    const isActive = secao === id
    return (
      <div
        onClick={() => onSecao(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px',
          cursor: 'pointer', color: isActive ? 'var(--accent2)' : 'var(--muted)',
          fontSize: 13, fontWeight: 500, borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
          background: isActive ? 'rgba(108,99,255,0.1)' : 'transparent',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ width: 18, textAlign: 'center', fontSize: 15 }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {badge !== undefined && (
          <span style={{
            background: typeof badge === 'string' ? 'var(--orange)' : 'var(--red)',
            color: 'white', fontSize: 10, fontWeight: 700,
            padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
          }}>
            {badge}
          </span>
        )}
      </div>
    )
  }

  return (
    <aside style={{
      width: 240, minWidth: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', overflowY: 'auto', zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>⚡ Cúmplice</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Sistema de Inteligência Contábil</div>
      </div>

      {/* Seletor de cliente */}
      <div style={{ padding: '12px 12px 0' }}>
        <select
          value={clienteAtivo.id}
          onChange={e => {
            const c = clientes.find(cl => cl.id === e.target.value)
            if (c) onCliente(c)
          }}
          style={{
            width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '8px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          }}
        >
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.razao_social}</option>
          ))}
        </select>
      </div>

      {/* Card cliente */}
      <div style={{
        margin: '12px 12px 0', background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '14px 14px 12px',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#1a1200',
          fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
          letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8,
        }}>
          ★ Prime
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{clienteAtivo.razao_social}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>CNPJ: {clienteAtivo.cnpj}</div>
        <div style={{
          marginTop: 8, fontSize: 11, background: 'rgba(108,99,255,0.15)', color: 'var(--accent2)',
          padding: '4px 8px', borderRadius: 6, display: 'inline-block',
        }}>
          {clienteAtivo.regime}
        </div>
      </div>

      {/* Navegação */}
      <nav style={{ padding: '8px 0', flex: 1 }}>
        <SectionLabel>Painel</SectionLabel>
        <NavItem id="visao-geral" icon="📊" label="Visão Geral" />

        <SectionLabel>Lançamentos</SectionLabel>
        <NavItem id="compras" icon="🛒" label="Compras" />
        <NavItem id="notas" icon="🧾" label="Notas Fiscais" />
        <NavItem id="banco" icon="🏦" label="Banco" />
        <NavItem id="despesas" icon="💳" label="Despesas" />

        <SectionLabel>Análise</SectionLabel>
        <NavItem id="cruzamento" icon="🔍" label="Cruzamento" badge="!" />
        <NavItem id="projecao" icon="📈" label="Projeção Tributária" />

        <SectionLabel>Configuração</SectionLabel>
        <NavItem id="config" icon="⚙️" label="Perfil do Cliente" />
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select
          value={periodo}
          onChange={e => onPeriodo(e.target.value)}
          style={{
            width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '8px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          }}
        >
          {PERIODOS_LISTA.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--muted)', fontSize: 12, padding: '6px 10px', cursor: 'pointer', width: '100%',
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
      letterSpacing: 1, padding: '12px 20px 4px',
    }}>
      {children}
    </div>
  )
}
