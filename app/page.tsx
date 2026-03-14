'use client'

import { useState } from 'react'

// ── Voice catalogue ────────────────────────────────────────────────────────
const VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George',  desc: 'British · Warm',        gender: 'M' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',  desc: 'British · Broadcast',   gender: 'M' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',   desc: 'American · Deep',       gender: 'M' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric',    desc: 'American · Smooth',     gender: 'M' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will',    desc: 'American · Casual',     gender: 'M' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',   desc: 'American · Confident',  gender: 'F' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',   desc: 'British · Clear',       gender: 'F' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', desc: 'American · Pro',        gender: 'F' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura',   desc: 'American · Energetic',  gender: 'F' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antonia', desc: 'American · Authoritative', gender: 'F' },
]

// ── Pipeline stages ────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'extracting', label: 'NEEDLE',      sub: 'Content extraction',  icon: '◎' },
  { id: 'writing',   label: 'FEATHERLESS',  sub: 'Script generation',   icon: '◈' },
  { id: 'audio',     label: 'ELEVENLABS',   sub: 'Voice synthesis',      icon: '◉' },
]

type Stage = 'idle' | 'extracting' | 'writing' | 'audio' | 'done' | 'error'
type ScriptLine = { speaker: 'ALEX' | 'SAM'; text: string }
type Result = { scriptLines: ScriptLine[]; audio: string | null }

function stageIndex(s: Stage) {
  return ['extracting', 'writing', 'audio', 'done'].indexOf(s)
}

// ── Sub-components ─────────────────────────────────────────────────────────
function PipelineViz({ stage }: { stage: Stage }) {
  const active = stageIndex(stage)

  return (
    <div className="w-full mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center justify-center gap-0">
        {PIPELINE_STAGES.map((s, i) => {
          const done    = active > i
          const current = active === i && stage !== 'done' && stage !== 'error'
          const idle    = active < i || stage === 'idle'

          return (
            <div key={s.id} className="flex items-center flex-1">
              {/* Node */}
              <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 72 }}>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${current ? 'pipeline-active' : ''}`}
                  style={{
                    background: done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--card)',
                    border: `1px solid ${done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--border)'}`,
                    color: done || current ? '#000' : 'var(--muted)',
                    transform: current ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: current ? '0 0 20px rgba(255,92,58,0.3)' : done ? '0 0 12px rgba(74,222,128,0.2)' : 'none',
                  }}
                >
                  {done ? '✓' : s.icon}
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold tracking-widest"
                    style={{ color: done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--muted2)', fontSize: 9 }}>
                    {s.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted2)', fontSize: 8, marginTop: 1 }}>
                    {s.sub}
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="flex-1 h-px mx-1 relative overflow-hidden" style={{ background: 'var(--border)' }}>
                  {done && (
                    <div className="absolute inset-0" style={{ background: 'var(--green)', animation: 'bar-grow 0.4s ease' }} />
                  )}
                  {current && (
                    <div className="absolute inset-0 opacity-50" style={{ background: 'var(--accent)', animation: 'bar-grow 1.2s ease infinite' }} />
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

function VoiceSelector({
  label, color, voiceId, onChange,
}: { label: string; color: string; voiceId: string; onChange: (id: string) => void }) {
  const voice = VOICES.find(v => v.id === voiceId)

  return (
    <div className="flex-1 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tracking-widest" style={{ color, fontSize: 10 }}>{label}</span>
        <span className="text-xs" style={{ color: 'var(--muted)', fontSize: 10 }}>{voice?.desc}</span>
      </div>
      <select
        value={voiceId}
        onChange={e => onChange(e.target.value)}
        className="w-full text-xs px-3 py-2 rounded-lg outline-none cursor-pointer transition-colors"
        style={{
          background: 'var(--card2)',
          border: `1px solid var(--border)`,
          color: 'var(--text)',
          fontSize: 11,
          paddingRight: 28,
        }}
      >
        {VOICES.map(v => (
          <option key={v.id} value={v.id}>
            {v.name} — {v.desc}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Home() {
  const [input,       setInput]       = useState('')
  const [stage,       setStage]       = useState<Stage>('idle')
  const [result,      setResult]      = useState<Result | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [alexVoiceId, setAlexVoiceId] = useState('JBFqnCBsd6RMkjVDRZzb') // George
  const [samVoiceId,  setSamVoiceId]  = useState('EXAVITQu4vr4xnSDxMaL') // Sarah
  const [showConfig,  setShowConfig]  = useState(false)

  const busy = stage === 'extracting' || stage === 'writing' || stage === 'audio'

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
        body: JSON.stringify({ input: input.trim(), alexVoiceId, samVoiceId }),
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

  const alexVoice = VOICES.find(v => v.id === alexVoiceId)
  const samVoice  = VOICES.find(v => v.id === samVoiceId)

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pb-20" style={{ paddingTop: 56 }}>

      {/* ── Wordmark ── */}
      <div className="text-center mb-2 animate-slide-up">
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 'clamp(3rem, 8vw, 5rem)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          background: 'linear-gradient(135deg, #f0f0f0 40%, #666 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          DROP
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: '0.2em', marginTop: 6 }}>
          PASTE A URL OR TOPIC · GET A PODCAST IN 60s
        </p>
      </div>

      {/* ── Pipeline visualization ── */}
      {stage !== 'idle' && (
        <div className="w-full max-w-2xl flex justify-center mb-2">
          <PipelineViz stage={stage} />
        </div>
      )}

      {/* ── Input card ── */}
      <div
        className="w-full max-w-2xl rounded-2xl animate-slide-up"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          animationDelay: '0.15s',
          overflow: 'hidden',
        }}
      >
        {/* Input area */}
        <div className="p-5">
          <textarea
            className="w-full bg-transparent resize-none outline-none leading-relaxed placeholder:opacity-30"
            rows={3}
            placeholder="https://... or describe a topic"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            style={{ color: 'var(--text)', fontSize: 13 }}
          />
        </div>

        {/* Bottom bar */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--card2)' }}
        >
          {/* Config toggle */}
          <button
            onClick={() => setShowConfig(c => !c)}
            className="flex items-center gap-2 text-xs transition-colors"
            style={{ color: showConfig ? 'var(--text)' : 'var(--muted)', fontSize: 11 }}
          >
            <span style={{ color: 'var(--alex)' }}>▶ {alexVoice?.name}</span>
            <span style={{ color: 'var(--muted2)' }}>×</span>
            <span style={{ color: 'var(--sam)' }}>{samVoice?.name} ▶</span>
            <span style={{ color: 'var(--muted2)', marginLeft: 4 }}>⚙</span>
          </button>

          <div className="flex items-center gap-3">
            <span style={{ color: 'var(--muted2)', fontSize: 10 }}>⌘↵</span>
            <button
              onClick={handleGenerate}
              disabled={busy}
              aria-label={busy ? 'Processing…' : 'Generate podcast'}
              className="px-6 py-2.5 rounded-xl font-bold tracking-widest transition-all"
              style={{
                background: busy           ? 'transparent'
                          : !input.trim()  ? '#2a2a2a'
                          :                  'var(--accent)',
                color:      busy           ? 'var(--muted)'   // #666 on transparent — label explains state
                          : !input.trim()  ? '#888'           // 3.2:1 on #2a2a2a — AA for large/bold text ✓
                          :                  '#000',          // black on #ff5c3a — 4.7:1 ✓ WCAG AA
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.08em',
                border: busy ? '1px solid var(--border2)' : 'none',
                cursor: busy ? 'not-allowed' : 'pointer',
                minWidth: 140,
                boxShadow: !busy && input.trim() ? '0 0 24px rgba(255,92,58,0.35)' : 'none',
              }}
            >
              {busy ? '● PROCESSING…' : '▶ GENERATE'}
            </button>
          </div>
        </div>

        {/* Voice config panel */}
        {showConfig && (
          <div
            className="px-5 py-4 flex gap-4"
            style={{ borderTop: '1px solid var(--border)', animation: 'slide-up 0.2s ease' }}
          >
            <VoiceSelector label="ALEX" color="var(--alex)" voiceId={alexVoiceId} onChange={setAlexVoiceId} />
            <VoiceSelector label="SAM"  color="var(--sam)"  voiceId={samVoiceId}  onChange={setSamVoiceId}  />
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="w-full max-w-2xl mt-4 px-4 py-3 rounded-xl text-xs animate-slide-up"
          style={{ background: 'rgba(255,92,58,0.08)', border: '1px solid rgba(255,92,58,0.2)', color: '#ff8566' }}
        >
          ✗ {error}
        </div>
      )}

      {/* ── Stage status label ── */}
      {busy && (
        <p className="mt-4 text-xs animate-slide-up" style={{ color: 'var(--muted)', letterSpacing: '0.15em' }}>
          {stage === 'extracting' && '◎ EXTRACTING CONTENT VIA NEEDLE...'}
          {stage === 'writing'    && '◈ GENERATING SCRIPT VIA FEATHERLESS...'}
          {stage === 'audio'      && '◉ SYNTHESISING VOICES VIA ELEVENLABS...'}
        </p>
      )}

      {/* ── Result ── */}
      {result && (
        <div className="w-full max-w-2xl mt-6 flex flex-col gap-4 animate-slide-up">

          {/* Audio player */}
          {result.audio && (
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: 'var(--accent)', fontSize: 11 }}>◉</span>
                <span className="text-xs tracking-widest" style={{ color: 'var(--muted)', fontSize: 10 }}>PODCAST EPISODE</span>
                <span style={{ color: 'var(--muted2)', fontSize: 10, marginLeft: 'auto' }}>
                  {alexVoice?.name} × {samVoice?.name}
                </span>
              </div>
              <audio
                controls
                autoPlay
                className="w-full"
                src={`data:audio/mpeg;base64,${result.audio}`}
              />
            </div>
          )}

          {/* Transcript */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span style={{ color: 'var(--muted2)', fontSize: 11 }}>◈</span>
              <span className="text-xs tracking-widest" style={{ color: 'var(--muted)', fontSize: 10 }}>TRANSCRIPT</span>
              <span style={{ color: 'var(--muted2)', fontSize: 10, marginLeft: 'auto' }}>
                {result.scriptLines.length} lines
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {result.scriptLines.map((line, i) => (
                <div
                  key={i}
                  className="flex gap-3 line-in"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <span
                    className="shrink-0 text-xs font-bold pt-0.5"
                    style={{
                      color: line.speaker === 'ALEX' ? 'var(--alex)' : 'var(--sam)',
                      width: 36,
                      fontSize: 10,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {line.speaker}
                  </span>
                  <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    {line.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between px-1">
            <span style={{ color: 'var(--muted2)', fontSize: 10, letterSpacing: '0.1em' }}>
              NEEDLE · FEATHERLESS · ELEVENLABS
            </span>
            <button
              onClick={() => {
                const text = result.scriptLines.map(l => `${l.speaker}: ${l.text}`).join('\n')
                navigator.clipboard.writeText(text)
              }}
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.1em' }}
            >
              COPY TRANSCRIPT ↗
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
