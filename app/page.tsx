'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────
type Voice = { id: string; name: string; type: 'builtin' | 'custom' }
type Stage = 'idle' | 'extracting' | 'writing' | 'audio' | 'done' | 'error'
type ScriptLine = { speaker: 'ALEX' | 'SAM'; text: string }
type Result = { scriptLines: ScriptLine[]; audio: string | null; scriptBackend?: 'ollama' | 'openrouter' | 'featherless' | 'claude' }

type SavedPodcast = {
  id: string; title: string; input: string
  scriptLines: ScriptLine[]; scriptBackend: string
  alexVoice: string; samVoice: string; createdAt: string
}

type MaskedProfile = {
  name: string
  openrouterKey: string   // masked, e.g. "sk-or•••a3f2"
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

const PROFILE_KEY = 'drop-active-profile'

function loadActiveProfile(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(PROFILE_KEY) || ''
}

function saveActiveProfile(name: string) {
  if (name) localStorage.setItem(PROFILE_KEY, name)
  else localStorage.removeItem(PROFILE_KEY)
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

// ── Voice select (compact dropdown) ─────────────────────────────────────────
function VoiceSelect({ label, color, voices, selected, onSelect }: {
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

// ── Settings input ──────────────────────────────────────────────────────────
// ── Action button ───────────────────────────────────────────────────────────
function ActionButton({ onClick, disabled, label, hint }: {
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
  const [scriptLength, setScriptLength] = useState<'short' | 'medium' | 'long'>('short')
  const [language, setLanguage] = useState('English')
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
  const [activeProfile, setActiveProfile] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)
  const [showLibrary,  setShowLibrary]  = useState(false)
  const [podcasts,     setPodcasts]     = useState<SavedPodcast[]>([])
  const [profiles,     setProfiles]     = useState<MaskedProfile[]>([])
  const [saveTitle,    setSaveTitle]    = useState('')
  const [saving,       setSaving]       = useState(false)
  const [profileName,  setProfileName]  = useState('')
  const [profileForm,  setProfileForm]  = useState({
    openrouterKey: '', openrouterModel: '', featherlessKey: '',
    anthropicKey: '', needleKey: '', ollamaUrl: '', ollamaModel: '',
  })
  const mediaRecRef    = useRef<MediaRecorder | null>(null)
  const chunksRef      = useRef<Blob[]>([])
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef       = useRef<AbortController | null>(null)

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

  const refreshLibrary = useCallback(() => {
    fetch('/api/library').then(r => r.json()).then(setPodcasts).catch(() => {})
    fetch('/api/profiles').then(r => r.json()).then(setProfiles).catch(() => {})
  }, [])

  useEffect(() => {
    refreshVoices()
    setActiveProfile(loadActiveProfile())
    fetch('/api/settings').then(r => r.json()).then(setServerStatus).catch(() => {})
    refreshLibrary()
  }, [refreshLibrary])

  function selectProfile(name: string) {
    setActiveProfile(name)
    saveActiveProfile(name)
  }

  async function handleSavePodcast() {
    if (!result?.audio || !saveTitle.trim() || saving) return
    setSaving(true)
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: saveTitle.trim(),
          input,
          scriptLines: result.scriptLines,
          scriptBackend: result.scriptBackend,
          alexVoice, samVoice,
          audio: result.audio,
        }),
      })
      setSaveTitle('')
      refreshLibrary()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePodcast(id: string) {
    await fetch(`/api/library/${id}`, { method: 'DELETE' })
    refreshLibrary()
  }

  async function handleLoadPodcast(p: SavedPodcast) {
    setInput(p.input || p.scriptLines.map(l => `${l.speaker}: ${l.text}`).join('\n'))
    if (p.alexVoice) setAlexVoice(p.alexVoice)
    if (p.samVoice) setSamVoice(p.samVoice)
    setShowLibrary(false)
    setStage('audio')
    try {
      const res = await fetch(`/api/library/${p.id}/audio`)
      if (!res.ok) throw new Error('Audio not found')
      const blob = await res.blob()
      const audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          resolve(dataUrl.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      setResult({ scriptLines: p.scriptLines, audio, scriptBackend: p.scriptBackend as Result['scriptBackend'] })
      setStage('done')
    } catch {
      setResult({ scriptLines: p.scriptLines, audio: null, scriptBackend: p.scriptBackend as Result['scriptBackend'] })
      setStage('done')
    }
  }

  function inputLooksLikeTranscript(): boolean {
    const lines = input.trim().split('\n').filter(Boolean)
    return lines.length >= 2 && lines.every(l => /^(ALEX|SAM):\s/i.test(l.trim()))
  }

  async function handleVoiceTranscript() {
    if (!input.trim() || busy) return
    const lines = input.trim().split('\n').map(l => l.trim()).filter(Boolean)
    const scriptLines = lines.map(l => {
      const m = l.match(/^(ALEX|SAM):\s*(.+)$/i)
      if (!m) return null
      return { speaker: m[1].toUpperCase() as 'ALEX' | 'SAM', text: m[2].trim() }
    }).filter((l): l is ScriptLine => l !== null)

    if (scriptLines.length === 0) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setStage('audio')
    setError(null)
    setResult({ scriptLines, audio: null, scriptBackend: 'manual' as any })
    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptLines, alexVoice, samVoice }),
        signal: ac.signal,
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult({ scriptLines, audio: data.audio, scriptBackend: 'manual' as any })
      setStage('done')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setStage('error')
      setError(e instanceof Error ? e.message : 'Voicing failed')
    } finally {
      abortRef.current = null
    }
  }

  async function handleSaveProfile() {
    if (!profileName.trim()) return
    await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profileForm, name: profileName.trim() }),
    })
    setProfileName('')
    setProfileForm({
      openrouterKey: '', openrouterModel: '', featherlessKey: '',
      anthropicKey: '', needleKey: '', ollamaUrl: '', ollamaModel: '',
    })
    refreshLibrary()
  }

  async function handleDeleteProfile(name: string) {
    if (activeProfile === name) selectProfile('')
    await fetch('/api/profiles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    refreshLibrary()
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

  function handleCancel() {
    abortRef.current?.abort()
    abortRef.current = null
    setStage('idle')
    setError(null)
  }

  async function handleGenerate() {
    if (!input.trim() || busy) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setStage('extracting')
    setResult(null)
    setError(null)
    try {
      setStage('writing')
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), alexVoice, samVoice, profile: activeProfile, length: scriptLength, language }),
        signal: ac.signal,
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (data.audio) setStage('audio')
      setResult(data)
      setStage('done')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setStage('error')
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      abortRef.current = null
    }
  }

  async function handleResynthesize() {
    if (!result?.scriptLines || busy) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setStage('audio')
    setError(null)
    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptLines: result.scriptLines, alexVoice, samVoice }),
        signal: ac.signal,
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult(prev => prev ? { ...prev, audio: data.audio } : prev)
      setStage('done')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setStage('error')
      setError(e instanceof Error ? e.message : 'Re-synthesis failed')
    } finally {
      abortRef.current = null
    }
  }

  async function handleDownloadMp3() {
    if (!result?.audio) return
    const res = await fetch('/api/encode-mp3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: result.audio }),
    })
    const data = await res.json()
    if (!res.ok || !data.audio) return
    const bytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'audio/mp3' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `drop-${new Date().toISOString().slice(0, 10)}.mp3`
    a.click()
    URL.revokeObjectURL(url)
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

      {/* ── Panel toggles ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => { setShowSettings(s => !s); setShowLibrary(false) }}
          style={{
            padding: '5px 14px', borderRadius: 8,
            fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
            color: showSettings ? 'var(--text)' : 'var(--muted)',
            background: showSettings ? 'var(--card)' : 'transparent',
            border: `1px solid ${showSettings ? 'var(--border2)' : 'transparent'}`,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          {showSettings ? '▾ SETTINGS' : '▸ SETTINGS'}
        </button>
        <button
          onClick={() => { setShowLibrary(s => !s); setShowSettings(false); if (!showLibrary) refreshLibrary() }}
          style={{
            padding: '5px 14px', borderRadius: 8,
            fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
            color: showLibrary ? 'var(--text)' : 'var(--muted)',
            background: showLibrary ? 'var(--card)' : 'transparent',
            border: `1px solid ${showLibrary ? 'var(--border2)' : 'transparent'}`,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          {showLibrary ? '▾ LIBRARY' : '▸ LIBRARY'}
          {podcasts.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.6 }}>{podcasts.length}</span>
          )}
        </button>
      </div>

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
            <p style={{ margin: 0, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              Keys are stored on the server only. Select an active profile or use .env.local.
            </p>

            {/* Server env status */}
            {serverStatus && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(['ollama', 'openrouter', 'featherless', 'anthropic', 'needle'] as const).map(k => {
                  const active = serverStatus[k]
                  return (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: active ? 'var(--green)' : 'var(--muted2)',
                        boxShadow: active ? '0 0 6px rgba(74,222,128,0.4)' : 'none',
                      }} />
                      <span style={{ fontSize: 9, letterSpacing: '0.1em', color: active ? 'var(--text)' : 'var(--muted2)' }}>
                        {k.toUpperCase()} {active ? '(env)' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Active profile selector */}
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', marginTop: 4 }}>
              ACTIVE PROFILE
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => selectProfile('')}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 10,
                  fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
                  background: !activeProfile ? 'var(--accent)' : 'var(--card2)',
                  border: `1px solid ${!activeProfile ? 'var(--accent)' : 'var(--border2)'}`,
                  color: !activeProfile ? '#000' : 'var(--muted)',
                }}
              >
                env only
              </button>
              {profiles.map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    onClick={() => selectProfile(p.name)}
                    style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 10,
                      fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
                      background: activeProfile === p.name ? 'var(--accent)' : 'var(--card2)',
                      border: `1px solid ${activeProfile === p.name ? 'var(--accent)' : 'var(--border2)'}`,
                      color: activeProfile === p.name ? '#000' : 'var(--text)',
                    }}
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={() => handleDeleteProfile(p.name)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--muted2)', fontSize: 10, fontFamily: 'inherit',
                      padding: '2px 4px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Show masked keys for active profile */}
            {activeProfile && (() => {
              const p = profiles.find(pr => pr.name === activeProfile)
              if (!p) return null
              const keys = [
                { label: 'OLLAMA', val: p.ollamaModel ? `${p.ollamaModel} @ ${p.ollamaUrl || 'localhost'}` : '' },
                { label: 'OPENROUTER', val: p.openrouterKey },
                { label: 'FEATHERLESS', val: p.featherlessKey },
                { label: 'ANTHROPIC', val: p.anthropicKey },
                { label: 'NEEDLE', val: p.needleKey },
              ].filter(k => k.val)
              if (keys.length === 0) return <p style={{ margin: 0, fontSize: 10, color: 'var(--muted2)' }}>No keys configured in this profile.</p>
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {keys.map(k => (
                    <div key={k.label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted)', width: 80 }}>{k.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'inherit' }}>{k.val}</span>
                    </div>
                  ))}
                </div>
              )
            })()}

            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

            {/* Create new profile */}
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)' }}>
              CREATE PROFILE
            </div>

            <SettingsInput
              label="PROFILE NAME"
              placeholder="e.g. work, personal"
              value={profileName}
              onChange={v => setProfileName(v)}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <SettingsInput
                label="OLLAMA MODEL"
                placeholder="e.g. qwen2.5:7b"
                value={profileForm.ollamaModel}
                onChange={v => setProfileForm(f => ({ ...f, ollamaModel: v }))}
                style={{ flex: 1, minWidth: 140 }}
              />
              <SettingsInput
                label="OLLAMA URL"
                placeholder="http://localhost:11434"
                value={profileForm.ollamaUrl}
                onChange={v => setProfileForm(f => ({ ...f, ollamaUrl: v }))}
                style={{ flex: 1, minWidth: 180 }}
              />
            </div>

            <SettingsInput
              label="OPENROUTER API KEY"
              placeholder="sk-or-..."
              value={profileForm.openrouterKey}
              onChange={v => setProfileForm(f => ({ ...f, openrouterKey: v }))}
              secret
            />

            <SettingsInput
              label="OPENROUTER MODEL"
              placeholder="qwen/qwen3-8b (default)"
              value={profileForm.openrouterModel}
              onChange={v => setProfileForm(f => ({ ...f, openrouterModel: v }))}
            />

            <SettingsInput
              label="FEATHERLESS API KEY"
              placeholder="fl-..."
              value={profileForm.featherlessKey}
              onChange={v => setProfileForm(f => ({ ...f, featherlessKey: v }))}
              secret
            />

            <SettingsInput
              label="ANTHROPIC API KEY"
              placeholder="sk-ant-..."
              value={profileForm.anthropicKey}
              onChange={v => setProfileForm(f => ({ ...f, anthropicKey: v }))}
              secret
            />

            <SettingsInput
              label="NEEDLE API KEY"
              placeholder="optional — built-in scraper used by default"
              value={profileForm.needleKey}
              onChange={v => setProfileForm(f => ({ ...f, needleKey: v }))}
              secret
            />

            <button
              onClick={handleSaveProfile}
              disabled={!profileName.trim()}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 11,
                fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'inherit',
                cursor: profileName.trim() ? 'pointer' : 'not-allowed',
                border: 'none', transition: 'all 0.15s', alignSelf: 'flex-start',
                background: profileName.trim() ? 'var(--accent)' : 'var(--card2)',
                color: profileName.trim() ? '#000' : 'var(--muted)',
              }}
            >
              SAVE PROFILE
            </button>

            <p style={{ margin: 0, fontSize: 9, color: 'var(--muted2)', lineHeight: 1.5 }}>
              LLM priority: Ollama → OpenRouter → Featherless → Claude. Profile keys override env vars.
            </p>
          </div>
        </div>
      )}

      {/* ── Library panel ── */}
      {showLibrary && (
        <div
          className="animate-slide-up"
          style={{
            width: '100%', maxWidth: 640, marginBottom: 20,
            borderRadius: 16, padding: '18px 20px',
            background: 'var(--card)', border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)' }}>
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
                      <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                        <span>{p.scriptLines.length} lines</span>
                        <span>{p.scriptBackend.toUpperCase()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLoadPodcast(p)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 9,
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
                      style={{ height: 32, flexShrink: 0 }}
                    />
                    <button
                      onClick={() => handleDeletePodcast(p.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--muted2)', fontSize: 12, fontFamily: 'inherit',
                        padding: '4px 6px', flexShrink: 0,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ff8566')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted2)')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <VoiceSelect label="ALEX" color="var(--alex)" voices={voices} selected={alexVoice} onSelect={setAlexVoice} />
          <VoiceSelect label="SAM" color="var(--sam)" voices={voices} selected={samVoice} onSelect={setSamVoice} />

          <button
            onClick={() => { setShowClone(c => !c); setCloneMsg(null) }}
            style={{
              fontSize: 9, fontWeight: 600, letterSpacing: '0.1em',
              color: showClone ? 'var(--text)' : 'var(--muted)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', padding: 0, marginLeft: 'auto',
              transition: 'color 0.15s',
            }}
          >
            {showClone ? '▾ CLONE' : '+ CLONE'}
          </button>

        </div>

        {showClone && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 20px',
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

        {/* Bottom toolbar */}
        <div className="bottom-toolbar" style={{
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

          {/* Length selector */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--card)', borderRadius: 8, padding: 2 }}>
            {(['short', 'medium', 'long'] as const).map(len => (
              <button
                key={len}
                onClick={() => setScriptLength(len)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 9,
                  fontWeight: scriptLength === len ? 700 : 400,
                  fontFamily: 'inherit', cursor: 'pointer',
                  border: 'none', transition: 'all 0.15s',
                  letterSpacing: '0.08em',
                  background: scriptLength === len ? 'var(--accent)' : 'transparent',
                  color: scriptLength === len ? '#000' : 'var(--muted)',
                }}
              >
                {len === 'short' ? '~1m' : len === 'medium' ? '~3m' : '~7m'}
              </button>
            ))}
          </div>

          {/* Language selector */}
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            style={{
              padding: '4px 24px 4px 8px', borderRadius: 8, fontSize: 9,
              fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.08em',
              background: 'var(--card)', border: 'none',
              color: language === 'English' ? 'var(--muted)' : 'var(--text)',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="English">EN</option>
            <option value="German">DE</option>
            <option value="French">FR</option>
            <option value="Spanish">ES</option>
            <option value="Italian">IT</option>
            <option value="Portuguese">PT</option>
            <option value="Dutch">NL</option>
            <option value="Polish">PL</option>
            <option value="Japanese">JA</option>
            <option value="Chinese">ZH</option>
            <option value="Korean">KO</option>
            <option value="Arabic">AR</option>
            <option value="Hindi">HI</option>
            <option value="Turkish">TR</option>
            <option value="Russian">RU</option>
          </select>

          <div className="toolbar-controls" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cmd-hint" style={{
              display: 'none', alignItems: 'center', gap: 1,
              color: 'var(--muted)', lineHeight: 1,
            }}>
              <span style={{ fontSize: 18 }}>⌘</span>
              <span style={{ fontSize: 14, position: 'relative', top: -3, right: -3 }}>↵</span>
            </span>
            {busy ? (
              <button
                onClick={handleCancel}
                aria-label="Cancel generation"
                style={{
                  padding: '10px 24px',
                  borderRadius: 12,
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.08em',
                  minWidth: 148,
                  minHeight: 44,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--border2)',
                  background: 'transparent',
                  color: 'var(--muted)',
                }}
              >
                ■ CANCEL
              </button>
            ) : (
              <>
                {inputLooksLikeTranscript() && (
                  <button
                    onClick={handleVoiceTranscript}
                    disabled={ttsOnline === false}
                    aria-label="Voice this transcript"
                    style={{
                      padding: '10px 18px',
                      borderRadius: 12,
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: 12,
                      letterSpacing: '0.08em',
                      minHeight: 44,
                      cursor: ttsOnline === false ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      border: '1px solid var(--sam)',
                      background: 'transparent',
                      color: 'var(--sam)',
                    }}
                  >
                    ◉ VOICE IT
                  </button>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={ttsOnline === false}
                  aria-label="Generate podcast"
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: '0.08em',
                    minWidth: 148,
                    minHeight: 44,
                    cursor: ttsOnline === false ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    border: 'none',
                    background: ttsOnline === false  ? '#1a1a1a'
                              : !input.trim()        ? '#2a2a2a'
                              :                        'var(--accent)',
                    color: (ttsOnline === false || !input.trim()) ? '#666' : '#000',
                    boxShadow: input.trim() && ttsOnline !== false
                      ? '0 0 24px rgba(255,92,58,0.3)' : 'none',
                  }}
                >
                  ▶ GENERATE
                </button>
              </>
            )}
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
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}
        >
          <span style={{ flex: 1 }}>✗ {error}</span>
          <button
            className="error-dismiss"
            onClick={() => setError(null)}
            style={{
              background: 'none', border: 'none', color: '#ff8566',
              cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
              opacity: 0.5, padding: 0, lineHeight: 1, flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── TTS offline hint ── */}
      {ttsOnline === false && stage === 'idle' && !result && (
        <div
          className="animate-slide-up"
          style={{
            width: '100%', maxWidth: 640, marginTop: 12,
            padding: '12px 16px', borderRadius: 12,
            background: 'rgba(255,92,58,0.05)',
            border: '1px solid var(--border)',
            color: 'var(--muted)', fontSize: 11, lineHeight: 1.6,
          }}
        >
          TTS sidecar not detected. Start it with:
          <code style={{ display: 'block', marginTop: 6, padding: '6px 10px', borderRadius: 6, background: 'var(--card2)', color: 'var(--text)', fontSize: 10 }}>
            cd tts-server && uv run uvicorn main:app
          </code>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {busy && (
        <div className="animate-slide-up" style={{ width: '100%', maxWidth: 640, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderRadius: 16, padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ color: 'var(--accent)', fontSize: 13 }}>◉</span>
              <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.15em' }}>{stageLabel}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="skeleton" style={{ height: 14, width: '90%' }} />
              <div className="skeleton" style={{ height: 14, width: '75%' }} />
              <div className="skeleton" style={{ height: 14, width: '85%' }} />
              <div className="skeleton" style={{ height: 14, width: '60%' }} />
            </div>
          </div>
        </div>
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

          {/* Save + download + actions (between audio and transcript) */}
          {result.audio && (
            <div style={{
              borderRadius: 12, padding: '12px 16px',
              background: 'var(--card)', border: '1px solid var(--border)',
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <input
                type="text"
                placeholder="episode title"
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSavePodcast() }}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8,
                  background: 'var(--card2)', border: '1px solid var(--border2)',
                  color: 'var(--text)', fontSize: 11, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={handleSavePodcast}
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
              <ActionButton onClick={handleDownloadMp3} disabled={false} label="MP3 ↓" hint="download as MP3" />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionButton onClick={handleResynthesize} disabled={busy} label="RE-VOICE" hint="same script, current voices" />
            <ActionButton onClick={handleGenerate} disabled={busy} label="REGENERATE" hint="new script + audio" />
            <button
              onClick={() => navigator.clipboard.writeText(result.scriptLines.map(l => `${l.speaker}: ${l.text}`).join('\n'))}
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
              COPY ↗
            </button>
          </div>

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

          {/* Footer */}
          <div style={{ padding: '0 4px' }}>
            <span style={{ color: 'var(--muted2)', fontSize: 10, letterSpacing: '0.1em' }}>
              LOCAL TTS · POCKET-TTS{result.scriptBackend ? ` · ${result.scriptBackend.toUpperCase()}` : ''}
            </span>
          </div>
        </div>
      )}
    </main>
  )
}
