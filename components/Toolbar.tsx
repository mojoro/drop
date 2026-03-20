'use client'

import type { ServerStatus } from './types'

export interface ToolbarProps {
  ttsOnline: boolean | null
  ttsBackend: 'local' | 'elevenlabs' | 'openai'
  scriptLength: 'short' | 'medium' | 'long' | 'custom' | 'unlimited'
  onScriptLengthChange: (len: 'short' | 'medium' | 'long' | 'custom' | 'unlimited') => void
  customMinutes: number
  onCustomMinutesChange: (m: number) => void
  llmBackend: 'auto' | 'ollama' | 'openrouter' | 'featherless' | 'claude'
  onLlmBackendChange: (b: 'auto' | 'ollama' | 'openrouter' | 'featherless' | 'claude') => void
  serverStatus: ServerStatus | null
  language: string
  onLanguageChange: (lang: string) => void
  onSwitchTtsBackend: (b: 'local' | 'elevenlabs' | 'openai') => void
  busy: boolean
  ttsReady: boolean
  input: string
  inputLooksLikeTranscript: boolean
  onCancel: () => void
  onVoiceTranscript: () => void
  onGenerate: () => void
}

export function Toolbar({
  ttsOnline, ttsBackend, scriptLength, onScriptLengthChange,
  customMinutes, onCustomMinutesChange,
  llmBackend, onLlmBackendChange, serverStatus,
  language, onLanguageChange, onSwitchTtsBackend,
  busy, ttsReady, input, inputLooksLikeTranscript,
  onCancel, onVoiceTranscript, onGenerate,
}: ToolbarProps) {
  return (
    <div className="bottom-toolbar" style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 16px',
      borderTop: '1px solid var(--border)',
      background: 'var(--card2)',
      gap: 10,
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
      <div style={{ display: 'flex', gap: 2, background: 'var(--card)', borderRadius: 8, padding: 2, alignItems: 'center' }}>
        {(['short', 'medium', 'long', 'custom', 'unlimited'] as const).map(len => (
          <button
            key={len}
            onClick={() => onScriptLengthChange(len)}
            title={len === 'unlimited' ? 'No token limit — generation may take a very long time' : undefined}
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
            {len === 'short' ? '1m' : len === 'medium' ? '3m' : len === 'long' ? '7m' : len === 'unlimited' ? '\u221E' : `${customMinutes}m`}
          </button>
        ))}
        {scriptLength === 'custom' && (
          <input
            type="number"
            min={1}
            max={240}
            value={customMinutes}
            onChange={e => onCustomMinutesChange(Math.max(1, Math.min(240, parseInt(e.target.value) || 1)))}
            style={{
              width: 36, padding: '2px 4px', borderRadius: 4, fontSize: 9,
              fontFamily: 'inherit', fontWeight: 600,
              background: 'var(--card2)', border: '1px solid var(--border2)',
              color: 'var(--text)', textAlign: 'center', outline: 'none',
            }}
          />
        )}
      </div>

      {/* LLM selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted2)' }}>LLM</span>
        <select
          value={llmBackend}
          onChange={e => onLlmBackendChange(e.target.value as typeof llmBackend)}
          title="Script generation model. AUTO cascades: Ollama → OpenRouter → Featherless → Claude"
          style={{
            padding: '4px 24px 4px 8px', borderRadius: 8, fontSize: 9,
            fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.08em',
            background: 'var(--card)', border: 'none',
            color: llmBackend === 'auto' ? 'var(--muted)' : 'var(--text)',
            cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="auto">AUTO (cascade)</option>
          <option value="ollama">{`OLLAMA${serverStatus && !serverStatus.ollama ? ' \u26A0' : ''}`}</option>
          <option value="openrouter">{`OPENROUTER${serverStatus && !serverStatus.openrouter ? ' \u26A0' : ''}`}</option>
          <option value="featherless">{`FEATHERLESS${serverStatus && !serverStatus.featherless ? ' \u26A0' : ''}`}</option>
          <option value="claude">{`CLAUDE${serverStatus && !serverStatus.anthropic ? ' \u26A0' : ''}`}</option>
        </select>
      </div>

      {/* Language selector */}
      <select
        value={language}
        onChange={e => onLanguageChange(e.target.value)}
        disabled={ttsBackend === 'local'}
        title={ttsBackend === 'local' ? 'pocket-tts supports English only' : 'Script & TTS language'}
        style={{
          padding: '4px 24px 4px 8px', borderRadius: 8, fontSize: 9,
          fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.08em',
          background: 'var(--card)', border: 'none',
          color: ttsBackend === 'local' ? 'var(--muted2)' : language === 'English' ? 'var(--muted)' : 'var(--text)',
          cursor: ttsBackend === 'local' ? 'not-allowed' : 'pointer', outline: 'none',
          opacity: ttsBackend === 'local' ? 0.5 : 1,
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

      {/* TTS backend selector */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--card)', borderRadius: 8, padding: 2 }}>
        {([
          { id: 'local', label: 'LOCAL' },
          { id: 'elevenlabs', label: '11LABS' },
          { id: 'openai', label: 'OPENAI' },
        ] as const).map(b => (
          <button
            key={b.id}
            onClick={() => onSwitchTtsBackend(b.id)}
            style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 8,
              fontWeight: ttsBackend === b.id ? 700 : 400,
              fontFamily: 'inherit', cursor: 'pointer',
              border: 'none', transition: 'all 0.15s',
              letterSpacing: '0.08em',
              background: ttsBackend === b.id ? 'var(--sam)' : 'transparent',
              color: ttsBackend === b.id ? '#000' : 'var(--muted)',
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="toolbar-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <span className="cmd-hint" style={{
          display: 'none', alignItems: 'center',
          color: 'var(--muted2)', fontSize: 10, lineHeight: 1,
        }}>
          {'\u2318\u21B5'}
        </span>
        {busy ? (
          <button
            onClick={onCancel}
            aria-label="Cancel generation"
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.08em',
              minHeight: 38,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: '1px solid var(--border2)',
              background: 'transparent',
              color: 'var(--muted)',
            }}
          >
            {'\u25A0'} CANCEL
          </button>
        ) : (
          <>
            {inputLooksLikeTranscript && (
              <button
                onClick={onVoiceTranscript}
                disabled={!ttsReady}
                aria-label="Voice this transcript"
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  minHeight: 38,
                  cursor: !ttsReady ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--sam)',
                  background: 'transparent',
                  color: 'var(--sam)',
                }}
              >
                {'\u25C9'} VOICE IT
              </button>
            )}
            <button
              onClick={onGenerate}
              disabled={ttsOnline === false}
              aria-label="Generate podcast"
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.08em',
                minHeight: 38,
                cursor: !ttsReady ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                border: 'none',
                background: !ttsReady            ? '#1a1a1a'
                          : !input.trim()        ? '#2a2a2a'
                          :                        'var(--accent)',
                color: (!ttsReady || !input.trim()) ? '#666' : '#000',
                boxShadow: input.trim() && ttsReady
                  ? '0 0 24px rgba(255,92,58,0.3)' : 'none',
              }}
            >
              {'\u25B6'} GENERATE
            </button>
          </>
        )}
      </div>
    </div>
  )
}
