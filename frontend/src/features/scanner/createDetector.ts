import {
  BarcodeDetector as PonyfillBarcodeDetector,
  type BarcodeFormat,
  type DetectedBarcode,
} from 'barcode-detector/ponyfill'

const EAN_13_FORMATS: BarcodeFormat[] = ['ean_13']

export type DetectorEngine = 'native' | 'wasm'

export interface ScannerDetector {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

export interface CreateDetectorResult {
  detector: ScannerDetector
  engine: DetectorEngine
}

/** Forma mínima da API nativa `BarcodeDetector` do navegador — não existe
 * na lib DOM do TypeScript instalado, então é declarada aqui em vez de `any`. */
interface NativeBarcodeDetectorCtor {
  new (options?: { formats?: BarcodeFormat[] }): ScannerDetector
  getSupportedFormats(): Promise<readonly BarcodeFormat[]>
}

function getNativeBarcodeDetector(): NativeBarcodeDetectorCtor | undefined {
  return (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor })
    .BarcodeDetector
}

function isForcedWasm(): boolean {
  return new URLSearchParams(window.location.search).get('engine') === 'wasm'
}

/**
 * Usa o `BarcodeDetector` nativo do navegador só quando ele existe *e*
 * declara suporte a `ean_13` (Chrome/Edge no Android sem Play Services
 * expõe a classe mas devolve zero formatos) — caso contrário cai para o
 * ponyfill (ZXing-WASM), que cobre Safari/iOS e Firefox.
 *
 * `?engine=wasm` na URL força o ponyfill mesmo havendo suporte nativo,
 * para comparar os dois motores no mesmo aparelho em campo.
 */
export async function createDetector(): Promise<CreateDetectorResult> {
  const NativeBarcodeDetector = isForcedWasm()
    ? undefined
    : getNativeBarcodeDetector()

  if (NativeBarcodeDetector) {
    const supported = await NativeBarcodeDetector.getSupportedFormats()
    if (supported.includes('ean_13')) {
      return {
        detector: new NativeBarcodeDetector({ formats: EAN_13_FORMATS }),
        engine: 'native',
      }
    }
  }

  return {
    detector: new PonyfillBarcodeDetector({ formats: EAN_13_FORMATS }),
    engine: 'wasm',
  }
}
