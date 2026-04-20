'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants'
import { usePathname } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function FloatingChatBar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Don't show on chat tab (it has its own full page) or login
  if (pathname === ROUTES.CHAT || pathname === ROUTES.LOGIN) return null

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || 'No response.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error reaching AI service.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Expanded chat panel */}
      {open && (
        <div className="card-elevated w-80 shadow-2xl flex flex-col overflow-hidden animate-slide-in" style={{ height: '420px' }}>
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border bg-bg-elevated flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse-dot" />
              <span className="text-sm font-medium text-txt-primary">AI Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href={ROUTES.CHAT} className="text-xs text-accent hover:underline">Full view</Link>
              <button onClick={() => setOpen(false)} className="text-txt-muted hover:text-txt-primary text-lg leading-none">×</button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-txt-muted text-center pt-6">Ask anything about your IAM data…</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-bg-surface text-txt-primary rounded-bl-sm border border-bg-border'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-bg-surface border border-bg-border rounded-xl rounded-bl-sm px-3 py-2">
                  <span className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-pulse-dot" style={{ animationDelay: `${i * 0.2}s` }} />
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
                placeholder="Ask about metrics, users…"
                className="input-base flex-1 text-xs py-1.5"
              />
              <button
                onClick={sendMessage}
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
        title="AI Assistant"
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  )
}
