// Motor de cruzamento NF × Banco
// Match por valor (±2%) e janela de datas (±3 dias)

import type { BancoLancamento, Compra, Despesa, Divergencia, NotaFiscal } from './supabase/types'
import { ehVenda } from './cfop'

export type ResultadoCruzamento = {
  divergencias: Omit<Divergencia, 'id' | 'created_at'>[]
  conciliacoes: { banco_id: string; nf_id: string; diferenca: number }[]
  estatisticas: {
    total_lancamentos_banco: number
    conciliados: number
    sem_nf: number
    pct_conciliado: number
    valor_receita_nao_declarada: number
    valor_compras_sem_nf: number
    valor_despesas_sem_doc: number
  }
}

const TOLERANCIA_VALOR = 0.02 // 2%
const JANELA_DIAS = 3

function diffDias(dataA: string, dataB: string): number {
  const a = new Date(dataA).getTime()
  const b = new Date(dataB).getTime()
  return Math.abs((a - b) / (1000 * 60 * 60 * 24))
}

function dentroToleranciaPct(v1: number, v2: number, tolerancia: number): boolean {
  if (v1 === 0 && v2 === 0) return true
  const maior = Math.max(v1, v2)
  return Math.abs(v1 - v2) / maior <= tolerancia
}

export function cruzarDados(
  clienteId: string,
  periodo: string,
  bancosEntrada: BancoLancamento[],
  notas: NotaFiscal[],
  compras: Compra[],
  despesas: Despesa[],
  thresholds = { divergencia_banco_nf: 500, compra_sem_nf: 200, despesa_sem_doc: 300 }
): ResultadoCruzamento {
  const divergencias: Omit<Divergencia, 'id' | 'created_at'>[] = []
  const conciliacoes: ResultadoCruzamento['conciliacoes'] = []
  const notasUsadas = new Set<string>()

  // Apenas NFs com CFOP de venda real (5101, 5102, 6101, 6102, 6107, 6108)
  const notasConciliaveis = notas.filter(nf => ehVenda(nf.cfop))

  // ========================================
  // 1. CRUZAMENTO: Entradas Banco × NFs emitidas
  // ========================================
  for (const lanc of bancosEntrada) {
    if (lanc.tipo !== 'entrada' || lanc.valor === 0) continue

    // Já tem NF vinculada manualmente?
    if (lanc.nota_fiscal_id) {
      notasUsadas.add(lanc.nota_fiscal_id)
      conciliacoes.push({ banco_id: lanc.id, nf_id: lanc.nota_fiscal_id, diferenca: 0 })
      continue
    }

    // Tenta match automático — apenas NFs que geram receita real
    const match = notasConciliaveis.find(nf => {
      if (notasUsadas.has(nf.id)) return false
      const valorOk = dentroToleranciaPct(lanc.valor, nf.valor, TOLERANCIA_VALOR)
      const dataOk = diffDias(lanc.data, nf.data) <= JANELA_DIAS
      return valorOk && dataOk
    })

    if (match) {
      notasUsadas.add(match.id)
      const diferenca = Math.abs(lanc.valor - match.valor)
      conciliacoes.push({ banco_id: lanc.id, nf_id: match.id, diferenca })

      // Divergência parcial (valores não iguais mas dentro da tolerância)
      if (diferenca > 0) {
        divergencias.push({
          cliente_id: clienteId,
          periodo,
          tipo: 'receita_nao_declarada',
          severidade: 'baixo',
          valor: diferenca,
          descricao: `Divergência parcial: Banco R$ ${lanc.valor.toLocaleString('pt-BR')} × NF ${match.numero} R$ ${match.valor.toLocaleString('pt-BR')} — diferença R$ ${diferenca.toLocaleString('pt-BR')}`,
          banco_lancamento_id: lanc.id,
          nota_fiscal_id: match.id,
          resolvida: false,
        })
      }
    } else if (lanc.valor >= thresholds.divergencia_banco_nf) {
      // Entrada bancária sem NF correspondente
      divergencias.push({
        cliente_id: clienteId,
        periodo,
        tipo: 'receita_nao_declarada',
        severidade: 'alto',
        valor: lanc.valor,
        descricao: `Entrada bancária sem NF emitida: ${lanc.descricao} — R$ ${lanc.valor.toLocaleString('pt-BR')} em ${lanc.data}`,
        banco_lancamento_id: lanc.id,
        resolvida: false,
      })
    }
  }

  // ========================================
  // 2. COMPRAS SEM NF DE ENTRADA
  // ========================================
  for (const compra of compras) {
    if (compra.status === 'sem_nf' && compra.valor >= thresholds.compra_sem_nf) {
      divergencias.push({
        cliente_id: clienteId,
        periodo,
        tipo: 'compra_sem_nf',
        severidade: compra.valor >= 1000 ? 'alto' : 'medio',
        valor: compra.valor,
        descricao: `Compra sem NF de entrada: ${compra.fornecedor} — R$ ${compra.valor.toLocaleString('pt-BR')} em ${compra.data}`,
        compra_id: compra.id,
        resolvida: false,
      })
    }
  }

  // ========================================
  // 3. DESPESAS SEM COMPROVANTE
  // ========================================
  for (const desp of despesas) {
    if (desp.status === 'sem_doc' && desp.valor >= thresholds.despesa_sem_doc) {
      divergencias.push({
        cliente_id: clienteId,
        periodo,
        tipo: 'despesa_sem_comprovante',
        severidade: 'medio',
        valor: desp.valor,
        descricao: `Despesa sem comprovante fiscal: ${desp.descricao} — R$ ${desp.valor.toLocaleString('pt-BR')} em ${desp.data}`,
        despesa_id: desp.id,
        resolvida: false,
      })
    }
  }

  // ========================================
  // ESTATÍSTICAS
  // ========================================
  const entradas = bancosEntrada.filter(b => b.tipo === 'entrada' && b.valor > 0)
  const conciliadosCount = conciliacoes.length
  const semNF = entradas.length - conciliadosCount

  const valorReceitaNaoDeclarada = divergencias
    .filter(d => d.tipo === 'receita_nao_declarada' && d.severidade === 'alto')
    .reduce((s, d) => s + (d.valor || 0), 0)

  const valorComprasSemNF = compras
    .filter(c => c.status === 'sem_nf')
    .reduce((s, c) => s + c.valor, 0)

  const valorDespSemDoc = despesas
    .filter(d => d.status === 'sem_doc')
    .reduce((s, d) => s + d.valor, 0)

  return {
    divergencias,
    conciliacoes,
    estatisticas: {
      total_lancamentos_banco: entradas.length,
      conciliados: conciliadosCount,
      sem_nf: semNF,
      pct_conciliado: entradas.length ? Math.round((conciliadosCount / entradas.length) * 1000) / 10 : 100,
      valor_receita_nao_declarada: valorReceitaNaoDeclarada,
      valor_compras_sem_nf: valorComprasSemNF,
      valor_despesas_sem_doc: valorDespSemDoc,
    },
  }
}

// Cálculo Simples Nacional (tabela 2024 Anexo I — Comércio)
const SIMPLES_TABELA = [
  { limite: 180000, aliquota: 0.04, deducao: 0 },
  { limite: 360000, aliquota: 0.073, deducao: 5940 },
  { limite: 720000, aliquota: 0.095, deducao: 13860 },
  { limite: 1800000, aliquota: 0.107, deducao: 22500 },
  { limite: 3600000, aliquota: 0.143, deducao: 87300 },
  { limite: 4800000, aliquota: 0.19, deducao: 378000 },
]

export function calcularSimples(fat12meses: number, fatMes: number) {
  // Sem faturamento acumulado não é possível calcular alíquota efetiva
  if (!fat12meses || fat12meses <= 0) {
    return { imposto: 0, aliquota_efetiva: 0, faixa_aliquota: 0.04, faixa_deducao: 0 }
  }
  if (!fatMes || fatMes <= 0) {
    return { imposto: 0, aliquota_efetiva: 0, faixa_aliquota: 0.04, faixa_deducao: 0 }
  }
  const faixa = SIMPLES_TABELA.find(f => fat12meses <= f.limite) || SIMPLES_TABELA[SIMPLES_TABELA.length - 1]
  const aliqEfetiva = Math.max(0, (fat12meses * faixa.aliquota - faixa.deducao) / fat12meses)
  return {
    imposto: fatMes * aliqEfetiva,
    aliquota_efetiva: aliqEfetiva,
    faixa_aliquota: faixa.aliquota,
    faixa_deducao: faixa.deducao,
  }
}

export function calcularLucroPresumido(fatMes: number) {
  const bcIRPJ = fatMes * 0.08
  const bcCSLL = fatMes * 0.12
  const pis = fatMes * 0.0065
  const cofins = fatMes * 0.03
  const irpj = bcIRPJ * 0.15
  const csll = bcCSLL * 0.09
  return { total: pis + cofins + irpj + csll, pis, cofins, irpj, csll }
}
