import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/** Modais abertos, do mais antigo ao mais novo: só o do topo responde ao Esc. */
const openStack: symbol[] = []

interface ModalProps {
  title: string
  subtitle?: string
  onClose: () => void
  footer?: ReactNode
  /** `end`: botões alinhados à direita (e lado a lado no celular). */
  footerAlign?: 'end' | 'between'
  children?: ReactNode
}

/**
 * Diálogo do protótipo (style.css MODAIS). Ao abrir, foca o elemento com
 * `data-autofocus` (ou o primeiro campo); ao fechar, devolve o foco a quem
 * abriu. Fecha em Esc e no fundo escurecido; trava a rolagem da página.
 */
export function Modal({ title, subtitle, onClose, footer, footerAlign = 'end', children }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const token = Symbol('modal')
    const opener = document.activeElement as HTMLElement | null
    openStack.push(token)
    document.body.classList.add('is-locked')

    const dialog = dialogRef.current
    const target =
      dialog?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog?.querySelector<HTMLElement>('input, select, textarea') ??
      dialog
    const focusTimer = window.setTimeout(() => target?.focus(), 30)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openStack[openStack.length - 1] === token) {
        event.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      openStack.splice(openStack.indexOf(token), 1)
      if (openStack.length === 0) document.body.classList.remove('is-locked')
      opener?.focus()
    }
  }, [])

  return createPortal(
    <div className="modal">
      <div className="modal__backdrop" onClick={() => onCloseRef.current()} />
      <div className="modal__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <header className="modal__header">
          <div className="modal__heading">
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={() => onCloseRef.current()}>
            <Icon name="close" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && (
          <footer className={`modal__footer${footerAlign === 'end' ? ' modal__footer--end' : ''}`}>{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
