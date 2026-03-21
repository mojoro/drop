'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Voice, Stage, ScriptLine, Result, SavedPodcast, MaskedProfile, ServerStatus } from '../components/types'
import { capitalize } from '../components/types'
import type { ProfileForm } from '../components/SettingsPanel'
import { PipelineViz } from '../components/PipelineViz'
import { VoiceSelect } from '../components/VoiceSelect'
import { SettingsPanel } from '../components/SettingsPanel'
import { LibraryPanel } from '../components/LibraryPanel'
import { Toolbar } from '../components/Toolbar'
import { ResultsSection } from '../components/ResultsSection'

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

// ── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [input,      setInput]      = useState('')
  const [stage,      setStage]      = useState<Stage>('idle')
  const [result,     setResult]     = useState<Result | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [alexVoice,  setAlexVoice]  = useState('alba')
  const [scriptLength, setScriptLength] = useState<'1m' | '3m' | '7m' | 'custom' | 'unlimited'>('1m')
  const [customMinutes, setCustomMinutes] = useState(5)
  const [language, setLanguage] = useState('English')
  const [llmBackend, setLlmBackend] = useState<'auto' | 'ollama' | 'openrouter' | 'featherless' | 'claude'>('auto')
  const [hostA, setHostA] = useState('ALEX')
  const [hostB, setHostB] = useState('SAM')
  const [monologue, setMonologue] = useState(false)
  const [samVoice,   setSamVoice]   = useState('marius')
  const [voices,     setVoices]     = useState<Voice[]>(FALLBACK_VOICES)
  const [ttsBackend, setTtsBackend] = useState<'local' | 'elevenlabs' | 'openai' | 'qwen'>('local')
  const [ttsOnline,  setTtsOnline]  = useState<boolean | null>(null)
  const [showClone,  setShowClone]  = useState(false)
  const [cloneName,  setCloneName]  = useState('')
  const [cloneFile,  setCloneFile]  = useState<File | null>(null)
  const [customVoiceId, setCustomVoiceId] = useState('')
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
  const [savedToLibrary, setSavedToLibrary] = useState(false)
  const [ttsProgress, setTtsProgress] = useState<{ current: number; total: number } | null>(null)
const [customSystemPrompt, setCustomSystemPrompt] = useState('')
  const [customUserPrompt, setCustomUserPrompt] = useState('')
  const [llmOrder, setLlmOrder] = useState<('ollama' | 'openrouter' | 'featherless' | 'claude')[]>(['ollama', 'openrouter', 'featherless', 'claude'])
  const [profileName,  setProfileName]  = useState('')
  const [profileForm,  setProfileForm]  = useState<ProfileForm>({
    openrouterKey: '', openrouterModel: '', featherlessKey: '',
    anthropicKey: '', needleKey: '', ollamaUrl: '', ollamaModel: '',
    elevenlabsKey: '', openaiKey: '', ttsBackend: 'local',
  })
  const mediaRecRef    = useRef<MediaRecorder | null>(null)
  const chunksRef      = useRef<Blob[]>([])
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef       = useRef<AbortController | null>(null)
  const ttsStartRef    = useRef<number | null>(null)
  const ttsTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const [ttsElapsed, setTtsElapsed] = useState(0)

  const isTtsSynthesizing = ttsProgress !== null
  useEffect(() => {
    if (isTtsSynthesizing) {
      if (ttsStartRef.current === null) {
        ttsStartRef.current = Date.now()
        setTtsElapsed(0)
      }
      if (!ttsTimerRef.current) {
        ttsTimerRef.current = setInterval(() => {
          setTtsElapsed(Math.floor((Date.now() - ttsStartRef.current!) / 1000))
        }, 1000)
      }
    } else {
      if (ttsTimerRef.current) { clearInterval(ttsTimerRef.current); ttsTimerRef.current = null }
      ttsStartRef.current = null
      setTtsElapsed(0)
    }
    return () => { if (ttsTimerRef.current) { clearInterval(ttsTimerRef.current); ttsTimerRef.current = null } }
  }, [isTtsSynthesizing])

  const busy = stage === 'extracting' || stage === 'writing' || stage === 'audio'
  const ttsReady = (ttsBackend !== 'local' && ttsBackend !== 'qwen') || ttsOnline !== false

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

  function refreshVoices(backend?: string) {
    const b = backend ?? ttsBackend
    const params = new URLSearchParams({ backend: b, profile: activeProfile })
    return fetch(`/api/voices?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then((data: { backend: string; voices: Voice[] }) => {
        const newVoices = data.voices.length > 0 ? data.voices : FALLBACK_VOICES
        setVoices(newVoices)
        // Reset selected voices if they don't exist in the new backend
        const ids = new Set(newVoices.map(v => v.id))
        if (!ids.has(alexVoice) && newVoices.length >= 1) setAlexVoice(newVoices[0].id)
        if (!ids.has(samVoice) && newVoices.length >= 2) setSamVoice(newVoices[Math.min(1, newVoices.length - 1)].id)
        setTtsOnline(b !== 'local' || data.voices.length > 0)
      })
      .catch(() => {
        if (b === 'local') setTtsOnline(false)
        else setTtsOnline(true) // cloud backends don't need sidecar
      })
  }

  const refreshLibrary = useCallback(() => {
    fetch('/api/library').then(r => r.json()).then(setPodcasts).catch(() => {})
    fetch('/api/profiles').then(r => r.json()).then(setProfiles).catch(() => {})
  }, [])

  useEffect(() => {
    refreshVoices()
    setActiveProfile(loadActiveProfile())
    fetch('/api/settings').then(r => r.json()).then(data => {
      const { config, ...status } = data
      setServerStatus(status)
      if (config) {
        if (config.hostA) setHostA(config.hostA)
        if (config.hostB) setHostB(config.hostB)
        if (config.language) setLanguage(config.language)
        if (config.scriptLength) setScriptLength(config.scriptLength)
        if (config.customMinutes) setCustomMinutes(config.customMinutes)
        if (config.llmBackend) setLlmBackend(config.llmBackend)
        if (Array.isArray(config.llmOrder) && config.llmOrder.length) setLlmOrder(config.llmOrder)
        if (config.ttsBackend) setTtsBackend(config.ttsBackend)
        if (typeof config.monologue === 'boolean') setMonologue(config.monologue)
        if (config.customSystemPrompt) setCustomSystemPrompt(config.customSystemPrompt)
        if (config.customUserPrompt) setCustomUserPrompt(config.customUserPrompt)
      }
    }).catch(() => {})
    refreshLibrary()

    refreshVoices()
    const pollId = setInterval(() => refreshVoices(), 5_000)
    return () => clearInterval(pollId)
  }, [refreshLibrary])

  function selectProfile(name: string) {
    setActiveProfile(name)
    saveActiveProfile(name)
  }

  function switchTtsBackend(backend: 'local' | 'elevenlabs' | 'openai' | 'qwen') {
    setTtsBackend(backend)
    if (backend === 'local' || backend === 'qwen') setLanguage('English')
    refreshVoices(backend)
  }

  function deriveTitle(src: string): string {
    const s = src.trim()
    try { return new URL(s).hostname.replace(/^www\./, '') } catch { /* not a URL */ }
    if (s.length <= 60) return s
    const cut = s.slice(0, 60)
    const lastSpace = cut.lastIndexOf(' ')
    return lastSpace > 20 ? cut.slice(0, lastSpace) : cut
  }

  async function autoSave(finalResult: Result, title: string) {
    if (!finalResult.audio) return
    setSaving(true)
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          input,
          scriptLines: finalResult.scriptLines,
          scriptBackend: finalResult.scriptBackend,
          alexVoice, samVoice,
          audio: finalResult.audio,
          monologue, hostA, hostB,
        }),
      })
      setSavedToLibrary(true)
      refreshLibrary()
    } catch {
      // silent — user can still save manually
    } finally {
      setSaving(false)
    }
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
          monologue, hostA, hostB,
        }),
      })
      setSaveTitle('')
      setSavedToLibrary(true)
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
    if (p.hostA) setHostA(p.hostA)
    if (p.hostB) setHostB(p.hostB)
    const isMono = p.monologue ?? new Set(p.scriptLines.map(l => l.speaker)).size === 1
    setMonologue(isMono)
    setShowLibrary(false)
    setResult({ scriptLines: p.scriptLines, audio: `/api/library/${p.id}/audio`, scriptBackend: p.scriptBackend as Result['scriptBackend'] })
    setSavedToLibrary(true)
    setSaveTitle(p.title)
    setStage('done')
  }

  function inputLooksLikeTranscript(): boolean {
    const lines = input.trim().split('\n').filter(Boolean)
    const pat = new RegExp(`^(${hostA}|${hostB}):\\s`, 'i')
    return lines.length >= 2 && lines.every(l => pat.test(l.trim()))
  }

  async function handleVoiceTranscript() {
    if (!input.trim() || busy) return
    const lines = input.trim().split('\n').map(l => l.trim()).filter(Boolean)
    const scriptLines = lines.map(l => {
      const pat = new RegExp(`^(${hostA}|${hostB}):\\s*(.+)$`, 'i')
      const m = l.match(pat)
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
        body: JSON.stringify({ scriptLines, alexVoice, samVoice, ttsBackend, profile: activeProfile, language, hostA }),
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
      elevenlabsKey: '', openaiKey: '', ttsBackend: 'local',
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

  function handleAddCustomVoice() {
    if (!cloneName.trim() || !customVoiceId.trim()) return
    const newVoice: Voice = { id: customVoiceId.trim(), name: cloneName.trim(), type: 'custom' }
    setVoices(prev => [...prev, newVoice])
    setCloneMsg({ ok: true, text: `Voice "${cloneName.trim()}" added` })
    setCloneName('')
    setCustomVoiceId('')
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
    setSavedToLibrary(false)
    try {
      setTtsProgress(null)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: input.trim(), alexVoice, samVoice, profile: activeProfile,
          length: scriptLength, customMinutes: scriptLength === 'custom' ? customMinutes : undefined,
          language, ttsBackend, llmBackend, hostA, hostB, monologue,
          customSystemPrompt: customSystemPrompt || undefined,
          customUserPrompt: customUserPrompt || undefined,
          llmOrder,
        }),
        signal: ac.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }

      // Read SSE stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const chunk of lines) {
          const dataLine = chunk.trim()
          if (!dataLine.startsWith('data: ')) continue
          const event = JSON.parse(dataLine.slice(6))

          if (event.stage === 'extracting') setStage('extracting')
          else if (event.stage === 'writing') setStage('writing')
          else if (event.stage === 'script') {
            setResult({ scriptLines: event.scriptLines, audio: null, scriptBackend: event.scriptBackend })
          }
          else if (event.stage === 'audio') {
            setStage('audio')
            if (event.progress) setTtsProgress(event.progress)
          }
          else if (event.stage === 'done') {
            const finalResult = { scriptLines: event.scriptLines, audio: event.audio, scriptBackend: event.scriptBackend }
            setResult(finalResult)
            setStage('done')
            setTtsProgress(null)
            const title = deriveTitle(input)
            setSaveTitle(title)
            autoSave(finalResult, title)
          }
          else if (event.stage === 'error') {
            throw new Error(event.error)
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setStage('error')
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setTtsProgress(null)
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
        body: JSON.stringify({ scriptLines: result.scriptLines, alexVoice, samVoice, ttsBackend, profile: activeProfile, language, hostA }),
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
    let audioBase64 = result.audio
    if (audioBase64.startsWith('/')) {
      const r = await fetch(audioBase64)
      const buf = await r.arrayBuffer()
      const bytes = new Uint8Array(buf)
      const chunks: string[] = []
      for (let i = 0; i < bytes.length; i += 0x8000) {
        chunks.push(String.fromCharCode.apply(null, [...bytes.subarray(i, i + 0x8000)]))
      }
      audioBase64 = btoa(chunks.join(''))
    }
    const res = await fetch('/api/encode-mp3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: audioBase64 }),
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
    stage === 'extracting' ? '\u25CE SCRAPING CONTENT...' :
    stage === 'writing'    ? '\u25C8 GENERATING SCRIPT...' :
    stage === 'audio'      ? '\u25C9 SYNTHESISING VOICES...' : ''

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
          PASTE A URL OR TOPIC {'\u00B7'} LOCAL PODCAST GENERATION
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
          {showSettings ? '\u25BE SETTINGS' : '\u25B8 SETTINGS'}
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
          {showLibrary ? '\u25BE LIBRARY' : '\u25B8 LIBRARY'}
          {podcasts.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}> {podcasts.length}</span>
          )}
        </button>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <SettingsPanel
          serverStatus={serverStatus}
          profiles={profiles}
          activeProfile={activeProfile}
          onSelectProfile={selectProfile}
          onDeleteProfile={handleDeleteProfile}
          profileName={profileName}
          onProfileNameChange={setProfileName}
          profileForm={profileForm}
          onProfileFormChange={setProfileForm}
          onSaveProfile={handleSaveProfile}
          hostA={hostA}
          hostB={hostB}
          customSystemPrompt={customSystemPrompt}
          onCustomSystemPromptChange={setCustomSystemPrompt}
          customUserPrompt={customUserPrompt}
          onCustomUserPromptChange={setCustomUserPrompt}
          llmOrder={llmOrder}
          onLlmOrderChange={setLlmOrder}
        />
      )}

      {/* ── Library panel ── */}
      {showLibrary && (
        <LibraryPanel
          podcasts={podcasts}
          onLoadPodcast={handleLoadPodcast}
          onDeletePodcast={handleDeletePodcast}
        />
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
          width: '100%', maxWidth: 704,
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
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted2)' }}>
            {ttsBackend === 'local' ? 'POCKET-TTS' : ttsBackend === 'elevenlabs' ? 'ELEVENLABS' : 'OPENAI'}
          </span>
          <VoiceSelect label={hostA} color="var(--alex)" voices={voices} selected={alexVoice} onSelect={setAlexVoice} />
          {!monologue && <VoiceSelect label={hostB} color="var(--sam)" voices={voices} selected={samVoice} onSelect={setSamVoice} />}

          <button
            onClick={() => { setShowClone(c => !c); setCloneMsg(null) }}
            style={{
              fontSize: 12, fontWeight: 600, letterSpacing: '0.1em',
              color: showClone ? 'var(--text)' : 'var(--muted)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', padding: 0, marginLeft: 'auto',
              transition: 'color 0.15s',
            }}
          >
            {showClone
              ? (ttsBackend === 'local' ? '\u25BE CLONE' : '\u25BE ADD VOICE')
              : (ttsBackend === 'local' ? '+ CLONE' : '+ ADD VOICE')}
          </button>
        </div>

        {/* Clone / Add voice panel */}
        {showClone && ttsBackend === 'local' && (
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
              <label style={{
                flex: 2, minWidth: 120,
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--card2)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
                fontSize: 11, color: cloneFile ? 'var(--text)' : 'var(--muted)',
                overflow: 'hidden',
              }}>
                <span style={{ flexShrink: 0 }}>{'\u25CE'}</span>
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
                  whiteSpace: 'nowrap',
                }}
              >
                {recording
                  ? `\u23F9 ${Math.floor(recordSecs / 60)}:${String(recordSecs % 60).padStart(2, '0')}`
                  : '\u23FA REC'}
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
                {cloneMsg.ok ? '\u2713' : '\u2717'} {cloneMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Add custom voice for cloud backends */}
        {showClone && ttsBackend !== 'local' && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 20px',
            display: 'flex', flexDirection: 'column', gap: 8,
            animation: 'slide-up 0.2s ease',
          }}>
            <p style={{ margin: 0, fontSize: 9, color: 'var(--muted)', lineHeight: 1.5 }}>
              {ttsBackend === 'elevenlabs'
                ? 'Add a voice by its ElevenLabs voice ID (from elevenlabs.io \u2192 Voices \u2192 ID).'
                : 'Add an OpenAI voice name (e.g. alloy, echo, fable, onyx, nova, shimmer, or a custom voice).'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={ttsBackend === 'elevenlabs' ? 'display name' : 'display name'}
                value={cloneName}
                onChange={e => setCloneName(e.target.value)}
                style={{
                  flex: 1, minWidth: 100,
                  background: 'var(--card2)', border: '1px solid var(--border2)',
                  color: 'var(--text)', fontSize: 11, padding: '7px 10px',
                  borderRadius: 8, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <input
                type="text"
                placeholder={ttsBackend === 'elevenlabs' ? 'voice ID (e.g. 21m00Tcm4TlvDq8ikWAM)' : 'voice name (e.g. coral)'}
                value={customVoiceId}
                onChange={e => setCustomVoiceId(e.target.value)}
                style={{
                  flex: 2, minWidth: 180,
                  background: 'var(--card2)', border: '1px solid var(--border2)',
                  color: 'var(--text)', fontSize: 11, padding: '7px 10px',
                  borderRadius: 8, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleAddCustomVoice}
                disabled={!cloneName.trim() || !customVoiceId.trim()}
                style={{
                  padding: '7px 16px', borderRadius: 8,
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 11,
                  letterSpacing: '0.08em', cursor: 'pointer',
                  border: 'none', transition: 'all 0.15s',
                  background: !cloneName.trim() || !customVoiceId.trim()
                    ? 'var(--card2)' : 'var(--accent)',
                  color: !cloneName.trim() || !customVoiceId.trim()
                    ? 'var(--muted)' : '#000',
                }}
              >
                ADD
              </button>
            </div>
            {cloneMsg && (
              <p style={{
                margin: 0, fontSize: 10, letterSpacing: '0.08em',
                color: cloneMsg.ok ? 'var(--green)' : '#ff8566',
              }}>
                {cloneMsg.ok ? '\u2713' : '\u2717'} {cloneMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Bottom toolbar */}
        <Toolbar
          ttsOnline={ttsOnline}
          ttsBackend={ttsBackend}
          scriptLength={scriptLength}
          onScriptLengthChange={setScriptLength}
          customMinutes={customMinutes}
          onCustomMinutesChange={setCustomMinutes}
          llmBackend={llmBackend}
          onLlmBackendChange={setLlmBackend}
          serverStatus={serverStatus}
          language={language}
          onLanguageChange={setLanguage}
          onSwitchTtsBackend={switchTtsBackend}
          busy={busy}
          ttsReady={ttsReady}
          input={input}
          inputLooksLikeTranscript={inputLooksLikeTranscript()}
          onCancel={handleCancel}
          onVoiceTranscript={handleVoiceTranscript}
          onGenerate={handleGenerate}
        />
      </div>

      {/* ── Host names + warnings ── */}
      <div style={{ width: '100%', maxWidth: 704, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Mode + host name config */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Dialogue / Monologue toggle */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--card)', borderRadius: 6, padding: 2 }}>
            {(['dialogue', 'monologue'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setMonologue(mode === 'monologue')}
                style={{
                  padding: '5px 10px', borderRadius: 4, fontSize: 11,
                  fontWeight: (monologue ? mode === 'monologue' : mode === 'dialogue') ? 700 : 400,
                  fontFamily: 'inherit', cursor: 'pointer', border: 'none',
                  letterSpacing: '0.08em', transition: 'all 0.15s',
                  background: (monologue ? mode === 'monologue' : mode === 'dialogue') ? 'var(--accent)' : 'transparent',
                  color: (monologue ? mode === 'monologue' : mode === 'dialogue') ? '#000' : 'var(--muted)',
                }}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={hostA}
            onChange={e => setHostA(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
            style={{
              width: 80, padding: '3px 8px', borderRadius: 6, fontSize: 10,
              fontFamily: 'inherit', fontWeight: 700, letterSpacing: '0.08em',
              background: 'transparent', border: '1px solid var(--border2)',
              color: 'var(--alex)', textAlign: 'center', outline: 'none',
            }}
          />
          {!monologue && (
            <>
              <span style={{ fontSize: 9, color: 'var(--muted2)' }}>{'\u00D7'}</span>
              <input
                type="text"
                value={hostB}
                onChange={e => setHostB(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                style={{
                  width: 80, padding: '3px 8px', borderRadius: 6, fontSize: 10,
                  fontFamily: 'inherit', fontWeight: 700, letterSpacing: '0.08em',
                  background: 'transparent', border: '1px solid var(--border2)',
                  color: 'var(--sam)', textAlign: 'center', outline: 'none',
                }}
              />
            </>
          )}
        </div>

        {/* LLM backend warning */}
        {llmBackend !== 'auto' && serverStatus && (() => {
          const statusMap: Record<string, boolean> = { ollama: serverStatus.ollama, openrouter: serverStatus.openrouter, featherless: serverStatus.featherless, claude: serverStatus.anthropic }
          if (!statusMap[llmBackend]) {
            return (
              <div style={{ fontSize: 10, color: '#ff8566', padding: '4px 0' }}>
                {'\u26A0'} No API key configured for {llmBackend.toUpperCase()}. Add one in Settings or switch to AUTO.
              </div>
            )
          }
          return null
        })()}

        {/* Language restriction notice */}
        {ttsBackend === 'local' && language !== 'English' && (
          <div style={{ fontSize: 10, color: 'var(--muted)', padding: '4px 0' }}>
            pocket-tts only supports English pronunciation. Switch to QWEN3, 11LABS, or OPENAI for {language} TTS.
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="animate-slide-up"
          style={{
            width: '100%', maxWidth: 704, marginTop: 12,
            padding: '12px 16px', borderRadius: 12,
            background: 'rgba(255,92,58,0.08)',
            border: '1px solid rgba(255,92,58,0.2)',
            color: '#ff8566', fontSize: 12,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}
        >
          <span style={{ flex: 1 }}>{'\u2717'} {error}</span>
          <button
            className="error-dismiss"
            onClick={() => setError(null)}
            style={{
              background: 'none', border: 'none', color: '#ff8566',
              cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
              opacity: 0.5, padding: 0, lineHeight: 1, flexShrink: 0,
            }}
          >
            {'\u2715'}
          </button>
        </div>
      )}

      {/* ── TTS offline hint ── */}
      {(ttsBackend === 'local' || ttsBackend === 'qwen') && ttsOnline === false && stage === 'idle' && !result && (
        <div
          className="animate-slide-up"
          style={{
            width: '100%', maxWidth: 704, marginTop: 12,
            padding: '12px 16px', borderRadius: 12,
            background: 'rgba(255,92,58,0.05)',
            border: '1px solid var(--border)',
            color: 'var(--muted)', fontSize: 11, lineHeight: 1.6,
          }}
        >
          {ttsBackend === 'qwen' ? 'Qwen3-TTS sidecar not detected. Start it with:' : 'TTS sidecar not detected. Start it with:'}
          <code style={{ display: 'block', marginTop: 6, padding: '6px 10px', borderRadius: 6, background: 'var(--card2)', color: 'var(--text)', fontSize: 10 }}>
            {ttsBackend === 'qwen'
              ? 'cd qwen-tts-server && uv run uvicorn main:app --port 8001'
              : 'cd tts-server && uv run uvicorn main:app'}
          </code>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {busy && (
        <div className="animate-slide-up" style={{ width: '100%', maxWidth: 704, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderRadius: 16, padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ color: 'var(--accent)', fontSize: 13 }}>{'\u25C9'}</span>
              <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.15em' }}>{stageLabel}</span>
              {ttsProgress && (() => {
                const pct = ttsProgress.current / ttsProgress.total
                const remaining = ttsProgress.current > 0 ? Math.round(ttsElapsed / pct - ttsElapsed) : null
                const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
                return (
                  <span style={{ color: 'var(--muted2)', fontSize: 10, marginLeft: 'auto', display: 'flex', gap: 10 }}>
                    <span>{ttsProgress.current}/{ttsProgress.total} lines</span>
                    <span>{fmt(ttsElapsed)} elapsed</span>
                    {remaining !== null && <span>~{fmt(remaining)} left</span>}
                  </span>
                )
              })()}
            </div>
            {ttsProgress ? (
              <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: 'var(--accent)',
                  width: `${(ttsProgress.current / ttsProgress.total) * 100}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton" style={{ height: 14, width: '90%' }} />
                <div className="skeleton" style={{ height: 14, width: '75%' }} />
                <div className="skeleton" style={{ height: 14, width: '85%' }} />
                <div className="skeleton" style={{ height: 14, width: '60%' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {result && (
        <ResultsSection
          result={result}
          alexVoice={alexVoice}
          samVoice={samVoice}
          hostA={hostA}
          hostB={hostB}
          monologue={monologue}
          ttsBackend={ttsBackend}
          busy={busy}
          saveTitle={saveTitle}
          onSaveTitleChange={setSaveTitle}
          saving={saving}
          saved={savedToLibrary}
          onSavePodcast={handleSavePodcast}
          onDownloadMp3={handleDownloadMp3}
          onResynthesize={handleResynthesize}
          onCopyScript={() => navigator.clipboard.writeText(result.scriptLines.map(l => `${l.speaker}: ${l.text}`).join('\n'))}
        />
      )}
    </main>
  )
}
