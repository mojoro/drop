'use client'

import { useState, useEffect } from 'react'
import Home from '@/app/page'

const SESSION_KEY = 'drop_unlocked'

export default function ForChris() {
  const [status,   setStatus]   = useState<'loading' | 'locked' | 'unlocked'>('loading')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(false)

  useEffect(() => {
    setStatus(sessionStorage.getItem(SESSION_KEY) === '1' ? 'unlocked' : 'locked')
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password === process.env.NEXT_PUBLIC_FRIEND_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setStatus('unlocked')
    } else {
      setError(true)
      setPassword('')
    }
  }

  if (status === 'loading') return null
  if (status === 'unlocked') return <Home />

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div className="animate-slide-up" style={{ textAlign: 'center', marginBottom: 32 }}>
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
      </div>

      <form
        onSubmit={handleSubmit}
        className="animate-slide-up"
        style={{
          width: '100%', maxWidth: 320,
          display: 'flex', flexDirection: 'column', gap: 10,
          animationDelay: '0.1s',
        }}
      >
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(false) }}
          placeholder="Password"
          autoFocus
          style={{
            width: '100%',
            background: 'var(--card)',
            border: `1px solid ${error ? 'rgba(255,92,58,0.5)' : 'var(--border)'}`,
            color: 'var(--text)',
            fontSize: 14,
            padding: '12px 14px',
            borderRadius: 12,
            outline: 'none',
            fontFamily: 'inherit',
            transition: 'border-color 0.2s',
          }}
        />
        {error && (
          <p style={{ color: '#ff8566', fontSize: 11, letterSpacing: '0.08em', margin: 0, textAlign: 'center' }}>
            ✗ INCORRECT PASSWORD
          </p>
        )}
        <button
          type="submit"
          disabled={!password}
          style={{
            padding: '11px 24px',
            borderRadius: 12,
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.08em',
            cursor: password ? 'pointer' : 'not-allowed',
            border: 'none',
            background: password ? 'var(--accent)' : '#2a2a2a',
            color: password ? '#000' : '#888',
            boxShadow: password ? '0 0 24px rgba(255,92,58,0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          ENTER
        </button>
      </form>
    </main>
  )
}
