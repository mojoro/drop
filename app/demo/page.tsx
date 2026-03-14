'use client'

import { useState } from 'react'

// ── Voice catalogue (same as main app) ─────────────────────────────────────
const VOICES = [
  { id: 'Fahco4VZzobUeiPqni1S', name: 'Archer',  desc: 'British · Warm',              gender: 'M' },
  { id: 'BIvP0GN1cAtSRTxNHnWS', name: 'Ellen',   desc: 'German · Direct',             gender: 'F' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George',  desc: 'British · Warm',              gender: 'M' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',  desc: 'British · Broadcast',         gender: 'M' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',   desc: 'American · Deep',             gender: 'M' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric',    desc: 'American · Smooth',           gender: 'M' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will',    desc: 'American · Casual',           gender: 'M' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger',   desc: 'American · Conversational',   gender: 'M' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris',   desc: 'American · Natural',          gender: 'M' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', desc: 'Australian · Energetic',      gender: 'M' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River',   desc: 'American · Neutral',          gender: 'N' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',    desc: 'American · Warm',             gender: 'M' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',   desc: 'American · Confident',        gender: 'F' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',   desc: 'British · Clear',             gender: 'F' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', desc: 'American · Pro',              gender: 'F' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura',   desc: 'American · Energetic',        gender: 'F' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antonia', desc: 'American · Authoritative',    gender: 'F' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', desc: 'American · Bright & Warm',   gender: 'F' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',    desc: 'British · Velvety',           gender: 'F' },
]

// ── Pipeline stages ─────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'extracting', label: 'NEEDLE',     sub: 'Content extraction', icon: '◎' },
  { id: 'writing',   label: 'FEATHERLESS', sub: 'Script generation',  icon: '◈' },
  { id: 'audio',     label: 'ELEVENLABS',  sub: 'Voice synthesis',    icon: '◉' },
]

type Stage = 'idle' | 'extracting' | 'writing' | 'audio' | 'done' | 'error'
type ScriptLine = { speaker: 'ALEX' | 'SAM'; text: string }

// ── Pre-baked demo content ──────────────────────────────────────────────────
const DEMO_INPUT = 'The attention economy — why capturing focus at scale is becoming a public health crisis'

const DEMO_SCRIPT: ScriptLine[] = [
  { speaker: 'ALEX', text: "There's a framing I keep coming back to: attention as infrastructure. What do you mean by that?" },
  { speaker: 'SAM',  text: "Think about what we protect as essential — roads, water, power. Attention is the substrate everything else runs on. When it's captured and monetized at scale, everything downstream degrades: democracy, mental health, the quality of decisions we make." },
  { speaker: 'ALEX', text: "Aren't people just choosing to use their phones?" },
  { speaker: 'SAM',  text: "We said the same thing about cigarettes. The engineering effort that goes into keeping you scrolling would make a missile guidance system look unsophisticated." },
  { speaker: 'ALEX', text: "But governments regulate tobacco. Why hasn't that happened here?" },
  { speaker: 'SAM',  text: "Because the harm is diffuse and delayed. Cigarettes gave you lung cancer. Attention capture gives you — what? A slightly shorter attention span? A vague sense that you're not living your actual life? It's harder to litigate." },
  { speaker: 'ALEX', text: "Is the problem the platforms, or is it something deeper about human psychology?" },
  { speaker: 'SAM',  text: "Both. We didn't evolve to handle infinite novelty delivered at machine speed. Our reward systems weren't built for this. But the platforms know that, and they built their products around it deliberately." },
  { speaker: 'ALEX', text: "What does protecting attention actually look like in practice?" },
  { speaker: 'SAM',  text: "It looks like treating distraction the way we treat pollution. You can pollute your own land — up to a point. But when your runoff gets into the shared water supply, that's a public health problem. Captured attention is the same. It degrades our collective ability to think." },
  { speaker: 'ALEX', text: "Last word?" },
  { speaker: 'SAM',  text: "The most valuable thing you own isn't your house or your savings. It's the hours of genuine focus you have left in your life. The question is who you're going to let spend them." },
]

const DEMO_AUDIO = '/demos/portfolio.mp3'

// ── Mock stage delays (realistic pacing) ───────────────────────────────────
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function stageIndex(s: Stage) {
  return ['extracting', 'writing', 'audio', 'done'].indexOf(s)
}

// ── Pipeline visualization (identical to main app) ──────────────────────────
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

// ── Voice selector ──────────────────────────────────────────────────────────
function VoiceSelector({
  label, color, voiceId, onChange,
}: { label: string; color: string; voiceId: string; onChange: (id: string) => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color }}>{label}</label>
      <select
        value={voiceId}
        onChange={e => onChange(e.target.value)}
        aria-label={`Voice for ${label}`}
        style={{
          width: '100%',
          background: 'var(--card2)',
          border: '1px solid var(--border2)',
          color: 'var(--text)',
          fontSize: 12,
          padding: '8px 28px 8px 10px',
          borderRadius: 8,
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
      >
        {VOICES.map(v => (
          <option key={v.id} value={v.id}>{v.name} — {v.desc}</option>
        ))}
      </select>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [input,       setInput]       = useState(DEMO_INPUT)
  const [stage,       setStage]       = useState<Stage>('idle')
  const [showResult,  setShowResult]  = useState(false)
  const [alexVoiceId, setAlexVoiceId] = useState('Fahco4VZzobUeiPqni1S') // Archer
  const [samVoiceId,  setSamVoiceId]  = useState('BIvP0GN1cAtSRTxNHnWS') // Ellen
  const [showConfig,  setShowConfig]  = useState(false)

  const busy = stage === 'extracting' || stage === 'writing' || stage === 'audio'

  async function handleGenerate() {
    if (!input.trim() || busy) return
    setShowResult(false)
    setStage('extracting')
    await delay(3400)
    setStage('writing')
    await delay(5200)
    setStage('audio')
    await delay(8800)
    setStage('done')
    setShowResult(true)
  }

  const alexVoice = VOICES.find(v => v.id === alexVoiceId)
  const samVoice  = VOICES.find(v => v.id === samVoiceId)

  const stageLabel =
    stage === 'extracting' ? '◎ EXTRACTING CONTENT VIA NEEDLE...' :
    stage === 'writing'    ? '◈ GENERATING SCRIPT VIA FEATHERLESS...' :
    stage === 'audio'      ? '◉ SYNTHESISING VOICES VIA ELEVENLABS...' : ''

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(32px, 5vw, 56px) 16px 80px' }}>

      {/* ── Wordmark ── */}
      <div className="animate-slide-up" style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 'clamp(2.8rem, 10vw, 5rem)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #f0f0f0 40%, #555 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>
            DROP
          </h1>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
            color: 'var(--accent)',
            padding: '4px 8px',
            border: '1px solid rgba(255,92,58,0.35)',
            borderRadius: 4,
            alignSelf: 'flex-start',
            marginTop: 8,
          }}>
            DEMO
          </span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: '0.18em', marginTop: 0 }}>
          PASTE A URL OR TOPIC · GET A PODCAST IN 60s
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
        <div style={{ padding: '18px 20px 14px' }}>
          <textarea
            rows={3}
            placeholder="https://... or describe a topic"
            value={input}
            onChange={() => {}}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            readOnly
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 'clamp(13px, 3.5vw, 15px)', lineHeight: 1.6,
              resize: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card2)',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setShowConfig(c => !c)}
            aria-label="Configure voices"
            aria-expanded={showConfig}
            className="config-toggle"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${showConfig ? 'var(--border2)' : 'transparent'}`,
              background: showConfig ? 'var(--card)' : 'transparent',
              cursor: 'pointer',
              minHeight: 44,
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, transition: 'transform 0.2s ease', display: 'inline-block', transform: showConfig ? 'rotate(30deg)' : 'rotate(0deg)', color: showConfig ? 'var(--text)' : 'var(--muted)' }}>⚙</span>
            <span style={{ display: 'inline-block', width: 1, height: 16, background: 'var(--border2)', margin: '0 2px', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--alex)', fontWeight: 600, lineHeight: 1 }}>{alexVoice?.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1 }}>×</span>
            <span style={{ fontSize: 13, color: 'var(--sam)', fontWeight: 600, lineHeight: 1 }}>{samVoice?.name}</span>
          </button>

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
              disabled={busy}
              aria-label={busy ? 'Processing…' : 'Generate podcast'}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.08em',
                minWidth: 148,
                minHeight: 44,
                cursor: busy ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                border: busy ? '1px solid var(--border2)' : 'none',
                background: busy           ? 'transparent'
                          : !input.trim()  ? '#2a2a2a'
                          :                  'var(--accent)',
                color:      busy           ? 'var(--muted)'
                          : !input.trim()  ? '#888'
                          :                  '#000',
                boxShadow: !busy && input.trim() ? '0 0 24px rgba(255,92,58,0.3)' : 'none',
              }}
            >
              {busy ? '● PROCESSING…' : '▶ GENERATE'}
            </button>
          </div>
        </div>

        {showConfig && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '16px 20px',
            display: 'flex',
            gap: 12,
            animation: 'slide-up 0.2s ease',
            flexWrap: 'wrap',
          }}>
            <VoiceSelector label="ALEX" color="var(--alex)" voiceId={alexVoiceId} onChange={setAlexVoiceId} />
            <VoiceSelector label="SAM"  color="var(--sam)"  voiceId={samVoiceId}  onChange={setSamVoiceId}  />
          </div>
        )}
      </div>

      {/* ── Status label ── */}
      {busy && stageLabel && (
        <p className="animate-slide-up" style={{ marginTop: 16, color: 'var(--muted)', fontSize: 11, letterSpacing: '0.14em', textAlign: 'center' }}>
          {stageLabel}
        </p>
      )}

      {/* ── Result ── */}
      {showResult && (
        <div className="animate-slide-up" style={{ width: '100%', maxWidth: 640, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Audio */}
          <div style={{ borderRadius: 16, padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ color: 'var(--accent)', fontSize: 13 }}>◉</span>
              <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.15em' }}>PODCAST EPISODE</span>
              <span style={{ color: 'var(--muted2)', fontSize: 10, marginLeft: 'auto' }}>{alexVoice?.name} × {samVoice?.name}</span>
            </div>
            <audio controls autoPlay className="w-full" src={DEMO_AUDIO} />
          </div>

          {/* Transcript */}
          <div style={{ borderRadius: 16, padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ color: 'var(--muted2)', fontSize: 13 }}>◈</span>
              <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.15em' }}>TRANSCRIPT</span>
              <span style={{ color: 'var(--muted2)', fontSize: 10, marginLeft: 'auto' }}>{DEMO_SCRIPT.length} lines</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {DEMO_SCRIPT.map((line, i) => (
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

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <span style={{ color: 'var(--muted2)', fontSize: 10, letterSpacing: '0.1em' }}>NEEDLE · FEATHERLESS · ELEVENLABS</span>
            <button
              onClick={() => navigator.clipboard.writeText(DEMO_SCRIPT.map(l => `${l.speaker}: ${l.text}`).join('\n'))}
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
