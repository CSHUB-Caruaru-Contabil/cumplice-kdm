'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, Upload, ExternalLink, Trash2, Loader2 } from 'lucide-react'

type Props = {
  tabela: 'despesas' | 'banco_lancamentos'
  registroId: string
  clienteId: string
  urlAtual?: string | null
  onAtualizado?: (novaUrl: string | null) => void
  /** Dados do lançamento correspondente na outra tabela (despesas ⇄ banco_lancamentos),
   *  usados para propagar o comprovante para o registro espelhado (mesma transação). */
  vincular?: { periodo: string; data: string; valor: number; descricao: string }
}

export default function UploadComprovante({ tabela, registroId, clienteId, urlAtual, onAtualizado, vincular }: Props) {
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const [url, setUrl] = useState(urlAtual || null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Valida tamanho (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErro('Arquivo muito grande (máx 10MB)')
      return
    }

    setUploading(true)
    setErro('')

    try {
      // Gera caminho único: clientes/{clienteId}/{tabela}/{registroId}/{timestamp}-{nome}
      const ext = file.name.split('.').pop()
      const path = `clientes/${clienteId}/${tabela}/${registroId}/${Date.now()}.${ext}`

      // Apaga arquivo anterior se existir
      if (url) {
        const oldPath = url.split('/comprovantes/')[1]
        if (oldPath) await supabase.storage.from('comprovantes').remove([oldPath])
      }

      // Faz upload
      const { error: uploadErr } = await supabase.storage
        .from('comprovantes')
        .upload(path, file, { upsert: true })

      if (uploadErr) throw new Error(uploadErr.message)

      // Gera URL assinada (válida por 1 ano)
      const { data: signed } = await supabase.storage
        .from('comprovantes')
        .createSignedUrl(path, 365 * 24 * 3600)

      const novaUrl = signed?.signedUrl || null

      // Salva URL no registro
      const { error: saveErr } = await supabase
        .from(tabela)
        .update({ comprovante_url: novaUrl })
        .eq('id', registroId)

      if (saveErr) throw new Error(saveErr.message)

      setUrl(novaUrl)
      await propagar(novaUrl)
      await reconciliar()
      onAtualizado?.(novaUrl)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemover() {
    if (!url) return
    setUploading(true)
    try {
      const path = url.split('/comprovantes/')[1]?.split('?')[0]
      if (path) await supabase.storage.from('comprovantes').remove([path])

      await supabase.from(tabela).update({ comprovante_url: null }).eq('id', registroId)

      setUrl(null)
      await propagar(null)
      await reconciliar()
      onAtualizado?.(null)
    } catch { /* ignora */ }
    setUploading(false)
  }

  // Propaga o comprovante para o lançamento espelhado na outra tabela (mesma
  // transação, identificada por cliente+período+data+valor+descrição)
  async function propagar(novaUrl: string | null) {
    if (!vincular) return
    try {
      const tabelaDestino = tabela === 'despesas' ? 'banco_lancamentos' : 'despesas'
      await supabase.from(tabelaDestino)
        .update({ comprovante_url: novaUrl })
        .eq('cliente_id', clienteId)
        .eq('periodo', vincular.periodo)
        .eq('data', vincular.data)
        .eq('valor', vincular.valor)
        .eq('descricao', vincular.descricao)
    } catch { /* ignora — registro espelhado pode não existir */ }
  }

  // O status de conciliação de banco_lancamentos depende do comprovante
  // (saída só fica "ok" com NF + comprovante) — reprocessa após anexar/remover
  async function reconciliar() {
    if (!vincular) return
    try {
      await fetch(`/api/clientes/${clienteId}/conciliar?periodo=${vincular.periodo}`, { method: 'POST' })
    } catch { /* ignora */ }
  }

  const inputId = `comprovante-${registroId}`

  if (uploading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Enviando...</span>
      </div>
    )
  }

  if (url) {
    return (
      <div className="flex items-center gap-1">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          title="Ver comprovante">
          <Paperclip className="h-3.5 w-3.5" />
          <span>Comprovante</span>
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
        <button onClick={handleRemover} title="Remover comprovante"
          className="text-muted-foreground hover:text-destructive ml-1 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={inputId}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors"
        title="Anexar comprovante (PDF, imagem)">
        <Upload className="h-3.5 w-3.5" />
        <span>Anexar</span>
      </label>
      <input
        id={inputId}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
        onChange={handleUpload}
      />
      {erro && <p className="text-[10px] text-red-400 mt-0.5">{erro}</p>}
    </div>
  )
}
