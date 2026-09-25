interface StoreFieldsProps {
  name: string
  onNameChange: (value: string) => void
  phone: string
  onPhoneChange: (value: string) => void
}

/** Nome da loja + telefone, usados em Criar conta e Concluir cadastro. */
export function StoreFields({ name, onNameChange, phone, onPhoneChange }: StoreFieldsProps) {
  return (
    <>
      <div className="field">
        <label className="field__label" htmlFor="storeName">
          Nome da loja
        </label>
        <input
          className="input"
          id="storeName"
          autoComplete="organization"
          placeholder="Ex.: Pet Shop Amigo Fiel"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="storePhone">
          Telefone <span className="field__optional">(opcional)</span>
        </label>
        <input
          className="input"
          type="tel"
          id="storePhone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 90000-0000"
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
        />
      </div>
    </>
  )
}
