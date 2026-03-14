'use client'

import { useState } from 'react'

type ScriptLine = { speaker: 'ALEX' | 'SAM'; text: string }

type GenerateResult = {
  scriptLines: ScriptLine[]
  audio: string | null
}

type Status = 'idle' | 'extracting' | 'writing' | 'audio' | 'done' | 'error'

const STATUS_LABELS: Record<Status, string> = {
  idle: '',
  extracting: 'Extracting content...',
  writing: 'Writing script...',
  audio: 'Generating audio...',
  done: '',
  error: '',
}

export default function Home() {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!input.trim()) return
    setStatus('extracting')
    setResult(null)
    setError(null)

    try {
      setStatus('writing')
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      if (data.audio) setStatus('audio')
      setResult(data)
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start pt-20 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Drop</h1>
        <p className="text-lg" style={{ color: 'var(--muted)' }}>
          Paste a URL or topic. Get a podcast episode in 60 seconds.
        </p>
      </div>

      {/* Input card */}
      <div
        className="w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <textarea
          className="w-full bg-transparent resize-none outline-none text-base leading-relaxed placeholder:opacity-40"
          rows={3}
          placeholder="Paste a URL or describe a topic..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
          style={{ color: 'var(--text)' }}
        />
        <button
          onClick={handleGenerate}
          disabled={status === 'extracting' || status === 'writing' || status === 'audio'}
          className="self-end px-6 py-2.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-40"
          style={{ background: 'var(--alex)', color: '#0a0a0a' }}
        >
          Generate
        </button>
      </div>

      {/* Status */}
      {STATUS_LABELS[status] && (
        <p className="mt-6 text-sm animate-pulse" style={{ color: 'var(--muted)' }}>
          {STATUS_LABELS[status]}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="mt-6 text-sm" style={{ color: '#e07070' }}>
          {error}
        </p>
      )}

      {/* Result */}
      {result && (
        <div className="w-full max-w-2xl mt-8 flex flex-col gap-6">
          {/* Audio player */}
          {result.audio && (
            <div
              className="rounded-2xl p-6 flex flex-col gap-3"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Listen
              </h2>
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
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Transcript
            </h2>
            {result.scriptLines.map((line, i) => (
              <div key={i} className="flex gap-3">
                <span
                  className="text-xs font-bold pt-0.5 w-8 shrink-0"
                  style={{ color: line.speaker === 'ALEX' ? 'var(--alex)' : 'var(--sam)' }}
                >
                  {line.speaker}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                  {line.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
