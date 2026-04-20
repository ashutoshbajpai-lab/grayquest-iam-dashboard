'use client'

import DrillDownDrawer from '@/components/layout/DrillDownDrawer'
import LineChart from '@/components/charts/LineChart'
import BarChart from '@/components/charts/BarChart'
import type { IamUser as User } from '@/types/people'

interface Props {
  user: User | null
  onClose: () => void
}

const SERVICE_POOL = [
  { name: 'Fee Collection',      events: ['VIEW_FEE', 'COLLECT_FEE', 'GENERATE_RECEIPT'] },
  { name: 'Student Management',  events: ['VIEW_STUDENT', 'ADD_STUDENT', 'UPDATE_RECORD'] },
  { name: 'Loan Management',     events: ['LOAN_APPROVAL', 'VIEW_LOAN', 'LOAN_STATUS'] },
  { name: 'User Administration', events: ['CREATE_USER', 'UPDATE_USER', 'VIEW_ROLE'] },
  { name: 'Audit Logs',          events: ['VIEW_LOG', 'EXPORT_LOG', 'FILTER_LOG'] },
  { name: 'Reports',             events: ['GENERATE_REPORT', 'VIEW_REPORT', 'EXPORT_PDF'] },
  { name: 'Settings',            events: ['UPDATE_CONFIG', 'VIEW_SETTINGS'] },
]

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
}
const DATES = getLast7Days()

// Deterministic pseudo-random from user_id + offset seed
function prng(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateActivitySeries(user: User) {
  const dailySessions = user.sessions_30d / 30
  const dailyEvents   = user.events_30d / 30
  return DATES.map((date, i) => {
    const factor = 0.5 + prng(user.user_id * 13 + i) * 1.1
    return {
      date,
      sessions: Math.max(0, Math.round(dailySessions * factor)),
      events:   Math.max(0, Math.round(dailyEvents   * factor)),
    }
  })
}

function generateServiceBreakdown(user: User) {
  const count    = Math.min(user.services_used, SERVICE_POOL.length)
  const services = SERVICE_POOL.slice(0, count)
  // Descending weights so first service gets the most events
  const weights  = services.map((_, i) => count - i)
  const total    = weights.reduce((a, b) => a + b, 0)
  return services.map((s, i) => ({
    service: s.name,
    events:  Math.round((weights[i] / total) * user.events_30d),
    pct:     Math.round((weights[i] / total) * 100),
  }))
}

function generateRecentEvents(user: User) {
  const count    = Math.min(user.services_used, SERVICE_POOL.length)
  const services = SERVICE_POOL.slice(0, count)
  const failRate = 1 - user.login_success_rate / 100

  return Array.from({ length: 6 }, (_, i) => {
    const svc      = services[i % services.length]
    const evtIdx   = Math.floor(prng(user.user_id * 7 + i) * svc.events.length)
    const isFailed = prng(user.user_id * 11 + i) < failRate
    const dayOff   = Math.floor(i / 2)
    const hour     = 9 + Math.floor(prng(user.user_id * 3 + i) * 9)
    const min      = Math.floor(prng(user.user_id * 5 + i) * 60)
    const d        = new Date(); d.setDate(d.getDate() - dayOff)
    const date     = d.toISOString().slice(0, 10)
    return {
      ts:      `${date} ${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`,
      service: svc.name,
      event:   svc.events[evtIdx],
      status:  isFailed ? 'FAILED' : 'SUCCESS',
    }
  })
}

function HealthScoreGauge({ score }: { score: number }) {
  const color    = score >= 75 ? 'var(--color-status-success)' : score >= 50 ? 'var(--color-status-pending)' : 'var(--color-status-failure)'
  const r        = 40
  const circ     = 2 * Math.PI * r
  const dash     = (score / 100) * circ * 0.75
  const gap      = circ - dash
  const rotation = -225

  return (
    <div className="flex flex-col items-center" aria-label={`Health score: ${score} out of 100`}>
      <svg width="110" height="80" viewBox="0 0 110 80" role="img" aria-hidden="true">
        {/* Track — uses CSS variable so it adapts to light/dark */}
        <circle cx="55" cy="70" r={r} fill="none"
          stroke="var(--color-bg-border)" strokeWidth="8"
          strokeDasharray={`${circ * 0.75} ${circ}`}
          strokeDashoffset="0"
          transform={`rotate(${rotation} 55 70)`}
          strokeLinecap="round"
        />
        {/* Fill */}
        <circle cx="55" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset="0"
          transform={`rotate(${rotation} 55 70)`}
          strokeLinecap="round"
        />
        <text x="55" y="65" textAnchor="middle" fill={color} fontSize="22" fontWeight="600">{score}</text>
        <text x="55" y="78" textAnchor="middle" fill="var(--color-txt-muted)" fontSize="10">/ 100</text>
      </svg>
      <p className="text-xs text-txt-muted -mt-1">Health Score</p>
    </div>
  )
}

export default function UserDrawer({ user, onClose }: Props) {
  if (!user) return null

  const activitySeries    = generateActivitySeries(user)
  const serviceBreakdown  = generateServiceBreakdown(user)
  const recentEvents      = generateRecentEvents(user)

  return (
    <DrillDownDrawer open={!!user} onClose={onClose} title={user.name} breadcrumbs={[{ label: 'People', onClick: onClose }]}>
      <div className="space-y-6">
        {/* Identity + score */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
            <span className="text-accent text-lg font-semibold">{user.name[0]}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-txt-primary">{user.name}</p>
            <p className="text-xs text-txt-muted">{user.email}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="badge badge-neutral">{user.role}</span>
              <span className="badge badge-neutral">{user.group}</span>
              <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-failure'}`}>
                {user.status}
              </span>
            </div>
          </div>
          <HealthScoreGauge score={user.health_score} />
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Sessions (30d)', value: user.sessions_30d },
            { label: 'Events (30d)',   value: user.events_30d   },
            { label: 'Avg Session',    value: `${user.avg_session_min}m` },
            { label: 'Services Used',  value: user.services_used },
            { label: 'Login Rate',     value: `${user.login_success_rate}%` },
            { label: 'Member Since',   value: user.first_seen?.slice(0, 7) ?? '—' },
          ].map(k => (
            <div key={k.label} className="card-elevated p-3">
              <p className="text-xs text-txt-muted">{k.label}</p>
              <p className="text-base font-semibold text-txt-primary mt-0.5">{k.value}</p>
            </div>
          ))}
        </div>

        {/* 7-day activity */}
        <div>
          <p className="text-xs font-medium text-txt-secondary mb-3">Activity — Last 7 Days</p>
          <figure aria-label={`${user.name}'s 7-day activity trend`}>
            <LineChart
              data={activitySeries}
              xKey="date"
              lines={[
                { key: 'sessions', color: 'var(--color-accent)',      label: 'Sessions' },
                { key: 'events',   color: 'var(--color-status-info)', label: 'Events'   },
              ]}
              height={160}
            />
            <figcaption className="sr-only">
              Line chart showing sessions and events per day over the past 7 days for {user.name}.
            </figcaption>
          </figure>
        </div>

        {/* Services breakdown */}
        <div>
          <p className="text-xs font-medium text-txt-secondary mb-3">Service Usage Breakdown</p>
          <figure aria-label={`${user.name}'s service usage`}>
            <BarChart
              data={serviceBreakdown}
              xKey="service"
              bars={[{ key: 'events', color: 'var(--color-accent)', label: 'Events' }]}
              horizontal
              height={Math.max(140, serviceBreakdown.length * 32)}
              showLabels
            />
            <figcaption className="sr-only">
              Horizontal bar chart showing event counts per service for {user.name}.
            </figcaption>
          </figure>
        </div>

        {/* Recent events */}
        <div>
          <p className="text-xs font-medium text-txt-secondary mb-3">Recent Events</p>
          <div className="space-y-1" role="list" aria-label="Recent events">
            {recentEvents.map((e, i) => (
              <div key={i} role="listitem" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-elevated transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.status === 'SUCCESS' ? 'bg-status-success' : 'bg-status-failure'}`}
                  aria-hidden="true" />
                <span className="text-xs text-txt-muted w-32 flex-shrink-0">{e.ts}</span>
                <span className="text-xs text-txt-secondary flex-1">{e.service}</span>
                <span className="text-xs font-mono text-txt-primary">{e.event}</span>
                <span className={`text-xs font-medium ${e.status === 'SUCCESS' ? 'text-status-success' : 'text-status-failure'}`}>
                  {e.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DrillDownDrawer>
  )
}
