// `?no-inline`: sem ele o Vite pode embutir o sprite como `data:` URI, que os
// navegadores não aceitam em `<use href>`.
import spriteUrl from './icons.svg?no-inline'

/** Mesmos nomes dos `<symbol id="i-...">` de `icons.svg`, sem o prefixo. */
export type IconName =
  | 'alert'
  | 'arrow-right'
  | 'ban'
  | 'barcode'
  | 'bell'
  | 'box'
  | 'camera'
  | 'camera-off'
  | 'check'
  | 'check-circle'
  | 'close'
  | 'eye'
  | 'eye-off'
  | 'filter'
  | 'flash'
  | 'logout'
  | 'menu'
  | 'paw'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'settings'

interface IconProps {
  name: IconName
  size?: 'sm'
}

/** Ícone decorativo: quem usa dá o texto acessível ao botão/link ao redor. */
export function Icon({ name, size }: IconProps) {
  return (
    <svg
      className={size === 'sm' ? 'icon icon--sm' : 'icon'}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`${spriteUrl}#i-${name}`} />
    </svg>
  )
}
