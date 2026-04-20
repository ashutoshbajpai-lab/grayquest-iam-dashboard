'use client'

import { useState } from 'react'
import { useFilterStore } from '@/store/filterStore'
import { useChartColors } from '@/hooks/useChartColors'
import PinnedMetrics from '@/components/ui/PinnedMetrics'
import KPICard from '@/components/ui/KPICard'
import LineChart from '@/components/charts/LineChart'
import BarChart from '@/components/charts/BarChart'
import FunnelChart from '@/components/charts/FunnelChart'
import FailureDrawer from '@/components/health/FailureDrawer'
import { SUCCESS_RATE, SERVICE_FAILURE_RATE, SESSION, CHART_LIMITS } from '@/lib/config'

interface HealthData {
  health: {
    kpis: Record<string, number | string>
    success_rate_series: { date: string; rate: number }[]
    failure_by_service: { service: string; failed: number; total: number; rate: number }[]
    failure_by_event: { event: string; failed: number; total: number; rate: number }[]
    login_funnel: { step: string; count: number }[]
  }
  sessions: {
    kpis: Record<string, number | string>
    duration_buckets: { label: string; count: number }[]
    events_per_session_buckets: { label: string; count: number }[]
    by_role: { role: string; avg_duration_min: number; avg_events: number; sessions: number }[]
  }
  overview: {
    kpis: Record<string, number>
    trends: Record<string, number>
  }
}

type ServiceFailure = { service: string; failed: number; total: number; rate: number }

function serviceFailureStatus(rate: number) {
  if (rate <= SERVICE_FAILURE_RATE.GOOD)    return 'SUCCESS'
  if (rate <= SERVICE_FAILURE_RATE.WARNING) return 'PENDING'
  return 'FAILED'
}

export default function HealthClient({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as HealthData
  const { statuses, search, dateRange } = useFilterStore()
  const c = useChartColors()
  const [selectedService, setSelectedService] = useState<ServiceFailure | null>(null)

  const hkpis   = d.health.kpis
  const skpis   = d.sessions.kpis
  const trends  = d.overview.trends

  // Filter success_rate_series to selected date range
  const from = dateRange.from || ''
  const to   = dateRange.to   || ''
  const successSeries = d.health.success_rate_series.filter(r =>
    (!from || r.date >= from) && (!to || r.date <= to)
  )

  // Deduplicate failure_by_event and apply search filter
  const seen = new Set<string>()
  const uniqueFailures = d.health.failure_by_event.filter(e => {
    if (seen.has(e.event)) return false
    seen.add(e.event)
    return true
  })

  return (
    <>
      <PinnedMetrics section="health" />
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KPICard
          title="Overall Success Rate"
          value={`${hkpis.overall_success_rate}%`}
          trend={trends.success_rate_vs_prev}
          trendLabel="vs prev 30d"
          status={Number(hkpis.overall_success_rate) >= SUCCESS_RATE.GOOD ? 'success' : Number(hkpis.overall_success_rate) >= SUCCESS_RATE.WARNING ? 'warning' : 'danger'}
        />
        <KPICard
          title="Login Success Rate"
          value={`${hkpis.login_success_rate}%`}
          status={Number(hkpis.login_success_rate) >= SUCCESS_RATE.GOOD ? 'success' : 'warning'}
        />
        <KPICard
          title="Failed Events (30d)"
          value={hkpis.failed_events_30d}
          subtitle={`${hkpis.unique_error_types} error types`}
          status="danger"
        />
        <KPICard
          title="Avg Session Duration"
          value={`${skpis.avg_duration_min}m`}
          subtitle={`Median ${skpis.median_duration_min}m`}
          status="neutral"
        />
        <KPICard
          title="Cross-Module Rate"
          value={`${skpis.cross_module_rate}%`}
          subtitle="3+ services per session"
          status={Number(skpis.cross_module_rate) >= SESSION.CROSS_MODULE_GOOD ? 'success' : 'warning'}
        />
        <KPICard
          title="API Error Rate"
          value={`${hkpis.api_error_rate}%`}
          subtitle={`p95 ${hkpis.p95_latency_ms}ms`}
          status={Number(hkpis.api_error_rate) <= SESSION.API_ERROR_ALERT ? 'success' : 'danger'}
        />
      </div>

      {/* Row 2: Success trend + login funnel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <p className="text-sm font-semibold text-txt-primary mb-1">Success Rate Trend</p>
          <p className="text-xs text-txt-muted mb-4">{successSeries.length} data points — filtered by date range</p>
          <LineChart
            data={successSeries}
            xKey="date"
            lines={[{ key: 'rate', color: c.success, label: 'Success %' }]}
            height={180}
            formatY={v => `${v}%`}
          />
        </div>

        <div className="card p-4">
          <p className="text-sm font-semibold text-txt-primary mb-1">Login Funnel</p>
          <p className="text-xs text-txt-muted mb-4">Attempt → Auth → Session → Action (30d)</p>
          <FunnelChart data={d.health.login_funnel} color={c.secondary} />
          <div className="mt-4 pt-3 border-t border-bg-border grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-txt-muted">Auth Rate</p>
              <p className="text-sm font-semibold text-txt-primary">
                {hkpis.login_success_rate}%
              </p>
            </div>
            <div>
              <p className="text-xs text-txt-muted">Completion Rate</p>
              <p className="text-sm font-semibold text-txt-primary">{skpis.completion_rate}%</p>
            </div>
            <div>
              <p className="text-xs text-txt-muted">Bounce Rate</p>
              <p className="text-sm font-semibold text-status-pending">{skpis.bounce_rate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Failure by service + failure by event */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <p className="text-sm font-semibold text-txt-primary mb-1">Failure Rate by Service</p>
          <p className="text-xs text-txt-muted mb-1">
            Click a row to drill into root events
            <span className="ml-2 text-txt-muted opacity-70">
              ({d.health.failure_by_service.reduce((s,x) => s+x.failed, 0)} of {Number(hkpis.failed_events_30d)} total failures attributed)
            </span>
          </p>
          {(() => {
            const filtered = d.health.failure_by_service.filter(s => {
              const matchStatus = statuses.length === 0 || statuses.includes(serviceFailureStatus(s.rate))
              const matchSearch = !search || s.service.toLowerCase().includes(search.toLowerCase())
              return matchStatus && matchSearch
            })
            const maxRate = filtered.reduce((m, s) => Math.max(m, s.rate), 0) || 1
            if (filtered.length === 0) return (
              <p className="py-8 text-center text-xs text-txt-muted">No services match the current filters.</p>
            )
            return (
              <div className="space-y-2 mt-4">
                {filtered.map(s => (
                  <div
                    key={s.service}
                    onClick={() => setSelectedService(s)}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-bg-elevated cursor-pointer transition-colors group"
                  >
                    <span className="text-xs text-txt-secondary w-36 flex-shrink-0 group-hover:text-accent transition-colors truncate">{s.service}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(s.rate / maxRate) * 100}%`,
                          backgroundColor: s.rate > SERVICE_FAILURE_RATE.WARNING ? 'var(--color-status-failure)' : s.rate > SERVICE_FAILURE_RATE.GOOD ? 'var(--color-status-pending)' : 'var(--color-status-success)'
                        }}
                      />
                    </div>
                    <span className="text-xs text-txt-muted w-12 text-right">{s.failed}/{s.total}</span>
                    <span className={`text-xs font-semibold w-12 text-right ${s.rate > SERVICE_FAILURE_RATE.WARNING ? 'text-status-failure' : s.rate > SERVICE_FAILURE_RATE.GOOD ? 'text-status-pending' : 'text-status-success'}`}>
                      {s.rate}%
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        <div className="card p-4">
          <p className="text-sm font-semibold text-txt-primary mb-1">Top Failing Events</p>
          <p className="text-xs text-txt-muted mb-4">By failure rate across all services</p>
          <BarChart
            data={uniqueFailures.slice(0, CHART_LIMITS.TOP_FAILING_EVENTS)}
            xKey="event"
            bars={[{ key: 'rate', color: c.danger, label: 'Failure %' }]}
            horizontal
            height={240}
            showLabels
            formatY={v => `${v}%`}
          />
        </div>
      </div>

      {/* Row 4: Session depth */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm font-semibold text-txt-primary mb-1">Session Duration Distribution</p>
          <p className="text-xs text-txt-muted mb-4">Number of sessions by length</p>
          <BarChart
            data={d.sessions.duration_buckets}
            xKey="label"
            bars={[{ key: 'count', color: c.info, label: 'Sessions' }]}
            height={180}
          />
        </div>

        <div className="card p-4">
          <p className="text-sm font-semibold text-txt-primary mb-1">Events per Session</p>
          <p className="text-xs text-txt-muted mb-4">Engagement depth distribution</p>
          <BarChart
            data={d.sessions.events_per_session_buckets}
            xKey="label"
            bars={[{ key: 'count', color: c.secondary, label: 'Sessions' }]}
            height={180}
          />
        </div>

        <div className="card p-4">
          <p className="text-sm font-semibold text-txt-primary mb-1">Session Stats by Role</p>
          <p className="text-xs text-txt-muted mb-4">Avg sessions per role (30d)</p>
          <BarChart
            data={d.sessions.by_role.map(r => ({ role: r.role.split(' ')[0], sessions: r.sessions }))}
            xKey="role"
            bars={[{ key: 'sessions', color: c.tertiary, label: 'Sessions' }]}
            height={180}
          />
          <div className="mt-3 pt-3 border-t border-bg-border space-y-1">
            {d.sessions.by_role.map(r => (
              <div key={r.role} className="flex justify-between text-xs">
                <span className="text-txt-muted truncate">{r.role}</span>
                <span className="text-txt-secondary font-medium ml-2 flex-shrink-0">{r.avg_duration_min}m avg</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Failure drill-down drawer */}
      <FailureDrawer
        service={selectedService}
        allEventFailures={uniqueFailures}
        onClose={() => setSelectedService(null)}
      />
    </>
  )
}
