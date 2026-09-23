import { useId, useState, type FormEvent } from 'react'
import { toFormMessage, type FormMessage } from '../auth/authErrors'
import { FormError } from '../auth/FormError'
import { ScannerModal } from '../scanner/ScannerModal'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { Icon } from '../../shared/ui/Icon'
import { Modal } from '../../shared/ui/Modal'
import { useToast } from '../../shared/ui/toastContext'
import { categoryOptions, CATEGORIES } from './categories'
import { formatPrice, isValidBarcode, normalizeBarcode, parsePrice, priceToInput } from './productFormat'
import { createProduct, deleteProduct, findProductByEan, updateProduct } from './productsApi'
import type { Product, ProductInput } from './types'

interface ProductFormModalProps {
  /** `null` = cadastrar; um produto = editar. */
  product: Product | null
  /** Produto da loja que já usa este código (para a mensagem de duplicidade). */
  findByEan: (ean: string) => Product | undefined
  /** Cadastro aberto pelo leitor da barra: código já preenchido. */
  initialEan?: string
  /** O `initialEan` veio da câmera (define `source` — T-07 D6). */
  initialScanned?: boolean
  /** Produto achado pelo leitor no banco (entra na lista se faltar). */
  onFound: (product: Product) => void
  /** "Abrir produto": troca o formulário para outro produto da loja. */
  onOpenProduct: (product: Product) => void
  onSaved: (product: Product, created: boolean) => void
  onDeleted: (product: Product) => void
  onClose: () => void
}

/** Um único formulário atende cadastro e edição (script.js §6). */
export function ProductFormModal({
  product,
  findByEan,
  initialEan,
  initialScanned,
  onFound,
  onOpenProduct,
  onSaved,
  onDeleted,
  onClose,
}: ProductFormModalProps) {
  const isCreate = product === null
  const formId = useId()
  const showToast = useToast()
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState<string>(product?.category ?? CATEGORIES[0])
  const [ean, setEan] = useState(product?.ean ?? initialEan ?? '')
  /** Último código aceito pela câmera neste formulário. */
  const [scannedEan, setScannedEan] = useState<string | null>(initialScanned && initialEan ? initialEan : null)
  const [scanning, setScanning] = useState(false)
  const [price, setPrice] = useState(product ? priceToInput(product.price) : '')
  const [error, setError] = useState<FormMessage | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function invalid(text: string, fieldId: string) {
    setError({ text })
    document.getElementById(fieldId)?.focus()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    const digits = normalizeBarcode(ean)
    const parsedPrice = parsePrice(price)
    if (!trimmedName) return invalid('Informe o nome do produto.', `${formId}-name`)
    if (digits && !isValidBarcode(digits)) {
      return invalid('O código de barras deve ter de 8 a 14 dígitos.', `${formId}-ean`)
    }
    if (parsedPrice === null) return invalid('Informe um preço de venda válido (ex.: 29,90).', `${formId}-price`)

    const input: ProductInput = { name: trimmedName, category, price: parsedPrice, ean: digits || null }
    setError(null)
    setSaving(true)
    try {
      // `barcode` só se o código salvo é o que a câmera leu; a edição não muda `source`.
      const source = input.ean && input.ean === scannedEan ? 'barcode' : 'manual'
      const saved = isCreate ? await createProduct(input, source) : await updateProduct(product.id, input)
      showToast({ type: 'success', title: isCreate ? 'Produto cadastrado' : 'Produto atualizado', text: saved.name })
      onSaved(saved, isCreate)
    } catch (err) {
      setSaving(false)
      // 23505: índice único (petshop_id, ean) — o código já é de outro produto da loja.
      if (isRecord(err) && err.code === '23505' && input.ean) {
        const owner = findByEan(input.ean)
        setError({
          text: owner
            ? `O código de barras ${input.ean} já pertence a ${owner.name}.`
            : `O código de barras ${input.ean} já pertence a outro produto da loja.`,
        })
        document.getElementById(`${formId}-ean`)?.focus()
        return
      }
      setError(toFormMessage(err))
    }
  }

  async function handleDelete() {
    if (!product) return
    setDeleting(true)
    try {
      await deleteProduct(product.id)
      showToast({ type: 'success', title: 'Produto excluído', text: product.name })
      onDeleted(product)
    } catch (err) {
      setDeleting(false)
      setConfirmingDelete(false)
      setError(toFormMessage(err))
    }
  }

  /** Leitor aberto pelo campo de código: o próprio produto em edição conta como "novo". */
  async function lookupFromForm(code: string) {
    const found = await findProductByEan(code)
    if (!found || found.id === product?.id) return { kind: 'new' as const }
    onFound(found)
    return { kind: 'existing' as const, item: found, summary: `${found.name} · ${formatPrice(found.price)}` }
  }

  const busy = saving || deleting
  const actions = (
    <>
      <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
        Cancelar
      </button>
      <button type="submit" form={formId} className="btn btn--primary" disabled={busy}>
        <Icon name="check" size="sm" />
        {saving ? 'Salvando…' : isCreate ? 'Cadastrar produto' : 'Salvar alterações'}
      </button>
    </>
  )

  return (
    <>
      <Modal
        title={isCreate ? 'Cadastrar produto' : 'Editar produto'}
        subtitle={isCreate ? 'Adicione um item ao catálogo da loja' : product.category}
        onClose={busy ? () => {} : onClose}
        footerAlign={isCreate ? 'end' : 'between'}
        footer={
          isCreate ? (
            actions
          ) : (
            <>
              <button
                type="button"
                className="btn btn--ghost btn--danger-ghost"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
              >
                Excluir produto
              </button>
              <div className="modal__footer-right">{actions}</div>
            </>
          )
        }
      >
        <form className="form" id={formId} onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor={`${formId}-name`}>
              Nome do produto
            </label>
            <input
              className="input"
              id={`${formId}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              data-autofocus
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor={`${formId}-category`}>
              Categoria
            </label>
            <select
              className="input"
              id={`${formId}-category`}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categoryOptions(product?.category).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor={`${formId}-ean`}>
              Código de barras <span className="field__optional">(opcional)</span>
            </label>
            <div className="field-with-action">
              <input
                className="input"
                id={`${formId}-ean`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ex.: 7891000315507"
                value={ean}
                onChange={(event) => setEan(event.target.value)}
              />
              <button
                type="button"
                className="btn btn--outline field-with-action__btn"
                data-action="scan-barcode"
                onClick={() => setScanning(true)}
                disabled={busy}
              >
                <Icon name="barcode" size="sm" />
                Escanear
              </button>
            </div>
            <p className="field__hint">Escaneie com a câmera do celular ou digite o código.</p>
          </div>

          <div className="field">
            <label className="field__label" htmlFor={`${formId}-price`}>
              Preço de venda (R$)
            </label>
            <input
              className="input"
              id={`${formId}-price`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>

          <FormError message={error} />
        </form>
      </Modal>

      {scanning && (
        <ScannerModal<Product>
          onCode={lookupFromForm}
          onNewCode={(code) => {
            setEan(code)
            setScannedEan(code)
            setScanning(false)
          }}
          existingActionLabel="Abrir produto"
          onExistingAction={(other) => {
            setScanning(false)
            onOpenProduct(other)
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {confirmingDelete && product && (
        <ConfirmDialog
          title="Excluir produto?"
          text={`"${product.name}" será removido do catálogo da loja. Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          busy={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  )
}

function isRecord(value: unknown): value is { code?: unknown } {
  return typeof value === 'object' && value !== null
}
