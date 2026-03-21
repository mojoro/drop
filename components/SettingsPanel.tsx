'use client'

import { useState } from 'react'
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
  // Prompt settings
  hostA: string
  hostB: string
  customSystemPrompt: string
  onCustomSystemPromptChange: (v: string) => void
  customUserPrompt: string
  onCustomUserPromptChange: (v: string) => void
  llmOrder: ('ollama' | 'openrouter' | 'featherless' | 'claude')[]
  onLlmOrderChange: (order: ('ollama' | 'openrouter' | 'featherless' | 'claude')[]) => void
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', userSelect: 'none',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)',
      }}
    >
      <span>{label}</span>
      <span style={{
        display: 'inline-block',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
        fontSize: 10, color: 'var(--muted2)',
      }}>▾</span>
    </div>
  )
}

export function SettingsPanel({
  serverStatus, profiles, activeProfile, onSelectProfile, onDeleteProfile,
  profileName, onProfileNameChange, profileForm, onProfileFormChange, onSaveProfile,
  hostA, hostB,
  customSystemPrompt, onCustomSystemPromptChange,
  customUserPrompt, onCustomUserPromptChange,
  llmOrder, onLlmOrderChange,
}: SettingsPanelProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [showTts, setShowTts] = useState(true)
  const [showPrompt, setShowPrompt] = useState(false)

  return (
    <div
      className="animate-slide-up"
      style={{
        width: '100%', maxWidth: 704, marginBottom: 20,
        borderRadius: 16, padding: '18px 20px',
        background: 'var(--card)', border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
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
                  <span style={{ fontSize: 11, letterSpacing: '0.1em', color: active ? 'var(--text)' : 'var(--muted2)' }}>
                    {k.toUpperCase()} {active ? '(env)' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Active profile selector */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', marginTop: 4 }}>
          ACTIVE PROFILE
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => onSelectProfile('')}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12,
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
                  padding: '5px 12px', borderRadius: 6, fontSize: 12,
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
                  color: 'var(--muted2)', fontSize: 12, fontFamily: 'inherit',
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
          if (keys.length === 0) return <p style={{ margin: 0, fontSize: 12, color: 'var(--muted2)' }}>No keys configured in this profile.</p>
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {keys.map(k => (
                <div key={k.label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted)', width: 80 }}>{k.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'inherit' }}>{k.val}</span>
                </div>
              ))}
            </div>
          )
        })()}

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

        {/* ── Create Profile (collapsible) ── */}
        <SectionHeader label="CREATE PROFILE" open={showCreate} onToggle={() => setShowCreate(o => !o)} />

        {showCreate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* TTS Backends (collapsible) */}
            <SectionHeader label="TTS BACKENDS" open={showTts} onToggle={() => setShowTts(o => !o)} />

            {showTts && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              </div>
            )}

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

            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted2)', lineHeight: 1.5 }}>
              LLM priority: Ollama {'\u2192'} OpenRouter {'\u2192'} Featherless {'\u2192'} Claude. Profile keys override env vars.
            </p>
          </div>
        )}

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

        {/* ── Prompt Settings (collapsible) ── */}
        <SectionHeader
          label={`PROMPT${customSystemPrompt || customUserPrompt ? ' \u25CF' : ''}`}
          open={showPrompt}
          onToggle={() => setShowPrompt(o => !o)}
        />

        {showPrompt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(255,92,58,0.06)', border: '1px solid rgba(255,92,58,0.15)',
              fontSize: 12, color: '#ff8566', lineHeight: 1.5,
            }}>
              {'\u26A0'} Editing prompts can break script generation. Leave blank to use defaults.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: 6 }}>
                SYSTEM PROMPT
              </label>
              <textarea
                rows={4}
                placeholder={`You are a podcast script writer. Write a punchy, 2-host dialogue. Return ONLY lines in this exact format: "${hostA}: ..." or "${hostB}: ...". No intro, no title, no bullets, no stage directions, no markdown. Keep it concise and natural.`}
                value={customSystemPrompt}
                onChange={e => onCustomSystemPromptChange(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  background: 'var(--card2)', border: '1px solid var(--border2)',
                  color: 'var(--text)', fontSize: 11, fontFamily: 'inherit',
                  lineHeight: 1.5, resize: 'vertical', outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: 6 }}>
                USER PROMPT <span style={{ color: 'var(--muted2)', fontWeight: 400 }}>{'(use {{SOURCE}} for article content)'}</span>
              </label>
              <textarea
                rows={8}
                placeholder={`Write a sharp podcast dialogue based on the source below.\n\nRules:\n- Two hosts only: ${hostA} and ${hostB}\n- ${hostA} is curious, conversational, and asks sharp questions\n- ${hostB} is direct, insightful, and gives no-fluff answers\n- Every line must start with ${hostA}: or ${hostB}:\n- End with a memorable one-line takeaway from ${hostB}\n\nSource:\n{{SOURCE}}`}
                value={customUserPrompt}
                onChange={e => onCustomUserPromptChange(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  background: 'var(--card2)', border: '1px solid var(--border2)',
                  color: 'var(--text)', fontSize: 11, fontFamily: 'inherit',
                  lineHeight: 1.5, resize: 'vertical', outline: 'none',
                }}
              />
            </div>

            {(customSystemPrompt || customUserPrompt) && (
              <button
                onClick={() => { onCustomSystemPromptChange(''); onCustomUserPromptChange('') }}
                style={{
                  alignSelf: 'flex-start',
                  padding: '6px 14px', borderRadius: 8, fontSize: 12,
                  fontWeight: 600, letterSpacing: '0.08em', fontFamily: 'inherit',
                  cursor: 'pointer', border: '1px solid var(--border2)',
                  background: 'transparent', color: 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >
                RESET TO DEFAULTS
              </button>
            )}

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* LLM cascade order */}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)' }}>
              AUTO CASCADE ORDER
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted2)', lineHeight: 1.5 }}>
              When LLM is set to AUTO, backends are tried in this order. Use arrows to reorder.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {llmOrder.map((backend, i) => {
                const available = serverStatus
                  ? backend === 'claude' ? serverStatus.anthropic : serverStatus[backend as keyof ServerStatus]
                  : null
                return (
                  <div key={backend} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8,
                    background: 'var(--card2)', border: '1px solid var(--border2)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--muted2)', width: 16, textAlign: 'center' }}>{i + 1}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: 'var(--text)' }}>
                      {backend.toUpperCase()}
                    </span>
                    {available !== null && (
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: available ? 'var(--green)' : 'var(--muted2)',
                        boxShadow: available ? '0 0 6px rgba(74,222,128,0.4)' : 'none',
                      }} />
                    )}
                    <button
                      onClick={() => {
                        if (i === 0) return
                        const n = [...llmOrder]; [n[i-1], n[i]] = [n[i], n[i-1]]
                        onLlmOrderChange(n)
                      }}
                      disabled={i === 0}
                      style={{
                        background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer',
                        color: i === 0 ? 'var(--muted2)' : 'var(--muted)', fontSize: 12, fontFamily: 'inherit',
                        padding: '0 4px',
                      }}
                    >
                      {'\u2191'}
                    </button>
                    <button
                      onClick={() => {
                        if (i === llmOrder.length - 1) return
                        const n = [...llmOrder]; [n[i], n[i+1]] = [n[i+1], n[i]]
                        onLlmOrderChange(n)
                      }}
                      disabled={i === llmOrder.length - 1}
                      style={{
                        background: 'none', border: 'none', cursor: i === llmOrder.length - 1 ? 'default' : 'pointer',
                        color: i === llmOrder.length - 1 ? 'var(--muted2)' : 'var(--muted)', fontSize: 12, fontFamily: 'inherit',
                        padding: '0 4px',
                      }}
                    >
                      {'\u2193'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
