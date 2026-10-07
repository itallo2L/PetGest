import type { DraftsBackend, ProductSuggestion } from '../types'
import type { ApiClient } from './client'
import type { components } from './schema'

type Schemas = components['schemas']

/** Cadastro por foto e por voz pela API (T-19/T-20). */
export function createApiDrafts(client: ApiClient): DraftsBackend {
  async function upload(path: string, field: string, file: Blob, fileName: string): Promise<ProductSuggestion> {
    const form = new FormData()
    form.append(field, file, fileName)
    const draft = await client.request<Schemas['ProductSuggestionResponse']>('POST', path, { body: form })
    return {
      draftId: draft.draftId,
      source: draft.source === 'voice_ai' ? 'voice_ai' : 'photo_ai',
      name: draft.name ?? null,
      category: draft.category ?? null,
      price: draft.price == null ? null : Number(draft.price),
      ean: draft.ean ?? null,
      transcript: draft.transcript ?? null,
    }
  }

  return {
    async availability() {
      const result = await client.request<Schemas['DraftAvailabilityResponse']>('GET', '/products/drafts/availability')
      return { photo: result.photo, voice: result.voice }
    },

    fromPhoto(image) {
      return upload('/products/drafts/photo', 'image', image, 'foto.jpg')
    },

    fromVoice(audio) {
      return upload('/products/drafts/voice', 'audio', audio, 'audio')
    },
  }
}
