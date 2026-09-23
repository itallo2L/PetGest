/** Primeira letra das duas primeiras palavras: "Pet Shop Amigo Fiel" → "PS". */
export function storeInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}
