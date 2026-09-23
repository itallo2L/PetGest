import { useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { supabase } from '../../shared/supabaseClient'
import { AuthLayout } from './AuthLayout'
import { EMAIL_RE, toFormMessage, type FormMessage } from './authErrors'
import { FormError } from './FormError'
import { useSession } from './sessionContext'
import { StoreFields } from './StoreFields'

/** Conta logada sem petshop (ex.: o `signup_petshop` falhou no cadastro). */
export function CompleteSignupPage() {
  const { session, refreshPetshop } = useSession()
  const location = useLocation()
  const initialError = (location.state as { error?: FormMessage } | null)?.error ?? null
  const [storeName, setStoreName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(session?.user.email ?? '')
  const [error, setError] = useState<FormMessage | null>(initialError)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const name = storeName.trim()
    const trimmedEmail = email.trim()
    if (!name) {
      setError({ text: 'Informe o nome da loja.' })
      document.getElementById('storeName')?.focus()
      return
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError({ text: 'Informe um e-mail válido.' })
      document.getElementById('storeEmail')?.focus()
      return
    }

    setError(null)
    setSubmitting(true)
    const { error: rpcError } = await supabase.rpc('signup_petshop', {
      petshop_name: name,
      petshop_email: trimmedEmail,
      petshop_phone: phone.trim() || null,
    })
    if (rpcError && rpcError.code !== '23505') {
      setError(toFormMessage(rpcError))
      setSubmitting(false)
      return
    }
    await refreshPetshop()
    // Status `ready`: a guarda leva para Produtos.
  }

  return (
    <AuthLayout title="Concluir cadastro da loja" subtitle="Falta só informar os dados da sua loja">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <StoreFields name={storeName} onNameChange={setStoreName} phone={phone} onPhoneChange={setPhone} />

        <div className="field">
          <label className="field__label" htmlFor="storeEmail">
            E-mail da loja
          </label>
          <input
            className="input"
            type="email"
            id="storeEmail"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <FormError message={error} />

        <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Concluir cadastro'}
        </button>
      </form>

      <p className="auth-hint">
        Não é sua conta?{' '}
        <button type="button" className="btn btn--link" onClick={() => void supabase.auth.signOut()}>
          Sair
        </button>
      </p>
    </AuthLayout>
  )
}
