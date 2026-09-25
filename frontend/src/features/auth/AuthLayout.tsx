import type { ReactNode } from 'react'
import { Icon } from '../../shared/ui/Icon'
import './auth.css'

interface AuthLayoutProps {
  title?: string
  subtitle?: string
  children?: ReactNode
}

/** Cartão centralizado com a marca — base de Entrar, Criar conta,
 * Concluir cadastro e da tela de carregamento. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand__mark" aria-hidden="true">
            <Icon name="paw" />
          </span>
          <span className="auth-brand__name">PetGest</span>
        </div>
        {title && <h1 className="auth-card__title">{title}</h1>}
        {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
