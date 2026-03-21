'use client'

import type { ServerStatus } from './types'

export interface PromptPanelProps {
  hostA: string
  hostB: string
  customSystemPrompt: string
  onCustomSystemPromptChange: (v: string) => void
  customUserPrompt: string
  onCustomUserPromptChange: (v: string) => void
  llmOrder: ('ollama' | 'openrouter' | 'featherless' | 'claude')[]
  onLlmOrderChange: (order: ('ollama' | 'openrouter' | 'featherless' | 'claude')[]) => void
  serverStatus: ServerStatus | null
}

export function PromptPanel({
  hostA, hostB,
  customSystemPrompt, onCustomSystemPromptChange,
  customUserPrompt, onCustomUserPromptChange,
  llmOrder, onLlmOrderChange, serverStatus,
}: PromptPanelProps) {
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
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(255,92,58,0.06)', border: '1px solid rgba(255,92,58,0.15)',
          fontSize: 12, color: '#ff8566', lineHeight: 1.5,
        }}>
          {'\u26A0'} Editing prompts can break script generation. Only change if you know what you{"'"}re doing. Leave blank to use defaults.
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

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

        {/* Fallback order */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)' }}>
          AUTO CASCADE ORDER
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted2)', lineHeight: 1.5 }}>
          When LLM is set to AUTO, backends are tried in this order. Drag to reorder, or use arrows.
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
    </div>
  )
}
