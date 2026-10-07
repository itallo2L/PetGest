import { fitWithin } from './aiHelpers'

/**
 * Foto da câmera → JPEG reduzido (design D6 da T-19). Respeita a orientação EXIF (foto
 * em pé continua em pé) e converte o HEIC do iPhone, que o Safari consegue decodificar,
 * para um formato que a API aceita.
 */
export async function toJpeg(file: Blob, quality = 0.82): Promise<Blob> {
  const image = await decode(file)
  try {
    const { width, height } = fitWithin(image.width, image.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D indisponível')
    context.drawImage(image, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar o JPEG'))), 'image/jpeg', quality),
    )
  } finally {
    if ('close' in image) image.close()
  }
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in globalThis) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Safari antigo não aceita as opções; cai no <img>.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}
