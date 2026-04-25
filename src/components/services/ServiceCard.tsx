'use client'

import type { Service } from '@/types/services'

interface Props {
  service: Service
  onClick: (s: Service) => void
}

export default function ServiceCard({ service, onClick }: Props) {
  const isHealthy = service.success_rate >= 95
  const isWarning = service.success_rate >= 85 && service.success_rate < 95
  
  const statusColor = isHealthy ? '#10B981' : isWarning ? '#F59E0B' : '#EF4444'
  const statusBg = isHealthy ? 'bg-[#ECFDF5]' : isWarning ? 'bg-[#FFFBEB]' : 'bg-[#FEF2F2]'
  const statusText = isHealthy ? 'text-[#059669]' : isWarning ? 'text-[#D97706]' : 'text-[#DC2626]'

  return (
    <div
      onClick={() => onClick(service)}
      className="card p-5 cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 group bg-white/80 backdrop-blur-xl border border-white/60"
    >
      {/* Header Row */}
      <div className="flex justify-between items-start mb-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-black text-[#111827] group-hover:text-[#6366F1] transition-colors truncate">
            {service.service_name}
          </h3>
          <p className="text-[11px] text-[#9CA3AF] font-bold mt-0.5">
            {service.active_users_30d.toLocaleString()} active users
          </p>
        </div>
        <div className={`px-2 py-0.5 rounded-md ${statusBg} ${statusText} text-[11px] font-extrabold border border-current/10`}>
          {service.success_rate}%
        </div>
      </div>

      {/* Progress Bar (Matching Image) */}
      <div className="mb-5">
        <div className="w-full h-[6px] rounded-full bg-[#F1F5F9] overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-700 ease-out" 
            style={{ width: `${service.success_rate}%`, backgroundColor: statusColor }}
          />
        </div>
      </div>

      {/* Volume Section */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col">
          <span className="text-[12px] font-black text-[#111827]">{service.events_30d.toLocaleString()}</span>
          <span className="text-[9px] text-[#9CA3AF] uppercase font-black tracking-wider">Events</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[12px] font-black text-[#111827]">Peak {service.peak_hour}:00</span>
          <span className="text-[9px] text-[#9CA3AF] uppercase font-black tracking-wider">Daily High</span>
        </div>
      </div>

      {/* Tags / Actions (Matching Image) */}
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-50 mt-1">
        {service.top_events.slice(0, 2).map(e => (
          <button 
            key={e} 
            className="text-[10px] font-bold text-[#6366F1] bg-[#F5F3FF] px-2.5 py-1 rounded-lg hover:bg-[#6366F1] hover:text-white transition-all border border-[#6366F1]/10"
          >
            {e.replace('_', ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}
