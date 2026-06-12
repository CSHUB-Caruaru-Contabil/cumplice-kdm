import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { guardCliente } from '@/lib/supabase/auth-guard'
import { classificarProdutosIA, type ItemParaClassificar } from '@/lib/ia/classificacao-produtos'

const MAX_ITENS = 100

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params

  const guard = await guardCliente(clienteId)
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const itens = body.itens as ItemParaClassificar[]
    const tipoDocumento = typeof body.tipoDocumento === 'string' ? body.tipoDocumento : 'NF-e'

    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ erro: 'Nenhum item informado' }, { status: 400 })
    }
    if (itens.length > MAX_ITENS) {
      return NextResponse.json({ erro: `Máximo de ${MAX_ITENS} itens por requisição` }, { status: 400 })
    }

    try {
      const sugestoes = await classificarProdutosIA(itens, tipoDocumento)
      return NextResponse.json({ sugestoes })
    } catch (err) {
      console.error('[classificar-produtos] análise IA falhou', err)

      if (err instanceof Anthropic.APIError) {
        if (err.status === 401 || err.status === 403) {
          return NextResponse.json({ erro: 'Chave de API da IA ausente ou inválida (configuração do servidor)' }, { status: 500 })
        }
        if (err.status === 429) {
          return NextResponse.json({ erro: 'Limite de requisições à IA atingido. Tente novamente em instantes.' }, { status: 429 })
        }
        if (err.status && err.status >= 500) {
          return NextResponse.json({ erro: 'Serviço de IA indisponível no momento' }, { status: 502 })
        }
        return NextResponse.json({ erro: `Falha ao classificar (IA: ${err.status} ${err.message})` }, { status: 502 })
      }

      if (err instanceof Error && err.message.includes('ANTHROPIC_API_KEY')) {
        return NextResponse.json({ erro: 'ANTHROPIC_API_KEY não configurada no servidor' }, { status: 500 })
      }

      return NextResponse.json({ erro: `Falha ao classificar: ${err instanceof Error ? err.message : 'erro desconhecido'}` }, { status: 502 })
    }
  } catch (err) {
    console.error('[classificar-produtos]', err)
    return NextResponse.json({ erro: 'Erro interno ao processar requisição' }, { status: 500 })
  }
}
