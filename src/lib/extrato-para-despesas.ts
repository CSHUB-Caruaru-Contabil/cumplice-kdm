// Mapeamento: categoria OFX → categoria de despesa
// Apenas saídas identificadas como despesas operacionais viram Despesa

export const CATEGORIAS_DESPESA: Record<string, string | null> = {
  // ✅ Categorias específicas que SÃO despesas operacionais
  'Folha de Pagamento':   'Folha de Pagamento',
  'Pró-Labore/Salário':   'Pró-Labore',
  'Aluguel':              'Aluguel',
  'Energia Elétrica':     'Energia Elétrica',
  'Telefone/Internet':    'Telefone/Internet',
  'Contabilidade':        'Contabilidade',
  'Marketing':            'Marketing',
  'Manutenção':           'Manutenção',

  // ❌ NÃO viram despesa automaticamente:
  'Imposto/Tributo':      null,  // DAS/DARF = lançamento tributário específico
  'Despesa Operacional':  null,  // MUITO GENÉRICO — inclui pagamentos de fornecedor
  'Venda de Mercadoria':  null,  // receita
  'Recebimento de Duplicata': null,
  'Empréstimo/Aporte':    null,
  'Pagamento Fornecedor': null,  // vai para Compras
  'Outro':                null,  // ambíguo
}

export function categoriaOFXParaDespesa(categoriaOFX: string | null): string | null {
  if (!categoriaOFX) return null
  return CATEGORIAS_DESPESA[categoriaOFX] ?? null
}
