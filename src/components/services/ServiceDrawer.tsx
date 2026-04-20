'use client'

import { useState } from 'react'
import DrillDownDrawer from '@/components/layout/DrillDownDrawer'
import LineChart from '@/components/charts/LineChart'
import BarChart from '@/components/charts/BarChart'
import type { Service } from '@/types/services'
import { SUCCESS_RATE, COLORS, CHART_LIMITS, CHART_ROW_HEIGHT } from '@/lib/config'

interface DrillData {
  success_series: { date: string; rate: number }[]
  events_breakdown: { event: string; count: number; success: number }[]
  top_users: { name: string; role: string; events: number }[]
  report_metrics?: {
    total_reports: number; exported: number; export_rate: number
    report_types: { type: string; count: number; exported: number }[]
    by_user: { name: string; reports: number; exports: number }[]
  }
}

interface Props {
  service: Service | null
  drill: DrillData | null
  onClose: () => void
}

export default function ServiceDrawer({ service, drill, onClose }: Props) {
  const [tab, setTab] = useState<'overview' | 'events' | 'users' | 'reports'>('overview')

  if (!service) return null

  const emptyDrill: DrillData = { success_series: [], events_breakdown: [], top_users: [] }
  const d = drill ?? emptyDrill

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'events',   label: 'Events'   },
    { id: 'users',    label: 'Users'    },
    ...(service.has_reports ? [{ id: 'reports', label: 'Reports' }] : []),
  ] as { id: typeof tab; label: string }[]

  const rateColor = service.success_rate >= SUCCESS_RATE.GOOD ? COLORS.TREND_UP : service.success_rate >= SUCCESS_RATE.WARNING ? COLORS.TREND_NEUTRAL : COLORS.TREND_DOWN

  return (
    <DrillDownDrawer
      open={!!service}
      onClose={onClose}
      title={service.service_name}
      breadcrumbs={[{ label: 'Services', onClick: onClose }]}
    >
      <div className="space-y-5">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Events (30d)',    value: service.events_30d.toLocaleString() },
            { label: 'Success Rate',    value: `${service.success_rate}%`, color: rateColor },
            { label: 'Active Users',    value: service.active_users_30d },
            { label: 'Avg Events/Session', value: service.avg_events_per_session },
            { label: 'Peak Hour',       value: `${service.peak_hour}:00` },
            { label: 'Trend (30d)',     value: `${service.trend > 0 ? '+' : ''}${service.trend}%`,
              color: service.trend >= 0 ? COLORS.TREND_UP : COLORS.TREND_DOWN },
          ].map(k => (
            <div key={k.label} className="card-elevated p-3">
              <p className="text-xs text-txt-muted">{k.label}</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: k.color ?? COLORS.KPI_FALLBACK }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tab nav */}
        <div className="flex gap-0 border-b border-bg-border -mx-6 px-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`nav-tab ${tab === t.id ? 'nav-tab-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-txt-secondary mb-3">Success Rate — Last {CHART_LIMITS.SUCCESS_SERIES_DAYS} Days</p>
              <LineChart
                data={d.success_series}
                xKey="date"
                lines={[{ key: 'rate', color: rateColor, label: 'Success %' }]}
                height={160}
                formatY={v => `${v}%`}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-txt-secondary mb-2">Top Events (by volume)</p>
              <div className="space-y-2">
                {d.events_breakdown.map(e => (
                  <div key={e.event} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-txt-primary w-40 flex-shrink-0">{e.event}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(e.count / d.events_breakdown[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-txt-muted w-10 text-right">{e.count}</span>
                    <span className={`text-xs font-medium w-14 text-right ${e.success >= SUCCESS_RATE.GOOD ? 'text-status-success' : e.success >= SUCCESS_RATE.WARNING ? 'text-status-pending' : 'text-status-failure'}`}>
                      {e.success}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Events tab */}
        {tab === 'events' && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-txt-secondary mb-3">Event Breakdown</p>
              <BarChart
                data={d.events_breakdown}
                xKey="event"
                bars={[{ key: 'count', color: COLORS.EVENTS_BAR, label: 'Volume' }]}
                horizontal
                height={Math.max(160, d.events_breakdown.length * CHART_ROW_HEIGHT.STANDARD)}
                showLabels
              />
            </div>
            <div>
              <p className="text-xs font-medium text-txt-secondary mb-3">Success Rate by Event</p>
              <BarChart
                data={d.events_breakdown}
                xKey="event"
                bars={[{ key: 'success', color: COLORS.REPORT_BAR, label: 'Success %' }]}
                horizontal
                height={Math.max(160, d.events_breakdown.length * CHART_ROW_HEIGHT.STANDARD)}
                showLabels
                formatY={v => `${v}%`}
              />
            </div>
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <div>
            <p className="text-xs font-medium text-txt-secondary mb-3">Top Users in this Service</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="pb-2 text-left text-xs text-txt-muted font-medium">User</th>
                  <th className="pb-2 text-left text-xs text-txt-muted font-medium">Role</th>
                  <th className="pb-2 text-right text-xs text-txt-muted font-medium">Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {d.top_users.map((u, i) => (
                  <tr key={i} className="hover:bg-bg-elevated transition-colors">
                    <td className="py-2.5 text-xs text-txt-primary">{u.name}</td>
                    <td className="py-2.5">
                      <span className="badge badge-neutral text-[10px]">{u.role}</span>
                    </td>
                    <td className="py-2.5 text-xs text-txt-secondary text-right font-medium">{u.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reports tab — only for services with has_reports=true */}
        {tab === 'reports' && d.report_metrics && (
          <div className="space-y-5">
            {/* Report KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card-elevated p-3">
                <p className="text-xs text-txt-muted">Total Reports</p>
                <p className="text-base font-semibold text-txt-primary mt-0.5">{d.report_metrics.total_reports}</p>
              </div>
              <div className="card-elevated p-3">
                <p className="text-xs text-txt-muted">Exported</p>
                <p className="text-base font-semibold text-txt-primary mt-0.5">{d.report_metrics.exported}</p>
              </div>
              <div className="card-elevated p-3">
                <p className="text-xs text-txt-muted">Export Rate</p>
                <p className="text-base font-semibold text-status-success mt-0.5">{d.report_metrics.export_rate}%</p>
              </div>
            </div>

            {/* Report types */}
            <div>
              <p className="text-xs font-medium text-txt-secondary mb-3">By Report Type</p>
              <div className="space-y-2.5">
                {d.report_metrics.report_types.map(r => (
                  <div key={r.type} className="flex items-center gap-3">
                    <span className="text-xs text-txt-primary flex-1 truncate">{r.type}</span>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-txt-muted">{r.count} viewed</span>
                      <span className="text-xs font-medium text-status-success">{r.exported} exported</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By user */}
            <div>
              <p className="text-xs font-medium text-txt-secondary mb-3">Report Usage by User</p>
              <BarChart
                data={d.report_metrics.by_user.map(u => ({ name: u.name, viewed: u.reports, exported: u.exports }))}
                xKey="name"
                bars={[
                  { key: 'viewed',   color: COLORS.EVENTS_BAR, label: 'Viewed'   },
                  { key: 'exported', color: COLORS.REPORT_BAR, label: 'Exported' },
                ]}
                horizontal
                height={Math.max(160, d.report_metrics.by_user.length * CHART_ROW_HEIGHT.REPORT)}
                showLabels
              />
            </div>
          </div>
        )}
      </div>
    </DrillDownDrawer>
  )
}
