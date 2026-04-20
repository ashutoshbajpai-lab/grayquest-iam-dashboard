'use client'

import type { Service } from '@/types/services'

interface Props {
  service: Service
  onClick: (s: Service) => void
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="w-full h-1 rounded-full bg-bg-border overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
    </div>
  )
}

export default function ServiceCard({ service, onClick }: Props) {
  const rateColor = service.success_rate >= 90 ? 'var(--color-status-success)' : service.success_rate >= 80 ? 'var(--color-status-pending)' : 'var(--color-status-failure)'
  const trendPos = service.trend >= 0

  return (
    <div
      onClick={() => onClick(service)}
      className="card p-4 cursor-pointer hover:border-accent/40 transition-all hover:-translate-y-0.5 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-txt-primary group-hover:text-accent transition-colors truncate">
            {service.service_name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-txt-muted">{service.active_users_30d} users</span>
            {service.has_reports && (
              <span className="badge badge-neutral text-[10px]">Reports</span>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium flex items-center gap-0.5 ${trendPos ? 'text-status-success' : 'text-status-failure'}`}>
          {trendPos ? '↑' : '↓'}{Math.abs(service.trend)}%
        </span>
      </div>

      <div className="space-y-2.5">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-txt-muted">Success Rate</span>
            <span className="font-medium" style={{ color: rateColor }}>{service.success_rate}%</span>
          </div>
          <MiniBar value={service.success_rate} max={100} color={rateColor} />
        </div>

        <div className="flex justify-between text-xs text-txt-secondary">
          <span>{service.events_30d.toLocaleString()} events</span>
          <span>Peak {service.peak_hour}:00</span>
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          {service.top_events.slice(0, 2).map(e => (
            <span key={e} className="text-[10px] font-mono bg-bg-elevated text-txt-muted px-1.5 py-0.5 rounded">{e}</span>
          ))}
          {service.top_events.length > 2 && (
            <span className="text-[10px] text-txt-muted">+{service.top_events.length - 2}</span>
          )}
        </div>
      </div>
    </div>
  )
}
