'use client'

export function ActionButton({ onClick, disabled, label, hint }: {
  onClick: () => void; disabled: boolean; label: string; hint: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      style={{
        padding: '6px 12px', borderRadius: 8, fontSize: 10,
        fontWeight: 600, letterSpacing: '0.08em', fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid var(--border2)',
        background: 'transparent',
        color: disabled ? 'var(--muted2)' : 'var(--muted)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--accent)' } }}
      onMouseLeave={e => { e.currentTarget.style.color = disabled ? 'var(--muted2)' : 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
    >
      {label}
    </button>
  )
}
