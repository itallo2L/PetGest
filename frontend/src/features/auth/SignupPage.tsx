import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { supabase } from '../../shared/supabaseClient'
import { AuthLayout } from './AuthLayout'
import { EMAIL_RE, MIN_PASSWORD_LENGTH, toFormMessage, type FormMessage } from './authErrors'
import { FormError } from './FormError'
import type { FromState } from './guards'
import { PasswordField } from './PasswordField'
import { useSession } from './sessionContext'
import { StoreFields } from './StoreFields'

/** Conta + loja na mesma submissão: `signUp` e depois `signup_petshop`. */
export function SignupPage() {
  const { refreshPetshop, setSignupInProgress } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [storeName, setStoreName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<FormMessage | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // A flag só é desligada quando a tela sai da árvore: o navigate() do
  // react-router é uma transição e chega depois da atualização de status;
  // desligar antes faria a guarda redirecionar sem a mensagem de erro.
  useEffect(() => () => setSignupInProgress(false), [setSignupInProgress])

  function invalid(text: string, fieldId: string) {
    setError({ text })
    document.getElementById(fieldId)?.focus()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const name = storeName.trim()
    const trimmedEmail = email.trim()
    if (!name) return invalid('Informe o nome da loja.', 'storeName')
    if (!EMAIL_RE.test(trimmedEmail)) return invalid('Informe um e-mail válido.', 'signupEmail')
    if (password.length < MIN_PASSWORD_LENGTH) {
      return invalid(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'signupPassword')
    }

    setError(null)
    setSubmitting(true)
    setSignupInProgress(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email: trimmedEmail, password })
    if (signUpError || !data.session) {
      setSignupInProgress(false) // continua nesta tela, sem sessão nova
      setError(toFormMessage(signUpError ?? new Error('signUp sem sessão')))
      setSubmitting(false)
      return
    }

    const { error: rpcError } = await supabase.rpc('signup_petshop', {
      petshop_name: name,
      petshop_email: trimmedEmail,
      petshop_phone: phone.trim() || null,
    })
    // 23505 = a loja já existe (envio repetido): segue como sucesso.
    if (rpcError && rpcError.code !== '23505') {
      const message = toFormMessage(rpcError)
      // Garante o status `no-petshop` antes de navegar; senão a guarda de
      // /concluir-cadastro ainda vê a sessão anterior e descarta a mensagem.
      await refreshPetshop()
      navigate('/concluir-cadastro', { replace: true, state: { error: message } })
      return
    }

    await refreshPetshop()
    // Status `ready`: a guarda leva para a página de origem ou Produtos.
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Cadastre sua loja para começar">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <StoreFields name={storeName} onNameChange={setStoreName} phone={phone} onPhoneChange={setPhone} />

        <div className="field">
          <label className="field__label" htmlFor="signupEmail">
            E-mail
          </label>
          <input
            className="input"
            type="email"
            id="signupEmail"
            inputMode="email"
            autoComplete="username"
            placeholder="voce@petshop.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <span className="field__hint">Usado para entrar e como e-mail da loja.</span>
        </div>

        <PasswordField
          id="signupPassword"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
        />

        <FormError message={error} />

        <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
          {submitting ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>

      <p className="auth-hint">
        Já tem conta?{' '}
        <Link to="/entrar" state={location.state as FromState | null}>
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}
