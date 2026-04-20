'use client'

import { useState } from 'react'
import KPICard from '@/components/ui/KPICard'
import LineChart from '@/components/charts/LineChart'
import DonutChart from '@/components/charts/DonutChart'
import HeatmapChart from '@/components/charts/HeatmapChart'
import UserTable from '@/components/people/UserTable'
import UserDrawer from '@/components/people/UserDrawer'
import { useFilterStore } from '@/store/filterStore'
import { useChartColors } from '@/hooks/useChartColors'
import type { IamUser as User } from '@/types/people'
import PinnedMetrics from '@/components/ui/PinnedMetrics'

// ── Role colors ───────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  'Institute Admin':  '#7C6FF7',
  'IAM Admin':        '#10B981',
  'Service Manager':  '#0EA5E9',
  'Finance Officer':  '#F59E0B',
  'Audit Officer':    '#EF4444',
}

// ── KPI icons ─────────────────────────────────────────────────────
function IconUsers({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconHeart({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}
function IconUserPlus({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/>
      <line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  )
}
function IconCheckCircle({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}
function IconActivity({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

// ── Data types ────────────────────────────────────────────────────
interface PeopleData {
  overview: { kpis: Record<string, number>; trends: Record<string, number> }
  dau: { series: { date: string; dau: number; sessions: number; events: number }[] }
  users: { users: User[] }
  roles: { roles: { role: string; count: number; pct: number; avg_health: number; active_today: number }[] }
  cohort: { cohorts: { month: string; size: number; w1: number|null; w2: number|null; w4: number|null; m2: number|null; m3: number|null }[] }
  sessions: { by_role: { role: string; avg_duration_min: number; avg_events: number; sessions: number }[] }
}

export default function PeopleClient({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as PeopleData
  const { search, dateRange, roles } = useFilterStore()
  const c = useChartColors()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [dauMetric, setDauMetric] = useState<'dau' | 'sessions' | 'events'>('dau')

  const kpis   = d.overview.kpis
  const trends = d.overview.trends

  // ── Filters ───────────────────────────────────────────────────
  const dateUsers = d.users.users.filter(u => {
    const dateMatch = !dateRange.from || !dateRange.to ||
      (u.last_active >= dateRange.from && u.last_active <= dateRange.to)
    const roleMatch = roles.length === 0 || roles.includes(u.role)
    return dateMatch && roleMatch
  })

  const periodLabel =
    dateRange.preset === 'today'  ? 'Today'  :
    dateRange.preset === '7d'     ? '7d'     :
    dateRange.preset === 'custom' ? 'Custom' : '30d'

  const activeTrend =
    dateRange.preset === '7d'  ? trends.active_users_7d_vs_prev  :
    dateRange.preset === '30d' ? trends.active_users_30d_vs_prev : undefined

  // ── DAU chart ─────────────────────────────────────────────────
  const dauSlice =
    dateRange.preset === 'today' ? -3 :
    dateRange.preset === '7d'    ? -7 : -14
  const dauSeries = d.dau.series.slice(dauSlice).map(s => ({ ...s, date: s.date.slice(5) }))

  // ── Role donut ────────────────────────────────────────────────
  const roleSlices = d.roles.roles.map(r => ({
    name: r.role, value: r.count, color: ROLE_COLORS[r.role] ?? '#64748B',
  }))

  // ── Cohort heatmap ────────────────────────────────────────────
  const cohortCells = d.cohort.cohorts.flatMap(row =>
    (['w1','w2','w4','m2','m3'] as const).flatMap(period => {
      const v = row[period]
      return v !== null && v !== undefined
        ? [{ x: period.toUpperCase(), y: row.month, value: v }]
        : []
    })
  )

  const metricLabel = { dau: 'Active Users', sessions: 'Sessions', events: 'Events' }

  return (
    <>
      <PinnedMetrics section="people" />

      {/* ── KPI Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <KPICard
          title={`Active Users · ${periodLabel}`}
          value={dateUsers.length}
          subtitle={
            dateRange.preset === 'today'  ? 'Logged in today'          :
            dateRange.preset === '7d'     ? 'Active in last 7 days'    :
            dateRange.preset === 'custom' ? `${dateRange.from} – ${dateRange.to}` :
                                           'Active in last 30 days'
          }
          trend={activeTrend}
          trendLabel="vs prev period"
          status="neutral"
          icon={<IconUsers color="currentColor" />}
        />
        <KPICard
          title="Avg Health Score"
          value={kpis.avg_health_score}
          subtitle={`All ${kpis.total_users.toLocaleString()} users`}
          trend={trends.health_score_vs_prev}
          trendLabel="vs prev 30d"
          status={kpis.avg_health_score >= 70 ? 'success' : kpis.avg_health_score >= 50 ? 'warning' : 'danger'}
          icon={<IconHeart color="currentColor" />}
        />
        <KPICard
          title="New Activations"
          value={kpis.new_activations_30d}
          subtitle="First action after login"
          status="neutral"
          icon={<IconUserPlus color="currentColor" />}
        />
        <KPICard
          title="Session Completion"
          value={`${kpis.completion_rate}%`}
          subtitle={`${kpis.shallow_session_pct}% login-only`}
          status={kpis.completion_rate >= 70 ? 'success' : 'warning'}
          icon={<IconCheckCircle color="currentColor" />}
        />
        <KPICard
          title="Total Sessions"
          value={kpis.total_sessions_30d}
          subtitle={`${kpis.total_events_30d.toLocaleString()} events`}
          status="neutral"
          icon={<IconActivity color="currentColor" />}
        />
      </div>

      {/* ── Row 2: Activity Trend + Role Distribution ──────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">

        {/* Activity Trend */}
        <div className="card xl:col-span-2 flex flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-bg-border">
            <div>
              <p className="text-base font-bold text-txt-primary">Activity Trend</p>
              <p className="text-xs text-txt-muted mt-0.5">
                {dateRange.preset === 'today' ? 'Last 3 days' : dateRange.preset === '7d' ? 'Last 7 days' : 'Last 14 days'} · platform-wide
              </p>
            </div>
            <div className="flex gap-1 bg-bg-elevated rounded-xl p-1">
              {(['dau','sessions','events'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setDauMetric(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    dauMetric === m
                      ? 'text-white shadow-sm'
                      : 'text-txt-muted hover:text-txt-primary'
                  }`}
                  style={dauMetric === m ? { backgroundColor: '#1C1C1E' } : {}}
                >
                  {metricLabel[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="px-6 py-5">
            <LineChart
              data={dauSeries}
              xKey="date"
              lines={[{ key: dauMetric, color: c.secondary, label: metricLabel[dauMetric] }]}
              height={210}
            />
          </div>
        </div>

        {/* Users by Role */}
        <div className="card flex flex-col">
          <div className="px-6 pt-5 pb-4 border-b border-bg-border">
            <p className="text-base font-bold text-txt-primary">Users by Role</p>
            <p className="text-xs text-txt-muted mt-0.5">Distribution across platform_id=7</p>
          </div>
          <div className="px-6 py-5 flex-1">
            <DonutChart
              data={roleSlices}
              height={200}
              centerLabel={String(dateUsers.length)}
              centerSub={`active ${periodLabel.toLowerCase()}`}
            />
          </div>
        </div>
      </div>

      {/* ── Row 3: User Table (full width) ────────────────────── */}
      <div className="card mb-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-bg-border">
          <div>
            <p className="text-base font-bold text-txt-primary">All Users</p>
            <p className="text-xs text-txt-muted mt-0.5">Click any row to drill down · {dateUsers.length} of {d.users.users.length} users</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Active + At Risk + Inactive summary pills */}
            {[
              { label: 'Active',   count: dateUsers.filter(u => u.health_score >= 75).length,  bg: 'rgba(16,185,129,0.10)',  color: '#059669' },
              { label: 'At Risk',  count: dateUsers.filter(u => u.health_score >= 50 && u.health_score < 75).length, bg: 'rgba(217,119,6,0.10)', color: '#D97706' },
              { label: 'Inactive', count: dateUsers.filter(u => u.health_score < 50).length,   bg: 'rgba(239,68,68,0.10)',  color: '#DC2626' },
            ].map(({ label, count, bg, color }) => (
              <span
                key={label}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: bg, color }}
              >
                {count} {label}
              </span>
            ))}
          </div>
        </div>
        <UserTable
          users={dateUsers}
          onSelect={u => setSelectedUser(u)}
          search={search}
        />
      </div>

      {/* ── Row 4: Cohort Retention + Session Depth ───────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Cohort Retention */}
        <div className="card flex flex-col">
          <div className="px-6 pt-5 pb-4 border-b border-bg-border">
            <p className="text-base font-bold text-txt-primary">Cohort Retention</p>
            <p className="text-xs text-txt-muted mt-0.5">% returned in period after first login</p>
          </div>
          <div className="px-6 py-5">
            <HeatmapChart
              data={cohortCells}
              xLabel="Period"
              yLabel="Cohort"
              colorHigh={c.secondary}
              formatValue={v => `${v}%`}
            />
          </div>
        </div>

        {/* Session Depth */}
        <div className="card xl:col-span-2 flex flex-col">
          <div className="px-6 pt-5 pb-4 border-b border-bg-border">
            <p className="text-base font-bold text-txt-primary">Session Depth by Role</p>
            <p className="text-xs text-txt-muted mt-0.5">Longer sessions indicate deeper engagement</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-bg-border flex-1">
            <div className="px-6 py-5">
              <p className="text-xs font-semibold text-txt-muted uppercase tracking-wide mb-4">Avg Duration (min)</p>
              <LineChart
                data={d.sessions.by_role.map(r => ({ role: r.role, duration: r.avg_duration_min }))}
                xKey="role"
                lines={[{ key: 'duration', color: c.info, label: 'Avg Duration (min)' }]}
                height={160}
                formatX={v => v.split(' ')[0]}
              />
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold text-txt-muted uppercase tracking-wide mb-4">Avg Events per Session</p>
              <LineChart
                data={d.sessions.by_role.map(r => ({ role: r.role, events: r.avg_events }))}
                xKey="role"
                lines={[{ key: 'events', color: c.tertiary, label: 'Avg Events' }]}
                height={160}
                formatX={v => v.split(' ')[0]}
              />
            </div>
          </div>
        </div>

      </div>

      <UserDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
    </>
  )
}
