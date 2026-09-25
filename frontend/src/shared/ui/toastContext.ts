import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'danger'

export interface ToastOptions {
  type: ToastType
  title: string
  text?: string
}

export const ToastContext = createContext<((toast: ToastOptions) => void) | null>(null)

/** `showToast({ type: 'success', title: 'Produto cadastrado', text: nome })`. */
export function useToast(): (toast: ToastOptions) => void {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return show
}
