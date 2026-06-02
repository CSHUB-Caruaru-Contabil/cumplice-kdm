// Garante que o usuário autenticado tem acesso ao cliente solicitado
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function guardCliente(clienteId: string): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ erro: 'Não autenticado' }, { status: 401 }),
    }
  }

  // Verifica vínculo usuario ↔ cliente
  const { data: vinculo } = await supabase
    .from('usuario_clientes')
    .select('cliente_id')
    .eq('usuario_id', user.id)
    .eq('cliente_id', clienteId)
    .single()

  if (!vinculo) {
    return {
      ok: false,
      response: NextResponse.json({ erro: 'Acesso negado' }, { status: 403 }),
    }
  }

  return { ok: true, userId: user.id }
}
