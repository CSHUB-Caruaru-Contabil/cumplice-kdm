'use client'

/** Verifica via API se um período está fechado. Retorna null se aberto, mensagem de erro se fechado. */
export async function checkPeriodoAberto(clienteId: string, data: string): Promise<string | null> {
  const periodo = data.substring(0, 7) // YYYY-MM da data do lançamento
  try {
    const res = await fetch(`/api/clientes/${clienteId}/periodo?periodo=${periodo}`)
    if (!res.ok) return null // se falhar, deixa passar (não bloqueia por erro de rede)
    const result = await res.json()
    if (result.fechado) {
      return `O período ${periodo} está fechado. Solicite a um administrador para reabrir antes de lançar.`
    }
    return null
  } catch {
    return null // não bloqueia por erro de rede
  }
}
