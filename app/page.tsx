'use client'

import { useState, useEffect, useRef } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
type Voice = { id: string; name: string; type: 'builtin' | 'custom' }
type Stage = 'idle' | 'extracting' | 'writing' | 'audio' | 'done' | 'error'
type ScriptLine = { speaker: 'ALEX' | 'SAM'; text: string }
type Result = { scriptLines: ScriptLine[]; audio: string | null; scriptBackend?: 'ollama' | 'openrouter' | 'featherless' | 'claude' }

type Settings = {
  openrouterKey: string
  openrouterModel: string
  featherlessKey: string
  anthropicKey: string
  needleKey: string
  ollamaUrl: string
  ollamaModel: string
}

type ServerStatus = {
  ollama: boolean
  openrouter: boolean
  featherless: boolean
  anthropic: boolean
  needle: boolean
}

const DEFAULT_SETTINGS: Settings = {
  openrouterKey: '',
  openrouterModel: '',
  featherlessKey: '',
  anthropicKey: '',
  needleKey: '',
  ollamaUrl: '',
  ollamaModel: '',
}

const STORAGE_KEY = 'drop-settings'

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

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

// ── Settings input ──────────────────────────────────────────────────────────
function SettingsInput({ label, placeholder, value, onChange, secret, style }: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; secret?: boolean; style?: React.CSSProperties
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 4 }}>
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
            {show ? '◉' : '○'}
          </button>
        )}
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
  const [ttsOnline,  setTtsOnline]  = useState<boolean | null>(null)
  const [showClone,  setShowClone]  = useState(false)
  const [cloneName,  setCloneName]  = useState('')
  const [cloneFile,  setCloneFile]  = useState<File | null>(null)
  const [cloning,      setCloning]      = useState(false)
  const [cloneMsg,     setCloneMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [recording,    setRecording]    = useState(false)
  const [recordSecs,   setRecordSecs]   = useState(0)
  const [settings,     setSettings]     = useState<Settings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)
  const mediaRecRef    = useRef<MediaRecorder | null>(null)
  const chunksRef      = useRef<Blob[]>([])
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  const busy = stage === 'extracting' || stage === 'writing' || stage === 'audio'

  // ── WAV encoder (client-side, mono 16-bit PCM) ────────────────────────────
  function encodeWav(buf: AudioBuffer): File {
    const sr = buf.sampleRate
    const len = buf.length
    const samples = new Float32Array(len)
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c)
      for (let i = 0; i < len; i++) samples[i] += ch[i] / buf.numberOfChannels
    }
    const pcm = new Int16Array(len)
    for (let i = 0; i < len; i++) {
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)))
    }
    const header = new ArrayBuffer(44)
    const v = new DataView(header)
    const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); w(8, 'WAVE')
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
    v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true)
    v.setUint16(32, 2, true); v.setUint16(34, 16, true)
    w(36, 'data'); v.setUint32(40, pcm.byteLength, true)
    return new File([header, pcm.buffer], 'recording.wav', { type: 'audio/wav' })
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    chunksRef.current = []
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
      const blob = new Blob(chunksRef.current, { type: mr.mimeType })
      const arrayBuf = await blob.arrayBuffer()
      const audioBuf = await new AudioContext().decodeAudioData(arrayBuf)
      setCloneFile(encodeWav(audioBuf))
      setRecording(false)
    }
    mr.start()
    mediaRecRef.current = mr
    setRecordSecs(0)
    setRecording(true)
    timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
  }

  function stopRecording() {
    mediaRecRef.current?.stop()
  }

  function refreshVoices() {
    return fetch('/api/voices')
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
  }

  useEffect(() => {
    refreshVoices()
    setSettings(loadSettings())
    fetch('/api/settings').then(r => r.json()).then(setServerStatus).catch(() => {})
  }, [])

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      saveSettings(next)
      return next
    })
  }

  async function handleClone() {
    if (!cloneFile || !cloneName.trim() || cloning) return
    setCloning(true)
    setCloneMsg(null)
    try {
      const form = new FormData()
      form.append('name', cloneName.trim())
      form.append('file', cloneFile)
      const res = await fetch('/api/clone-voice', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      await refreshVoices()
      setCloneMsg({ ok: true, text: `Voice "${data.voice}" cloned` })
      setCloneName('')
      setCloneFile(null)
    } catch (e) {
      setCloneMsg({ ok: false, text: e instanceof Error ? e.message : 'Clone failed' })
    } finally {
      setCloning(false)
    }
  }

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
        body: JSON.stringify({ input: input.trim(), alexVoice, samVoice, settings }),
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

      {/* ── Settings toggle ── */}
      <button
        onClick={() => setShowSettings(s => !s)}
        style={{
          marginBottom: 16, padding: '5px 14px', borderRadius: 8,
          fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
          color: showSettings ? 'var(--text)' : 'var(--muted)',
          background: showSettings ? 'var(--card)' : 'transparent',
          border: `1px solid ${showSettings ? 'var(--border2)' : 'transparent'}`,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        }}
      >
        {showSettings ? '▾ SETTINGS' : '▸ SETTINGS'}
      </button>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div
          className="animate-slide-up"
          style={{
            width: '100%', maxWidth: 640, marginBottom: 20,
            borderRadius: 16, padding: '18px 20px',
            background: 'var(--card)', border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Server status */}
            {serverStatus && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                {(['ollama', 'openrouter', 'featherless', 'anthropic', 'needle'] as const).map(k => {
                  const hasEnv = serverStatus[k]
                  const hasClient = k === 'ollama' ? !!settings.ollamaModel
                    : k === 'openrouter' ? !!settings.openrouterKey
                    : k === 'featherless' ? !!settings.featherlessKey
                    : k === 'anthropic' ? !!settings.anthropicKey
                    : !!settings.needleKey
                  const active = hasEnv || hasClient
                  return (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: active ? 'var(--green)' : 'var(--muted2)',
                        boxShadow: active ? '0 0 6px rgba(74,222,128,0.4)' : 'none',
                      }} />
                      <span style={{ fontSize: 9, letterSpacing: '0.1em', color: active ? 'var(--text)' : 'var(--muted2)' }}>
                        {k.toUpperCase()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <p style={{ margin: 0, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              Keys are stored in your browser only. Server env vars are used as defaults.
            </p>

            {/* LLM section */}
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', marginTop: 4 }}>
              LLM BACKENDS
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <SettingsInput
                label="OLLAMA MODEL"
                placeholder="e.g. qwen2.5:7b"
                value={settings.ollamaModel}
                onChange={v => updateSetting('ollamaModel', v)}
                style={{ flex: 1, minWidth: 140 }}
              />
              <SettingsInput
                label="OLLAMA URL"
                placeholder="http://localhost:11434"
                value={settings.ollamaUrl}
                onChange={v => updateSetting('ollamaUrl', v)}
                style={{ flex: 1, minWidth: 180 }}
              />
            </div>

            <SettingsInput
              label="OPENROUTER API KEY"
              placeholder="sk-or-..."
              value={settings.openrouterKey}
              onChange={v => updateSetting('openrouterKey', v)}
              secret
            />

            <SettingsInput
              label="OPENROUTER MODEL"
              placeholder="qwen/qwen3-8b (default)"
              value={settings.openrouterModel}
              onChange={v => updateSetting('openrouterModel', v)}
            />

            <SettingsInput
              label="FEATHERLESS API KEY"
              placeholder="fl-..."
              value={settings.featherlessKey}
              onChange={v => updateSetting('featherlessKey', v)}
              secret
            />

            <SettingsInput
              label="ANTHROPIC API KEY"
              placeholder="sk-ant-..."
              value={settings.anthropicKey}
              onChange={v => updateSetting('anthropicKey', v)}
              secret
            />

            {/* Scraping section */}
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', marginTop: 8 }}>
              SCRAPING
            </div>

            <SettingsInput
              label="NEEDLE API KEY"
              placeholder="optional — built-in scraper used by default"
              value={settings.needleKey}
              onChange={v => updateSetting('needleKey', v)}
              secret
            />

            {/* Fallback order */}
            <p style={{ margin: 0, fontSize: 9, color: 'var(--muted2)', lineHeight: 1.5, marginTop: 4 }}>
              LLM priority: Ollama → OpenRouter → Featherless → Claude
            </p>
          </div>
        </div>
      )}

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

          {/* Clone voice toggle */}
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => { setShowClone(c => !c); setCloneMsg(null) }}
              style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                color: showClone ? 'var(--text)' : 'var(--muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', padding: 0,
                transition: 'color 0.15s',
              }}
            >
              {showClone ? '▾ CLONE VOICE' : '▸ CLONE VOICE'}
            </button>

            {showClone && (
              <div style={{
                marginTop: 10,
                display: 'flex', flexDirection: 'column', gap: 8,
                animation: 'slide-up 0.2s ease',
              }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="voice name"
                    value={cloneName}
                    onChange={e => setCloneName(e.target.value)}
                    style={{
                      flex: 1, minWidth: 120,
                      background: 'var(--card2)', border: '1px solid var(--border2)',
                      color: 'var(--text)', fontSize: 11, padding: '7px 10px',
                      borderRadius: 8, outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  {/* File upload */}
                  <label style={{
                    flex: 2, minWidth: 120,
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--card2)', border: '1px solid var(--border2)',
                    borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
                    fontSize: 11, color: cloneFile ? 'var(--text)' : 'var(--muted)',
                    overflow: 'hidden',
                  }}>
                    <span style={{ flexShrink: 0 }}>◎</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cloneFile ? cloneFile.name : 'upload WAV'}
                    </span>
                    <input
                      type="file"
                      accept=".wav,audio/wav"
                      style={{ display: 'none' }}
                      onChange={e => setCloneFile(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  {/* Mic record button */}
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    title={recording ? 'Stop recording' : 'Record from microphone'}
                    style={{
                      padding: '7px 12px', borderRadius: 8, border: 'none',
                      fontFamily: 'inherit', fontWeight: 600, fontSize: 11,
                      letterSpacing: '0.06em', cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: recording ? 'rgba(255,92,58,0.15)' : 'var(--card2)',
                      color: recording ? 'var(--accent)' : 'var(--muted)',
                      borderColor: recording ? 'rgba(255,92,58,0.4)' : 'var(--border2)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {recording
                      ? `⏹ ${Math.floor(recordSecs / 60)}:${String(recordSecs % 60).padStart(2, '0')}`
                      : '⏺ REC'}
                  </button>
                  <button
                    onClick={handleClone}
                    disabled={cloning || !cloneFile || !cloneName.trim()}
                    style={{
                      padding: '7px 16px', borderRadius: 8,
                      fontFamily: 'inherit', fontWeight: 700, fontSize: 11,
                      letterSpacing: '0.08em', cursor: 'pointer',
                      border: 'none', transition: 'all 0.15s',
                      background: cloning || !cloneFile || !cloneName.trim()
                        ? 'var(--card2)' : 'var(--accent)',
                      color: cloning || !cloneFile || !cloneName.trim()
                        ? 'var(--muted)' : '#000',
                    }}
                  >
                    {cloning ? '...' : 'CLONE'}
                  </button>
                </div>

                {cloneMsg && (
                  <p style={{
                    margin: 0, fontSize: 10, letterSpacing: '0.08em',
                    color: cloneMsg.ok ? 'var(--green)' : '#ff8566',
                  }}>
                    {cloneMsg.ok ? '✓' : '✗'} {cloneMsg.text}
                  </p>
                )}
              </div>
            )}
          </div>
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
