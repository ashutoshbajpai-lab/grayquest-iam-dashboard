'use client'

import { KPICardProps } from '@/types'

export default function KPICard({
  title, value, subtitle, trend, trendLabel,
  status = 'neutral', icon,
}: KPICardProps) {
  const trendPositive = trend !== undefined && trend >= 0

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-lg transition-all duration-200 hover:-translate-y-px">
      {/* Top row: label + outline icon */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-txt-muted uppercase tracking-wider leading-tight">{title}</p>
        {icon && (
          <div className="w-8 h-8 rounded-lg border border-bg-border flex items-center justify-center text-txt-muted flex-shrink-0">
            {icon}
          </div>
        )}
      </div>

      {/* Value — font scales down for long strings to prevent overflow */}
      <p className={`font-extrabold leading-tight tracking-tight text-txt-primary break-words min-h-[2.5rem] flex items-center ${
        String(value).length > 30
          ? 'text-sm'
          : String(value).length > 18
            ? 'text-lg'
            : String(value).length > 10
              ? 'text-2xl'
              : 'text-[2rem] leading-none'
      }`}>
        {value}
      </p>

      {/* Bottom row: trend + subtitle */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-bg-border">
        {trend !== undefined ? (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
            trendPositive
              ? 'text-status-success bg-status-success/10'
              : 'text-status-failure bg-status-failure/10'
          }`}>
            {trendPositive ? '↑' : '↓'} {Math.abs(trend)}%
            {trendLabel && <span className="text-txt-muted font-normal ml-1">{trendLabel}</span>}
          </span>
        ) : (
          <span />
        )}
        {subtitle && <p className="text-[11px] text-txt-muted leading-snug text-right">{subtitle}</p>}
      </div>
    </div>
  )
}
