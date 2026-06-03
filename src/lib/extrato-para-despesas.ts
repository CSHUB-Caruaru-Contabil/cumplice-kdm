// Mapeamento: categoria OFX → categoria de despesa
// Apenas saídas identificadas como despesas operacionais viram Despesa

export const CATEGORIAS_DESPESA: Record<string, string | null> = {
  // ✅ Categorias que SÃO despesas operacionais reais
  'Folha de Pagamento':    'Folha de Pagamento',
  'Pró-Labore/Salário':    'Pró-Labore',
  'Aluguel':               'Aluguel',
  'Energia Elétrica':      'Energia Elétrica',
  'Telefone/Internet':     'Telefone/Internet',
  'Contabilidade':         'Contabilidade',
  'Marketing':             'Marketing',
  'Manutenção':            'Manutenção',
  'Tecnologia/Software':   'Outro',   // software, sistemas, licenças
  'Serviços Gerais':       'Outro',   // direito autoral, prestação de serviços
  'Imposto/Tributo':       'Outro',   // DAS, DARF, FGTS, GPS

  // ❌ NÃO viram despesa automaticamente
  'Despesa Operacional':   null,  // genérico demais — inclui fornecedores de material
  'Pagamento Fornecedor':  null,  // materiais já estão em Compras
  'Venda de Mercadoria':   null,
  'Recebimento de Duplicata': null,
  'Empréstimo/Aporte':     null,  // investimentos e transferências
  'Outro':                 null,
}

export function categoriaOFXParaDespesa(categoriaOFX: string | null): string | null {
  if (!categoriaOFX) return null
  return CATEGORIAS_DESPESA[categoriaOFX] ?? null
}
