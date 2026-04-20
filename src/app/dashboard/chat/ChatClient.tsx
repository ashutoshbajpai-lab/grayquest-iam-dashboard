'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useMetricsStore } from '@/store/metricsStore'
import type { MetricSuggestion } from '@/app/api/chat/route'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: string
  metricSuggestion?: MetricSuggestion
}

const SUGGESTED = [
  'Who are the top 3 users by session count?',
  'Which service has the highest failure rate?',
  'What is the overall success rate this month?',
  'Show me users with health score below 50',
  'Which hour of day sees the most activity?',
  'How many users have not logged in for 7 days?',
  'What percentage of sessions span 3 or more services?',
  'Which service generates the most reports?',
]

function getTime() {
  const d = new Date()
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
      AI
    </div>
  )
}

function SaveMetricButton({ suggestion }: { suggestion: MetricSuggestion }) {
  const { addMetric, metrics } = useMetricsStore()
  const [saved, setSaved] = useState(false)

  const alreadySaved = metrics.some(m => m.formula === suggestion.formula)

  function handleSave() {
    if (alreadySaved || saved) return
    addMetric({
      name:        suggestion.name,
      description: suggestion.description,
      formula:     suggestion.formula,
      result:      suggestion.value,
      pinnedTo:    [],
    })
    setSaved(true)
  }

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {/* Value badge */}
      <span className="inline-flex items-center gap-1.5 bg-accent/15 border border-accent/30 text-accent text-xs font-mono px-2.5 py-1 rounded-lg">
        <span className="text-[10px] text-accent/70">result</span>
        {suggestion.value}
      </span>

      {/* Save button */}
      {alreadySaved || saved ? (
        <span className="text-xs text-status-success flex items-center gap-1">
          ✓ Saved to Metrics Builder
        </span>
      ) : (
        <button
          onClick={handleSave}
          className="text-xs px-2.5 py-1 rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-colors flex items-center gap-1.5"
        >
          <span>📌</span> Save to Metrics Builder
        </button>
      )}
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  function renderContent(text: string) {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={j}>{part.slice(2, -2)}</strong>
        return part
      })
      const isBullet = line.trimStart().startsWith('- ') || line.trimStart().startsWith('• ')
      return (
        <p key={i} className={`${isBullet ? 'pl-3 relative before:content-["·"] before:absolute before:left-0 before:text-accent' : ''} ${i > 0 ? 'mt-1' : ''}`}>
          {isBullet ? parts.map((p, j) => typeof p === 'string' ? p.replace(/^[\s\-•]+/, '') : p) : parts}
        </p>
      )
    })
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && <BotAvatar />}
      <div className={`max-w-[75%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-accent text-white rounded-br-sm'
            : 'bg-bg-surface border border-bg-border text-txt-primary rounded-bl-sm'
        }`}>
          {renderContent(msg.content)}
        </div>

        {/* Metric suggestion — only on assistant messages */}
        {!isUser && msg.metricSuggestion && (
          <div className="px-1">
            <SaveMetricButton suggestion={msg.metricSuggestion} />
          </div>
        )}

        {msg.ts && (
          <span className="text-[10px] text-txt-muted px-1">{msg.ts}</span>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <BotAvatar />
      <div className="bg-bg-surface border border-bg-border rounded-2xl rounded-bl-sm px-4 py-3">
        <span className="flex gap-1.5 items-center">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-txt-muted"
              style={{ animation: 'pulseDot 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id:      'welcome',
      role:    'assistant',
      content: 'Hello! I\'m your GrayQuest IAM analyst. I have full context of your dashboard data — 15 active users, 8 services, 30 days of activity on platform_id=7.\n\nAsk me anything about users, services, failures, or sessions. When I find a metric, you can save it directly to your Metrics Builder.',
      ts:      '',
    },
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')

    const userMsg: Message = {
      id:      crypto.randomUUID(),
      role:    'user',
      content: q,
      ts:      getTime(),
    }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json() as {
        content?: string
        metricSuggestion?: MetricSuggestion
      }
      setMessages(prev => [...prev, {
        id:               crypto.randomUUID(),
        role:             'assistant',
        content:          data.content ?? 'No response.',
        ts:               getTime(),
        metricSuggestion: data.metricSuggestion,
      }])
    } catch {
      setMessages(prev => [...prev, {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: 'Network error — please try again.',
        ts:      getTime(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    send()
  }

  function clearChat() {
    setMessages(prev => [prev[0]])
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-160px)] min-h-[500px]">
      {/* Sidebar */}
      <div className="hidden xl:flex flex-col w-64 flex-shrink-0 gap-4">
        <div className="card p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse-dot" />
            <p className="text-xs font-medium text-txt-secondary">AI Status</p>
          </div>
          <p className="text-xs text-txt-muted">
            Tries <span className="text-txt-primary">Ollama phi3:mini</span> → falls back to <span className="text-txt-primary">Gemini 1.5 Flash</span>.
          </p>
          <p className="text-xs text-txt-muted mt-2">Context: 15 users · 8 services · 30d data</p>
          <div className="mt-3 pt-3 border-t border-bg-border">
            <p className="text-xs text-txt-muted">
              💡 Metric answers show a <span className="text-accent">Save to Metrics Builder</span> button
            </p>
          </div>
        </div>

        <div className="card p-4 flex-1 overflow-y-auto">
          <p className="text-xs font-medium text-txt-secondary mb-3">Suggested Questions</p>
          <div className="space-y-1.5">
            {SUGGESTED.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="w-full text-left text-xs text-txt-secondary hover:text-txt-primary hover:bg-bg-elevated px-2.5 py-2 rounded-lg transition-colors disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <BotAvatar />
            <div>
              <p className="text-sm font-semibold text-txt-primary">GrayQuest IAM Analyst</p>
              <p className="text-xs text-txt-muted">Ollama phi3:mini · Gemini fallback · Metric save enabled</p>
            </div>
          </div>
          <button onClick={clearChat} className="btn-ghost text-xs text-txt-muted">
            Clear chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Suggested pills — mobile */}
        <div className="xl:hidden px-5 pb-2 flex gap-2 overflow-x-auto">
          {SUGGESTED.slice(0, 4).map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-bg-border text-txt-muted hover:text-txt-primary hover:border-accent/40 transition-colors disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-5 pb-5 flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about users, services, failures, sessions…"
              disabled={loading}
              className="input-base flex-1 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary px-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                : '→'}
            </button>
          </form>
          <p className="text-[10px] text-txt-muted mt-2 text-center">
            Responses based on mock data · Metric answers can be saved directly to Metrics Builder
          </p>
        </div>
      </div>
    </div>
  )
}
