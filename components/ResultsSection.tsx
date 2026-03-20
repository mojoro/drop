'use client'

import type { Result } from './types'
import { capitalize } from './types'
import { ActionButton } from './ActionButton'

export interface ResultsSectionProps {
  result: Result
  alexVoice: string
  samVoice: string
  hostA: string
  hostB: string
  busy: boolean
  saveTitle: string
  onSaveTitleChange: (title: string) => void
  saving: boolean
  saved?: boolean
  onSavePodcast: () => void
  onDownloadMp3: () => void
  onResynthesize: () => void
  onCopyScript: () => void
}

export function ResultsSection({
  result, alexVoice, samVoice, hostA, hostB, busy,
  saveTitle, onSaveTitleChange, saving, saved,
  onSavePodcast, onDownloadMp3, onResynthesize, onCopyScript,
}: ResultsSectionProps) {
  return (
    <div className="animate-slide-up" style={{ width: '100%', maxWidth: 640, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Audio */}
      {result.audio && (
        <div style={{ borderRadius: 16, padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ color: 'var(--accent)', fontSize: 13 }}>{'\u25C9'}</span>
            <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.15em' }}>PODCAST EPISODE</span>
            <span style={{ color: 'var(--muted2)', fontSize: 10, marginLeft: 'auto' }}>
              {capitalize(alexVoice)} {'\u00D7'} {capitalize(samVoice)}
            </span>
          </div>
          <audio controls autoPlay className="audio-full" src={`data:audio/wav;base64,${result.audio}`} />
        </div>
      )}

      {/* Save + download + actions */}
      {result.audio && (
        <div style={{
          borderRadius: 12, padding: '12px 16px',
          background: 'var(--card)', border: '1px solid var(--border)',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          {saved ? (
            <span style={{ flex: 1, fontSize: 10, color: 'var(--green)', letterSpacing: '0.1em' }}>
              {'\u2713'} SAVED — {saveTitle}
            </span>
          ) : (
            <>
              <input
                type="text"
                placeholder="episode title"
                value={saveTitle}
                onChange={e => onSaveTitleChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSavePodcast() }}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8,
                  background: 'var(--card2)', border: '1px solid var(--border2)',
                  color: 'var(--text)', fontSize: 11, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={onSavePodcast}
                disabled={saving || !saveTitle.trim()}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 10,
                  fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'inherit',
                  cursor: saving || !saveTitle.trim() ? 'not-allowed' : 'pointer',
                  border: 'none', transition: 'all 0.15s',
                  background: saving || !saveTitle.trim() ? 'var(--card2)' : 'var(--green)',
                  color: saving || !saveTitle.trim() ? 'var(--muted)' : '#000',
                }}
              >
                {saving ? '...' : 'SAVE'}
              </button>
            </>
          )}
          <ActionButton onClick={onDownloadMp3} disabled={false} label="MP3 \u2193" hint="download as MP3" />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton onClick={onResynthesize} disabled={busy} label="RE-VOICE" hint="same script, current voices" />
        <button
          onClick={onCopyScript}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 10,
            fontWeight: 600, letterSpacing: '0.08em', fontFamily: 'inherit',
            cursor: 'pointer', border: '1px solid var(--border2)',
            background: 'transparent', color: 'var(--muted)',
            transition: 'all 0.15s', marginLeft: 'auto',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
        >
          COPY {'\u2197'}
        </button>
      </div>

      {/* Transcript */}
      <div style={{ borderRadius: 16, padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ color: 'var(--muted2)', fontSize: 13 }}>{'\u25C8'}</span>
          <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.15em' }}>TRANSCRIPT</span>
          <span style={{ color: 'var(--muted2)', fontSize: 10, marginLeft: 'auto' }}>{result.scriptLines.length} lines</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {result.scriptLines.map((line, i) => (
            <div key={i} className="line-in" style={{ display: 'flex', gap: 12, animationDelay: `${i * 0.04}s` }}>
              <span style={{
                flexShrink: 0, minWidth: 36, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.1em', paddingTop: 2,
                color: line.speaker === hostA ? 'var(--alex)' : 'var(--sam)',
              }}>
                {line.speaker}
              </span>
              <p style={{ margin: 0, fontSize: 'clamp(12px, 3vw, 14px)', lineHeight: 1.65, color: 'var(--text)' }}>
                {line.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '0 4px' }}>
        <span style={{ color: 'var(--muted2)', fontSize: 10, letterSpacing: '0.1em' }}>
          LOCAL TTS {'\u00B7'} POCKET-TTS{result.scriptBackend ? ` \u00B7 ${result.scriptBackend.toUpperCase()}` : ''}
        </span>
      </div>
    </div>
  )
}
