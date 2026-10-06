import { describe, expect, it } from 'vitest'
import { REFRESH_TOKEN_KEY, USER_KEY } from './client'
import { createApiBackend } from './index'
import { fakeDeps, json, sessionFor } from './testing'

const USER = { id: '22222222-2222-2222-2222-222222222222', email: 'dono@loja.test' }

// Backend da API sobre o cliente: sessão, saída e loja (spec frontend-backend).
describe('createApiBackend', () => {
  it('sem sessão salva, restore e subscribe dão null sem ir à rede', async () => {
    const fake = fakeDeps({})
    const backend = createApiBackend('/api', fake.deps)

    expect(await backend.auth.restore()).toBeNull()
    const first = await new Promise((resolve) => backend.auth.subscribe(resolve))
    expect(first).toBeNull()
    expect(fake.calls).toHaveLength(0)
  })

  it('cadastro é uma chamada só, usa o e-mail da conta na loja e avisa o usuário', async () => {
    const fake = fakeDeps({ 'POST /auth/signup': () => json(201, sessionFor(USER, 'r1', 'p1')) })
    const backend = createApiBackend('/api', fake.deps)
    const seen: unknown[] = []
    backend.auth.subscribe((user) => seen.push(user))
    await Promise.resolve()

    const result = await backend.auth.signUp({ email: USER.email, password: 'senha123', storeName: 'Pet', storePhone: null })

    expect(result).toEqual({})
    expect(fake.calls[0].body).toEqual({
      email: USER.email,
      password: 'senha123',
      petshopName: 'Pet',
      petshopEmail: USER.email,
      petshopPhone: null,
    })
    expect(seen.at(-1)).toEqual(USER)
    expect(await backend.auth.restore()).toEqual(USER)
  })

  it('sair sem rede apaga a sessão mesmo assim', async () => {
    const fake = fakeDeps({
      'POST /auth/logout': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    fake.store.set(REFRESH_TOKEN_KEY, 'r1')
    fake.store.set(USER_KEY, JSON.stringify(USER))
    const backend = createApiBackend('/api', fake.deps)

    await backend.auth.signOut()

    expect(fake.store.has(REFRESH_TOKEN_KEY)).toBe(false)
    expect(await backend.auth.restore()).toBeNull()
  })

  it('sair revoga o refresh token na API', async () => {
    const fake = fakeDeps({ 'POST /auth/logout': () => json(204) })
    fake.store.set(REFRESH_TOKEN_KEY, 'r1')
    fake.store.set(USER_KEY, JSON.stringify(USER))
    const backend = createApiBackend('/api', fake.deps)

    await backend.auth.signOut()

    expect(fake.calls[0]).toMatchObject({ path: '/auth/logout', body: { refreshToken: 'r1' } })
  })

  it('concluir cadastro cria a loja e renova a sessão para o token trazer a loja', async () => {
    const fake = fakeDeps({
      'POST /auth/login': () => json(200, sessionFor(USER, 'r1')),
      'POST /petshop': () => json(201, { id: 'p1', name: 'Pet', email: 'p@t.test', phone: null, sessionRenewalRequired: true }),
      'POST /auth/refresh': () => json(200, sessionFor(USER, 'r2', 'p1')),
      'GET /petshop': ({ authorization }) =>
        authorization === `Bearer ${sessionFor(USER, 'r2', 'p1').accessToken}`
          ? json(200, { id: 'p1', name: 'Pet', email: 'p@t.test', phone: null })
          : json(404, { code: 'petshop_not_found' }),
    })
    const backend = createApiBackend('/api', fake.deps)
    await backend.auth.signIn(USER.email, 'senha123')
    expect(await backend.auth.currentPetshop()).toBeNull()

    await backend.auth.completeSignup({ name: 'Pet', email: 'p@t.test', phone: null })

    expect(await backend.auth.currentPetshop()).toEqual({ id: 'p1', name: 'Pet' })
    expect(fake.store.get(REFRESH_TOKEN_KEY)).toBe('r2')
  })

  it('concluir cadastro repetido (409) segue como sucesso', async () => {
    const fake = fakeDeps({
      'POST /auth/login': () => json(200, sessionFor(USER, 'r1', 'p1')),
      'POST /petshop': () => json(409, { code: 'petshop_exists' }),
      'POST /auth/refresh': () => json(200, sessionFor(USER, 'r2', 'p1')),
    })
    const backend = createApiBackend('/api', fake.deps)
    await backend.auth.signIn(USER.email, 'senha123')

    await expect(backend.auth.completeSignup({ name: 'Pet', email: 'p@t.test', phone: null })).resolves.toBeUndefined()
  })

  it('busca por código: 404 vira não encontrado', async () => {
    const fake = fakeDeps({
      'POST /auth/login': () => json(200, sessionFor(USER, 'r1', 'p1')),
      'GET /products/by-ean/7891000100103': () => json(404, { code: 'product_not_found' }),
      'GET /products/by-ean/78910001': () =>
        json(200, { id: 'x', name: 'Petisco', category: 'Petiscos', price: '5.5', ean: '78910001', source: 'barcode', updatedAt: 't' }),
    })
    const backend = createApiBackend('/api', fake.deps)
    await backend.auth.signIn(USER.email, 'senha123')

    expect(await backend.products.findByEan('7891000100103')).toBeNull()
    expect(await backend.products.findByEan('78910001')).toMatchObject({ name: 'Petisco', price: 5.5 })
  })
})
