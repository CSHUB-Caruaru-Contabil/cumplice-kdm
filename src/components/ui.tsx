// Componentes UI reutilizáveis

import React from 'react'

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, ...style,
    }}>
      {children}
    </div>
  )
}

export function CardTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span>{children}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{sub}</span>}
    </div>
  )
}

export function KpiCard({ label, value, delta, deltaType, topColor }: {
  label: string; value: string; delta?: string; deltaType?: 'up' | 'down' | 'warn'; topColor?: string
}) {
  const deltaColor = deltaType === 'up' ? 'var(--green)' : deltaType === 'down' ? 'var(--red)' : 'var(--orange)'
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 18, borderTop: topColor ? `3px solid ${topColor}` : undefined,
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 4px' }}>{value}</div>
      {delta && <div style={{ fontSize: 12, color: deltaType ? deltaColor : 'var(--muted)' }}>{delta}</div>}
    </div>
  )
}

export function Btn({ children, onClick, variant = 'primary', style, disabled }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger';
  style?: React.CSSProperties; disabled?: boolean
}) {
  const colors = {
    primary: { background: 'var(--accent)', color: 'white', border: 'none' },
    ghost: { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1, ...colors[variant], ...style,
      }}
    >
      {children}
    </button>
  )
}

export function Badge({ children, variant = 'ok' }: {
  children: React.ReactNode; variant?: 'ok' | 'warn' | 'err' | 'pending'
}) {
  const styles = {
    ok: { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' },
    warn: { background: 'rgba(249,115,22,0.15)', color: '#fdba74' },
    err: { background: 'rgba(239,68,68,0.15)', color: '#fca5a5' },
    pending: { background: 'rgba(100,116,139,0.2)', color: '#94a3b8' },
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
      padding: '3px 9px', borderRadius: 20, ...styles[variant],
    }}>
      {children}
    </span>
  )
}

export function Tag({ children, variant = 'red' }: {
  children: React.ReactNode; variant?: 'red' | 'orange' | 'yellow' | 'green' | 'purple'
}) {
  const styles = {
    red: { background: 'rgba(239,68,68,0.15)', color: '#fca5a5' },
    orange: { background: 'rgba(249,115,22,0.15)', color: '#fdba74' },
    yellow: { background: 'rgba(234,179,8,0.15)', color: '#fde047' },
    green: { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' },
    purple: { background: 'rgba(108,99,255,0.15)', color: 'var(--accent2)' },
  }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      whiteSpace: 'nowrap', flexShrink: 0, ...styles[variant],
    }}>
      {children}
    </span>
  )
}

export function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      <input
        {...props}
        style={{
          background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
          padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

export function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      <select
        {...props}
        style={{
          background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
          padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none', cursor: 'pointer',
        }}
      >
        {children}
      </select>
    </div>
  )
}

export function UploadZone({ icon, label, sub, onFiles, accept }: {
  icon: string; label: string; sub: string; onFiles: (files: File[]) => void; accept?: string
}) {
  const inputId = `upload-${label.replace(/\s/g, '-').toLowerCase()}`
  return (
    <div
      onClick={() => document.getElementById(inputId)?.click()}
      style={{
        border: '2px dashed var(--border)', borderRadius: 10, padding: 28, textAlign: 'center',
        cursor: 'pointer', color: 'var(--muted)', transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
        ;(e.currentTarget as HTMLElement).style.color = 'var(--accent2)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLElement).style.color = 'var(--muted)'
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>
      <input
        type="file"
        id={inputId}
        style={{ display: 'none' }}
        multiple
        accept={accept}
        onChange={e => e.target.files && onFiles(Array.from(e.target.files))}
      />
    </div>
  )
}

export function AlertBar({ children, variant = 'error' }: { children: React.ReactNode; variant?: 'error' | 'warn' }) {
  const colors = variant === 'error'
    ? { background: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' }
    : { background: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' }
  return (
    <div style={{
      ...colors, border: `1px solid ${colors.border}`,
      borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
    }}>
      {children}
    </div>
  )
}

export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '8px 12px', color: 'var(--muted)',
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                borderBottom: '1px solid var(--border)',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </tr>
  )
}

export function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td style={{
      padding: '10px 12px', color: 'var(--text)', verticalAlign: 'middle',
      fontFamily: mono ? "'Courier New', monospace" : undefined, fontSize: mono ? 12 : undefined,
    }}>
      {children}
    </td>
  )
}

export function Toast({ msg, onHide }: { msg: string; onHide: () => void }) {
  const isError = msg.toLowerCase().startsWith('erro')
  React.useEffect(() => {
    const t = setTimeout(onHide, isError ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [onHide, isError])

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)',
      border: '1px solid var(--green)', color: 'var(--text)', padding: '12px 18px',
      borderRadius: 10, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center',
      gap: 8, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      borderColor: isError ? 'var(--red)' : 'var(--green)',
    }}>
      {isError ? '❌' : '✅'} {msg}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ title, children, onClose }: {
  title: string; children: React.ReactNode; onClose: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20,
            cursor: 'pointer', lineHeight: 1, padding: '0 4px',
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── ConfirmDelete ────────────────────────────────────────────────────────────
export function ConfirmDelete({ msg = 'Excluir este registro?', onConfirm, onCancel }: {
  msg?: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--red)', borderRadius: 12,
        padding: '24px 28px', maxWidth: 360, textAlign: 'center',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 20 }}>{msg}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)',
            padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600,
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5',
            padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 700,
          }}>Excluir</button>
        </div>
      </div>
    </div>
  )
}

// ─── RowActions ───────────────────────────────────────────────────────────────
export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={onEdit} title="Editar" style={{
        background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)',
        color: 'var(--accent2)', width: 28, height: 28, borderRadius: 6,
        cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✏️</button>
      <button onClick={onDelete} title="Excluir" style={{
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
        color: '#fca5a5', width: 28, height: 28, borderRadius: 6,
        cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>🗑️</button>
    </div>
  )
}

/** Formata número como moeda BRL. Retorna "R$ —" para valores inválidos. */
export function brl(valor: number | null | undefined): string {
  if (valor == null || !isFinite(valor) || isNaN(valor)) return 'R$ —'
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/** Formata percentual com N casas decimais. Retorna "—%" para valores inválidos. */
export function pct(valor: number | null | undefined, casas = 1): string {
  if (valor == null || !isFinite(valor) || isNaN(valor)) return '—%'
  return `${valor.toFixed(casas)}%`
}
