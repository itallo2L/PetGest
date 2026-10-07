import { describe, expect, it } from 'vitest'
import { REFRESH_TOKEN_KEY, USER_KEY } from './client'
import { createApiBackend } from './index'
import { fakeDeps, json, sessionFor } from './testing'

const USER = { id: '44444444-4444-4444-4444-444444444444', email: 'dono@loja.test' }

function signedIn(handlers: Parameters<typeof fakeDeps>[0]) {
  const fake = fakeDeps({ 'POST /auth/refresh': () => json(200, sessionFor(USER, 'r2', 'p1')), ...handlers })
  fake.store.set(REFRESH_TOKEN_KEY, 'r1')
  fake.store.set(USER_KEY, JSON.stringify(USER))
  return fake
}

// Cadastro por foto e por voz pela API (T-19/T-20).
describe('drafts (API)', () => {
  it('foto vai como multipart com o token e volta como sugestão', async () => {
    const fake = signedIn({
      'POST /products/drafts/photo': () =>
        json(200, {
          draftId: 'd1',
          source: 'photo_ai',
          name: 'Ração Golden 15kg',
          category: 'Ração',
          price: null,
          ean: '7891000315507',
          transcript: null,
        }),
    })
    const backend = createApiBackend('/api', fake.deps)

    const suggestion = await backend.drafts!.fromPhoto(new Blob(['jpeg'], { type: 'image/jpeg' }))

    expect(suggestion).toEqual({
      draftId: 'd1',
      source: 'photo_ai',
      name: 'Ração Golden 15kg',
      category: 'Ração',
      price: null,
      ean: '7891000315507',
      transcript: null,
    })
    const upload = fake.calls.find((c) => c.path === '/products/drafts/photo')!
    expect(upload.body).toBeInstanceOf(FormData)
    expect((upload.body as FormData).get('image')).toBeInstanceOf(Blob)
    expect(upload.contentType).toBeNull() // o navegador põe o boundary
    expect(upload.authorization).toMatch(/^Bearer /)
  })

  it('voz devolve o preço como número e a transcrição', async () => {
    const fake = signedIn({
      'POST /products/drafts/voice': () =>
        json(200, { draftId: 'd2', source: 'voice_ai', name: 'Petisco', category: 'Petiscos', price: 9.9, ean: null, transcript: 'petisco nove e noventa' }),
    })
    const backend = createApiBackend('/api', fake.deps)

    const suggestion = await backend.drafts!.fromVoice(new Blob(['webm'], { type: 'audio/webm' }))

    expect(suggestion.price).toBe(9.9)
    expect(suggestion.transcript).toBe('petisco nove e noventa')
    expect((fake.calls.at(-1)!.body as FormData).get('audio')).toBeInstanceOf(Blob)
  })

  it.each([
    [503, 'ai_unavailable'],
    [502, 'ai_failed'],
    [400, 'invalid_file'],
  ])('erro %i com código %s vira o mesmo kind', async (status, code) => {
    const fake = signedIn({ 'POST /products/drafts/photo': () => json(status, { code }) })
    const backend = createApiBackend('/api', fake.deps)

    await expect(backend.drafts!.fromPhoto(new Blob(['x']))).rejects.toMatchObject({ kind: code })
  })

  it('produto salvo a partir da IA leva a origem e o rascunho', async () => {
    const fake = signedIn({
      'POST /products': () =>
        json(201, { id: 'p9', name: 'X', category: 'Ração', price: 1, ean: null, source: 'photo_ai', updatedAt: '2026-10-07T00:00:00Z' }),
    })
    const backend = createApiBackend('/api', fake.deps)

    await backend.products.create({ name: 'X', category: 'Ração', price: 1, ean: null }, 'photo_ai', 'd1')

    expect(fake.calls.at(-1)!.body).toEqual({ name: 'X', category: 'Ração', price: 1, ean: null, source: 'photo_ai', draftId: 'd1' })
    expect(fake.calls.at(-1)!.contentType).toBe('application/json')
  })
})
