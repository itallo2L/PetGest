import { Link } from 'react-router'
import { Icon } from '../../shared/ui/Icon'
import type { FormMessage } from './authErrors'

export function FormError({ message }: { message: FormMessage | null }) {
  if (!message) return null
  return (
    <p className="form__error" role="alert">
      <Icon name="alert" size="sm" />
      <span>
        {message.text}
        {message.suggestLogin && (
          <>
            {' '}
            <Link to="/entrar">Entrar</Link>
          </>
        )}
      </span>
    </p>
  )
}
