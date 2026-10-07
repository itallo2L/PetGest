import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Modal } from '../../../shared/ui/Modal'
import { MAX_RECORDING_SECONDS, pickAudioMimeType } from './aiHelpers'

type State =
  | { name: 'starting' }
  | { name: 'recording'; seconds: number }
  | { name: 'error'; message: string }

interface VoiceRecorderProps {
  /** Gravação concluída: o áudio vai para a IA. */
  onRecorded: (audio: Blob) => void
  onClose: () => void
}

/**
 * Gravação do cadastro por voz (T-20, design D2): pede o microfone ao abrir, grava até
 * 30 segundos e para sozinho no limite. O microfone é solto ao parar, ao fechar e ao sair
 * da tela, como a câmera do scanner.
 */
export function VoiceRecorder({ onRecorded, onClose }: VoiceRecorderProps) {
  const [state, setState] = useState<State>({ name: 'starting' })
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const discardRef = useRef(false)
  const onRecordedRef = useRef(onRecorded)

  useEffect(() => {
    onRecordedRef.current = onRecorded
  }, [onRecorded])

  useEffect(() => {
    let cancelled = false
    // A limpeza de uma montagem anterior (StrictMode monta duas vezes em desenvolvimento)
    // marca como descartada; esta montagem grava de novo.
    discardRef.current = false
    const release = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setState({ name: 'error', message: 'Este navegador não grava áudio. Preencha o cadastro à mão.' })
        return
      }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (error) {
        const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
        setState({
          name: 'error',
          message: denied
            ? 'O microfone foi bloqueado. Libere o microfone para este site nas configurações do navegador e tente de novo.'
            : 'Não foi possível usar o microfone deste aparelho.',
        })
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream

      const mimeType = pickAudioMimeType((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        release()
        if (discardRef.current) return
        const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
        if (audio.size === 0) {
          setState({ name: 'error', message: 'Nada foi gravado. Tente de novo, falando perto do celular.' })
          return
        }
        onRecordedRef.current(audio)
      }
      recorderRef.current = recorder
      recorder.start()
      setState({ name: 'recording', seconds: 0 })
    }

    void start()
    return () => {
      cancelled = true
      discardRef.current = true
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      release()
    }
  }, [])

  // Cronômetro e parada automática no limite.
  const recording = state.name === 'recording'
  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => {
      setState((current) => {
        if (current.name !== 'recording') return current
        const seconds = current.seconds + 1
        if (seconds >= MAX_RECORDING_SECONDS && recorderRef.current?.state === 'recording') recorderRef.current.stop()
        return { name: 'recording', seconds }
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [recording])

  // A página foi para o fundo (outra aba, tela inicial): descarta e solta o microfone.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        discardRef.current = true
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
        onClose()
      }
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [onClose])

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const close = () => {
    discardRef.current = true
    stop()
    onClose()
  }

  return (
    <Modal
      title="Cadastrar por voz"
      subtitle="Diga o nome do produto, a categoria e o preço"
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={close}>
            Cancelar
          </button>
          {state.name === 'recording' && (
            <button type="button" className="btn btn--primary" onClick={stop} data-autofocus>
              <Icon name="stop" size="sm" />
              Parar e preencher
            </button>
          )}
        </>
      }
    >
      <div className="voice" data-state={state.name}>
        {state.name === 'starting' && <p className="voice__status">Liberando o microfone…</p>}

        {state.name === 'recording' && (
          <>
            <span className="voice__pulse" aria-hidden="true">
              <Icon name="mic" />
            </span>
            <p className="voice__status" role="status">
              Gravando… {state.seconds}s de {MAX_RECORDING_SECONDS}s
            </p>
            <p className="voice__hint">
              Exemplo: “Ração Golden Adultos frango, quinze quilos, categoria ração, cento e oitenta e nove e noventa.”
            </p>
          </>
        )}

        {state.name === 'error' && (
          <p className="voice__error" role="alert">
            <Icon name="alert" size="sm" />
            {state.message}
          </p>
        )}
      </div>
    </Modal>
  )
}
