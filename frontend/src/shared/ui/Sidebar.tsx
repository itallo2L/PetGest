import type { RefObject } from 'react'
import { NavLink } from 'react-router'
import { useSession } from '../../features/auth/sessionContext'
import { supabase } from '../supabaseClient'
import { Icon, type IconName } from './Icon'
import { storeInitials } from './storeInitials'

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/produtos', label: 'Produtos', icon: 'box' },
]
const FOOTER_NAV = { to: '/configuracoes', label: 'Configurações', icon: 'settings' as IconName }

interface SidebarProps {
  open: boolean
  onClose: () => void
  closeButtonRef: RefObject<HTMLButtonElement | null>
}

export function Sidebar({ open, onClose, closeButtonRef }: SidebarProps) {
  const { petshop } = useSession()
  const storeName = petshop?.name ?? ''

  const navClass = ({ isActive }: { isActive: boolean }) => `nav__item${isActive ? ' is-active' : ''}`

  return (
    <aside className={`sidebar${open ? ' is-open' : ''}`} id="sidebar" aria-label="Navegação principal">
      <div className="sidebar__brand">
        <span className="brand__mark" aria-hidden="true">
          <Icon name="paw" />
        </span>
        <span className="brand__text">
          <strong className="brand__name">PetGest</strong>
          <span className="brand__tagline">V0 — cadastro por código de barras</span>
        </span>
        <button
          type="button"
          className="icon-btn sidebar__close"
          aria-label="Fechar menu"
          onClick={onClose}
          ref={closeButtonRef}
        >
          <Icon name="close" />
        </button>
      </div>

      <nav className="sidebar__nav">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={navClass} onClick={onClose}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <NavLink to={FOOTER_NAV.to} className={navClass} onClick={onClose}>
          <Icon name={FOOTER_NAV.icon} />
          <span>{FOOTER_NAV.label}</span>
        </NavLink>
        <div className="store-chip">
          <span className="store-chip__avatar" aria-hidden="true">
            {storeInitials(storeName)}
          </span>
          <span className="store-chip__info">
            <strong>{storeName}</strong>
          </span>
        </div>
        <button type="button" className="sidebar__logout" onClick={() => void supabase.auth.signOut()}>
          <Icon name="logout" size="sm" />
          Sair
        </button>
      </div>
    </aside>
  )
}
