// Mapeamento: categoria OFX → categoria de despesa
// Apenas saídas identificadas como despesas operacionais viram Despesa

export const CATEGORIAS_DESPESA: Record<string, string | null> = {
  'Folha de Pagamento':   'Folha de Pagamento',
  'Pró-Labore/Salário':   'Pró-Labore',
  'Aluguel':              'Aluguel',
  'Energia Elétrica':     'Energia Elétrica',
  'Telefone/Internet':    'Telefone/Internet',
  'Contabilidade':        'Contabilidade',
  'Marketing':            'Marketing',
  'Manutenção':           'Manutenção',
  'Imposto/Tributo':      'Outro',           // DAS, DARF, GPS, FGTS
  'Despesa Operacional':  'Outro',
  // NÃO viram despesa:
  'Venda de Mercadoria':  null,  // receita
  'Recebimento de Duplicata': null,
  'Empréstimo/Aporte':    null,
  'Pagamento Fornecedor': null,  // vai para Compras
  'Outro':                null,  // ambíguo, não criar automaticamente
}

export function categoriaOFXParaDespesa(categoriaOFX: string | null): string | null {
  if (!categoriaOFX) return null
  return CATEGORIAS_DESPESA[categoriaOFX] ?? null
}
