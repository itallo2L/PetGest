import { useEffect, useState, type FormEvent } from 'react'
import { EMAIL_RE, toFormMessage, type FormMessage } from '../auth/authErrors'
import { FormError } from '../auth/FormError'
import { useSession } from '../auth/sessionContext'
import { Icon } from '../../shared/ui/Icon'
import { useToast } from '../../shared/ui/toastContext'
import { getStore, updateStore, type Store } from './petshopApi'
import './settings.css'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; store: Store }

/** Configurações do V0: só "Dados da loja" (PLANOMVP §3.8). */
export function SettingsPage() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // Recarrega a cada tentativa; ignora a resposta se a tela já saiu (T-08 D4).
  useEffect(() => {
    let active = true
    getStore().then(
      (store) => active && setLoad({ status: 'ready', store }),
      (err: unknown) => active && setLoad({ status: 'error', message: toFormMessage(err).text }),
    )
    return () => {
      active = false
    }
  }, [attempt])

  if (load.status === 'loading') {
    return (
      <p className="empty-state__text" role="status">
        Carregando dados da loja…
      </p>
    )
  }

  if (load.status === 'error') {
    return (
      <div className="empty-state">
        <span className="empty-state__icon" aria-hidden="true">
          <Icon name="alert" />
        </span>
        <h2 className="empty-state__title">Não foi possível carregar os dados da loja</h2>
        <p className="empty-state__text">{load.message}</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setLoad({ status: 'loading' })
            setAttempt((n) => n + 1)
          }}
        >
          <Icon name="refresh" size="sm" />
          Tentar de novo
        </button>
      </div>
    )
  }

  return <StoreForm store={load.store} onSaved={(store) => setLoad({ status: 'ready', store })} />
}

function StoreForm({ store, onSaved }: { store: Store; onSaved: (store: Store) => void }) {
  const { refreshPetshop } = useSession()
  const showToast = useToast()
  const [name, setName] = useState(store.name)
  const [email, setEmail] = useState(store.email)
  const [phone, setPhone] = useState(store.phone ?? '')
  const [error, setError] = useState<FormMessage | null>(null)
  const [saving, setSaving] = useState(false)

  function invalid(text: string, fieldId: string) {
    setError({ text })
    document.getElementById(fieldId)?.focus()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName) return invalid('Informe o nome do petshop.', 'setStoreName')
    if (!EMAIL_RE.test(trimmedEmail)) return invalid('Informe um e-mail válido.', 'setEmail')

    setError(null)
    setSaving(true)
    try {
      // Telefone opcional: vazio vira null, como no cadastro (T-08 D2).
      const saved = await updateStore(store.id, { name: trimmedName, email: trimmedEmail, phone: phone.trim() || null })
      await refreshPetshop() // nome e iniciais novos na barra lateral (T-08 D3)
      showToast({ type: 'success', title: 'Dados da loja salvos', text: saved.name })
      onSaved(saved)
    } catch (err) {
      setError(toFormMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-grid">
      <section className="card" aria-labelledby="storeTitle">
        <header className="card__header">
          <div>
            <h2 className="card__title" id="storeTitle">
              Dados da loja
            </h2>
            <p className="card__subtitle">Aparecem na barra lateral e no cadastro do petshop</p>
          </div>
        </header>

        <form className="card__body form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="setStoreName">
              Nome do petshop
            </label>
            <input
              className="input"
              type="text"
              id="setStoreName"
              autoComplete="organization"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor="setEmail">
                E-mail
              </label>
              <input
                className="input"
                type="email"
                id="setEmail"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className="field__hint">E-mail de contato da loja. Não muda o e-mail que você usa para entrar.</p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="setPhone">
                Telefone <span className="field__optional">(opcional)</span>
              </label>
              <input
                className="input"
                type="tel"
                id="setPhone"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </div>

          <FormError message={error} />

          <div className="form__actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              <Icon name="check" size="sm" />
              {saving ? 'Salvando…' : 'Salvar dados da loja'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
