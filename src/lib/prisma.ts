import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

function makePrisma() {
  // Em produção serverless usa a URL com pgbouncer (pooler)
  // Em dev usa a conexão direta para melhor DX
  const connectionString =
    process.env.NODE_ENV === 'production'
      ? process.env.DATABASE_URL!          // porta 6543 + ?pgbouncer=true
      : (process.env.DIRECT_URL || process.env.DATABASE_URL!)  // porta 5432

  const adapter = new PrismaPg({ connectionString })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

// Singleton — evita múltiplas conexões durante hot reload em dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
