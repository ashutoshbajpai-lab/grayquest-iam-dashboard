'use client'

import { useState, useMemo } from 'react'
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
import { getRefDate, KPI_DESCRIPTIONS } from '@/lib/constants'

// ── Role colors (Vibrant QORE Palette) ──────────────────────────
const ROLE_COLORS: Record<string, string> = {
  'Group manager':              '#7C3AED',
  'Block Master Dashboard':     '#2563EB',
  'Group Admissions Manager':   '#0891B2',
  'FMS Dashboard Limited':      '#059669',
  'Backend Engineer':           '#D97706',
  'Institute Dashboard Manager': '#EF4444',
  'Institute Admin':            '#DB2777',
  'IAM Admin':                  '#10B981', 
  'Service Manager':            '#0EA5E9',
  'Finance Officer':            '#F59E0B',
  'Audit Officer':              '#EF4444',
}

// ── Icons ─────────────────────────────────────────────────────
function IconUsers({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IconHeart({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 0 0 0 0-7.78z"/></svg> }
function IconUserPlus({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> }
function IconCheckCircle({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> }
function IconActivity({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> }
function IconInfo({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> }

interface PeopleData {
  overview: { kpis: Record<string, number>; trends: Record<string, number> }
  dau: { series: { date: string; dau: number; sessions: number; events: number }[] }
  users: { users: User[] }
  roles: { roles: { role: string; count: number; pct: number; avg_health: number; active_today: number }[] }
  cohort: { cohorts: { month: string; size: number; w1: number|null; w2: number|null; w4: number|null; m2: number|null; m3: number|null }[] }
  sessions: { by_role: { role: string; avg_duration_min: number; avg_events: number; sessions: number }[] }
  events: { events: { user_id: string | number }[] }
}

export default function PeopleClient({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as PeopleData
  const { search, dateRange, roles: selectedRoles } = useFilterStore()
  const c = useChartColors()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [dauMetric, setDauMetric] = useState<'dau' | 'sessions' | 'events'>('dau')
  const [pageSize, setPageSize] = useState(10)

  const filteredUsers = useMemo(() => {
    return (d?.users?.users ?? []).filter(u => {
      const dateMatch = !dateRange.from || !dateRange.to ||
        (u.last_active >= dateRange.from && u.last_active <= dateRange.to)
      const roleMatch = selectedRoles.length === 0 || selectedRoles.includes(u.role)
      const searchMatch = !search || 
        u.name.toLowerCase().includes(search.toLowerCase()) || 
        u.email.toLowerCase().includes(search.toLowerCase())
      return dateMatch && roleMatch && searchMatch
    })
  }, [d?.users?.users, dateRange, selectedRoles, search])

  const visibleUsers = useMemo(() => filteredUsers.slice(0, pageSize), [filteredUsers, pageSize])

  // ── KPI CALCULATIONS ──
  const filteredAvgHealth = filteredUsers.length > 0
    ? Math.round(filteredUsers.reduce((a: number, u: User) => a + u.health_score, 0) / filteredUsers.length)
    : 0
  const filteredTotalSessions = filteredUsers.reduce((a: number, u: User) => a + (u.sessions_30d || 0), 0)
  const filteredTotalEvents   = filteredUsers.reduce((a: number, u: User) => a + (u.events_30d || 0), 0)
  
  const filteredNewActivations = useMemo(() => {
    return (d?.users?.users ?? []).filter((u: any) => {
      const roleMatch = selectedRoles.length === 0 || selectedRoles.includes(u.role)
      const searchMatch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
      if (!roleMatch || !searchMatch) return false
      
      return u.first_seen >= (dateRange.from || '') && u.first_seen <= (dateRange.to || '')
    }).length
  }, [d?.users?.users, dateRange, selectedRoles, search])

  const periodLabel = useMemo(() => {
    if (dateRange.preset === 'today') return 'Today'
    if (dateRange.preset === '7d') return '7 Days'
    if (dateRange.preset === '30d') return '30 Days'
    if (dateRange.preset === 'custom') {
      if (dateRange.from && dateRange.to) {
        const d1 = new Date(dateRange.from)
        const d2 = new Date(dateRange.to)
        const diffTime = Math.abs(d2.getTime() - d1.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        return `${diffDays}d Custom`
      }
      return 'Custom'
    }
    return '30 Days'
  }, [dateRange])

  const dauSlice = useMemo(() => {
    const days = dateRange.preset === 'today' ? 1 : dateRange.preset === '7d' ? 7 : 30
    return -(days)
  }, [dateRange.preset])

  const dauSeries = (d?.dau?.series ?? []).slice(dauSlice).map(s => ({ ...s, date: s.date?.slice(5) ?? '' }))

  const roleSlices = Object.entries(
    filteredUsers.reduce((acc: Record<string, number>, u: User) => { acc[u.role] = (acc[u.role] ?? 0) + 1; return acc }, {} as Record<string, number>)
  ).map(([name, value]: [string, number]) => ({ name, value, color: ROLE_COLORS[name] ?? '#64748B' }))

  const cohortCells = (d?.cohort?.cohorts ?? []).flatMap((row: any) =>
    (['w1','w2','w4','m2','m3'] as const).flatMap((period: string) => {
      const v = (row as any)[period]
      return v !== null && v !== undefined ? [{ x: period.toUpperCase(), y: row.month, value: v }] : []
    })
  )

  return (
    <div className="flex flex-col gap-6 pb-12">
      <PinnedMetrics section="people" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">People</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Displaying only unique users with platform activity.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard 
          title={`Active Users · ${periodLabel}`} 
          value={filteredUsers.length} 
          subtitle="With platform activity" 
          icon={<IconUsers color="currentColor" />} 
          description={KPI_DESCRIPTIONS.active_users}
        />
        <KPICard 
          title="Avg Health Score" 
          value={filteredAvgHealth} 
          subtitle={`${filteredUsers.length} active`} 
          icon={<IconHeart color="currentColor" />} 
          description={KPI_DESCRIPTIONS.avg_health_score}
        />
        <KPICard 
          title="New Activations" 
          value={filteredNewActivations} 
          subtitle={`Seen · ${periodLabel}`} 
          icon={<IconUserPlus color="currentColor" />} 
          description={KPI_DESCRIPTIONS.new_users_activated}
        />
        <KPICard 
          title="Session Rate" 
          value={`${filteredUsers.length > 0 ? 100 : 0}%`} 
          subtitle="Auth success" 
          icon={<IconCheckCircle color="currentColor" />} 
          description="Percentage of login attempts that resulted in a successful session."
        />
        <KPICard 
          title="Total Sessions" 
          value={filteredTotalSessions.toLocaleString()} 
          subtitle={`${filteredTotalEvents.toLocaleString()} events`} 
          icon={<IconActivity color="currentColor" />} 
          description="Total number of authenticated sessions established in the period."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div>
              <p className="text-sm font-bold text-[#111827]">Activity Trend</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">{periodLabel} summary</p>
            </div>
            <div className="flex gap-2">
              {(['dau','sessions','events'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setDauMetric(m)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                    dauMetric === m ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:bg-white/60'
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="px-5 pb-5">
            <LineChart data={dauSeries} xKey="date" lines={[{ key: dauMetric, color: '#6366F1', label: dauMetric.toUpperCase() }]} height={200} />
          </div>
        </div>

        <div className="card p-6">
          <p className="text-sm font-bold text-[#111827]">Active Roles</p>
          <p className="text-[10px] text-[#9CA3AF] mt-0.5 mb-6">Distribution of active platform users</p>
          <div className="flex flex-col gap-6">
            <div className="flex justify-center h-[160px]">
              <DonutChart data={roleSlices} height={160} innerRadius={55} outerRadius={80} centerLabel={String(filteredUsers.length)} centerSub="USERS" />
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {roleSlices.map(slice => (
                <div key={slice.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
                    <span className="text-[11px] font-black text-[#475569] truncate">{slice.name}</span>
                  </div>
                  <span className="text-[11px] font-black text-[#111827]">{slice.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* User Table Header with Search */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/40 flex justify-between items-center bg-slate-50/30">
          <div>
            <p className="text-[15px] font-black text-[#111827]">Verified Platform Users</p>
            <p className="text-[10px] text-[#94A3B8] font-bold mt-0.5 uppercase tracking-wider">Activity Verified</p>
          </div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search users in list..."
              value={search}
              onChange={(e) => useFilterStore.getState().setSearch(e.target.value)}
              className="w-[280px] px-4 py-2 pl-10 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#6366F1] focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm font-bold shadow-sm"
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <div>
          <UserTable 
            users={visibleUsers} 
            onSelect={setSelectedUser} 
            totalCount={filteredUsers.length}
            pageSize={pageSize}
            onShowMore={() => setPageSize(prev => prev + 20)}
            onCollapse={() => setPageSize(10)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm font-bold text-[#111827]">Cohort Retention</p>
            <div className="relative group flex items-center cursor-help">
              <IconInfo color="#94A3B8" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#111827] text-white text-[11px] font-medium rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none text-center">
                Measures the percentage of users from a specific monthly cohort who return and engage with the platform in subsequent weeks and months.
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111827]" />
              </div>
            </div>
          </div>
          <div className="h-[220px]">
            <HeatmapChart data={cohortCells} xLabel="Period" yLabel="Cohort" colorHigh="#6366F1" formatValue={v => `${v}%`} />
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm font-bold text-[#111827]">Engagement Depth</p>
            <div className="relative group flex items-center cursor-help">
              <IconInfo color="#94A3B8" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#111827] text-white text-[11px] font-medium rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none text-center">
                Displays the average number of events per session for each role. A higher number indicates that users in this role perform more actions during a single login.
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111827]" />
              </div>
            </div>
          </div>
          <LineChart
            data={(d.sessions?.by_role ?? []).map((r: any) => ({ role: r.role, events: r.avg_events }))}
            xKey="role"
            lines={[{ key: 'events', color: '#A78BFA', label: 'Avg Events/Session' }]}
            height={220}
            formatX={v => String(v).slice(0, 8)}
            formatTooltipLabel={v => String(v)}
          />
        </div>
      </div>

      <UserDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  )
}
