import { useBarcodeScanner } from './useBarcodeScanner'

const engineLabel: Record<string, string> = {
  native: 'nativo',
  wasm: 'wasm',
}

export function ScannerSpike() {
  const {
    status,
    engine,
    code,
    error,
    firstReadMs,
    torchSupported,
    torchOn,
    videoRef,
    start,
    stop,
    toggleTorch,
  } = useBarcodeScanner()

  const isScanning = status === 'asking' || status === 'scanning'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <button
        type="button"
        onClick={isScanning ? stop : start}
        style={{ width: '100%', padding: 12, fontSize: 16 }}
      >
        {isScanning ? 'Parar' : 'Iniciar câmera'}
      </button>

      {isScanning && torchSupported && (
        <button
          type="button"
          onClick={toggleTorch}
          style={{ width: '100%', padding: 12, fontSize: 16, marginTop: 8 }}
        >
          {torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}
        </button>
      )}

      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{ width: '100%', marginTop: 12, background: '#000' }}
      />

      <dl style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 14 }}>
        <dt>Motor</dt>
        <dd>{engine ? engineLabel[engine] : '—'}</dd>

        <dt>Status</dt>
        <dd>{status}</dd>

        <dt>Código lido</dt>
        <dd>{code ?? '—'}</dd>

        <dt>Tempo até 1ª leitura</dt>
        <dd>{firstReadMs !== null ? `${firstReadMs} ms` : '—'}</dd>

        <dt>Erro</dt>
        <dd style={{ color: error ? 'crimson' : undefined }}>{error ?? '—'}</dd>
      </dl>
    </div>
  )
}
