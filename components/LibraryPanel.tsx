'use client'

import type { SavedPodcast } from './types'

export interface LibraryPanelProps {
  podcasts: SavedPodcast[]
  onLoadPodcast: (p: SavedPodcast) => void
  onDeletePodcast: (id: string) => void
}

export function LibraryPanel({ podcasts, onLoadPodcast, onDeletePodcast }: LibraryPanelProps) {
  return (
    <div
      className="animate-slide-up"
      style={{
        width: '100%', maxWidth: 704, marginBottom: 20,
        borderRadius: 16, padding: '18px 20px',
        background: 'var(--card)', border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)' }}>
          SAVED PODCASTS
        </div>

        {podcasts.length === 0 ? (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--muted2)' }}>
            No saved podcasts yet. Generate one and save it.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {podcasts.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--card2)', border: '1px solid var(--border2)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                    <span>{p.scriptLines.length} lines</span>
                    <span>{p.scriptBackend.toUpperCase()}</span>
                  </div>
                </div>
                <button
                  onClick={() => onLoadPodcast(p)}
                  style={{
                    padding: '5px 11px', borderRadius: 6, fontSize: 11,
                    fontWeight: 600, letterSpacing: '0.08em', fontFamily: 'inherit',
                    cursor: 'pointer', border: '1px solid var(--border2)',
                    background: 'transparent', color: 'var(--muted)',
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
                >
                  LOAD
                </button>
                <audio
                  controls
                  src={`/api/library/${p.id}/audio`}
                  style={{ height: 32, width: 200, flexShrink: 0 }}
                />
                <button
                  onClick={() => onDeletePodcast(p.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted2)', fontSize: 12, fontFamily: 'inherit',
                    padding: '4px 6px', flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ff8566')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted2)')}
                >
                  {'\u2715'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
