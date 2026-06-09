// Parser de SPED EFD ICMS/IPI (arquivo texto delimitado por "|")
// Lê os registros de identificação (0000), participantes (0150) e
// documentos fiscais (C100/C170) e classifica cada CFOP usando @/lib/cfop.

import { classificarCFOP, type CFOPInfo } from '@/lib/cfop'

export type SpedItem = {
  numero_item: string
  cod_item: string
  descricao_complementar: string
  cfop: string
  valor: number
  classificacao: CFOPInfo
}

export type SpedResumoCfop = {
  cfop: string
  valor_operacao: number
  classificacao: CFOPInfo
}

export type SpedDocumento = {
  tipo: 'entrada' | 'saida'
  emissao: 'propria' | 'terceiros'
  cod_participante: string
  participante_nome?: string
  cnpj_participante?: string
  cancelado: boolean
  modelo: string
  serie: string
  numero: string
  chave_nfe?: string
  data_emissao: string   // YYYY-MM-DD
  data_entrada_saida: string // YYYY-MM-DD
  valor_total: number
  cfop_principal: string
  classificacao: CFOPInfo
  itens: SpedItem[]
  // Resumo analítico por CFOP (registro C190) — preenchido quando a empresa
  // não escritura o detalhamento por item (C170), apenas o total por CFOP
  resumos_cfop: SpedResumoCfop[]
}

export type SpedEmpresa = {
  cnpj: string
  razao_social: string
  periodo_inicio: string // YYYY-MM-DD
  periodo_fim: string    // YYYY-MM-DD
}

export type SpedResultado = {
  empresa?: SpedEmpresa
  documentos: SpedDocumento[]
  total_parsed: number
  erro?: string
}

// ─── Normaliza valor (vírgula decimal -> ponto) ──────────────────────────────
function parseValor(raw: string | undefined): number {
  if (!raw) return 0
  const normalizado = raw.trim().replace(/\./g, '').replace(',', '.')
  const valor = parseFloat(normalizado)
  return isNaN(valor) ? 0 : valor
}

// ─── Converte data SPED (DDMMAAAA) para YYYY-MM-DD ───────────────────────────
function parseDataSped(raw: string | undefined): string {
  if (!raw || raw.length !== 8) return ''
  const dia = raw.substring(0, 2)
  const mes = raw.substring(2, 4)
  const ano = raw.substring(4, 8)
  return `${ano}-${mes}-${dia}`
}

// ─── Quebra uma linha de registro SPED em campos ─────────────────────────────
// Layout: |REG|CAMPO1|CAMPO2|...|  →  campos[0] é vazio (antes do primeiro "|")
function camposDoRegistro(linha: string): string[] {
  const semBordas = linha.trim().replace(/^\|/, '').replace(/\|$/, '')
  return semBordas.split('|')
}

export function parseSpedEFD(content: string): SpedResultado {
  try {
    const linhas = content.split(/\r?\n/).filter(l => l.trim().startsWith('|'))

    let empresa: SpedEmpresa | undefined
    const participantes = new Map<string, { nome: string; cnpj: string }>()
    const documentos: SpedDocumento[] = []

    let docAtual: SpedDocumento | null = null

    for (const linha of linhas) {
      const campos = camposDoRegistro(linha)
      const registro = campos[0]

      switch (registro) {
        case '0000': {
          // |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|CPF|UF|IE|...
          empresa = {
            razao_social: campos[5] ?? '',
            cnpj: campos[6] ?? '',
            periodo_inicio: parseDataSped(campos[3]),
            periodo_fim: parseDataSped(campos[4]),
          }
          break
        }

        case '0150': {
          // |0150|COD_PART|NOME|COD_PAIS|CNPJ|CPF|IE|COD_MUN|...
          const codPart = campos[1]
          if (codPart) {
            participantes.set(codPart, {
              nome: campos[2] ?? '',
              cnpj: campos[4] || campos[5] || '',
            })
          }
          break
        }

        case 'C100': {
          // |C100|IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|SER|NUM_DOC|CHV_NFE|DT_DOC|DT_E_S|VL_DOC|...
          const indOper = campos[1]
          const indEmit = campos[2]
          const codPart = campos[3] ?? ''
          const codSit = campos[5] ?? ''
          const participante = participantes.get(codPart)

          docAtual = {
            tipo: indOper === '1' ? 'saida' : 'entrada',
            emissao: indEmit === '1' ? 'terceiros' : 'propria',
            cod_participante: codPart,
            participante_nome: participante?.nome,
            cnpj_participante: participante?.cnpj,
            // COD_SIT: 02 e 03 = documento cancelado
            cancelado: codSit === '02' || codSit === '03',
            modelo: campos[4] ?? '',
            serie: campos[6] ?? '',
            numero: campos[7] ?? '',
            chave_nfe: campos[8] || undefined,
            data_emissao: parseDataSped(campos[9]),
            data_entrada_saida: parseDataSped(campos[10]),
            valor_total: parseValor(campos[11]),
            cfop_principal: '',
            classificacao: classificarCFOP(undefined),
            itens: [],
            resumos_cfop: [],
          }
          documentos.push(docAtual)
          break
        }

        case 'C170': {
          // |C170|NUM_ITEM|COD_ITEM|DESCR_COMPL|QTD|UNID|VL_ITEM|VL_DESC|IND_MOV|CST_ICMS|CFOP|COD_NAT|...
          if (!docAtual) break
          const cfop = campos[10] ?? ''
          docAtual.itens.push({
            numero_item: campos[1] ?? '',
            cod_item: campos[2] ?? '',
            descricao_complementar: campos[3] ?? '',
            cfop,
            valor: parseValor(campos[6]),
            classificacao: classificarCFOP(cfop),
          })
          break
        }

        case 'C190': {
          // |C190|CST_ICMS|CFOP|ALIQ_ICMS|VL_OPR|VL_BC_ICMS|VL_ICMS|VL_BC_ICMS_ST|VL_ICMS_ST|VL_RED_BC|VL_IPI|COD_OBS|
          // Resumo analítico por CFOP — usado por empresas que não escrituram C170 (perfil B)
          if (!docAtual) break
          const cfop = campos[2] ?? ''
          docAtual.resumos_cfop.push({
            cfop,
            valor_operacao: parseValor(campos[4]),
            classificacao: classificarCFOP(cfop),
          })
          break
        }

        default:
          break
      }
    }

    // Define o CFOP/classificação "principal" de cada documento como o de
    // maior valor — a partir dos itens (C170, perfil A) quando existirem,
    // ou do resumo analítico por CFOP (C190, perfil B) caso contrário.
    // Documentos podem ter mais de um CFOP, mas costumam ter um predominante
    // para fins de classificação financeira.
    for (const doc of documentos) {
      if (doc.itens.length > 0) {
        const principal = doc.itens.reduce((maior, atual) => (atual.valor > maior.valor ? atual : maior))
        doc.cfop_principal = principal.cfop
        doc.classificacao = principal.classificacao
        // Quando VL_DOC (C100) é zero mas os itens têm valor (ex.: remessa/retorno),
        // usa a soma dos itens como valor fiscal da operação
        if (doc.valor_total === 0) {
          doc.valor_total = doc.itens.reduce((s, i) => s + i.valor, 0)
        }
      } else if (doc.resumos_cfop.length > 0) {
        const principal = doc.resumos_cfop.reduce((maior, atual) => (atual.valor_operacao > maior.valor_operacao ? atual : maior))
        doc.cfop_principal = principal.cfop
        doc.classificacao = principal.classificacao
        // Quando VL_DOC (C100) é zero mas C190 tem VL_OPR (ex.: retorno de remessa),
        // usa a soma dos VL_OPR como valor fiscal da operação
        if (doc.valor_total === 0) {
          doc.valor_total = doc.resumos_cfop.reduce((s, r) => s + r.valor_operacao, 0)
        }
      }
    }

    return { empresa, documentos, total_parsed: documentos.length }
  } catch (e) {
    return {
      documentos: [],
      total_parsed: 0,
      erro: e instanceof Error ? e.message : 'Erro ao processar arquivo SPED',
    }
  }
}
