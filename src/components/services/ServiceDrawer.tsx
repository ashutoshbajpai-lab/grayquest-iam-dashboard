'use client'

import { useState } from 'react'
import DrillDownDrawer from '@/components/layout/DrillDownDrawer'
import LineChart from '@/components/charts/LineChart'
import BarChart from '@/components/charts/BarChart'
import type { Service } from '@/types/services'

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

function ServiceKPICard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white/90 rounded-2xl p-4 border border-white/60 shadow-sm flex flex-col justify-center min-h-[90px]">
      <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[20px] font-black text-[#111827]" style={{ color: color ?? '#111827' }}>{value}</p>
    </div>
  )
}

export default function ServiceDrawer({ service, drill, onClose }: Props) {
  const [tab, setTab] = useState<'overview' | 'events' | 'users' | 'reports'>('overview')

  if (!service) return null
  const d = drill || { success_series: [], events_breakdown: [], top_users: [] }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'events',   label: 'Events'   },
    { id: 'users',    label: 'Users'    },
    ...(service.has_reports ? [{ id: 'reports', label: 'Reports' }] : []),
  ] as { id: typeof tab; label: string }[]

  return (
    <DrillDownDrawer open={!!service} onClose={onClose} title={service.service_name} breadcrumbs={[{ label: 'Services', onClick: onClose }]}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h3 className="text-[20px] font-black text-[#111827] leading-tight">{service.service_name}</h3>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-3 gap-3">
          <ServiceKPICard label="Total Events" value={service.events_30d.toLocaleString()} />
          <ServiceKPICard label="Success Rate" value={`${service.success_rate}%`} color="#10B981" />
          <ServiceKPICard label="Active Users" value={service.active_users_30d} />
        </div>

        {/* Tab Nav */}
        <div className="flex gap-6 border-b border-white/40 pb-2">
          {tabs.map(t => (
            <button 
              key={t.id} 
              onClick={() => setTab(t.id)}
              className={`text-[12px] font-black uppercase tracking-widest transition-all ${tab === t.id ? 'text-[#6366F1] border-b-2 border-[#6366F1] pb-2 -mb-[10px]' : 'text-[#94A3B8] hover:text-[#64748B]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in duration-300">
          {tab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h4 className="text-[13px] font-black text-[#475569] mb-4">Reliability Trend (Last 7 Days)</h4>
                <div className="h-[180px] -ml-4">
                  <LineChart
                    data={d.success_series}
                    xKey="date"
                    lines={[{ key: 'rate', color: '#10B981', label: 'Success %' }]}
                    height={180}
                    formatY={v => `${v}%`}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-[13px] font-black text-[#475569] mb-4">Top Events by Volume</h4>
                <BarChart
                  data={d.events_breakdown?.slice(0, 5) ?? []}
                  xKey="event"
                  bars={[{ key: 'count', color: '#6366F1', label: 'Events' }]}
                  horizontal
                  height={200}
                  showLabels
                />
              </div>
            </div>
          )}

          {tab === 'events' && (
            <div className="space-y-8">
              <div>
                <h4 className="text-[13px] font-black text-[#475569] mb-4">Event Performance Breakdown</h4>
                <BarChart
                  data={d.events_breakdown ?? []}
                  xKey="event"
                  bars={[{ key: 'success', color: '#10B981', label: 'Success %' }]}
                  horizontal
                  height={Math.max(200, (d.events_breakdown?.length ?? 0) * 40)}
                  showLabels
                  formatY={v => `${v}%`}
                  yAxisWidth={160}
                />
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-6">
              <h4 className="text-[13px] font-black text-[#475569]">Top Service Users</h4>
              <div className="space-y-2">
                {d.top_users?.map((u, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/50 border border-white/60">
                    <div className="min-w-0">
                      <p className="text-[12px] font-black text-[#111827] truncate">{u.name}</p>
                      <p className="text-[10px] font-bold text-[#94A3B8]">{u.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-black text-[#6366F1]">{u.events}</p>
                      <p className="text-[9px] font-bold text-[#94A3B8]">EVENTS</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'reports' && d.report_metrics && (
            <div className="space-y-8">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/90 p-4 rounded-2xl border border-white/60">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">Total Reports</p>
                  <p className="text-[18px] font-black text-[#111827]">{d.report_metrics.total_reports}</p>
                </div>
                <div className="bg-white/90 p-4 rounded-2xl border border-white/60">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">Exported</p>
                  <p className="text-[18px] font-black text-[#111827]">{d.report_metrics.exported}</p>
                </div>
                <div className="bg-white/90 p-4 rounded-2xl border border-white/60">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">Rate</p>
                  <p className="text-[18px] font-black text-emerald-600">{d.report_metrics.export_rate}%</p>
                </div>
              </div>
              <div>
                <h4 className="text-[13px] font-black text-[#475569] mb-4">Usage by Report Type</h4>
                <div className="space-y-2">
                  {d.report_metrics.report_types.map(r => (
                    <div key={r.type} className="flex items-center justify-between p-3 rounded-xl bg-white/50 border border-white/60">
                      <p className="text-[12px] font-black text-[#111827]">{r.type}</p>
                      <div className="flex gap-4">
                        <span className="text-[11px] font-bold text-[#94A3B8]">{r.count} VIEWS</span>
                        <span className="text-[11px] font-black text-emerald-600">{r.exported} EXPORTS</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DrillDownDrawer>
  )
}
