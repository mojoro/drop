'use client'

import type { MaskedProfile, ServerStatus } from './types'
import { SettingsInput } from './SettingsInput'

export type ProfileForm = {
  openrouterKey: string; openrouterModel: string; featherlessKey: string
  anthropicKey: string; needleKey: string; ollamaUrl: string; ollamaModel: string
  elevenlabsKey: string; openaiKey: string; ttsBackend: string
}

export interface SettingsPanelProps {
  serverStatus: ServerStatus | null
  profiles: MaskedProfile[]
  activeProfile: string
  onSelectProfile: (name: string) => void
  onDeleteProfile: (name: string) => void
  profileName: string
  onProfileNameChange: (name: string) => void
  profileForm: ProfileForm
  onProfileFormChange: (form: ProfileForm) => void
  onSaveProfile: () => void
}

export function SettingsPanel({
  serverStatus, profiles, activeProfile, onSelectProfile, onDeleteProfile,
  profileName, onProfileNameChange, profileForm, onProfileFormChange, onSaveProfile,
}: SettingsPanelProps) {
  return (
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
            onClick={() => onSelectProfile('')}
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
                onClick={() => onSelectProfile(p.name)}
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
                onClick={() => onDeleteProfile(p.name)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted2)', fontSize: 10, fontFamily: 'inherit',
                  padding: '2px 4px',
                }}
              >
                {'\u2715'}
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
          onChange={v => onProfileNameChange(v)}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SettingsInput
            label="OLLAMA MODEL"
            placeholder="e.g. qwen2.5:7b"
            value={profileForm.ollamaModel}
            onChange={v => onProfileFormChange({ ...profileForm, ollamaModel: v })}
            style={{ flex: 1, minWidth: 140 }}
          />
          <SettingsInput
            label="OLLAMA URL"
            placeholder="http://localhost:11434"
            value={profileForm.ollamaUrl}
            onChange={v => onProfileFormChange({ ...profileForm, ollamaUrl: v })}
            style={{ flex: 1, minWidth: 180 }}
          />
        </div>

        <SettingsInput
          label="OPENROUTER API KEY"
          placeholder="sk-or-..."
          value={profileForm.openrouterKey}
          onChange={v => onProfileFormChange({ ...profileForm, openrouterKey: v })}
          secret
        />

        <SettingsInput
          label="OPENROUTER MODEL"
          placeholder="qwen/qwen3-8b (default)"
          value={profileForm.openrouterModel}
          onChange={v => onProfileFormChange({ ...profileForm, openrouterModel: v })}
        />

        <SettingsInput
          label="FEATHERLESS API KEY"
          placeholder="fl-..."
          value={profileForm.featherlessKey}
          onChange={v => onProfileFormChange({ ...profileForm, featherlessKey: v })}
          secret
        />

        <SettingsInput
          label="ANTHROPIC API KEY"
          placeholder="sk-ant-..."
          value={profileForm.anthropicKey}
          onChange={v => onProfileFormChange({ ...profileForm, anthropicKey: v })}
          secret
        />

        <SettingsInput
          label="NEEDLE API KEY"
          placeholder="optional — built-in scraper used by default"
          value={profileForm.needleKey}
          onChange={v => onProfileFormChange({ ...profileForm, needleKey: v })}
          secret
        />

        {/* TTS section */}
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)' }}>
          TTS BACKENDS
        </div>

        <SettingsInput
          label="ELEVENLABS API KEY"
          placeholder="optional — enables ElevenLabs voices"
          value={profileForm.elevenlabsKey}
          onChange={v => onProfileFormChange({ ...profileForm, elevenlabsKey: v })}
          secret
        />

        <SettingsInput
          label="OPENAI API KEY"
          placeholder="optional — enables OpenAI TTS voices"
          value={profileForm.openaiKey}
          onChange={v => onProfileFormChange({ ...profileForm, openaiKey: v })}
          secret
        />

        <button
          onClick={onSaveProfile}
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
          LLM priority: Ollama {'\u2192'} OpenRouter {'\u2192'} Featherless {'\u2192'} Claude. Profile keys override env vars.
        </p>
      </div>
    </div>
  )
}
