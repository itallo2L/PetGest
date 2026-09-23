import { useCallback, useEffect, useRef, useState } from 'react'
import { createDetector, type BarcodeFormat, type DetectorEngine, type ScannerDetector } from './createDetector'

export type ScannerStatus = 'idle' | 'asking' | 'scanning' | 'error'

/** Para a tela escolher o aviso: permissão negada, sem câmera/HTTPS ou outro. */
export type ScannerErrorKind = 'denied' | 'unavailable' | 'error'

/**
 * Opções do leitor do app (T-07). Sem opções, o hook se comporta como no
 * spike da T-01: só EAN-13, publica cada código novo e segue lendo.
 */
export interface BarcodeScannerOptions {
  formats?: BarcodeFormat[]
  /** Descarta leituras que não passam (ex.: dígito verificador). */
  accept?: (code: string) => boolean
  /** Quantas detecções idênticas seguidas antes de publicar o código. */
  requiredMatches?: number
  /** Para o loop depois do primeiro código publicado (a câmera segue ligada). */
  stopOnAccept?: boolean
  /** Desliga a câmera quando a aba fica oculta. */
  stopWhenHidden?: boolean
}

export interface BarcodeScannerState {
  status: ScannerStatus
  engine: DetectorEngine | null
  code: string | null
  error: string | null
  errorKind: ScannerErrorKind | null
  firstReadMs: number | null
  torchSupported: boolean
  torchOn: boolean
  torchDebug: string | null
}

export interface UseBarcodeScanner extends BarcodeScannerState {
  videoRef: React.RefObject<HTMLVideoElement | null>
  start: () => void
  stop: () => void
  toggleTorch: () => void
}

/** `torch` não faz parte do `MediaTrackCapabilities`/`MediaTrackConstraintSet`
 * padrão do TypeScript — é uma extensão do Chrome/Android, ausente no Safari. */
interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean
}
interface TorchConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean
}

function errorKindOf(err: unknown): ScannerErrorKind {
  if (!(err instanceof DOMException)) return 'error'
  if (err.name === 'NotAllowedError') return 'denied'
  if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') return 'unavailable'
  return 'error'
}

function mapGetUserMediaError(err: unknown): string {
  if (!(err instanceof DOMException)) {
    return `Erro ao acessar a câmera (${err instanceof Error ? err.message : String(err)}).`
  }
  switch (err.name) {
    case 'NotAllowedError':
      return 'Câmera negada. Libere o acesso à câmera nas configurações do site e tente de novo.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nenhuma câmera disponível neste aparelho.'
    default:
      return `Câmera indisponível (${err.name}).`
  }
}

export function useBarcodeScanner(options: BarcodeScannerOptions = {}): UseBarcodeScanner {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const [status, setStatus] = useState<ScannerStatus>('idle')
  const [engine, setEngine] = useState<DetectorEngine | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<ScannerErrorKind | null>(null)
  const [firstReadMs, setFirstReadMs] = useState<number | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchDebug, setTorchDebug] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoTrackRef = useRef<MediaStreamTrack | null>(null)
  const detectorRef = useRef<ScannerDetector | null>(null)
  const rafRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const firstReadDoneRef = useRef(false)
  const lastCodeRef = useRef<string | null>(null)
  const candidateRef = useRef<{ value: string; count: number } | null>(null)
  const acceptedRef = useRef(false)

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    videoTrackRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    inFlightRef.current = false
    startedAtRef.current = null
    firstReadDoneRef.current = false
    lastCodeRef.current = null
    candidateRef.current = null
    acceptedRef.current = false
    setTorchSupported(false)
    setTorchOn(false)
    setTorchDebug(null)
    setStatus('idle')
  }, [])

  const toggleTorch = useCallback(() => {
    const track = videoTrackRef.current
    if (!track) return
    const next = !torchOn
    track
      .applyConstraints({ advanced: [{ torch: next } as TorchConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => {
        // hardware recusou o toggle — mantém o estado anterior
      })
  }, [torchOn])

  const tickRef = useRef<() => void>(() => {})

  const tick = useCallback(() => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector || acceptedRef.current) return

    if (
      !inFlightRef.current &&
      video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA
    ) {
      inFlightRef.current = true
      detector
        .detect(video)
        .then((results) => {
          if (acceptedRef.current) return
          const { accept, requiredMatches = 1, stopOnAccept = false } = optionsRef.current
          const raw = results[0]?.rawValue
          const value = raw && (!accept || accept(raw)) ? raw : undefined
          if (!value) {
            // Leitura inválida ou nenhuma: a próxima detecção recomeça a contagem.
            if (raw) candidateRef.current = null
            return
          }
          const candidate = candidateRef.current
          candidateRef.current =
            candidate?.value === value ? { value, count: candidate.count + 1 } : { value, count: 1 }
          if (candidateRef.current.count < requiredMatches) return
          if (value !== lastCodeRef.current) {
            lastCodeRef.current = value
            if (stopOnAccept) acceptedRef.current = true
            setCode(value)
            if (!firstReadDoneRef.current && startedAtRef.current !== null) {
              firstReadDoneRef.current = true
              setFirstReadMs(Math.round(performance.now() - startedAtRef.current))
            }
          }
        })
        .catch(() => {
          // frame ruim isolado — a próxima tentativa segue normalmente
        })
        .finally(() => {
          inFlightRef.current = false
        })
    }

    rafRef.current = requestAnimationFrame(() => tickRef.current())
  }, [])

  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  const start = useCallback(() => {
    setError(null)
    setErrorKind(null)
    setCode(null)
    setFirstReadMs(null)
    lastCodeRef.current = null
    candidateRef.current = null
    acceptedRef.current = false
    firstReadDoneRef.current = false
    setStatus('asking')

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Câmera não disponível neste contexto (precisa de HTTPS).')
      setErrorKind('unavailable')
      setStatus('error')
      return
    }

    createDetector(optionsRef.current.formats)
      .then(async ({ detector, engine: detectorEngine }) => {
        detectorRef.current = detector
        setEngine(detectorEngine)

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        streamRef.current = stream
        const [videoTrack] = stream.getVideoTracks()
        videoTrackRef.current = videoTrack ?? null

        if (!videoTrack) {
          setTorchDebug('sem video track')
        } else if (!videoTrack.getCapabilities) {
          setTorchDebug('getCapabilities() não existe neste navegador')
        } else {
          const capabilities = videoTrack.getCapabilities() as TorchCapabilities
          setTorchDebug(
            `torch=${JSON.stringify(capabilities.torch)} | chaves: ${Object.keys(capabilities).join(', ')}`,
          )
          setTorchSupported(!!capabilities.torch)
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        startedAtRef.current = performance.now()
        setStatus('scanning')
        rafRef.current = requestAnimationFrame(() => tickRef.current())
      })
      .catch((err: unknown) => {
        setError(mapGetUserMediaError(err))
        setErrorKind(errorKindOf(err))
        setStatus('error')
      })
  }, [tickRef])

  useEffect(() => stop, [stop])

  // Câmera não fica ligada com a aba em segundo plano (T-07 D7).
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && optionsRef.current.stopWhenHidden && streamRef.current) stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [stop])

  return {
    status,
    engine,
    code,
    error,
    errorKind,
    firstReadMs,
    torchSupported,
    torchOn,
    torchDebug,
    videoRef,
    start,
    stop,
    toggleTorch,
  }
}
