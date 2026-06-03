import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function verificarPeriodoAberto(
  clienteId: string,
  periodo: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const fechado = await prisma.periodoFechado.findUnique({
    where: { cliente_id_periodo: { cliente_id: clienteId, periodo } },
  })

  if (fechado) {
    return {
      ok: false,
      response: NextResponse.json(
        { erro: `O período ${periodo} está fechado. Solicite a um administrador para reabrir.` },
        { status: 423 } // 423 Locked
      ),
    }
  }

  return { ok: true }
}
