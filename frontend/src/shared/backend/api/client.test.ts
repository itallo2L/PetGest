import { describe, expect, it } from 'vitest'
import { BackendError } from '../errors'
import { ApiClient, REFRESH_TOKEN_KEY, USER_KEY, userFromAccessToken } from './client'
import { fakeDeps, fakeJwt, json, sessionFor } from './testing'

const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'dono@loja.test' }

// Requisitos "Sessão com a API persistida", "Renovação transparente e em voo único",
// "Sessão sincronizada entre abas" e "Erros do backend em português" da spec
// frontend-backend.
describe('ApiClient', () => {
  function loggedIn(handlers: Parameters<typeof fakeDeps>[0]) {
    const fake = fakeDeps(handlers)
    const client = new ApiClient('/api', fake.deps)
    client.setSession(sessionFor(USER, 'r1'))
    return { ...fake, client }
  }

  it('guarda o refresh token e o usuário, e nunca o token de acesso', () => {
    const { store } = loggedIn({})

    expect(store.get(REFRESH_TOKEN_KEY)).toBe('r1')
    expect(JSON.parse(store.get(USER_KEY)!)).toEqual(USER)
    expect([...store.values()].some((value) => value.includes('eyJ'))).toBe(false)
  })

  it('lê usuário e e-mail das claims do token de acesso', () => {
    expect(userFromAccessToken(fakeJwt({ sub: USER.id, email: 'josé@loja.test' }))).toEqual({
      id: USER.id,
      email: 'josé@loja.test',
    })
  })

  it('três chamadas com 401 fazem uma só renovação e repetem com o token novo', async () => {
    let refreshes = 0
    const { client, calls } = loggedIn({
      'GET /products': ({ authorization }) =>
        authorization === `Bearer ${sessionFor(USER, 'r2').accessToken}` ? json(200, []) : json(401),
      'POST /auth/refresh': async ({ body }) => {
        refreshes++
        expect(body).toEqual({ refreshToken: 'r1' })
        await new Promise((resolve) => setTimeout(resolve, 10))
        return json(200, sessionFor(USER, 'r2'))
      },
    })
    // O token de acesso em memória "venceu": a primeira resposta de cada chamada é 401.
    client.setSession({ ...sessionFor(USER, 'r1'), accessToken: fakeJwt({ sub: USER.id, email: USER.email, old: true }) })

    await Promise.all([1, 2, 3].map(() => client.request('GET', '/products')))

    expect(refreshes).toBe(1)
    expect(calls.filter((c) => c.path === '/products')).toHaveLength(6)
  })

  it('sessão restaurada renova antes da primeira chamada', async () => {
    const fake = fakeDeps({
      'POST /auth/refresh': () => json(200, sessionFor(USER, 'r2')),
      'GET /petshop': ({ authorization }) => (authorization ? json(200, { id: 'p1' }) : json(401)),
    })
    fake.store.set(REFRESH_TOKEN_KEY, 'r1')
    fake.store.set(USER_KEY, JSON.stringify(USER))
    const client = new ApiClient('/api', fake.deps)

    expect(client.storedUser()).toEqual(USER)
    await expect(client.request('GET', '/petshop')).resolves.toEqual({ id: 'p1' })
    expect(fake.calls.map((c) => c.path)).toEqual(['/auth/refresh', '/petshop'])
    expect(fake.store.get(REFRESH_TOKEN_KEY)).toBe('r2')
  })

  it('renovação recusada apaga a sessão e avisa null', async () => {
    const { client, store } = loggedIn({
      'GET /products': () => json(401),
      'POST /auth/refresh': () => json(401, { code: 'invalid_refresh_token' }),
    })
    const seen: unknown[] = []
    client.onSessionChange((user) => seen.push(user))

    await expect(client.request('GET', '/products')).rejects.toMatchObject({ kind: 'session_expired' })

    expect(store.has(REFRESH_TOKEN_KEY)).toBe(false)
    expect(store.has(USER_KEY)).toBe(false)
    expect(seen).toEqual([null])
  })

  it('renova com o refresh token que outra aba acabou de gravar', async () => {
    const fake = fakeDeps({
      'POST /auth/refresh': ({ body }) => json(200, sessionFor(USER, `depois-de-${(body as { refreshToken: string }).refreshToken}`)),
      'GET /petshop': () => json(200, {}),
    })
    fake.store.set(REFRESH_TOKEN_KEY, 'r1')
    fake.store.set(USER_KEY, JSON.stringify(USER))
    const client = new ApiClient('/api', fake.deps)

    fake.emitStorage(REFRESH_TOKEN_KEY, 'r2-da-outra-aba')
    await client.request('GET', '/petshop')

    expect(fake.calls[0].body).toEqual({ refreshToken: 'r2-da-outra-aba' })
  })

  it('saída em outra aba avisa null', () => {
    const { client, emitStorage } = loggedIn({})
    const seen: unknown[] = []
    client.onSessionChange((user) => seen.push(user))

    emitStorage(REFRESH_TOKEN_KEY, null)

    expect(seen).toEqual([null])
    expect(client.storedUser()).toBeNull()
  })

  it('erro de rede vira network e não apaga a sessão', async () => {
    const fake = fakeDeps({
      'POST /auth/refresh': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    fake.store.set(REFRESH_TOKEN_KEY, 'r1')
    fake.store.set(USER_KEY, JSON.stringify(USER))
    const client = new ApiClient('/api', fake.deps)

    await expect(client.request('GET', '/petshop')).rejects.toMatchObject({ kind: 'network' })
    expect(fake.store.get(REFRESH_TOKEN_KEY)).toBe('r1')
  })

  it('traduz ProblemDetails para BackendError', async () => {
    const { client } = loggedIn({
      'POST /products': () =>
        json(409, { code: 'ean_taken', title: 'O código já pertence a Ração X', product: { id: 'p9', name: 'Ração X' } }),
      'POST /auth/login': () => json(429),
      'GET /products/p0': () => json(404, { code: 'product_not_found' }),
      'POST /auth/signup': () => json(400, { title: 'One or more validation errors occurred.', errors: {} }),
    })

    const conflict = await client.request('POST', '/products', { body: {} }).catch((e: BackendError) => e)
    expect(conflict).toMatchObject({ kind: 'ean_taken', owner: { id: 'p9', name: 'Ração X' } })
    await expect(client.request('POST', '/auth/login', { auth: false })).rejects.toMatchObject({ kind: 'rate_limited' })
    await expect(client.request('GET', '/products/p0')).rejects.toMatchObject({ kind: 'not_found' })
    await expect(client.request('POST', '/auth/signup', { auth: false })).rejects.toMatchObject({ kind: 'unknown' })
  })
})
