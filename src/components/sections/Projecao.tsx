'use client'

import { useState, useEffect } from 'react'
import { calcularSimples, calcularLucroPresumido } from '@/lib/crossref'
import type { Cliente } from '@/lib/supabase/types'
import { Btn, Card, CardTitle, Input, Select, brl, pct } from '@/components/ui'

type Props = { clienteId: string; periodo: string; refresh: number; onRecarregar: () => void; cliente: Cliente }

export default function Projecao({ cliente }: Props) {
  const regimeAtual = (cliente.regime || '').toLowerCase()
  const jaEhPresumido = regimeAtual.includes('presumido')
  const jaEhReal      = regimeAtual.includes('real')
  const jaEhSimples   = regimeAtual.includes('simples')

  const [fat, setFat] = useState(148320)
  const [acum, setAcum] = useState(645200)
  const [folha, setFolha] = useState(18500)
  const [regime, setRegime] = useState<'simples' | 'presumido'>('simples')

  const simples   = calcularSimples(acum, fat)
  const presumido = calcularLucroPresumido(fat)

  // Se já é Presumido, compara com Simples (verificar se migração faz sentido)
  // Se já é Simples, compara com Presumido (padrão)
  const melhor  = simples.imposto <= presumido.total ? 'simples' : 'presumido'
  const economia = Math.abs(simples.imposto - presumido.total)

  const fatorR = folha > 0 && fat > 0 ? (folha / fat * 100).toFixed(1) : '0'

  return (
    <div>
      {/* Parâmetros */}
      <Card style={{ marginBottom: 18, background: 'rgba(108,99,255,0.05)', borderColor: 'rgba(108,99,255,0.3)' }}>
        <CardTitle>⚙️ Parâmetros de Projeção</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
          <Input label="Faturamento Mensal (R$)" type="number" value={String(fat)} onChange={e => setFat(Number(e.target.value))} />
          <Input label="Faturamento Acumulado Ano" type="number" value={String(acum)} onChange={e => setAcum(Number(e.target.value))} />
          <Input label="Folha de Pagamento" type="number" value={String(folha)} onChange={e => setFolha(Number(e.target.value))} />
          <Select label="Regime Atual" value={regime} onChange={e => setRegime(e.target.value as typeof regime)}>
            <option value="simples">Simples Nacional</option>
            <option value="presumido">Lucro Presumido</option>
          </Select>
        </div>
      </Card>

      {/* Cards de regimes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{
          background: melhor === 'simples' ? 'rgba(16,185,129,0.07)' : 'var(--surface2)',
          border: `1px solid ${melhor === 'simples' ? 'var(--green)' : 'var(--border)'}`,
          borderRadius: 10, padding: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Simples Nacional {melhor === 'simples' ? '✓ Recomendado' : ''}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: melhor === 'simples' ? 'var(--green)' : 'var(--text)' }}>
            {brl(simples.imposto)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Alíquota efetiva: {pct(simples.aliquota_efetiva * 100, 2)}
          </div>
          {melhor === 'simples' && (
            <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6, fontWeight: 700 }}>💚 Menor carga tributária</div>
          )}
        </div>

        <div style={{
          background: melhor === 'presumido' ? 'rgba(16,185,129,0.07)' : 'var(--surface2)',
          border: `1px solid ${melhor === 'presumido' ? 'var(--green)' : 'var(--border)'}`,
          borderRadius: 10, padding: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Lucro Presumido {melhor === 'presumido' ? '✓ Recomendado' : ''}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: melhor === 'presumido' ? 'var(--green)' : 'var(--text)' }}>
            {brl(presumido.total)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Alíquota efetiva: {fat > 0 ? pct(presumido.total / fat * 100, 2) : '—%'}
          </div>
          {melhor === 'presumido' && (
            <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6, fontWeight: 700 }}>💚 Menor carga tributária</div>
          )}
        </div>

        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Economia Potencial / Mês
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{brl(economia)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Optando por {melhor === 'simples' ? 'Simples Nacional' : 'Lucro Presumido'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* Breakdown Simples */}
        <Card>
          <CardTitle>Composição do Imposto — Simples Nacional</CardTitle>
          {[
            { label: 'Faturamento do Mês', valor: fat },
            { label: 'Acumulado 12 meses (base)', valor: acum },
            { label: `Alíquota nominal faixa`, valor: null, texto: pct(simples.faixa_aliquota * 100) },
            { label: 'Alíquota efetiva calculada', valor: null, texto: pct(simples.aliquota_efetiva * 100, 2), color: 'var(--accent2)' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: r.color }}>{r.texto || brl(r.valor!)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', borderTop: '2px solid var(--accent)', marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>DAS do Mês</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--green)' }}>{brl(simples.imposto)}</span>
          </div>
        </Card>

        {/* Breakdown Presumido */}
        <Card>
          <CardTitle>Composição — Lucro Presumido</CardTitle>
          {[
            { label: 'PIS (0,65%)', valor: presumido.pis },
            { label: 'COFINS (3%)', valor: presumido.cofins },
            { label: 'IRPJ (base 8% × 15%)', valor: presumido.irpj },
            { label: 'CSLL (base 12% × 9%)', valor: presumido.csll },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>{r.label}</span>
              <span style={{ fontWeight: 700 }}>{brl(r.valor)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', borderTop: '2px solid var(--accent)', marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>Total Presumido</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--gold)' }}>{brl(presumido.total)}</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '10px 12px', borderRadius: 8 }}>
            📌 Fator R: <strong style={{ color: 'var(--text)' }}>{fatorR}%</strong> — {parseFloat(fatorR) >= 28 ? 'Acima de 28% → migrar para Anexo III pode ser mais vantajoso.' : 'Abaixo de 28% → permanece no Anexo V.'}
          </div>
        </Card>
      </div>

      {/* Recomendação — contextual ao regime atual */}
      <Card style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.3)' }}>
        <CardTitle>📌 Recomendação Estratégica</CardTitle>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          {jaEhPresumido ? (
            // Empresa já é Presumido — compara com Simples
            simples.imposto < presumido.total ? (
              <>
                <strong>⚠️ Verificar elegibilidade ao Simples Nacional.</strong> Com o faturamento atual, o Simples Nacional teria carga de{' '}
                <strong>{pct(simples.aliquota_efetiva * 100, 2)}</strong> versus {pct(presumido.total / fat * 100, 2)} no Lucro Presumido.
                Economia potencial de <strong>{brl(economia)}/mês</strong>. Verifique se a empresa é elegível ao Simples.<br /><br />
                📌 <strong>Atenção:</strong> A migração para o Simples tem restrições (vedações, atividades, faturamento). Consulte um especialista antes de decidir.
              </>
            ) : (
              <>
                <strong>✅ Lucro Presumido é a opção mais vantajosa.</strong> Com alíquota efetiva de {pct(presumido.total / fat * 100, 2)},
                o Lucro Presumido é mais econômico que o Simples Nacional ({pct(simples.aliquota_efetiva * 100, 2)}) para o faturamento atual.
                Economia de <strong>{brl(economia)}/mês</strong> em relação ao Simples.<br /><br />
                📌 O regime atual está otimizado. Reavalie anualmente conforme o crescimento do faturamento.
              </>
            )
          ) : melhor === 'simples' ? (
            <>
              <strong>✅ Manter Simples Nacional.</strong> Com faturamento acumulado de {brl(acum)}, a alíquota efetiva de{' '}
              <strong>{pct(simples.aliquota_efetiva * 100, 2)}</strong> é competitiva frente ao Lucro Presumido (
              {fat > 0 ? pct(presumido.total / fat * 100, 2) : '—%'}). A permanência no Simples representa uma economia de{' '}
              <strong>{brl(economia)}/mês</strong>.<br /><br />
              📌 <strong>Ponto de atenção:</strong> Se o faturamento crescer acima de R$ 720.000/ano, reavalie o regime.
            </>
          ) : (
            <>
              <strong>⚠️ Avaliar migração para Lucro Presumido.</strong> O Lucro Presumido apresenta carga de{' '}
              {fat > 0 ? pct(presumido.total / fat * 100, 2) : '—%'} versus {pct(simples.aliquota_efetiva * 100, 2)} no Simples.
              Economia potencial de <strong>{brl(economia)}/mês</strong>.
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
