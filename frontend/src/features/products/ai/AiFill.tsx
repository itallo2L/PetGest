import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { getBackend, isBackendError, type ProductSuggestion } from '../../../shared/backend'
import { Icon } from '../../../shared/ui/Icon'
import { toFormMessage } from '../../auth/authErrors'
import { toJpeg } from './photo'
import { VoiceRecorder } from './VoiceRecorder'
import './ai.css'

/** Disponibilidade consultada uma vez por carregamento do app (não muda sem novo deploy). */
let availabilityPromise: Promise<{ photo: boolean; voice: boolean }> | null = null

function loadAvailability() {
  const drafts = getBackend().drafts
  if (!drafts) return Promise.resolve({ photo: false, voice: false })
  availabilityPromise ??= drafts.availability().catch(() => {
    availabilityPromise = null // falha de rede: tenta de novo na próxima abertura
    return { photo: false, voice: false }
  })
  return availabilityPromise
}

type Busy = 'photo' | 'voice' | null

interface AiFillProps {
  disabled?: boolean
  onSuggestion: (suggestion: ProductSuggestion) => void
}

/** Mensagem dos erros da IA (o resto cai nas mensagens gerais de `toFormMessage`). */
function aiErrorMessage(error: unknown): string {
  switch (isBackendError(error) ? error.kind : undefined) {
    case 'ai_unavailable':
      return 'O cadastro por foto e voz não está disponível agora. Preencha à mão.'
    case 'ai_failed':
      return 'Não deu para ler o produto agora. Tente de novo ou preencha à mão.'
    case 'invalid_file':
      return 'Não foi possível usar este arquivo. Tente outra foto ou grave de novo.'
    case 'rate_limited':
      return 'Muitos cadastros por IA seguidos. Aguarde um minuto e tente de novo.'
  }
  return toFormMessage(error).text
}

/**
 * "Preencher com IA" no cadastro de produto (T-19 foto, T-20 voz). Só aparece quando a API
 * tem a IA configurada; o resultado vai para os campos do próprio formulário, que o
 * usuário confere antes de salvar (design D7 da T-19).
 */
export function AiFill({ disabled, onSuggestion }: AiFillProps) {
  const [available, setAvailable] = useState({ photo: false, voice: false })
  const [busy, setBusy] = useState<Busy>(null)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drafts = getBackend().drafts

  useEffect(() => {
    let active = true
    void loadAvailability().then((result) => active && setAvailable(result))
    return () => {
      active = false
    }
  }, [])

  if (!drafts || (!available.photo && !available.voice)) return null

  async function run(kind: Exclude<Busy, null>, task: () => Promise<ProductSuggestion>) {
    setError(null)
    setBusy(kind)
    try {
      onSuggestion(await task())
    } catch (taskError) {
      setError(aiErrorMessage(taskError))
    } finally {
      setBusy(null)
    }
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // a mesma foto pode ser escolhida de novo
    if (!file || !drafts) return
    void run('photo', async () => drafts.fromPhoto(await toJpeg(file)))
  }

  function handleRecorded(audio: Blob) {
    setRecording(false)
    if (!drafts) return
    void run('voice', () => drafts.fromVoice(audio))
  }

  const working = busy !== null || disabled

  return (
    <div className="ai-fill">
      <p className="ai-fill__label">
        <Icon name="sparkles" size="sm" />
        Preencher com IA
      </p>
      <div className="ai-fill__actions">
        {available.photo && (
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => fileRef.current?.click()}
            disabled={working}
          >
            <Icon name="camera" size="sm" />
            {busy === 'photo' ? 'Lendo a foto…' : 'Foto'}
          </button>
        )}
        {available.voice && (
          <button type="button" className="btn btn--outline" onClick={() => setRecording(true)} disabled={working}>
            <Icon name="mic" size="sm" />
            {busy === 'voice' ? 'Ouvindo…' : 'Voz'}
          </button>
        )}
      </div>
      {/* `capture` abre direto a câmera traseira no celular; no desktop, o seletor de arquivo. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="ai-fill__file"
        onChange={handlePhoto}
        tabIndex={-1}
        aria-hidden="true"
      />
      {error && (
        <p className="ai-fill__error" role="alert">
          <Icon name="alert" size="sm" />
          {error}
        </p>
      )}
      {recording && <VoiceRecorder onRecorded={handleRecorded} onClose={() => setRecording(false)} />}
    </div>
  )
}
