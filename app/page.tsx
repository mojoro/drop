'use client'

import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
type Voice = { id: string; name: string; type: 'builtin' | 'custom' }
type Stage = 'idle' | 'extracting' | 'writing' | 'audio' | 'done' | 'error'
type ScriptLine = { speaker: 'ALEX' | 'SAM'; text: string }
type Result = { scriptLines: ScriptLine[]; audio: string | null; scriptBackend?: 'ollama' | 'featherless' | 'claude' }

// ── Fallback voices (used when sidecar is offline) ───────────────────────────
const FALLBACK_VOICES: Voice[] = [
  'alba', 'marius', 'javert', 'jean', 'fantine', 'cosette', 'eponine', 'azelma',
].map(name => ({ id: name, name, type: 'builtin' as const }))

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Pipeline stages ──────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'extracting', label: 'SCRAPE',  sub: 'Content extraction',  icon: '◎' },
  { id: 'writing',    label: 'SCRIPT',  sub: 'Dialogue generation', icon: '◈' },
  { id: 'audio',      label: 'VOICE',   sub: 'Speech synthesis',    icon: '◉' },
]

function stageIndex(s: Stage) {
  return ['extracting', 'writing', 'audio', 'done'].indexOf(s)
}

// ── Pipeline visualization ───────────────────────────────────────────────────
function PipelineViz({ stage }: { stage: Stage }) {
  const active = stageIndex(stage)

  return (
    <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {PIPELINE_STAGES.map((s, i) => {
          const done    = active > i
          const current = active === i && stage !== 'done' && stage !== 'error'

          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 80 }}>
                <div
                  className={current ? 'pipeline-active' : ''}
                  style={{
                    width: 44, height: 44,
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700,
                    transition: 'all 0.5s ease',
                    background: done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--card)',
                    border: `1px solid ${done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--border)'}`,
                    color: done || current ? '#000' : 'var(--muted)',
                    transform: current ? 'scale(1.12)' : 'scale(1)',
                    boxShadow: current
                      ? '0 0 22px rgba(255,92,58,0.35)'
                      : done ? '0 0 14px rgba(74,222,128,0.25)' : 'none',
                  }}
                >
                  {done ? '✓' : s.icon}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                    color: done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--muted2)',
                  }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--muted2)', marginTop: 2 }}>
                    {s.sub}
                  </div>
                </div>
              </div>

              {i < PIPELINE_STAGES.length - 1 && (
                <div style={{ width: 48, height: 1, background: 'var(--border)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  {done && (
                    <div style={{ position: 'absolute', inset: 0, background: 'var(--green)', animation: 'bar-grow 0.4s ease' }} />
                  )}
                  {current && (
                    <div style={{ position: 'absolute', inset: 0, background: 'var(--accent)', opacity: 0.5, animation: 'bar-grow 1.2s ease infinite' }} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Voice pill ───────────────────────────────────────────────────────────────
function VoicePill({ voice, selected, color, onClick }: {
  voice: Voice; selected: boolean; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: selected ? 700 : 400,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        border: `1px solid ${selected ? color : 'var(--border2)'}`,
        background: selected ? color : 'transparent',
        color: selected ? '#000' : 'var(--muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {capitalize(voice.name)}
      {voice.type === 'custom' && (
        <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>*</span>
      )}
    </button>
  )
}

// ── Voice row ────────────────────────────────────────────────────────────────
function VoiceRow({ label, color, voices, selected, onSelect }: {
  label: string; color: string; voices: Voice[]; selected: string; onSelect: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
        color, width: 32, flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {voices.map(v => (
          <VoicePill
            key={v.id}
            voice={v}
            selected={v.id === selected}
            color={color}
            onClick={() => onSelect(v.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [input,      setInput]      = useState('')
  const [stage,      setStage]      = useState<Stage>('idle')
  const [result,     setResult]     = useState<Result | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [alexVoice,  setAlexVoice]  = useState('alba')
  const [samVoice,   setSamVoice]   = useState('marius')
  const [voices,     setVoices]     = useState<Voice[]>(FALLBACK_VOICES)
  const [ttsOnline,  setTtsOnline]  = useState<boolean | null>(null) // null = checking

  const busy = stage === 'extracting' || stage === 'writing' || stage === 'audio'

  // Fetch available voices from the TTS sidecar on mount
  useEffect(() => {
    fetch('/api/voices')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then((data: { builtin: string[]; custom: string[] }) => {
        const all: Voice[] = [
          ...data.builtin.map(name => ({ id: name, name, type: 'builtin' as const })),
          ...data.custom.map(name => ({ id: name, name, type: 'custom' as const })),
        ]
        if (all.length > 0) setVoices(all)
        setTtsOnline(true)
      })
      .catch(() => setTtsOnline(false))
  }, [])

  async function handleGenerate() {
    if (!input.trim() || busy) return
    setStage('extracting')
    setResult(null)
    setError(null)
    try {
      setStage('writing')
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), alexVoice, samVoice }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (data.audio) setStage('audio')
      setResult(data)
      setStage('done')
    } catch (e) {
      setStage('error')
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  const stageLabel =
    stage === 'extracting' ? '◎ SCRAPING CONTENT...' :
    stage === 'writing'    ? '◈ GENERATING SCRIPT...' :
    stage === 'audio'      ? '◉ SYNTHESISING VOICES...' : ''

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(32px, 5vw, 56px) 16px 80px' }}>

      {/* ── Wordmark ── */}
      <div className="animate-slide-up" style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 'clamp(2.8rem, 10vw, 5rem)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          background: 'linear-gradient(135deg, #f0f0f0 40%, #555 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          DROP
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.18em', marginTop: 8 }}>
          PASTE A URL OR TOPIC · LOCAL PODCAST GENERATION
        </p>
      </div>

      {/* ── Pipeline visualization ── */}
      {stage !== 'idle' && (
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <PipelineViz stage={stage} />
        </div>
      )}

      {/* ── Input card ── */}
      <div
        className="animate-slide-up"
        style={{
          width: '100%', maxWidth: 640,
          borderRadius: 18,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          animationDelay: '0.15s',
        }}
      >
        {/* Textarea */}
        <div style={{ padding: '18px 20px 14px' }}>
          <textarea
            rows={3}
            placeholder="https://... or describe a topic"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 'clamp(13px, 3.5vw, 15px)', lineHeight: 1.6,
              resize: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Voice selection */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '14px 20px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <VoiceRow label="ALEX" color="var(--alex)" voices={voices} selected={alexVoice} onSelect={setAlexVoice} />
          <VoiceRow label="SAM"  color="var(--sam)"  voices={voices} selected={samVoice}  onSelect={setSamVoice}  />
        </div>

        {/* Bottom toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card2)',
          gap: 12,
        }}>
          {/* Sidecar status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: ttsOnline === true ? 'var(--green)'
                        : ttsOnline === false ? 'var(--accent)'
                        : 'var(--muted2)',
              boxShadow: ttsOnline === true ? '0 0 6px rgba(74,222,128,0.4)' : 'none',
              transition: 'all 0.3s ease',
            }} />
            <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>
              {ttsOnline === true ? 'TTS ONLINE'
               : ttsOnline === false ? 'TTS OFFLINE'
               : 'CHECKING...'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cmd-hint" style={{
              display: 'none', alignItems: 'center', gap: 1,
              color: 'var(--muted)', lineHeight: 1,
            }}>
              <span style={{ fontSize: 18 }}>⌘</span>
              <span style={{ fontSize: 14, position: 'relative', top: -3, right: -3 }}>↵</span>
            </span>
            <button
              onClick={handleGenerate}
              disabled={busy || ttsOnline === false}
              aria-label={busy ? 'Processing...' : 'Generate podcast'}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.08em',
                minWidth: 148,
                minHeight: 44,
                cursor: (busy || ttsOnline === false) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                border: busy ? '1px solid var(--border2)' : 'none',
                background: busy                        ? 'transparent'
                          : ttsOnline === false          ? '#1a1a1a'
                          : !input.trim()               ? '#2a2a2a'
                          :                               'var(--accent)',
                color:      busy                        ? 'var(--muted)'
                          : (ttsOnline === false || !input.trim()) ? '#666'
                          :                               '#000',
                boxShadow: !busy && input.trim() && ttsOnline !== false
                  ? '0 0 24px rgba(255,92,58,0.3)' : 'none',
              }}
            >
              {busy ? '● PROCESSING...' : '▶ GENERATE'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="animate-slide-up"
          style={{
            width: '100%', maxWidth: 640, marginTop: 12,
            padding: '12px 16px', borderRadius: 12,
            background: 'rgba(255,92,58,0.08)',
            border: '1px solid rgba(255,92,58,0.2)',
            color: '#ff8566', fontSize: 12,
          }}
        >
          ✗ {error}
        </div>
      )}

      {/* ── Status label ── */}
      {busy && stageLabel && (
        <p className="animate-slide-up" style={{ marginTop: 16, color: 'var(--muted)', fontSize: 11, letterSpacing: '0.14em', textAlign: 'center' }}>
          {stageLabel}
        </p>
      )}

      {/* ── Result ── */}
      {result && (
        <div className="animate-slide-up" style={{ width: '100%', maxWidth: 640, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Audio */}
          {result.audio && (
            <div style={{ borderRadius: 16, padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ color: 'var(--accent)', fontSize: 13 }}>◉</span>
                <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.15em' }}>PODCAST EPISODE</span>
                <span style={{ color: 'var(--muted2)', fontSize: 10, marginLeft: 'auto' }}>
                  {capitalize(alexVoice)} × {capitalize(samVoice)}
                </span>
              </div>
              <audio controls autoPlay className="w-full" src={`data:audio/wav;base64,${result.audio}`} />
            </div>
          )}

          {/* Transcript */}
          <div style={{ borderRadius: 16, padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ color: 'var(--muted2)', fontSize: 13 }}>◈</span>
              <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.15em' }}>TRANSCRIPT</span>
              <span style={{ color: 'var(--muted2)', fontSize: 10, marginLeft: 'auto' }}>{result.scriptLines.length} lines</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {result.scriptLines.map((line, i) => (
                <div key={i} className="line-in" style={{ display: 'flex', gap: 12, animationDelay: `${i * 0.04}s` }}>
                  <span style={{
                    flexShrink: 0, width: 36, fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.1em', paddingTop: 2,
                    color: line.speaker === 'ALEX' ? 'var(--alex)' : 'var(--sam)',
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

          {/* Footer row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <span style={{ color: 'var(--muted2)', fontSize: 10, letterSpacing: '0.1em' }}>
              LOCAL TTS · POCKET-TTS{result.scriptBackend ? ` · ${result.scriptBackend.toUpperCase()}` : ''}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(result.scriptLines.map(l => `${l.speaker}: ${l.text}`).join('\n'))}
              style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', padding: '4px 0', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              COPY TRANSCRIPT ↗
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
