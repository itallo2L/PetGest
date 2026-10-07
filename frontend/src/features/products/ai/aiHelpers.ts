import type { ProductSuggestion } from '../../../shared/backend'
import { priceToInput } from '../productFormat'

/** Lado maior da foto enviada à IA (design D6 da T-19): legível para o modelo e leve para
 * subir em 4G — uma foto de 12 MP vira ~200–400 KB em JPEG. */
export const MAX_PHOTO_SIDE = 1600

/** Gravação de voz: o suficiente para dizer nome, categoria e preço (design D2 da T-20). */
export const MAX_RECORDING_SECONDS = 30

/** Novas dimensões para caber em `max` × `max` mantendo a proporção (nunca aumenta). */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Formato do `MediaRecorder` que a API e a OpenAI aceitam: Chrome/Android grava WebM/Opus,
 * Safari/iPhone grava MP4/AAC. `''` = deixa o navegador escolher. */
export function pickAudioMimeType(isSupported: (type: string) => boolean): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((type) => isSupported(type)) ?? ''
}

export interface FormFields {
  name: string
  category: string
  price: string
  ean: string
}

/** Aplica no formulário só os campos que a IA reconheceu; o resto fica como o usuário
 * deixou. `recognized` = a IA leu pelo menos o nome ou o código. */
export function applySuggestion(current: FormFields, suggestion: ProductSuggestion): { fields: FormFields; recognized: boolean } {
  return {
    fields: {
      name: suggestion.name ?? current.name,
      category: suggestion.category ?? current.category,
      price: suggestion.price == null ? current.price : priceToInput(suggestion.price),
      ean: suggestion.ean ?? current.ean,
    },
    recognized: suggestion.name !== null || suggestion.ean !== null,
  }
}
