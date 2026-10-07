import { describe, expect, it } from 'vitest'
import type { ProductSuggestion } from '../../../shared/backend'
import { applySuggestion, fitWithin, pickAudioMimeType } from './aiHelpers'

const EMPTY = { name: '', category: 'Ração', price: '', ean: '' }

function suggestion(fields: Partial<ProductSuggestion>): ProductSuggestion {
  return { draftId: 'd1', source: 'photo_ai', name: null, category: null, price: null, ean: null, transcript: null, ...fields }
}

// Apoio do cadastro por foto e por voz (T-19/T-20).
describe('fitWithin', () => {
  it('reduz a foto do celular mantendo a proporção', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 })
  })

  it('não aumenta foto pequena', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('pickAudioMimeType', () => {
  it('Chrome grava WebM/Opus', () => {
    expect(pickAudioMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus')
  })

  it('Safari grava MP4', () => {
    expect(pickAudioMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4')
  })

  it('sem suporte conhecido, o navegador escolhe', () => {
    expect(pickAudioMimeType(() => false)).toBe('')
  })
})

describe('applySuggestion', () => {
  it('preenche só o que a IA reconheceu', () => {
    const result = applySuggestion(
      { ...EMPTY, price: '10,00' },
      suggestion({ name: 'Ração Golden 15kg', category: 'Ração', ean: '7891000315507' }),
    )

    expect(result.fields).toEqual({ name: 'Ração Golden 15kg', category: 'Ração', price: '10,00', ean: '7891000315507' })
    expect(result.recognized).toBe(true)
  })

  it('formata o preço falado como o campo espera', () => {
    expect(applySuggestion(EMPTY, suggestion({ name: 'Petisco', price: 9.9 })).fields.price).toBe('9,90')
  })

  it('sem nome nem código, não reconheceu o produto', () => {
    const result = applySuggestion(EMPTY, suggestion({ category: 'Higiene' }))

    expect(result.recognized).toBe(false)
    expect(result.fields.category).toBe('Higiene')
  })
})
