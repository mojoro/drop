'use client'

import type { Stage } from './types'

const PIPELINE_STAGES = [
  { id: 'extracting', label: 'SCRAPE',  sub: 'Content extraction',  icon: '\u25CE' },
  { id: 'writing',    label: 'SCRIPT',  sub: 'Dialogue generation', icon: '\u25C8' },
  { id: 'audio',      label: 'VOICE',   sub: 'Speech synthesis',    icon: '\u25C9' },
]

function stageIndex(s: Stage) {
  return ['extracting', 'writing', 'audio', 'done'].indexOf(s)
}

export function PipelineViz({ stage }: { stage: Stage }) {
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
                  {done ? '\u2713' : s.icon}
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
