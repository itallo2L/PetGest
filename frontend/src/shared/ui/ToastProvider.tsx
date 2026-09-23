import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { ToastContext, type ToastOptions } from './toastContext'

interface ToastItem extends ToastOptions {
  id: number
  leaving: boolean
}

const VISIBLE_MS = 3500
const LEAVE_MS = 180 // duração de toast-out em toast.css

/** Pilha de avisos do protótipo (style.css TOASTS); cada aviso some sozinho. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])

  const showToast = useCallback((toast: ToastOptions) => {
    const id = ++nextId.current
    setToasts((list) => [...list, { ...toast, id, leaving: false }])
    timers.current.push(
      window.setTimeout(() => {
        setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
      }, VISIBLE_MS),
      window.setTimeout(() => {
        setToasts((list) => list.filter((t) => t.id !== id))
      }, VISIBLE_MS + LEAVE_MS),
    )
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}${toast.leaving ? ' is-leaving' : ''}`}>
            <span className="toast__icon" aria-hidden="true">
              <Icon name={toast.type === 'success' ? 'check-circle' : 'alert'} />
            </span>
            <div>
              <p className="toast__title">{toast.title}</p>
              {toast.text && <p className="toast__text">{toast.text}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
