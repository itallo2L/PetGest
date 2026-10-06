import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../shared/ui/Icon'
import { isTouchScreen, opensKeyboard } from '../../shared/ui/touch'
import type { FormMessage } from './authErrors'

export function FormError({ message }: { message: FormMessage | null }) {
  const ref = useRef<HTMLParagraphElement>(null)

  // No toque, o teclado aberto (envio pela tecla "Ir") cobriria a mensagem:
  // fecha o teclado e traz a mensagem para a tela (T-10 U1).
  useEffect(() => {
    if (!message || !isTouchScreen()) return
    const active = document.activeElement
    if (active instanceof HTMLElement && opensKeyboard(active)) active.blur()
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [message])

  if (!message) return null
  return (
    <p className="form__error" role="alert" ref={ref}>
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
