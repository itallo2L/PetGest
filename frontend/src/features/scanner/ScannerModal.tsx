import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { Icon, type IconName } from '../../shared/ui/Icon'
import { Modal } from '../../shared/ui/Modal'
import { toFormMessage } from '../auth/authErrors'
import { isValidGtin } from './gtin'
import { useBarcodeScanner } from './useBarcodeScanner'
import './scanner.css'

/** O que quem abriu o leitor encontrou para o código (design D4 da T-07). */
export type ScanOutcome<T> = { kind: 'existing'; item: T; summary: string } | { kind: 'new' }

interface ScannerModalProps<T> {
  /** Procura o código; o leitor só mostra o resultado. */
  onCode: (code: string) => Promise<ScanOutcome<T>>
  /** Código não encontrado: quem abriu fecha o leitor e segue. */
  onNewCode: (code: string) => void
  /** Botão do desfecho "já cadastrado" (ex.: "Editar produto"). */
  existingActionLabel: string
  onExistingAction: (item: T) => void
  onClose: () => void
}

type Phase =
  | { name: 'camera' }
  | { name: 'lookup'; code: string }
  | { name: 'lookup-error'; code: string; message: string }
  | { name: 'found'; code: string; item: unknown; summary: string }

const MANUAL_RE = /^\d{8,14}$/

/** Leitor de código de barras em modal, com os estados do protótipo. */
export function ScannerModal<T>({ onCode, onNewCode, existingActionLabel, onExistingAction, onClose }: ScannerModalProps<T>) {
  const { videoRef, status, code, error, errorKind, torchSupported, torchOn, toggleTorch, start, stop } =
    useBarcodeScanner({
      formats: ['ean_13', 'ean_8'],
      accept: isValidGtin,
      requiredMatches: 2,
      stopOnAccept: true,
      stopWhenHidden: true,
    })
  const [phase, setPhase] = useState<Phase>({ name: 'camera' })
  const [started, setStarted] = useState(false)
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const handledCodeRef = useRef<string | null>(null)

  // Liga a câmera ao abrir (fora do render: o start atualiza estado).
  useEffect(() => {
    const id = window.setTimeout(() => {
      setStarted(true)
      start()
    }, 0)
    return () => window.clearTimeout(id)
  }, [start])

  async function lookup(code: string) {
    setPhase({ name: 'lookup', code })
    try {
      const outcome = await onCode(code)
      if (outcome.kind === 'new') {
        stop()
        onNewCode(code)
        return
      }
      stop()
      setPhase({ name: 'found', code, item: outcome.item, summary: outcome.summary })
    } catch (err) {
      setPhase({ name: 'lookup-error', code, message: toFormMessage(err).text })
    }
  }

  // Código aceito pela câmera (dígito verificador + 2 leituras iguais).
  const onAccepted = useEffectEvent((accepted: string) => {
    navigator.vibrate?.(60)
    void lookup(accepted)
  })
  useEffect(() => {
    if (!code || handledCodeRef.current === code) return
    handledCodeRef.current = code
    const id = window.setTimeout(() => onAccepted(code), 0)
    return () => window.clearTimeout(id)
  }, [code])

  function handleManual(event: FormEvent) {
    event.preventDefault()
    const digits = manual.replace(/\D/g, '')
    if (!MANUAL_RE.test(digits)) {
      setManualError('Código inválido: informe de 8 a 14 dígitos.')
      return
    }
    setManualError(null)
    void lookup(digits)
  }

  function retry() {
    if (phase.name === 'lookup-error') {
      void lookup(phase.code)
      return
    }
    handledCodeRef.current = null
    setPhase({ name: 'camera' })
    start()
  }

  const view = viewFor(phase, status, errorKind, error, started)
  const showRetry = view.retry
  const found = phase.name === 'found' ? phase : null

  return (
    <Modal
      title="Código de barras"
      subtitle={view.state === 'scanning' ? 'Aponte a câmera para o código do produto' : 'Escaneie com a câmera ou digite o código'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          {showRetry && (
            <button type="button" className="btn btn--outline" onClick={retry}>
              <Icon name="refresh" size="sm" />
              Tentar de novo
            </button>
          )}
          {found && (
            <button type="button" className="btn btn--primary" onClick={() => onExistingAction(found.item as T)} data-autofocus>
              {existingActionLabel}
            </button>
          )}
        </>
      }
    >
      <div className="scanner" data-state={view.state}>
        <div className="scanner__stage">
          <video className="scanner__video" ref={videoRef} playsInline muted autoPlay />
          <div className="scanner__frame" aria-hidden="true">
            <span className="scanner__line" />
          </div>
          <button
            type="button"
            className="scanner__torch"
            hidden={!torchSupported}
            aria-pressed={torchOn}
            onClick={toggleTorch}
          >
            <Icon name="flash" size="sm" />
            Lanterna
          </button>
        </div>

        <p className="scanner__hint">Enquadre o código dentro da área e mantenha o celular firme.</p>

        <div className="scanner__notice" role="status">
          <span className="scanner__notice-icon">
            <Icon name={view.icon} />
          </span>
          <p className="scanner__notice-title">{view.title}</p>
          <p className="scanner__notice-text">{view.text}</p>
        </div>

        {found && (
          <div className="scanner__result scanner__result--info" role="status">
            <span className="scanner__result-icon">
              <Icon name="alert" />
            </span>
            <p className="scanner__result-title">Produto já cadastrado</p>
            <p className="scanner__code">{found.code}</p>
            <p className="scanner__result-text">{found.summary}</p>
          </div>
        )}

        <form className="scanner__manual" onSubmit={handleManual} noValidate>
          <label className="field__label" htmlFor="scannerManualInput">
            Ou digite o código
          </label>
          <div className="field-with-action">
            <input
              className="input"
              type="text"
              id="scannerManualInput"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ex.: 7891000315507"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
            />
            <button type="submit" className="btn btn--primary field-with-action__btn" disabled={phase.name === 'lookup'}>
              Usar
            </button>
          </div>
          {manualError && (
            <p className="form__error" role="alert">
              {manualError}
            </p>
          )}
        </form>
      </div>
    </Modal>
  )
}

interface View {
  state: 'asking' | 'scanning' | 'denied' | 'unavailable' | 'error' | 'lookup' | 'found'
  icon: IconName
  title: string
  text: string
  retry: boolean
}

function viewFor(
  phase: Phase,
  status: string,
  errorKind: string | null,
  error: string | null,
  started: boolean,
): View {
  const base = { icon: 'camera' as IconName, title: '', text: '', retry: false }
  if (phase.name === 'found') return { ...base, state: 'found' }
  if (phase.name === 'lookup') {
    return { ...base, state: 'lookup', icon: 'search', title: 'Procurando o código…', text: phase.code }
  }
  if (phase.name === 'lookup-error') {
    return { state: 'error', icon: 'alert', title: 'Não foi possível consultar o código', text: phase.message, retry: true }
  }
  if (status === 'scanning') return { ...base, state: 'scanning' }
  if (status === 'error') {
    if (errorKind === 'denied') {
      return { state: 'denied', icon: 'camera-off', title: 'Câmera bloqueada', text: error ?? '', retry: true }
    }
    if (errorKind === 'unavailable') {
      return { state: 'unavailable', icon: 'camera-off', title: 'Câmera indisponível', text: error ?? '', retry: false }
    }
    return { state: 'error', icon: 'alert', title: 'Não foi possível abrir a câmera', text: error ?? '', retry: true }
  }
  if (status === 'idle' && started) {
    return {
      state: 'error',
      icon: 'camera-off',
      title: 'Câmera desligada',
      text: 'A câmera foi desligada ao sair da tela. Toque em "Tentar de novo" para ligar.',
      retry: true,
    }
  }
  return {
    ...base,
    state: 'asking',
    title: 'Liberando a câmera…',
    text: 'Confirme o acesso à câmera para ler o código.',
  }
}
