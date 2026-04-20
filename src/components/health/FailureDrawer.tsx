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

// Mock per-service event failure breakdown
const SERVICE_EVENT_FAILURES: Record<string, { event: string; failed: number; total: number; rate: number }[]> = {
  'Loan Management':     [
    { event: 'LOAN_APPROVAL', failed: 28, total: 71,  rate: 39.4 },
    { event: 'PROCESS_EMI',   failed: 18, total: 124, rate: 14.5 },
    { event: 'VIEW_LOAN',     failed:  1, total: 148, rate:  0.7 },
  ],
  'Notifications':       [
    { event: 'SEND_SMS',   failed: 9, total: 42, rate: 21.4 },
    { event: 'SEND_EMAIL', failed: 1, total: 21, rate:  4.8 },
  ],
  'User Administration': [
    { event: 'DEACTIVATE_USER', failed: 11, total:  58, rate: 19.0 },
    { event: 'CREATE_USER',     failed: 14, total: 112, rate: 12.5 },
    { event: 'UPDATE_ROLE',     failed:  8, total: 101, rate:  7.9 },
    { event: 'VIEW_USER',       failed:  4, total: 118, rate:  3.4 },
  ],
  'Fee Collection': [
    { event: 'COLLECT_FEE',      failed: 29, total: 287, rate: 10.1 },
    { event: 'FEE_REMINDER',     failed: 12, total:  50, rate: 24.0 },
    { event: 'RECEIPT_GENERATE', failed:  7, total: 198, rate:  3.5 },
    { event: 'VIEW_FEE',         failed:  4, total: 312, rate:  1.3 },
  ],
  'Institute Management': [
    { event: 'UPDATE_INSTITUTE', failed: 14, total:  89, rate: 15.7 },
    { event: 'ADD_CONTACT',      failed:  9, total:  74, rate: 12.2 },
    { event: 'VIEW_INSTITUTE',   failed:  4, total: 115, rate:  3.5 },
  ],
  'Student Management': [
    { event: 'ADD_STUDENT',    failed: 14, total: 112, rate: 12.5 },
    { event: 'UPDATE_STUDENT', failed: 11, total: 198, rate:  5.6 },
    { event: 'DELETE_STUDENT', failed:  5, total:  61, rate:  8.2 },
    { event: 'VIEW_STUDENT',   failed:  2, total: 241, rate:  0.8 },
  ],
  'Settings': [
    { event: 'UPDATE_CONFIG',   failed: 3, total: 58, rate: 5.2 },
    { event: 'TOGGLE_FEATURE',  failed: 0, total: 29, rate: 0   },
  ],
  'Audit Logs': [
    { event: 'EXPORT_LOG', failed: 1, total: 58, rate: 1.7 },
    { event: 'VIEW_LOG',   failed: 0, total: 112, rate: 0  },
  ],
}

const FAILURE_SERIES = [
  { date: 'Apr 11', failures: 47 }, { date: 'Apr 12', failures: 52 },
  { date: 'Apr 13', failures: 38 }, { date: 'Apr 14', failures: 41 },
  { date: 'Apr 15', failures: 35 }, { date: 'Apr 16', failures: 44 },
  { date: 'Apr 17', failures: 49 }, { date: 'Apr 18', failures: 43 },
]

export default function FailureDrawer({ service, allEventFailures, onClose }: Props) {
  if (!service) return null

  const events = SERVICE_EVENT_FAILURES[service.service] ?? []

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
            data={FAILURE_SERIES}
            xKey="date"
            lines={[{ key: 'failures', color: '#EF4444', label: 'Failures' }]}
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
              bars={[{ key: 'failed', color: '#EF4444', label: 'Failed' }]}
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
