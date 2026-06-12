// Sugestão de NCM/CFOP para itens de NF-e via Claude API
import Anthropic from '@anthropic-ai/sdk'

export type ItemParaClassificar = {
  descricao: string
  ncm?: string
  cfop?: string
}

export type SugestaoClassificacao = {
  ncm: string
  cfop: string
  justificativa: string
}

const TOOL_NAME = 'classificar_itens'

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description: 'Registra a classificação fiscal (NCM e CFOP) sugerida para cada item, na mesma ordem em que foram informados',
  input_schema: {
    type: 'object' as const,
    properties: {
      itens: {
        type: 'array' as const,
        description: 'Uma entrada para cada item, na mesma ordem da lista recebida',
        items: {
          type: 'object' as const,
          properties: {
            ncm: { type: 'string', description: 'NCM sugerido (8 dígitos, sem pontuação)' },
            cfop: { type: 'string', description: 'CFOP sugerido (4 dígitos)' },
            justificativa: { type: 'string', description: 'Breve justificativa (até 15 palavras) — mencione se manteve o valor original ou o motivo da alteração' },
          },
          required: ['ncm', 'cfop', 'justificativa'],
        },
      },
    },
    required: ['itens'],
  },
}

function montarPrompt(itens: ItemParaClassificar[], tipoDocumento: string): string {
  const lista = itens.map((it, i) =>
    `${i + 1}. Descrição: "${it.descricao}" — NCM atual: ${it.ncm || '(vazio)'} — CFOP atual: ${it.cfop || '(vazio)'}`
  ).join('\n')

  return `Você é um especialista em classificação fiscal (NCM e CFOP) para uma indústria de confecções (roupas, calças, camisas, etc) no Brasil.

Este documento é do tipo: ${tipoDocumento}.

Para cada item abaixo, avalie se o NCM e o CFOP atuais fazem sentido para a descrição do produto. Se fizerem sentido, repita os valores atuais. Se não fizerem sentido (ou estiverem vazios), sugira o NCM (8 dígitos) e o CFOP (4 dígitos) mais adequados, considerando o tipo de documento.

Itens:
${lista}

Use a ferramenta ${TOOL_NAME} para responder, com exatamente ${itens.length} entrada(s), na mesma ordem.`
}

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')
    client = new Anthropic({ apiKey })
  }
  return client
}

export async function classificarProdutosIA(
  itens: ItemParaClassificar[],
  tipoDocumento: string
): Promise<SugestaoClassificacao[]> {
  if (itens.length === 0) return []

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [
      { role: 'user', content: montarPrompt(itens, tipoDocumento) },
    ],
  })

  const toolUse = response.content.find(c => c.type === 'tool_use' && c.name === TOOL_NAME)
  if (!toolUse || toolUse.type !== 'tool_use') return []

  const input = toolUse.input as { itens: SugestaoClassificacao[] }
  return Array.isArray(input.itens) ? input.itens : []
}
