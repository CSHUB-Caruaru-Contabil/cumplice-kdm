import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Cliente } from '@/lib/supabase/types'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Busca clientes do usuário
  const { data: uc } = await supabase
    .from('usuario_clientes')
    .select('cliente_id')
    .eq('usuario_id', user.id)

  const clienteIds = (uc || []).map(r => r.cliente_id)

  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .in('id', clienteIds.length ? clienteIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('ativo', true)
    .order('razao_social')

  return <DashboardClient clientes={(clientes || []) as Cliente[]} />
}
