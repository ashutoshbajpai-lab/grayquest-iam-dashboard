'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/constants'
import { PLATFORM_ID } from '@/lib/config'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
      } else {
        router.push(ROUTES.PEOPLE)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent mb-4">
            <span className="text-white font-bold text-xl">G</span>
          </div>
          <h1 className="text-xl font-semibold text-txt-primary">GrayQuest</h1>
          <p className="text-sm text-txt-muted mt-1">IAM Analytics Dashboard</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-txt-primary">Sign in</h2>
            <p className="text-xs text-txt-muted mt-0.5">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-txt-secondary" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@grayquest.com"
                className="input-base w-full"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-txt-secondary" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base w-full"
              />
            </div>

            {error && (
              <p className="text-xs text-status-failure bg-status-failure/10 border border-status-failure/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-txt-muted mt-6">
          Internal use only · GrayQuest platform_id={PLATFORM_ID}
        </p>
      </div>
    </div>
  )
}
