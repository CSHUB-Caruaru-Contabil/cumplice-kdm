// Classificação de CFOPs para o Sistema Cúmplice
// Validado contra SPED EFD ICMS/IPI — abril/2026 (KDM Confecções)
// Ajustes confirmados com cruzamento Domínio × SPED

export type TipoOperacao =
  | 'venda'             // receita real de venda ou serviço prestado
  | 'devolucao'         // devolução de compra feita pelo próprio estabelecimento (saída)
  | 'devolucao_entrada' // devolução de venda recebida de cliente (entrada)
  | 'remessa'           // movimentação de estoque sem transferência de propriedade
  | 'retorno_remessa'   // retorno físico de mercadoria enviada em remessa
  | 'industrializacao'  // serviço de industrialização contratado de terceiros (custo)
  | 'compra'            // entrada de mercadoria p/ produção ou comercialização
  | 'ativo_imobilizado' // aquisição de bem para o ativo permanente
  | 'uso_consumo'       // material de uso/consumo — não compõe custo de produto
  | 'entrada_remessa'   // recebimento temporário de mercadoria de terceiros
  | 'outros'            // operações não enquadradas — verificar

export interface CFOPInfo {
  tipo: TipoOperacao
  descricao: string
  badge: string           // rótulo curto para exibição na tabela
  cor: string             // classe Tailwind de cor do badge
  impacto: 'positivo' | 'negativo' | 'neutro'
}

// ─── CFOPs confirmados como VENDA (receita real) ─────────────────────────────
export const CFOPS_VENDA = new Set([
  // Venda de produção própria — intra/interestadual
  '5101','5102','5103','5104','5105','5106',
  '6101','6102','6103','6104','6105','6106',
  // Vendas especiais
  '6107','6108',          // ZFM / com retenção ST
  // Vendas com substituição tributária
  '5401','5403','5405',
  '6401','6403',
  // Serviços (NFS-e — ISSQN)
  '5933','6933',
  // Industrialização por encomenda prestada (é receita de serviço)
  '5124','6124',
])

const CFOP_MAP: Record<string, CFOPInfo> = {

  // ══════════════════════════════════════════════════════════════════════════
  // SAÍDAS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Vendas de produto industrializado ────────────────────────────────────
  '5101': { tipo: 'venda', descricao: 'Venda de produto industrializado',                   badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '5102': { tipo: 'venda', descricao: 'Venda de mercadoria adquirida de terceiros',         badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '5103': { tipo: 'venda', descricao: 'Venda de produção fora do estabelecimento',          badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '5104': { tipo: 'venda', descricao: 'Venda de mercadoria fora do estabelecimento',        badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '5105': { tipo: 'venda', descricao: 'Venda de produção ao Governo',                       badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '5106': { tipo: 'venda', descricao: 'Venda de mercadoria a não contribuinte',             badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '6101': { tipo: 'venda', descricao: 'Venda interestadual de produto industrializado',     badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '6102': { tipo: 'venda', descricao: 'Venda interestadual de mercadoria adquirida',        badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '6103': { tipo: 'venda', descricao: 'Venda interestadual de produção fora do estab.',     badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '6104': { tipo: 'venda', descricao: 'Venda interestadual de mercadoria fora do estab.',   badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '6105': { tipo: 'venda', descricao: 'Venda interestadual de produção ao Governo',         badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '6106': { tipo: 'venda', descricao: 'Venda interestadual a não contribuinte',             badge: 'Venda',     cor: 'text-green-400', impacto: 'positivo' },
  '6107': { tipo: 'venda', descricao: 'Venda p/ Zona Franca de Manaus / ALC',               badge: 'Venda ZFM', cor: 'text-green-400', impacto: 'positivo' },
  '6108': { tipo: 'venda', descricao: 'Venda interestadual c/ retenção ICMS-ST',            badge: 'Venda ST',  cor: 'text-green-400', impacto: 'positivo' },

  // ── Vendas c/ substituição tributária ────────────────────────────────────
  '5401': { tipo: 'venda', descricao: 'Venda de produto c/ ICMS-ST',                        badge: 'Venda ST',  cor: 'text-green-400', impacto: 'positivo' },
  '5403': { tipo: 'venda', descricao: 'Venda de mercadoria adquirida c/ ICMS-ST',           badge: 'Venda ST',  cor: 'text-green-400', impacto: 'positivo' },
  '5405': { tipo: 'venda', descricao: 'Venda de mercadoria c/ substituição tributária',     badge: 'Venda ST',  cor: 'text-green-400', impacto: 'positivo' },
  '6401': { tipo: 'venda', descricao: 'Venda interestadual de produto c/ ICMS-ST',          badge: 'Venda ST',  cor: 'text-green-400', impacto: 'positivo' },
  '6403': { tipo: 'venda', descricao: 'Venda interestadual de mercadoria c/ ICMS-ST',       badge: 'Venda ST',  cor: 'text-green-400', impacto: 'positivo' },

  // ── Serviços prestados (NFS-e / ISSQN) ───────────────────────────────────
  '5933': { tipo: 'venda', descricao: 'Prestação de serviço no município (ISSQN)',          badge: 'Serviço',   cor: 'text-green-400', impacto: 'positivo' },
  '6933': { tipo: 'venda', descricao: 'Prestação de serviço interestadual (ISSQN)',         badge: 'Serviço',   cor: 'text-green-400', impacto: 'positivo' },

  // ── Industrialização p/ terceiros (receita de serviço prestado) ──────────
  '5124': { tipo: 'venda', descricao: 'Industrialização efetuada p/ encomendante (estadual)',      badge: 'Serviço',  cor: 'text-green-400', impacto: 'positivo' },
  '6124': { tipo: 'venda', descricao: 'Industrialização efetuada p/ encomendante (interestadual)', badge: 'Serviço',  cor: 'text-green-400', impacto: 'positivo' },

  // ── Devoluções de compra (saída — deduzem saldo de compras) ──────────────
  '5201': { tipo: 'devolucao', descricao: 'Devolução de compra p/ industrialização',        badge: 'Dev.Compra', cor: 'text-orange-400', impacto: 'negativo' },
  '5202': { tipo: 'devolucao', descricao: 'Devolução de compra de mercadoria',              badge: 'Dev.Compra', cor: 'text-orange-400', impacto: 'negativo' },
  '6201': { tipo: 'devolucao', descricao: 'Devolução interestadual de compra p/ industr.',  badge: 'Dev.Compra', cor: 'text-orange-400', impacto: 'negativo' },
  '6202': { tipo: 'devolucao', descricao: 'Devolução interestadual de compra de mercad.',   badge: 'Dev.Compra', cor: 'text-orange-400', impacto: 'negativo' },

  // ── Remessas de saída (movimentação de estoque — NÃO é receita) ──────────
  '5901': { tipo: 'remessa', descricao: 'Remessa p/ industrialização por encomenda',        badge: 'Remessa',    cor: 'text-yellow-400', impacto: 'neutro' },
  '6901': { tipo: 'remessa', descricao: 'Remessa interestadual p/ industrialização',        badge: 'Remessa',    cor: 'text-yellow-400', impacto: 'neutro' },
  '5903': { tipo: 'remessa', descricao: 'Remessa p/ venda fora do estabelecimento',         badge: 'Remessa',    cor: 'text-yellow-400', impacto: 'neutro' },
  '6903': { tipo: 'remessa', descricao: 'Remessa interestadual p/ venda fora do estab.',    badge: 'Remessa',    cor: 'text-yellow-400', impacto: 'neutro' },
  '5910': { tipo: 'remessa', descricao: 'Remessa em bonificação',                           badge: 'Remessa',    cor: 'text-yellow-400', impacto: 'neutro' },
  '6911': { tipo: 'remessa', descricao: 'Remessa p/ armazenagem / depósito',                badge: 'Remessa',    cor: 'text-yellow-400', impacto: 'neutro' },
  '6912': { tipo: 'remessa', descricao: 'Remessa p/ demonstração ou mostruário',            badge: 'Remessa',    cor: 'text-yellow-400', impacto: 'neutro' },
  '6908': { tipo: 'remessa', descricao: 'Retorno de mercadoria depositada em 3º',           badge: 'Remessa',    cor: 'text-yellow-400', impacto: 'neutro' },

  // ── Retorno de remessa (saída — devolve ao remetente) ────────────────────
  '5902': { tipo: 'retorno_remessa', descricao: 'Retorno de industrialização ao encomendante',         badge: 'Retorno', cor: 'text-purple-400', impacto: 'neutro' },
  '6902': { tipo: 'retorno_remessa', descricao: 'Retorno interestadual de industrialização',           badge: 'Retorno', cor: 'text-purple-400', impacto: 'neutro' },
  '5904': { tipo: 'retorno_remessa', descricao: 'Retorno de remessa p/ venda fora do estab.',          badge: 'Retorno', cor: 'text-purple-400', impacto: 'neutro' },
  '6913': { tipo: 'retorno_remessa', descricao: 'Retorno de demonstração ou mostruário',               badge: 'Retorno', cor: 'text-purple-400', impacto: 'neutro' },
  '6923': { tipo: 'retorno_remessa', descricao: 'Retorno de depósito fechado',                         badge: 'Retorno', cor: 'text-purple-400', impacto: 'neutro' },
  // CFOP 5929: lançamento simbólico de crédito ICMS acumulado (Convênio 29/90)
  // VL_DOC = 0 — não representa movimentação financeira real
  '5929': { tipo: 'retorno_remessa', descricao: 'Crédito ICMS acumulado — Conv. 29/90 (simbólico)',    badge: 'Conv.29', cor: 'text-purple-400', impacto: 'neutro' },

  // ── Outras saídas ─────────────────────────────────────────────────────────
  // 5949/6949: validado — inclui bens não vinculados ao ciclo de industrialização
  // (ex.: veículo R$235.000 — cliente WAY, NF 17094)
  '5949': { tipo: 'outros', descricao: 'Outra saída de mercadoria ou serviço',              badge: 'Outros',     cor: 'text-muted-foreground', impacto: 'neutro' },
  '6949': { tipo: 'outros', descricao: 'Outra saída interestadual de mercadoria',           badge: 'Outros',     cor: 'text-muted-foreground', impacto: 'neutro' },

  // ══════════════════════════════════════════════════════════════════════════
  // ENTRADAS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Compras para produção / comercialização ───────────────────────────────
  '1101': { tipo: 'compra', descricao: 'Compra p/ industrialização',                        badge: 'Compra',     cor: 'text-blue-400',   impacto: 'negativo' },
  '2101': { tipo: 'compra', descricao: 'Compra interestadual p/ industrialização',          badge: 'Compra',     cor: 'text-blue-400',   impacto: 'negativo' },
  '1102': { tipo: 'compra', descricao: 'Compra p/ comercialização',                         badge: 'Compra',     cor: 'text-blue-400',   impacto: 'negativo' },
  '2102': { tipo: 'compra', descricao: 'Compra interestadual p/ comercialização',           badge: 'Compra',     cor: 'text-blue-400',   impacto: 'negativo' },
  '2124': { tipo: 'compra', descricao: 'Compra interestadual p/ industrialização (outra)',  badge: 'Compra',     cor: 'text-blue-400',   impacto: 'negativo' },
  '1124': { tipo: 'compra', descricao: 'Compra p/ industrialização (outra)',                badge: 'Compra',     cor: 'text-blue-400',   impacto: 'negativo' },

  // ── Industrialização contratada de terceiros (custo do serviço) ──────────
  // NOTA: 1124/2124 acima são compras de insumo; aqui seriam os CFOPs de serviço
  // Se houver separação necessária, ajustar conforme os CFOPs reais do cliente

  // ── Retorno de remessa (entrada — mercadoria retorna ao estoque) ──────────
  // 1902/2902: retorno físico de mercadoria enviada p/ industrialização
  // 2923: entrada ref. venda à ordem (fecha ciclo de consignação industrial)
  // Estes 3 CFOPs somam exatamente R$1.004.091,06 — validado Domínio abr/2026
  '1902': { tipo: 'retorno_remessa', descricao: 'Retorno de mercadoria enviada p/ industrialização',               badge: 'Ret.Rem.', cor: 'text-purple-400', impacto: 'neutro' },
  '2902': { tipo: 'retorno_remessa', descricao: 'Retorno interestadual de mercadoria remetida p/ industrialização', badge: 'Ret.Rem.', cor: 'text-purple-400', impacto: 'neutro' },
  '2923': { tipo: 'retorno_remessa', descricao: 'Entrada de mercadoria do vendedor remetente em venda à ordem',     badge: 'Ret.Rem.', cor: 'text-purple-400', impacto: 'neutro' },

  // ── Entrada de remessa (recebimento temporário de mercadoria de terceiros) ─
  '1901': { tipo: 'entrada_remessa', descricao: 'Entrada p/ industrialização por encomenda',                badge: 'Ent.Rem.', cor: 'text-cyan-400', impacto: 'neutro' },
  '2901': { tipo: 'entrada_remessa', descricao: 'Entrada interestadual p/ industrialização',                badge: 'Ent.Rem.', cor: 'text-cyan-400', impacto: 'neutro' },
  '2216': { tipo: 'entrada_remessa', descricao: 'Entrada interestadual de mercadoria p/ industrialização',  badge: 'Ent.Rem.', cor: 'text-cyan-400', impacto: 'neutro' },
  '2911': { tipo: 'entrada_remessa', descricao: 'Retorno de remessa p/ venda fora do estabelecimento',      badge: 'Ent.Rem.', cor: 'text-cyan-400', impacto: 'neutro' },
  '2912': { tipo: 'entrada_remessa', descricao: 'Entrada de mercadoria p/ demonstração ou mostruário',      badge: 'Ent.Rem.', cor: 'text-cyan-400', impacto: 'neutro' },

  // ── Devoluções de venda recebidas (cliente devolveu — deduz faturamento) ──
  '1201': { tipo: 'devolucao_entrada', descricao: 'Devolução de venda de produto próprio',                  badge: 'Dev.Venda', cor: 'text-red-400', impacto: 'negativo' },
  '1202': { tipo: 'devolucao_entrada', descricao: 'Devolução de venda de mercadoria adquirida',             badge: 'Dev.Venda', cor: 'text-red-400', impacto: 'negativo' },
  '1203': { tipo: 'devolucao_entrada', descricao: 'Devolução de venda p/ ZFM/ALC (produto próprio)',        badge: 'Dev.Venda', cor: 'text-red-400', impacto: 'negativo' },
  '1204': { tipo: 'devolucao_entrada', descricao: 'Devolução de venda p/ ZFM/ALC (mercadoria)',             badge: 'Dev.Venda', cor: 'text-red-400', impacto: 'negativo' },
  '1410': { tipo: 'devolucao_entrada', descricao: 'Devolução de venda p/ uso e consumo do destinatário',   badge: 'Dev.Venda', cor: 'text-red-400', impacto: 'negativo' },
  '2201': { tipo: 'devolucao_entrada', descricao: 'Devolução interestadual de venda de produto próprio',    badge: 'Dev.Venda', cor: 'text-red-400', impacto: 'negativo' },
  '2202': { tipo: 'devolucao_entrada', descricao: 'Devolução interestadual de venda de mercadoria',         badge: 'Dev.Venda', cor: 'text-red-400', impacto: 'negativo' },
  '2203': { tipo: 'devolucao_entrada', descricao: 'Devolução interestadual de venda p/ ZFM/ALC',            badge: 'Dev.Venda', cor: 'text-red-400', impacto: 'negativo' },
  '2410': { tipo: 'devolucao_entrada', descricao: 'Devolução interestadual de venda p/ uso e consumo',      badge: 'Dev.Venda', cor: 'text-red-400', impacto: 'negativo' },

  // ── Uso e consumo (não compõe custo de mercadoria/produto) ───────────────
  '1407': { tipo: 'uso_consumo', descricao: 'Compra de mercadoria p/ uso e consumo c/ ICMS-ST',             badge: 'Uso/Cons.', cor: 'text-slate-400', impacto: 'negativo' },
  '1556': { tipo: 'uso_consumo', descricao: 'Compra de material p/ uso ou consumo',                         badge: 'Uso/Cons.', cor: 'text-slate-400', impacto: 'negativo' },
  '2556': { tipo: 'uso_consumo', descricao: 'Compra interestadual de material p/ uso ou consumo',           badge: 'Uso/Cons.', cor: 'text-slate-400', impacto: 'negativo' },

  // ── Ativo imobilizado ─────────────────────────────────────────────────────
  '1551': { tipo: 'ativo_imobilizado', descricao: 'Aquisição de bem p/ ativo imobilizado',                  badge: 'Imobiliz.', cor: 'text-indigo-400', impacto: 'negativo' },
  '2551': { tipo: 'ativo_imobilizado', descricao: 'Aquisição interestadual de bem p/ ativo imobilizado',    badge: 'Imobiliz.', cor: 'text-indigo-400', impacto: 'negativo' },
}

export function classificarCFOP(cfop: string | null | undefined): CFOPInfo {
  if (!cfop) return { tipo: 'outros', descricao: 'Sem CFOP', badge: '—', cor: 'text-muted-foreground', impacto: 'neutro' }

  const clean = cfop.trim()
  if (CFOP_MAP[clean]) return CFOP_MAP[clean]

  // ── Inferência por prefixo quando o CFOP não está no mapa ────────────────
  const p = clean[0]

  if (p === '5' || p === '6') {
    if (CFOPS_VENDA.has(clean)) return { tipo: 'venda',     descricao: `CFOP ${clean}`, badge: 'Venda',    cor: 'text-green-400',           impacto: 'positivo' }
    const seg = clean.substring(0, 2)
    if (seg === '52' || seg === '62') return { tipo: 'devolucao',  descricao: `CFOP ${clean}`, badge: 'Dev.Compra', cor: 'text-orange-400', impacto: 'negativo' }
    if (seg === '59' || seg === '69') return { tipo: 'remessa',    descricao: `CFOP ${clean}`, badge: 'Remessa',    cor: 'text-yellow-400', impacto: 'neutro'   }
    return                                   { tipo: 'outros',     descricao: `CFOP ${clean}`, badge: clean,        cor: 'text-muted-foreground',  impacto: 'neutro' }
  }

  if (p === '1' || p === '2') {
    const seg = clean.substring(0, 2)
    if (seg === '12' || seg === '22') return { tipo: 'devolucao_entrada', descricao: `CFOP ${clean}`, badge: 'Dev.Venda',  cor: 'text-red-400',    impacto: 'negativo' }
    const suf = clean.substring(1)
    if (suf === '551')                return { tipo: 'ativo_imobilizado', descricao: `CFOP ${clean}`, badge: 'Imobiliz.', cor: 'text-indigo-400', impacto: 'negativo' }
    if (suf === '556' || suf === '407') return { tipo: 'uso_consumo',    descricao: `CFOP ${clean}`, badge: 'Uso/Cons.', cor: 'text-slate-400',  impacto: 'negativo' }
    return                                   { tipo: 'compra',            descricao: `CFOP ${clean}`, badge: 'Compra',    cor: 'text-blue-400',   impacto: 'negativo' }
  }

  return { tipo: 'outros', descricao: `CFOP ${clean}`, badge: clean, cor: 'text-muted-foreground', impacto: 'neutro' }
}

/** CFOPs que contam como faturamento real */
export function ehVenda(cfop: string | null | undefined): boolean {
  return classificarCFOP(cfop).tipo === 'venda'
}

/** CFOPs que são remessa (não contam como receita) */
export function ehRemessa(cfop: string | null | undefined): boolean {
  return classificarCFOP(cfop).tipo === 'remessa'
}

/** CFOPs que são retorno de remessa */
export function ehRetorno(cfop: string | null | undefined): boolean {
  return classificarCFOP(cfop).tipo === 'retorno_remessa'
}

/** CFOPs que são devoluções de compra (saída) */
export function ehDevolucao(cfop: string | null | undefined): boolean {
  return classificarCFOP(cfop).tipo === 'devolucao'
}

/** CFOPs que são devoluções de venda recebidas (entrada) */
export function ehDevolucaoEntrada(cfop: string | null | undefined): boolean {
  return classificarCFOP(cfop).tipo === 'devolucao_entrada'
}
