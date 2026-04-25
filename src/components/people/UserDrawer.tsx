'use client'

import { useMemo } from 'react'
import DrillDownDrawer from '@/components/layout/DrillDownDrawer'
import LineChart from '@/components/charts/LineChart'
import BarChart from '@/components/charts/BarChart'
import type { IamUser as User } from '@/types/people'

interface Props {
  user: User | null
  onClose: () => void
}

function UserKPICard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white/90 rounded-2xl p-4 border border-white/60 shadow-sm flex flex-col justify-center min-h-[90px]">
      <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[18px] font-black text-[#111827]" style={{ color: color ?? '#111827' }}>{value}</p>
      {sub && <p className="text-[9px] font-bold text-[#94A3B8] mt-1">{sub}</p>}
    </div>
  )
}

export default function UserDrawer({ user, onClose }: Props) {
  const activitySeries = useMemo(() => user?.activity_series ?? [], [user])
  const serviceBreakdown = useMemo(() => user?.service_breakdown ?? [], [user])
  const recentEvents = useMemo(() => user?.recent_events ?? [], [user])

  if (!user) return null

  const healthColor = user.health_score > 80 ? '#10B981' : user.health_score > 60 ? '#F59E0B' : '#EF4444'

  return (
    <DrillDownDrawer
      open={!!user}
      onClose={onClose}
      title={user.name}
      breadcrumbs={[{ label: 'People', onClick: onClose }]}
    >
      <div className="space-y-8">
        {/* Header Profile */}
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-200/50">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-[24px] font-black text-[#111827] leading-tight mb-2">{user.name}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-black uppercase tracking-wider border border-indigo-100">
                {user.role}
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-black uppercase tracking-wider border border-emerald-100">
                Active Now
              </span>
              <span className="text-[11px] font-bold text-[#94A3B8] ml-1">ID: {user.user_id}</span>
            </div>
          </div>
          
          {/* Health Gauge */}
          <div className="relative w-24 h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="rgba(0,0,0,0.05)" strokeWidth="10" fill="none" />
              <circle 
                cx="50" cy="50" r="42" stroke={healthColor} strokeWidth="10" fill="none" 
                strokeDasharray={`${(user.health_score / 100) * 264} 264`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex flex-col items-center -space-y-1">
                <span className="text-2xl font-black text-[#111827]">{Math.round(user.health_score)}</span>
                <span className="text-[10px] font-black text-[#94A3B8] uppercase">/ 100</span>
              </div>
              <p className="text-[8px] font-black text-[#94A3B8] uppercase mt-1 tracking-widest">Health</p>
            </div>
          </div>
        </div>

        {/* Extended KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <UserKPICard label="Sessions (30d)" value={user.sessions_30d} sub="Engagement" />
          <UserKPICard label="Events (30d)" value={user.events_30d} sub="Action count" />
          <UserKPICard label="Avg Session" value="4.2m" sub="Per login" />
          <UserKPICard label="Services Used" value={serviceBreakdown.length} sub="Cross-module" />
          <UserKPICard label="Login Rate" value={`${user.auth_success_rate ?? 0}%`} color="#10B981" sub="Auth health" />
          <UserKPICard label="Member Since" value={user.created_at?.slice(0, 7) ?? user.first_seen?.slice(0, 7) ?? '2026-01'} sub="Activation" />
        </div>

        {/* Charts in separate rows for better clarity */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h4 className="text-[12px] font-black text-[#475569] uppercase tracking-wider">Activity — Last 7 Days</h4>
            <div className="h-[200px] bg-white/50 rounded-2xl border border-white/60 p-4 shadow-sm">
              <LineChart
                data={activitySeries}
                xKey="date"
                lines={[{ key: 'events', color: '#6366F1', label: 'Events' }]}
                height={170}
                formatX={v => v.slice(5)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[12px] font-black text-[#475569] uppercase tracking-wider">Service Usage Breakdown</h4>
            <div className="h-[220px] bg-white/50 rounded-2xl border border-white/60 p-4 shadow-sm">
              <BarChart
                data={serviceBreakdown.slice(0, 6)}
                xKey="name"
                bars={[{ key: 'value', color: '#818CF8', label: 'Events' }]}
                height={190}
                horizontal
                showLabels
              />
            </div>
          </div>
        </div>

        {/* Detailed Activity Feed */}
        <div className="space-y-4">
          <h4 className="text-[12px] font-black text-[#475569] uppercase tracking-wider">Recent Events</h4>
          <div className="space-y-2">
            {recentEvents.length > 0 ? (
              recentEvents.map((e, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/60 border border-white/60 hover:shadow-sm transition-all group">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${e.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div className="min-w-[120px] text-[11px] font-bold text-[#94A3B8]">
                    {e.ts.replace('T', ' ').slice(0, 16)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-[#111827] truncate group-hover:text-[#6366F1] transition-colors">{e.service}</p>
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-tight truncate">{e.event}</p>
                  </div>
                  <div className={`text-[10px] font-black px-2 py-0.5 rounded-md ${e.status === 'SUCCESS' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                    {e.status}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center bg-white/40 rounded-xl border border-dashed border-white/60">
                <p className="text-[11px] font-bold text-[#94A3B8]">No recent events found for this user.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DrillDownDrawer>
  )
}
