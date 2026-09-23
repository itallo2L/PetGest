import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon: IconName
  title: string
  text: string
}

export function EmptyState({ icon, title, text }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__text">{text}</p>
    </div>
  )
}
