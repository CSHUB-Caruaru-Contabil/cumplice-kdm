import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { guardCliente } from '@/lib/supabase/auth-guard'
import { analisarPaginaComprovante } from '@/lib/ia/comprovante'

const MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const TAMANHO_MAXIMO = 30 * 1024 * 1024 // 30MB (limite de documento da API Claude)

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params

  const guard = await guardCliente(clienteId)
  if (!guard.ok) return guard.response

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    const mimeType = file.type || 'application/pdf'
    if (!MIME_PERMITIDOS.includes(mimeType)) {
      return NextResponse.json({ erro: `Tipo de arquivo não suportado: ${mimeType}` }, { status: 415 })
    }

    if (file.size > TAMANHO_MAXIMO) {
      return NextResponse.json({ erro: 'Página muito grande para análise (máx. 30MB)' }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    try {
      const resultado = await analisarPaginaComprovante(buffer, mimeType)
      return NextResponse.json(resultado)
    } catch (err) {
      console.error('[analisar-pagina-comprovante] análise IA falhou', err)

      if (err instanceof Anthropic.APIError) {
        if (err.status === 429) {
          return NextResponse.json({ erro: 'Limite de requisições à IA atingido. Tente novamente em instantes.' }, { status: 429 })
        }
        if (err.status === 413 || err.status === 400) {
          return NextResponse.json({ erro: 'Arquivo não pôde ser lido pela IA (formato ou tamanho inválido)' }, { status: 422 })
        }
        if (err.status && err.status >= 500) {
          return NextResponse.json({ erro: 'Serviço de IA indisponível no momento' }, { status: 502 })
        }
      }

      return NextResponse.json({ erro: 'Falha ao analisar a página' }, { status: 502 })
    }
  } catch (err) {
    console.error('[analisar-pagina-comprovante]', err)
    return NextResponse.json({ erro: 'Erro interno ao processar página' }, { status: 500 })
  }
}
