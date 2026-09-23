import { useState } from 'react'
import { Icon } from '../../shared/ui/Icon'

interface PasswordFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  placeholder: string
}

/** Senha com botão de mostrar/ocultar, como no protótipo. */
export function PasswordField({ id, value, onChange, autoComplete, placeholder }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        Senha
      </label>
      <div className="field-with-action">
        <input
          className="input"
          type={visible ? 'text' : 'password'}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="btn btn--outline field-with-action__btn"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size="sm" />
        </button>
      </div>
    </div>
  )
}
