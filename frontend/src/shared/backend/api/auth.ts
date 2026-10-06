import { BackendError, isBackendError } from '../errors'
import type { AuthBackend, AuthUser } from '../types'
import type { ApiClient } from './client'
import type { components } from './schema'

type Schemas = components['schemas']

/** Sessão na API do V1 (T-14) — design D2/D4 da T-16. */
export function createApiAuth(client: ApiClient): AuthBackend {
  const listeners = new Set<(user: AuthUser | null) => void>()
  const emit = (user: AuthUser | null) => listeners.forEach((listener) => listener(user))

  // Renovação recusada ou mudança em outra aba.
  client.onSessionChange(emit)

  async function openSession(path: string, body: unknown) {
    const session = await client.request<Schemas['SessionResponse']>('POST', path, { body, auth: false })
    emit(client.setSession(session))
  }

  return {
    /** Sem rede: o usuário salvo basta; a renovação acontece na primeira chamada. */
    async restore() {
      return client.storedUser()
    },

    subscribe(listener) {
      listeners.add(listener)
      queueMicrotask(() => listener(client.storedUser()))
      return () => listeners.delete(listener)
    },

    async signIn(email, password) {
      await openSession('/auth/login', { email, password } satisfies Schemas['LoginRequest'])
    },

    /** Uma chamada só: conta + loja + vínculo, atômico na API — nunca há `storeError`. */
    async signUp({ email, password, storeName, storePhone }) {
      await openSession('/auth/signup', {
        email,
        password,
        petshopName: storeName,
        petshopEmail: email,
        petshopPhone: storePhone,
      } satisfies Schemas['SignupRequest'])
      return {}
    },

    /** A loja nova só entra no token depois da renovação (T-15 D5). */
    async completeSignup(store) {
      try {
        await client.request('POST', '/petshop', { body: store satisfies Schemas['PetshopRequest'] })
      } catch (error) {
        // Envio repetido — segue como sucesso, como no V0.
        if (!(isBackendError(error) && error.kind === 'petshop_exists')) throw error
      }
      if (!(await client.refresh())) throw new BackendError('session_expired')
    },

    async currentPetshop() {
      try {
        const petshop = await client.request<Schemas['PetshopResponse']>('GET', '/petshop')
        return { id: petshop.id, name: petshop.name }
      } catch (error) {
        if (isBackendError(error) && error.kind === 'not_found') return null
        throw error
      }
    },

    /** Revoga na API; sem rede, sai do app mesmo assim. */
    async signOut() {
      const refreshToken = client.storedRefreshToken()
      if (refreshToken) {
        try {
          await client.request('POST', '/auth/logout', { body: { refreshToken }, auth: false })
        } catch {
          // a revogação falhou (rede): o token some do navegador de qualquer forma
        }
      }
      client.clearSession()
    },
  }
}
