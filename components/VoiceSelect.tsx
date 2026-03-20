'use client'

import type { Voice } from './types'
import { capitalize } from './types'

export function VoiceSelect({ label, color, voices, selected, onSelect }: {
  label: string; color: string; voices: Voice[]; selected: string; onSelect: (id: string) => void
}) {
  const builtin = voices.filter(v => v.type === 'builtin')
  const custom = voices.filter(v => v.type === 'custom')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color }}>
        {label}
      </span>
      <select
        value={selected}
        onChange={e => onSelect(e.target.value)}
        style={{
          padding: '5px 28px 5px 10px',
          borderRadius: 8, fontSize: 11,
          fontFamily: 'inherit', fontWeight: 600,
          background: 'var(--card2)', border: `1px solid ${color}40`,
          color: 'var(--text)', cursor: 'pointer', outline: 'none',
        }}
      >
        {builtin.length > 0 && (
          <optgroup label="Built-in">
            {builtin.map(v => (
              <option key={v.id} value={v.id}>{capitalize(v.name)}</option>
            ))}
          </optgroup>
        )}
        {custom.length > 0 && (
          <optgroup label="Custom">
            {custom.map(v => (
              <option key={v.id} value={v.id}>{capitalize(v.name)}</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}
