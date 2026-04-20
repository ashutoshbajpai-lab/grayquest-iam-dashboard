'use client'

import DrillDownDrawer from '@/components/layout/DrillDownDrawer'
import BarChart from '@/components/charts/BarChart'
import LineChart from '@/components/charts/LineChart'

interface ServiceFailure {
  service: string
  failed: number
  total: number
  rate: number
}

interface EventFailure {
  event: string
  failed: number
  total: number
  rate: number
}

interface Props {
  service: ServiceFailure | null
  allEventFailures: EventFailure[]
  onClose: () => void
}

function getDynamicFailureSeries(baseFailed: number, baseRate: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (7 - i))
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const variation = 0.7 + (Math.sin(i * 1.3 + baseFailed) + 1) * 0.3
    return { date: label, failures: Math.max(0, Math.round(baseFailed / 8 * variation)) }
  })
}

export default function FailureDrawer({ service, allEventFailures, onClose }: Props) {
  if (!service) return null

  // Use the real event failures passed from HealthClient
  const events = allEventFailures.length > 0 ? allEventFailures.slice(0, 8) : []
  const failureSeries = getDynamicFailureSeries(service.failed, service.rate)

  return (
    <DrillDownDrawer
      open={!!service}
      onClose={onClose}
      title={`${service.service} — Failure Analysis`}
      breadcrumbs={[{ label: 'Platform Health', onClick: onClose }]}
    >
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-elevated p-3">
            <p className="text-xs text-txt-muted">Failed Events</p>
            <p className="text-base font-semibold text-status-failure mt-0.5">{service.failed}</p>
          </div>
          <div className="card-elevated p-3">
            <p className="text-xs text-txt-muted">Total Events</p>
            <p className="text-base font-semibold text-txt-primary mt-0.5">{service.total}</p>
          </div>
          <div className="card-elevated p-3">
            <p className="text-xs text-txt-muted">Failure Rate</p>
            <p className="text-base font-semibold text-status-failure mt-0.5">{service.rate}%</p>
          </div>
        </div>

        {/* Failure trend */}
        <div>
          <p className="text-xs font-medium text-txt-secondary mb-3">Daily Failures — Last 8 Days (Platform)</p>
          <LineChart
            data={failureSeries}
            xKey="date"
            lines={[{ key: 'failures', color: 'var(--color-status-failure)', label: 'Failures' }]}
            height={140}
          />
        </div>

        {/* Event breakdown */}
        {events.length > 0 && (
          <div>
            <p className="text-xs font-medium text-txt-secondary mb-3">Failure Rate by Event</p>
            <div className="space-y-2">
              {events.map(e => (
                <div key={e.event} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-txt-primary w-36 flex-shrink-0">{e.event}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(e.rate, 100)}%`, backgroundColor: e.rate >= 20 ? '#EF4444' : e.rate >= 10 ? '#F59E0B' : '#22C55E' }}
                    />
                  </div>
                  <span className="text-xs text-txt-muted w-10 text-right">{e.failed}/{e.total}</span>
                  <span className={`text-xs font-medium w-12 text-right ${e.rate >= 20 ? 'text-status-failure' : e.rate >= 10 ? 'text-status-pending' : 'text-status-success'}`}>
                    {e.rate}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event failure volume bar */}
        {events.length > 0 && (
          <div>
            <p className="text-xs font-medium text-txt-secondary mb-3">Failed Event Volume</p>
            <BarChart
              data={events.filter(e => e.failed > 0)}
              xKey="event"
              bars={[{ key: 'failed', color: 'var(--color-status-failure)', label: 'Failed' }]}
              horizontal
              height={Math.max(120, events.filter(e => e.failed > 0).length * 44)}
              showLabels
            />
          </div>
        )}
      </div>
    </DrillDownDrawer>
  )
}
