'use client'

interface Step { step: string; count: number }

interface Props {
  data: Step[]
  color?: string
}

export default function FunnelChart({ data, color = '#7C6FF7' }: Props) {
  const max = data[0]?.count || 1

  return (
    <div className="space-y-2">
      {data.map((s, i) => {
        const pct = (s.count / max) * 100
        const dropPct = i > 0 ? (((data[i - 1].count - s.count) / data[i - 1].count) * 100) : null

        return (
          <div key={s.step}>
            {dropPct !== null && (
              <div className="flex items-center gap-2 py-1 px-2">
                <span className="text-[10px] text-status-failure">▼ {dropPct.toFixed(1)}% drop</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs text-txt-secondary w-20 flex-shrink-0 text-right">{s.step}</span>
              <div className="flex-1 h-8 relative flex items-center">
                <div
                  className="h-full rounded transition-all duration-500 flex items-center px-3"
                  style={{ width: `${pct}%`, minWidth: 60, backgroundColor: color, opacity: 0.2 + (i / data.length) * 0 + (pct / 100) * 0.7 }}
                />
                <span className="absolute left-3 text-xs font-medium text-txt-primary">{s.count.toLocaleString()}</span>
              </div>
              <span className="text-xs text-txt-muted w-12 flex-shrink-0">{pct.toFixed(1)}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
