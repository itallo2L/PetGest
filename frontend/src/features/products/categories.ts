/** Categorias do V0, na ordem do protótipo (script.js §2). */
export const CATEGORIES = [
  'Ração',
  'Medicamento',
  'Higiene',
  'Acessórios',
  'Petiscos',
  'Jardinagem',
  'Agropecuário',
] as const

/** Opções do select: as fixas + a atual, se o produto tiver outra (ex.: criado
 * pelo SQL Editor) — para não trocá-la sem o usuário perceber. */
export function categoryOptions(current?: string): string[] {
  const options: string[] = [...CATEGORIES]
  if (current && !options.includes(current)) options.push(current)
  return options
}
