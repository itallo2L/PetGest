/**
 * Tela de toque: focar um campo de texto abre o teclado virtual, que cobre
 * metade da tela (T-10 U1). Nela o foco só vai a um campo quando o usuário
 * toca nele; no desktop o foco automático continua ajudando quem usa teclado.
 */
export function isTouchScreen(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)
}

/** Elementos que abrem o teclado virtual ao receber foco. */
export function opensKeyboard(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true
  if (!(element instanceof HTMLInputElement)) return false
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'hidden'].includes(element.type)
}

/** Foca um campo, exceto quando isso abriria o teclado sem o usuário pedir. */
export function focusField(id: string) {
  if (isTouchScreen()) return
  document.getElementById(id)?.focus()
}
