'use client'

import { useState } from 'react'

export function SettingsInput({ label, placeholder, value, onChange, secret, style }: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; secret?: boolean; style?: React.CSSProperties
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', color: 'var(--text)', marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={secret && !show ? 'password' : 'text'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '7px 10px',
            paddingRight: secret ? 32 : 10,
            background: 'var(--card2)', border: '1px solid var(--border2)',
            borderRadius: 8, color: 'var(--text)', fontSize: 11,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        {secret && value && (
          <button
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 10, color: 'var(--muted)', fontFamily: 'inherit',
            }}
          >
            {show ? '\u25C9' : '\u25CB'}
          </button>
        )}
      </div>
    </div>
  )
}
