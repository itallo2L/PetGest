import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** Título e subtítulo da topbar por área (mesmos textos do protótipo). */
const PAGES: Record<string, { title: string; subtitle: string }> = {
  '/produtos': { title: 'Produtos', subtitle: 'Gerencie os produtos cadastrados' },
  '/configuracoes': { title: 'Configurações', subtitle: 'Dados do seu petshop' },
}

/** Layout do app autenticado: sidebar (gaveta no celular) + topbar + área. */
export function AppShell() {
  const { pathname } = useLocation()
  const page = PAGES[pathname] ?? PAGES['/produtos']
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const drawerOpenRef = useRef(false)

  const openDrawer = useCallback(() => {
    drawerOpenRef.current = true
    setDrawerOpen(true)
  }, [])
  /** Fecha a gaveta; se estava aberta, devolve o foco ao botão de menu. */
  const closeDrawer = useCallback(() => {
    if (!drawerOpenRef.current) return
    drawerOpenRef.current = false
    setDrawerOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    document.body.classList.add('is-locked')
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 60)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('is-locked')
    }
  }, [drawerOpen, closeDrawer])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return (
    <div className="app">
      <Sidebar open={drawerOpen} onClose={closeDrawer} closeButtonRef={closeButtonRef} />
      {drawerOpen && <div className="sidebar-backdrop" onClick={closeDrawer} aria-hidden="true" />}

      <div className="main">
        <Topbar
          title={page.title}
          subtitle={page.subtitle}
          drawerOpen={drawerOpen}
          onMenuClick={drawerOpen ? closeDrawer : openDrawer}
          menuButtonRef={menuButtonRef}
        />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
