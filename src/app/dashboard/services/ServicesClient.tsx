'use client'

import { useState, useEffect } from 'react'
import KPICard from '@/components/ui/KPICard'
import HeatmapChart from '@/components/charts/HeatmapChart'
import BarChart from '@/components/charts/BarChart'
import ServiceCard from '@/components/services/ServiceCard'
import ServiceDrawer from '@/components/services/ServiceDrawer'
import { useFilterStore } from '@/store/filterStore'
import { useChartColors } from '@/hooks/useChartColors'
import type { Service } from '@/types/services'
import PinnedMetrics from '@/components/ui/PinnedMetrics'
import { SUCCESS_RATE, CHART_LIMITS, COLORS } from '@/lib/config'

interface HeatmapRow { service: string; hour: number; count: number }
interface EventRow    { event_id: number; user_name: string; service: string; event: string; status: string; ts: string }

interface ServicesData {
  services: { services: Service[] }
  heatmap:  { matrix: HeatmapRow[] }
  events:   { events: EventRow[] }
  drill:    Record<string, unknown>
}

interface HeatmapDrillRow { event: string; hour: number; count: number }

interface WindowKpis {
  total_events: number; per_day: number; weighted_success_rate: number
  active_services: number; active_users: number; active_users_prev: number
  top_service: string; top_service_events: number
  report_exports: number; services_with_reports: number
}

interface WindowData {
  services: Service[]
  heatmap: { matrix: HeatmapRow[] }
  heatmapDrill: Record<string, HeatmapDrillRow[]>
  kpis: WindowKpis
}

const WINDOW_LABELS: Record<string, string> = { '1d': 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' }

export default function ServicesClient({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as ServicesData & {
    heatmapDrill: Record<string, HeatmapDrillRow[]>
    servicesWindows: Record<string, WindowData>
  }
  const { search, statuses, services: serviceFilter, hourRange, dateRange } = useFilterStore()
  const c = useChartColors()
  const [selected, setSelected] = useState<Service | null>(null)
  const [sortBy, setSortBy] = useState<'events' | 'success' | 'users'>('events')
  const [heatDrillService, setHeatDrillService] = useState<string | null>(null)

  // Pick window based on date preset — reset drill when window changes
  const windowKey = dateRange.preset === 'today' ? '1d' : dateRange.preset === '7d' ? '7d' : '30d'
  useEffect(() => { setHeatDrillService(null) }, [windowKey])
  const win: WindowData | null = d.servicesWindows?.[windowKey] ?? null

  const services = win ? win.services : d.services.services

  function serviceStatus(rate: number) {
    if (rate >= SUCCESS_RATE.GOOD)    return 'SUCCESS'
    if (rate >= SUCCESS_RATE.WARNING) return 'PENDING'
    return 'FAILED'
  }

  // Filtered & sorted
  const visible = services
    .filter(s => {
      const matchSearch  = !search || s.service_name.toLowerCase().includes(search.toLowerCase())
      const matchStatus  = statuses.length === 0 || statuses.includes(serviceStatus(s.success_rate))
      const matchService = serviceFilter.length === 0 || serviceFilter.includes(s.service_name)
      return matchSearch && matchStatus && matchService
    })
    .sort((a, b) => {
      if (sortBy === 'events')  return b.events_30d - a.events_30d
      if (sortBy === 'success') return b.success_rate - a.success_rate
      return b.active_users_30d - a.active_users_30d
    })

  // KPIs — use pre-computed window values when available
  const totalEvents   = win?.kpis.total_events   ?? services.reduce((s, x) => s + x.events_30d, 0)
  const avgSuccess    = win?.kpis.weighted_success_rate ?? (
    totalEvents > 0 ? services.reduce((s, x) => s + x.success_rate * x.events_30d, 0) / totalEvents : 0
  )
  const withReports   = win?.kpis.services_with_reports ?? services.filter(s => s.has_reports).length
  const totalExports  = win?.kpis.report_exports  ?? services.reduce((s, x) => s + x.report_count_30d, 0)
  const topServiceName = win?.kpis.top_service    ?? [...services].sort((a,b) => b.events_30d - a.events_30d)[0]?.service_name
  const topServiceEvt  = win?.kpis.top_service_events ?? [...services].sort((a,b) => b.events_30d - a.events_30d)[0]?.events_30d
  const perDay         = win?.kpis.per_day        ?? Math.round(totalEvents / 30)

  // Heatmap cells: x=hour, y=service (use window data when available)
  const heatMatrix = win ? win.heatmap.matrix : d.heatmap.matrix
  const heatCells = heatMatrix
    .filter(r => r.hour >= hourRange[0] && r.hour <= hourRange[1])
    .map(r => ({ x: String(r.hour), y: r.service, value: r.count }))

  // Top events bar chart — aggregate across services
  const eventMap: Record<string, number> = {}
  services.forEach(s => s.top_events.forEach((e, i) => {
    eventMap[e] = (eventMap[e] || 0) + (s.events_30d / (i + 2))
  }))
  const topEvents = Object.entries(eventMap)
    .map(([event, count]) => ({ event, count: Math.round(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, CHART_LIMITS.TOP_EVENTS_BAR)

  // Success rate comparison — compute dynamic label width (7px per char + padding)
  const successData = services.map(s => ({ name: s.service_name, rate: s.success_rate }))
    .sort((a, b) => b.rate - a.rate)
  const successYWidth = Math.min(200, Math.max(120, Math.max(...successData.map(s => s.name.length)) * 7))

  // Heatmap drill — event×hour for selected service, filtered by hour range
  const heatDrillData = win ? win.heatmapDrill : d.heatmapDrill
  const heatDrillCells = heatDrillService && heatDrillData?.[heatDrillService]
    ? heatDrillData[heatDrillService]
        .filter(r => r.hour >= hourRange[0] && r.hour <= hourRange[1])
        .map(r => ({ x: String(r.hour), y: r.event, value: r.count }))
    : []

  // Drill data
  const drillData = selected
    ? (d.drill as Record<string, unknown>)[String(selected.service_id)] ?? null
    : null

  return (
    <>
      <PinnedMetrics section="services" />
      {/* Window badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-accent font-medium border border-accent/30">
          {dateRange.preset === 'custom' ? 'Custom range (showing 30d data)' : WINDOW_LABELS[windowKey]}
        </span>
        <span className="text-xs text-txt-muted">{services.length} active service{services.length !== 1 ? 's' : ''}</span>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <KPICard title="Active Services"    value={win?.kpis.active_services ?? services.length} subtitle={`${win?.kpis.active_users ?? 0} active users`} status="neutral" />
        <KPICard title="Total Events" value={totalEvents.toLocaleString()} subtitle={`~${perDay.toLocaleString()} / day`} status="neutral" />
        <KPICard title="Weighted Success Rate" value={`${avgSuccess.toFixed(1)}%`}
          subtitle="Volume-weighted across services"
          status={avgSuccess >= SUCCESS_RATE.GOOD ? 'success' : avgSuccess >= SUCCESS_RATE.WARNING ? 'warning' : 'danger'} />
        <KPICard title="Top Service"        value={topServiceName ?? '—'}  subtitle={`${(topServiceEvt ?? 0).toLocaleString()} events`} status="neutral" />
        <KPICard title="Report Exports"     value={totalExports}             subtitle={`${withReports} services with reports`} status="neutral" />
      </div>

      {/* Row 2: Service cards grid */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-txt-primary">All Services</p>
            <p className="text-xs text-txt-muted">Click any card to drill down</p>
          </div>
          <div className="flex gap-1">
            {([['events','Volume'],['success','Success Rate'],['users','Users']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setSortBy(k)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${sortBy === k ? 'text-white' : 'text-txt-muted hover:text-txt-primary hover:bg-bg-elevated'}`}
                style={sortBy === k ? { backgroundColor: COLORS.ACCENT } : {}}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visible.map(s => (
            <ServiceCard key={s.service_id} service={s} onClick={setSelected} />
          ))}
          {visible.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center gap-2 text-txt-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 opacity-40"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              <p className="text-sm">No services match the current filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Heatmap + success rate bar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card p-4 xl:col-span-2">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold text-txt-primary">Activity Heatmap</p>
              <p className="text-xs text-txt-muted">Events per service by hour of day (30d) — click a service row to drill in</p>
            </div>
            {heatDrillService && (
              <button onClick={() => setHeatDrillService(null)} className="text-xs text-txt-muted hover:text-txt-primary transition-colors px-2 py-1 rounded hover:bg-bg-elevated">
                ← Back
              </button>
            )}
          </div>
          <div className="mt-4">
            {!heatDrillService ? (
              <HeatmapChart
                data={heatCells}
                xLabel="Hour of day"
                colorHigh={c.primary}
                formatValue={v => `${v} events`}
                onRowClick={setHeatDrillService}
                activeRow={heatDrillService}
              />
            ) : (
              <>
                <p className="text-xs font-semibold text-accent mb-3">{heatDrillService} — events by hour</p>
                {heatDrillCells.length > 0 ? (
                  <HeatmapChart
                    data={heatDrillCells}
                    xLabel="Hour of day"
                    colorHigh={c.secondary}
                    formatValue={v => `${v} events`}
                  />
                ) : (
                  <p className="text-xs text-txt-muted py-8 text-center">No event data for this service in the selected hour range.</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card p-4">
          <p className="text-sm font-semibold text-txt-primary mb-1">Success Rate by Service</p>
          <p className="text-xs text-txt-muted mb-4">Lower = more attention needed</p>
          <BarChart
            data={successData}
            xKey="name"
            bars={[{ key: 'rate', color: c.success, label: 'Success %' }]}
            horizontal
            height={Math.max(240, successData.length * 28)}
            yAxisWidth={successYWidth}
            showLabels
            formatY={v => `${v}%`}
          />
        </div>
      </div>

      {/* Row 4: Top events + recent feed */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm font-semibold text-txt-primary mb-1">Top Events Across Services</p>
          <p className="text-xs text-txt-muted mb-4">By estimated volume</p>
          <BarChart
            data={topEvents}
            xKey="event"
            bars={[{ key: 'count', color: c.secondary, label: 'Volume' }]}
            horizontal
            height={260}
            showLabels
          />
        </div>

        <div className="card">
          <div className="px-4 pt-4 pb-3 border-b border-bg-border">
            <p className="text-sm font-semibold text-txt-primary">Recent Events Feed</p>
            <p className="text-xs text-txt-muted">Filtered by status & date range</p>
          </div>
          <div className="divide-y divide-bg-border">
            {(() => {
              const from = dateRange.from ? new Date(dateRange.from).getTime() : 0
              const to   = dateRange.to   ? new Date(dateRange.to + 'T23:59:59').getTime() : Infinity
              const filtered = d.events.events.filter(e => {
                const ts = new Date(e.ts).getTime()
                const matchStatus = statuses.length === 0 || statuses.includes(e.status as import('@/types').StatusType)
                const matchDate   = ts >= from && ts <= to
                return matchStatus && matchDate
              })
              if (filtered.length === 0) return (
                <p className="px-4 py-8 text-center text-xs text-txt-muted">No events match the current filters.</p>
              )
              return filtered.slice(0, 20).map(e => (
                <div key={e.event_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-elevated transition-colors">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.status === 'SUCCESS' ? 'bg-status-success' : 'bg-status-failure'}`} />
                  <span className="text-xs text-txt-muted w-36 flex-shrink-0">{e.ts.replace('T',' ').slice(0,16)}</span>
                  <span className="text-xs text-txt-secondary flex-1 truncate">{e.service}</span>
                  <span className="text-xs font-mono text-txt-primary flex-shrink-0">{e.event}</span>
                </div>
              ))
            })()}
          </div>
        </div>
      </div>

      {/* Drill-down drawer */}
      <ServiceDrawer
        service={selected}
        drill={drillData as Parameters<typeof ServiceDrawer>[0]['drill']}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
