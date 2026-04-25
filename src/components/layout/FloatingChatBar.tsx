'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/constants'
import { getSuggestions } from '@/lib/chatSuggestions'
import { useMetricsStore } from '@/store/metricsStore'
import type { MetricSuggestion } from '@/app/api/chat/route'

interface Message {
  role: 'user' | 'assistant'
  content: string
  metricSuggestion?: MetricSuggestion
}

export default function FloatingChatBar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { addMetric, metrics } = useMetricsStore()

  const [open,     setOpen]     = useState(false)
  const [input,    setInput]    = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Don't render on chat page (has its own UI) or login
  if (pathname === ROUTES.CHAT || pathname === ROUTES.LOGIN) return null

  const suggestions = getSuggestions(pathname)
  const currentSection = pathname.split('/')[2] ?? ''

  async function sendMessage(text?: string) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:       next.map(m => ({ role: m.role, content: m.content })),
          currentSection,
        }),
      })
      const data = await res.json() as {
        content?: string
        metricSuggestion?: MetricSuggestion
        navigationTarget?: string
      }

      // Handle navigation response
      if (data.navigationTarget) {
        setMessages(prev => [...prev, {
          role:    'assistant',
          content: data.content ?? `Navigating to ${data.navigationTarget}…`,
        }])
        setTimeout(() => router.push(data.navigationTarget!), 600)
        return
      }

      setMessages(prev => [...prev, {
        role:             'assistant',
        content:          data.content ?? 'No response.',
        metricSuggestion: data.metricSuggestion,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error reaching AI service.' }])
    } finally {
      setLoading(false)
    }
  }

  function saveMetric(s: MetricSuggestion) {
    const alreadySaved = metrics.some(m => m.formula === s.formula)
    if (alreadySaved) return
    addMetric({ name: s.name, description: s.description, formula: s.formula, result: s.value, pinnedTo: [] })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

      {/* Expanded chat panel */}
      {open && (
        <div
          className="card-elevated w-80 shadow-2xl flex flex-col overflow-hidden animate-slide-in"
          style={{ height: '460px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border bg-bg-elevated flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse-dot" />
              <span className="text-sm font-medium text-txt-primary">IAM Analyst</span>
              <span className="text-[9px] text-txt-muted bg-bg-surface border border-bg-border rounded-full px-1.5 py-0.5">qwen2.5 · Gemini</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href={ROUTES.CHAT} className="text-xs text-accent hover:underline">Full view</Link>
              <button onClick={() => setOpen(false)} className="text-txt-muted hover:text-txt-primary text-lg leading-none">×</button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

            {/* Empty state: show suggestions */}
            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-[10px] text-txt-muted font-semibold uppercase tracking-wider">Suggested</p>
                {suggestions.slice(0, 4).map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="w-full text-left text-[10px] px-3 py-2 rounded-lg bg-bg-surface border border-bg-border text-txt-secondary hover:text-txt-primary hover:border-accent/40 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-bg-surface text-txt-primary rounded-bl-sm border border-bg-border'
                }`}>
                  {m.content}
                </div>

                {/* Metric save button */}
                {m.role === 'assistant' && m.metricSuggestion && (
                  <div className="mt-1 flex items-center gap-2 px-1">
                    <span className="text-[10px] font-mono bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded">
                      {m.metricSuggestion.value}
                    </span>
                    {metrics.some(mx => mx.formula === m.metricSuggestion!.formula) ? (
                      <span className="text-[10px] text-status-success">✓ Saved</span>
                    ) : (
                      <button
                        onClick={() => saveMetric(m.metricSuggestion!)}
                        className="text-[10px] text-accent hover:text-accent-hover underline"
                      >
                        📌 Save metric
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-bg-surface border border-bg-border rounded-xl rounded-bl-sm px-3 py-2">
                  <span className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-pulse-dot"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask or say 'go to health'…"
                className="input-base flex-1 text-xs py-1.5"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="btn-primary py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white shadow-lg flex items-center justify-center text-xl transition-colors duration-150"
        title="IAM Analyst"
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  )
}
