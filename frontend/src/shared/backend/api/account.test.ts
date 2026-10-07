import { describe, expect, it } from 'vitest'
import { BackendError } from '../errors'
import { REFRESH_TOKEN_KEY } from './client'
import { createApiBackend } from './index'
import { fakeDeps, json } from './testing'

const USER_ID = '33333333-3333-3333-3333-333333333333'

// Links enviados por e-mail (T-22): chamadas públicas que não mexem na sessão.
describe('account (API)', () => {
  it('pedir o link de redefinição vai sem token e não toca a sessão', async () => {
    const fake = fakeDeps({ 'POST /auth/forgot-password': () => json(202) })
    fake.store.set(REFRESH_TOKEN_KEY, 'r1')
    const backend = createApiBackend('/api', fake.deps)

    await backend.account!.requestPasswordReset('dono@loja.test')

    expect(fake.calls).toEqual([
      { method: 'POST', path: '/auth/forgot-password', body: { email: 'dono@loja.test' }, authorization: null },
    ])
    expect(fake.store.get(REFRESH_TOKEN_KEY)).toBe('r1')
  })

  it('redefinir envia usuário, código e senha', async () => {
    const fake = fakeDeps({ 'POST /auth/reset-password': () => json(204) })
    const backend = createApiBackend('/api', fake.deps)

    await backend.account!.resetPassword(USER_ID, 'abc', 'senha-nova')

    expect(fake.calls[0].body).toEqual({ userId: USER_ID, code: 'abc', password: 'senha-nova' })
  })

  it.each([
    ['POST /auth/reset-password', 'invalid_reset'],
    ['POST /auth/confirm-email', 'invalid_confirmation'],
  ])('%s com link inválido vira invalid_link', async (route, code) => {
    const fake = fakeDeps({ [route]: () => json(400, { code, title: 'Link inválido' }) })
    const backend = createApiBackend('/api', fake.deps)

    const call =
      route === 'POST /auth/reset-password'
        ? backend.account!.resetPassword(USER_ID, 'x', 'senha-nova')
        : backend.account!.confirmEmail(USER_ID, 'x')

    await expect(call).rejects.toMatchObject({ kind: 'invalid_link' } satisfies Partial<BackendError>)
  })

  it('senha fraca na redefinição vira weak_password', async () => {
    const fake = fakeDeps({ 'POST /auth/reset-password': () => json(400, { code: 'weak_password' }) })
    const backend = createApiBackend('/api', fake.deps)

    await expect(backend.account!.resetPassword(USER_ID, 'x', '123')).rejects.toMatchObject({ kind: 'weak_password' })
  })

  it('reenviar a confirmação vai sem token', async () => {
    const fake = fakeDeps({ 'POST /auth/resend-confirmation': () => json(202) })
    const backend = createApiBackend('/api', fake.deps)

    await backend.account!.resendConfirmation('dono@loja.test')

    expect(fake.calls[0]).toMatchObject({ body: { email: 'dono@loja.test' }, authorization: null })
  })
})
