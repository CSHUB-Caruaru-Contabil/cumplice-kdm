'use client'

/**
 * Verifica via API se um período está fechado.
 * - Retorna null se ABERTO (pode lançar)
 * - Retorna mensagem de erro se FECHADO (bloqueia)
 * - Em caso de falha na rede, BLOQUEIA por segurança
 */
export async function checkPeriodoAberto(clienteId: string, data: string): Promise<string | null> {
  if (!clienteId) return null // sem cliente ativo, não bloqueia

  const periodo = data.substring(0, 7) // YYYY-MM
  if (!periodo || periodo.length < 7) return null

  try {
    const res = await fetch(`/api/clientes/${clienteId}/periodo?periodo=${periodo}`, {
      cache: 'no-store', // sempre busca estado atual
    })

    // Se a API falhou com erro de servidor, bloqueia por segurança
    if (res.status >= 500) {
      return `Não foi possível verificar o período ${periodo}. Tente novamente.`
    }

    // 404 ou 401 = sem registro de fechamento, período aberto
    if (res.status === 404 || res.status === 401) return null

    if (!res.ok) return null

    const result = await res.json()

    if (result.fechado) {
      const fechadoEm = result.info?.fechado_em
        ? new Date(result.info.fechado_em).toLocaleDateString('pt-BR')
        : ''
      return `O período ${periodo} está fechado${fechadoEm ? ` desde ${fechadoEm}` : ''}. Solicite a um administrador para reabrir.`
    }

    return null // período aberto
  } catch {
    // Falha de rede — bloqueia por segurança
    return `Não foi possível verificar o status do período ${periodo}. Verifique sua conexão.`
  }
}
