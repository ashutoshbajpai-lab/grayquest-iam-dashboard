'use client'

import { KPICardProps } from '@/types'

export default function KPICard({
  title, value, subtitle, trend,
  icon, description
}: KPICardProps) {
  const trendPositive = trend !== undefined && trend >= 0

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-[0_8px_32px_rgba(100,116,180,0.16)] hover:-translate-y-0.5 transition-all duration-300 group/card">
      {/* Top: label + icon chip */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.08em] leading-tight truncate">{title}</p>
          {description && (
            <div className="relative group/info flex items-center cursor-help">
              <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 hover:stroke-[#6366F1] transition-colors">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2.5 bg-[#111827] text-white text-[10px] font-bold rounded-xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 shadow-xl pointer-events-none text-center leading-relaxed">
                {description}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111827]" />
              </div>
            </div>
          )}
        </div>
        {icon && (
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(79,110,247,0.15) 0%, rgba(124,58,237,0.1) 100%)' }}>
            <span className="text-[#4F6EF7] group-hover/card:scale-110 transition-transform">{icon}</span>
          </div>
        )}
      </div>

      {/* Value + trend badge inline */}
      <div className="flex items-baseline gap-2 flex-wrap min-w-0">
        <span 
          className="font-black leading-tight tracking-tight text-[#111827] whitespace-normal break-words w-full"
          style={{ fontSize: String(value).length > 14 ? '1.35rem' : '2.1rem' }}
          title={String(value)}
        >
          {value}
        </span>
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
            trendPositive
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-rose-50 text-rose-500'
          }`}>
            <span>{trendPositive ? '↗' : '↘'}</span>
            {trendPositive ? '+' : ''}{trend}%
          </span>
        )}
      </div>

      {/* Supporting text */}
      {subtitle && (
        <p className="text-[12px] text-[#6B7280] leading-snug -mt-1">{subtitle}</p>
      )}
    </div>
  )
}
