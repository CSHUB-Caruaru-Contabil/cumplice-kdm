// Persistência local (IndexedDB) de comprovantes ainda não vinculados/enviados —
// evita perder o trabalho de análise (erro ou sem match) ao recarregar a página.
const DB_NAME = 'cumplice-comprovantes'
const STORE = 'pendentes'
const VERSION = 1

export type ItemPersistido = {
  id: string
  clienteId: string
  periodo: string
  blob: Blob
  ext: string
  nomeExibicao: string
  lancamentoId: string | null
  semMatchIA: boolean
  status: 'pendente' | 'erro'
  erro?: string
  valorExtraido: number | null
  dataExtraida: string | null
  descricaoExtraida: string | null
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('cliente_periodo', ['clienteId', 'periodo'])
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function disponivel(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

export async function salvarItem(item: ItemPersistido): Promise<void> {
  if (!disponivel()) return
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function removerItem(id: string): Promise<void> {
  if (!disponivel()) return
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function listarItens(clienteId: string, periodo: string): Promise<ItemPersistido[]> {
  if (!disponivel()) return []
  const db = await openDB()
  const itens = await new Promise<ItemPersistido[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const index = tx.objectStore(STORE).index('cliente_periodo')
    const req = index.getAll([clienteId, periodo])
    req.onsuccess = () => resolve(req.result as ItemPersistido[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return itens
}

export async function limparItens(clienteId: string, periodo: string): Promise<void> {
  if (!disponivel()) return
  const itens = await listarItens(clienteId, periodo)
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const item of itens) store.delete(item.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
