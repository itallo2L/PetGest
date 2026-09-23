import type { RefObject } from 'react'
import { Icon } from './Icon'

interface TopbarProps {
  title: string
  subtitle: string
  drawerOpen: boolean
  onMenuClick: () => void
  menuButtonRef: RefObject<HTMLButtonElement | null>
}

export function Topbar({ title, subtitle, drawerOpen, onMenuClick, menuButtonRef }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="icon-btn topbar__menu"
          aria-label="Abrir menu"
          aria-controls="sidebar"
          aria-expanded={drawerOpen}
          onClick={onMenuClick}
          ref={menuButtonRef}
        >
          <Icon name="menu" />
        </button>
        <div className="topbar__titles">
          <h1 className="topbar__title">{title}</h1>
          <p className="topbar__subtitle">{subtitle}</p>
        </div>
      </div>
    </header>
  )
}
