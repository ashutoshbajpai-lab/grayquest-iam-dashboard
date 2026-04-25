'use client'

import { useState, useMemo } from 'react'
import KPICard from '@/components/ui/KPICard'
import HeatmapChart from '@/components/charts/HeatmapChart'
import BarChart from '@/components/charts/BarChart'
import ServiceCard from '@/components/services/ServiceCard'
import ServiceDrawer from '@/components/services/ServiceDrawer'
import { useFilterStore } from '@/store/filterStore'
import { useChartColors } from '@/hooks/useChartColors'
import type { Service } from '@/types/services'
import PinnedMetrics from '@/components/ui/PinnedMetrics'

// ── Icons ────────────────────────────────────────────────────────
function IconLayers({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> }
function IconZap({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }
function IconActivity({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> }
function IconAward({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg> }
function IconFileText({ color }: { color: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }

const SERVICE_GROUPS: Record<string, string> = {
  'Dashboard':                   'Core',
  'Master Dashboard':            'Core',
  'Master Dashboard Reports':    'Core',
  'Fee Headers':                 'Institute Management',
  'Classes':                     'Institute Management',
  'Institute Discount':          'Institute Management',
  'Forms':                       'Institute Management',
  'Fine':                        'Institute Management',
  'Student Management':          'Student Management',
  'Student Fee Headers':         'Student Management',
  'Student Transactions':        'Student Management',
  'Student Discount':            'Student Management',
  'Student Fine':                'Student Management',
  'EMI Applications':            'Transactions',
  'PG Transactions':             'Transactions',
  'AD Registrations':            'Transactions',
  'AD Transactions':             'Transactions',
  'Offline Transactions':        'Transactions',
  'Payment link communication':  'Communication',
  'Payment link history':        'Communication',
  'My Reports':                  'Reports',
  'Report Templates':            'Reports',
  'Ongoing Admissions':          'Admissions',
  'Admission Leads':             'Admissions',
  'Lead Profile':                'Admissions',
  'Application Profile':         'Admissions',
  'Applicant Fee Headers':       'Admissions',
}
const GROUP_ORDER = ['Core','Institute Management','Student Management','Transactions','Communication','Reports','Admissions']

export default function ServicesClient({ data }: { data: Record<string, unknown> }) {
  const d = data as any
  const { search, services: serviceFilter, dateRange } = useFilterStore()
  const [selected, setSelected] = useState<Service | null>(null)
  const [sortBy, setSortBy] = useState<'events' | 'success' | 'users'>('events')
  const [selectedCatalogGroup, setSelectedCatalogGroup] = useState<string | null>(null)
  const [feedLimit] = useState(10)

  const windowKey = dateRange.preset === 'today' ? '1d' : dateRange.preset === '7d' ? '7d' : '30d'
  const win = d.servicesWindows?.[windowKey] ?? null
  const allServices = win ? win.services : (d.services?.services ?? [])

  // ── DATA ACCURACY: COMPUTE REAL USER COUNTS PER SERVICE ──
  const serviceStats = useMemo(() => {
    const stats: Record<string, Set<string>> = {}
    d.events?.events?.forEach((e: any) => {
      if (!stats[e.service]) stats[e.service] = new Set()
      if (e.user_id) stats[e.service].add(String(e.user_id))
    })
    return stats
  }, [d.events?.events])

  const verifiedServices = useMemo(() => {
    return allServices.map((s: Service) => ({
      ...s,
      active_users_30d: serviceStats[s.service_name]?.size || s.active_users_30d || 0
    }))
  }, [allServices, serviceStats])

  // ── FILTERING LOGIC ──
  const filteredServices = useMemo(() => {
    return verifiedServices.filter((s: Service) => {
      const matchSearch  = !search || s.service_name.toLowerCase().includes(search.toLowerCase())
      const roleMatch = serviceFilter.length === 0 || serviceFilter.includes(s.service_name)
      return matchSearch && roleMatch
    })
  }, [verifiedServices, search, serviceFilter])

  const visible = useMemo(() => {
    return [...filteredServices].sort((a: Service, b: Service) => {
      if (sortBy === 'events')  return b.events_30d - a.events_30d
      if (sortBy === 'success') return b.success_rate - a.success_rate
      return b.active_users_30d - a.active_users_30d
    })
  }, [filteredServices, sortBy])

  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>()
    for (const s of visible) {
      const g = SERVICE_GROUPS[s.service_name] ?? 'Other'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(s)
    }
    return [...GROUP_ORDER, 'Other']
      .filter(g => map.has(g))
      .map(g => [g, map.get(g)!] as [string, Service[]])
  }, [visible])

  // ── KPI CALCULATIONS ──
  const kpis = useMemo(() => {
    const totalEvents = filteredServices.reduce((a: number, s: Service) => a + s.events_30d, 0)
    const avgSuccess = filteredServices.length > 0 
      ? filteredServices.reduce((a: number, s: Service) => a + s.success_rate, 0) / filteredServices.length 
      : 0
    
    const globalActiveUsers = new Set<string>()
    filteredServices.forEach((s: Service) => {
      serviceStats[s.service_name]?.forEach(uid => globalActiveUsers.add(uid))
    })

    const topService = filteredServices.length > 0
      ? filteredServices.reduce((best: Service, s: Service) => s.events_30d > best.events_30d ? s : best, filteredServices[0])
      : null

    return {
      active_services: filteredServices.length,
      total_events: totalEvents,
      weighted_success_rate: avgSuccess,
      active_users: globalActiveUsers.size,
      report_exports: filteredServices.reduce((a: number, s: any) => a + (s.report_count_30d ?? 0), 0),
      top_service_name: topService?.service_name ?? '—',
      top_service_events: topService?.events_30d ?? 0
    }
  }, [filteredServices, serviceStats])

  // ── CHART DATA ──
  const heatMatrix = win ? win.heatmap.matrix : (d?.heatmap?.matrix ?? [])
  const heatCells = useMemo(() => {
    return heatMatrix
      .map((r: any) => ({ x: String(r.hour), y: r.service, value: r.count }))
  }, [heatMatrix])

  const topEvents = useMemo(() => {
    const eventMap: Record<string, number> = {}
    filteredServices.forEach((s: Service) => {
      if (s.top_events) {
        s.top_events.forEach((e: string, i: number) => {
          const name = e || 'Other'
          eventMap[name] = (eventMap[name] || 0) + (s.events_30d / (i + 2))
        })
      }
    })
    return Object.entries(eventMap)
      .map(([event, count]) => {
        const label = event.replaceAll('_', ' ')
        const truncated = label.length > 22 ? label.slice(0, 22) + '…' : label
        return { event: truncated, count: Math.round(count) }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filteredServices])

  const successData = useMemo(() => {
    return filteredServices
      .map((s: Service) => ({ name: s.service_name, rate: s.success_rate }))
      .sort((a: {rate: number}, b: {rate: number}) => a.rate - b.rate)
      .slice(0, 10)
  }, [filteredServices])

  const selectedDrill = useMemo(() => {
    if (!selected) return null

    const serviceEvents = (d.events?.events || []).filter((e: any) => e.service === selected.service_name)
    
    const userMap = new Map<string, { name: string, role: string, events: number }>()
    serviceEvents.forEach((e: any) => {
      const uid = String(e.user_id)
      if (!userMap.has(uid)) {
        userMap.set(uid, { name: e.user_name || 'Unknown', role: 'User', events: 0 })
      }
      userMap.get(uid)!.events++
    })
    const top_users = Array.from(userMap.values()).sort((a, b) => b.events - a.events).slice(0, 5)

    const eventMap = new Map<string, { event: string, count: number, success: number }>()
    serviceEvents.forEach((e: any) => {
      if (!eventMap.has(e.event)) {
        eventMap.set(e.event, { event: e.event, count: 0, success: 0 })
      }
      const item = eventMap.get(e.event)!
      item.count++
      if (e.status === 'SUCCESS') item.success++
    })
    const events_breakdown = Array.from(eventMap.values()).sort((a, b) => b.count - a.count)

    // ── REAL PER-DAY SUCCESS RATE from actual event data ──
    const dayMap = new Map<string, { total: number; success: number }>()
    serviceEvents.forEach((e: any) => {
      const day = new Date(e.ts).toLocaleDateString('en-US', { weekday: 'short' })
      if (!dayMap.has(day)) dayMap.set(day, { total: 0, success: 0 })
      const entry = dayMap.get(day)!
      entry.total++
      if (e.status === 'SUCCESS') entry.success++
    })

    const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const success_series = DAY_ORDER.map(day => {
      const entry = dayMap.get(day)
      if (entry && entry.total > 0) {
        return { date: day, rate: parseFloat(((entry.success / entry.total) * 100).toFixed(1)) }
      }
      // fallback to service's overall rate for days with no events
      return { date: day, rate: selected.success_rate || 0 }
    })

    return {
      success_series,
      events_breakdown,
      top_users,
      report_metrics: {
        total_reports: selected.report_count_30d || 0,
        exported: selected.report_count_30d || 0,
        export_rate: selected.report_export_rate || 0,
        report_types: [
          { type: 'Standard Output', count: selected.report_count_30d || 0, exported: selected.report_count_30d || 0 }
        ],
        by_user: []
      }
    }
  }, [selected, d.events?.events])

  return (
    <div className="flex flex-col gap-6 pb-12">
      <PinnedMetrics section="services" />
      
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">Services</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">Real-time API and endpoint reliability metrics.</p>
        </div>
      </header>

      {/* KPI Row */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Active Services" value={kpis.active_services ?? 0} subtitle={`${kpis.active_users ?? 0} active users`} icon={<IconLayers color="currentColor" />} />
        <KPICard title="Total Volume" value={(kpis.total_events ?? 0).toLocaleString()} subtitle="Events processed" icon={<IconZap color="currentColor" />} />
        <KPICard title="Success Rate" value={`${(kpis.weighted_success_rate ?? 0).toFixed(1)}%`} subtitle="Weighted avg" icon={<IconAward color="currentColor" />} />
        <KPICard title="Top Service" value={kpis.top_service_name} subtitle={`${(kpis.top_service_events ?? 0).toLocaleString()} events`} icon={<IconActivity color="currentColor" />} />
        <KPICard title="Report Exports" value={(kpis.report_exports ?? 0).toLocaleString()} subtitle="Exported 30d" icon={<IconFileText color="currentColor" />} />
      </section>

      {/* Service Catalog Section with Search */}
      <section className="mt-4">
        <div className="card overflow-hidden">
          <div className="px-6 py-5 border-b border-white/40 flex justify-between items-center bg-slate-50/30">
            <div>
              <h2 className="text-[18px] font-black text-[#111827] tracking-tight">Service Catalog</h2>
              <p className="text-[10px] text-[#94A3B8] font-bold mt-0.5 uppercase tracking-wider">Inventory of all active platform endpoints</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex gap-1.5 bg-white/60 p-1 rounded-xl border border-white/40 shadow-sm">
                {['events','success','users'].map(k => (
                  <button key={k} onClick={() => setSortBy(k as any)} className={`text-[10px] font-black px-4 py-1.5 rounded-lg transition-all ${sortBy === k ? 'bg-[#111827] text-white shadow-md' : 'text-[#64748B] hover:bg-white'}`}>
                    {k.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search services..."
                  value={search}
                  onChange={(e) => useFilterStore.getState().setSearch(e.target.value)}
                  className="w-[240px] px-4 py-2 pl-10 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#6366F1] focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm font-bold shadow-sm"
                />
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="p-8">
            {!selectedCatalogGroup ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {grouped.map(([group, groupServices]) => {
                    const totalEvents = groupServices.reduce((acc, s) => acc + s.events_30d, 0)

                    return (
                      <div 
                        key={group}
                        onClick={() => setSelectedCatalogGroup(group)}
                        className="card p-6 cursor-pointer hover:border-[#6366F1] hover:shadow-[0_8px_30px_rgb(99,102,241,0.12)] transition-all group/card flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover/card:scale-110 group-hover/card:bg-indigo-600 group-hover/card:text-white transition-all">
                              <IconLayers color="currentColor" />
                            </div>
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{groupServices.length} Services</span>
                          </div>
                          <h3 className="text-base font-black text-[#111827] group-hover/card:text-[#6366F1] transition-colors">{group}</h3>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Volume</p>
                          <p className="text-sm font-black text-[#111827]">{totalEvents.toLocaleString()}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {grouped.length === 0 && (
                  <div className="py-20 text-center bg-white/40 rounded-3xl border border-dashed border-white/60">
                    <p className="text-[13px] font-black text-[#94A3B8]">No categories match your search.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <button 
                  onClick={() => setSelectedCatalogGroup(null)}
                  className="mb-8 flex items-center gap-2 text-[12px] font-black text-[#64748B] hover:text-[#111827] transition-colors uppercase tracking-wider"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Back to Categories
                </button>
                
                {grouped.filter(([g]) => g === selectedCatalogGroup).map(([group, groupServices]) => (
                  <div key={group} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="text-[15px] font-black text-[#111827]">{group} Services</span>
                      <div className="flex-1 h-[1px] bg-slate-200/60" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {groupServices.map(s => (
                        <ServiceCard key={s.service_id} service={s} onClick={setSelected} />
                      ))}
                    </div>
                  </div>
                ))}
                
                {grouped.filter(([g]) => g === selectedCatalogGroup).length === 0 && (
                   <div className="py-20 text-center bg-white/40 rounded-3xl border border-dashed border-white/60">
                     <p className="text-[13px] font-black text-[#94A3B8]">No services match your search in this category.</p>
                   </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Analytical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2 flex flex-col min-h-[420px]">
          <div className="px-6 pt-5 pb-2">
            <p className="text-[15px] font-black text-[#111827] flex items-center gap-2">
              Traffic Heatmap
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md uppercase font-bold">All</span>
            </p>
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mt-0.5">Hourly event distribution</p>
          </div>
          <div className="flex-1 px-4 pb-4 overflow-hidden">
            {heatCells.length > 0 ? (
              <HeatmapChart
                data={heatCells}
                xLabel="Hour"
                colorHigh="#6366F1"
                formatValue={v => `${v} ev`}
                onRowClick={(y) => {
                  const s = verifiedServices.find((sv: Service) => sv.service_name === y)
                  if (s) setSelected(s)
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-[11px] font-bold text-[#94A3B8]">No heatmap data for this section</div>
            )}
          </div>
        </div>

        <div className="card bg-white/80 backdrop-blur-xl border-white/60 overflow-hidden flex flex-col min-h-[420px]">
          <div className="px-6 py-5 border-b border-white/40 flex justify-between items-center bg-slate-50/30">
            <div>
              <p className="text-[15px] font-black text-[#111827]">Events Feed</p>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mt-0.5">Live Global activity</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/40 max-h-[350px]">
            {[...(d.events?.events ?? [])]
              .sort((a: any, b: any) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
              .slice(0, feedLimit)
              .map((e: any) => {
                const date = new Date(e.ts)
                const timeLabel = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
                const dateLabel = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                return (
                  <div key={e.event_id} className="flex items-center gap-4 px-6 py-4 hover:bg-indigo-50/30 transition-colors cursor-pointer group" onClick={() => {
                    const s = verifiedServices.find((sv: Service) => sv.service_name === e.service)
                    if (s) setSelected(s)
                  }}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${e.status === 'SUCCESS' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-[#111827] truncate group-hover:text-indigo-600 transition-colors">{e.event}</p>
                      <p className="text-[10px] font-bold text-[#94A3B8] truncate uppercase">{e.service}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[11px] font-black text-[#64748B]">{timeLabel}</p>
                      <p className="text-[9px] font-bold text-[#94A3B8]">{dateLabel}</p>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 flex flex-col min-h-[400px]">
          <p className="text-[15px] font-black text-[#111827]">Top Event Types</p>
          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mt-0.5 mb-6">Global Scope</p>
          <div className="flex-1">
            {topEvents.length > 0 ? (
              <BarChart data={topEvents} xKey="event" bars={[{ key: 'count', color: '#FBBF24', label: 'Volume' }]} horizontal height={300} showLabels labelSuffix="" yAxisWidth={200} />
            ) : (
              <div className="h-full flex items-center justify-center text-[11px] font-bold text-[#94A3B8]">No event data</div>
            )}
          </div>
        </div>

        <div className="card p-6 flex flex-col min-h-[400px]">
          <p className="text-[15px] font-black text-[#111827]">Reliability: All Services</p>
          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mt-0.5 mb-6">Service health ranking</p>
          <div className="flex-1">
            {successData.length > 0 ? (
              <BarChart data={successData} xKey="name" bars={[{ key: 'rate', color: '#10B981', label: 'Success %' }]} horizontal height={300} showLabels labelSuffix="%" yAxisWidth={220} />
            ) : (
              <div className="h-full flex items-center justify-center text-[11px] font-bold text-[#94A3B8]">No success data</div>
            )}
          </div>
        </div>
      </div>

      <ServiceDrawer
        service={selected}
        onClose={() => setSelected(null)}
        drill={selectedDrill}
      />
    </div>
  )
}
