'use client'

import DrillDownDrawer from '@/components/layout/DrillDownDrawer'
import BarChart from '@/components/charts/BarChart'
import LineChart from '@/components/charts/LineChart'

interface ServiceFailure {
  service: string
  failed: number
  failures?: number
  total: number
  volume?: number
  rate: number
}

interface EventFailure {
  event: string
  failed: number
  failures?: number
  total: number
  volume?: number
  rate: number
}

interface AffectedUser {
  user_email: string
  user_id: string
  event: string
  failed_at: string
  comment: string
}

interface Props {
  service: ServiceFailure | null
  allEventFailures: EventFailure[]
  recentlyFailed?: Record<string, AffectedUser[]>
  onClose: () => void
}

export default function FailureDrawer({ service, allEventFailures, recentlyFailed, onClose }: Props) {
  if (!service) return null

  const events = (allEventFailures.length > 0 ? allEventFailures.slice(0, 8) : []) as unknown as Record<string, unknown>[]
  
  // NOTE: No mock failure series generation as per strict "no mock data" requirement.
  // We use the event breakdown and affected users list which are backed by real data.
  
  const allAffected = recentlyFailed?.[service.service] ?? []
  const affectedUsers = allAffected

  return (
    <DrillDownDrawer
      open={!!service}
      onClose={onClose}
      title={`${service.service} — Failure Analysis`}
      breadcrumbs={[{ label: 'Platform Health', onClick: onClose }]}
    >
      <div className="space-y-8">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/90 p-4 rounded-2xl border border-white/60 shadow-sm">
            <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">Failed Events</p>
            <p className="text-[20px] font-black text-[#EF4444]">{(service.failures ?? service.failed ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/90 p-4 rounded-2xl border border-white/60 shadow-sm">
            <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">Total Volume</p>
            <p className="text-[20px] font-black text-[#111827]">{(service.total ?? service.volume ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/90 p-4 rounded-2xl border border-white/60 shadow-sm">
            <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-1">Failure Rate</p>
            <p className="text-[20px] font-black text-[#EF4444]">{service.rate}%</p>
          </div>
        </div>

        {/* Event breakdown */}
        {events.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-[13px] font-black text-[#475569] uppercase tracking-wider">Failure Rate by Event</h4>
            <div className="space-y-3">
              {events.map((e, i) => {
                const rate = Number((e as any).failure_rate ?? e.rate ?? 0)
                const failed = Number(e.failed ?? 0)
                const total = Number(e.total ?? 0)
                const event = String(e.event ?? '')
                return (
                  <div key={`${event}-${i}`} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[11px] font-black text-[#111827] truncate max-w-[200px]">{event}</span>
                      <span className={`text-[11px] font-black ${rate > 10 ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>{rate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#EF4444]"
                          style={{ width: `${Math.min(rate, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-[#94A3B8] w-16 text-right whitespace-nowrap">{failed}/{total}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Failed Event Volume Bar */}
        {events.some(e => Number(e.failed ?? 0) > 0) && (
          <div className="space-y-4">
            <h4 className="text-[13px] font-black text-[#475569] uppercase tracking-wider">Failed Event Volume</h4>
            <BarChart
              data={events.filter(e => Number(e.failed ?? 0) > 0)}
              xKey="event"
              bars={[{ key: 'failed', color: '#EF4444', label: 'Failed' }]}
              horizontal
              height={Math.max(120, events.filter(e => Number(e.failed ?? 0) > 0).length * 40)}
              showLabels
              yAxisWidth={140}
            />
          </div>
        )}

        {/* Recently Affected Users */}
        <div className="space-y-4">
          <h4 className="text-[13px] font-black text-[#475569] uppercase tracking-wider">Recently Affected Users</h4>
          {(affectedUsers?.length ?? 0) === 0 ? (
            <div className="py-10 text-center bg-white/40 rounded-2xl border border-dashed border-white/60">
              <p className="text-[11px] font-bold text-[#94A3B8]">No individual failed event records found in the current window.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/50">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-white/70 border-b border-white/60">
                      <th className="px-4 py-3 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Event</th>
                      <th className="px-4 py-3 text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {affectedUsers.slice(0, 20).map((u, i) => (
                      <tr key={i} className="hover:bg-white/40 transition-colors group">
                        <td className="px-4 py-2.5 text-[11px] font-black text-[#111827] truncate max-w-[150px]">{u.user_email}</td>
                        <td className="px-4 py-2.5 text-[11px] font-bold text-[#64748B] truncate max-w-[150px]">{u.event}</td>
                        <td className="px-4 py-2.5 text-[10px] font-black text-[#94A3B8] whitespace-nowrap uppercase">{u.failed_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DrillDownDrawer>
  )
}
