import type { AccountBackend } from '../types'
import type { ApiClient } from './client'
import type { components } from './schema'

type Schemas = components['schemas']

/** Links enviados por e-mail (T-22). Chamadas públicas: não usam nem mexem na sessão. */
export function createApiAccount(client: ApiClient): AccountBackend {
  return {
    async requestPasswordReset(email) {
      await client.request('POST', '/auth/forgot-password', {
        body: { email } satisfies Schemas['ForgotPasswordRequest'],
        auth: false,
      })
    },

    async resetPassword(userId, code, password) {
      await client.request('POST', '/auth/reset-password', {
        body: { userId, code, password } satisfies Schemas['ResetPasswordRequest'],
        auth: false,
      })
    },

    async confirmEmail(userId, code) {
      await client.request('POST', '/auth/confirm-email', {
        body: { userId, code } satisfies Schemas['ConfirmEmailRequest'],
        auth: false,
      })
    },

    async resendConfirmation(email) {
      await client.request('POST', '/auth/resend-confirmation', {
        body: { email } satisfies Schemas['ResendConfirmationRequest'],
        auth: false,
      })
    },
  }
}
