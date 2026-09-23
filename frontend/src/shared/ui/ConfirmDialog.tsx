import { Modal } from './Modal'

interface ConfirmDialogProps {
  title: string
  text: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmação de ação destrutiva no visual do app (no lugar de window.confirm). */
export function ConfirmDialog({ title, text, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy} data-autofocus>
            Cancelar
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Excluindo…' : confirmLabel}
          </button>
        </>
      }
    >
      <p>{text}</p>
    </Modal>
  )
}
