'use client'

import { useEffect, useState } from 'react'
import type { Alert, Section } from '@/types'

const SECTION_LABELS: Record<Section, string> = {
  people:   'People',
  services: 'Services',
  health:   'Platform Health',
  metrics:  'Metrics',
  chat:     'Chat',
}

const SECTION_COLORS: Record<Section, string> = {
  people:   'text-accent',
  services: 'text-status-info',
  health:   'text-status-failure',
  metrics:  'text-status-pending',
  chat:     'text-txt-muted',
}

interface Props {
  onClose: () => void
  onCountChange?: (n: number) => void
}

export default function AlertsPanel({ onClose, onCountChange }: Props) {
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then((d: { alerts: Alert[] }) => setAlerts(d.alerts ?? []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false))
  }, [])

  const active = alerts.filter(a => !dismissed.has(a.id))

  useEffect(() => { onCountChange?.(active.length) }, [active.length, onCountChange])

  function dismiss(id: string) { setDismissed(prev => new Set([...prev, id])) }
  function dismissAll()        { setDismissed(new Set(alerts.map(a => a.id))) }

  return (
    <div className="absolute right-0 top-full mt-2 w-88 card-elevated shadow-2xl z-50 overflow-hidden animate-fade-in" style={{ width: 340 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-txt-primary">Alerts</span>
          {active.length > 0 && (
            <span className="bg-status-pending text-bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {active.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {active.length > 0 && (
            <button onClick={dismissAll} className="text-xs text-txt-muted hover:text-txt-primary transition-colors">
              Dismiss all
            </button>
          )}
          <button onClick={onClose} className="text-txt-muted hover:text-txt-primary text-lg leading-none">×</button>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-xs text-txt-muted">Loading…</div>
      ) : active.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-txt-secondary">All clear</p>
          <p className="text-xs text-txt-muted mt-1">No active threshold alerts</p>
        </div>
      ) : (
        <ul className="divide-y divide-bg-border max-h-96 overflow-y-auto">
          {active.map(alert => (
            <li key={alert.id} className="px-4 py-3 flex items-start gap-3 hover:bg-bg-elevated transition-colors">
              <span className="mt-1 w-2 h-2 rounded-full bg-status-pending flex-shrink-0 animate-pulse-dot" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-txt-primary leading-snug">{alert.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium ${SECTION_COLORS[alert.section]}`}>
                    {SECTION_LABELS[alert.section]}
                  </span>
                  <span className="text-[10px] text-txt-muted">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => dismiss(alert.id)}
                className="text-txt-muted hover:text-txt-primary text-xs flex-shrink-0 transition-colors"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
