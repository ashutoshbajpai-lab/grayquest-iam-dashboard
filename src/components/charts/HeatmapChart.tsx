'use client'

interface Cell { x: string; y: string | number; value: number }

interface Props {
  data: Cell[]
  xLabel?: string
  yLabel?: string
  colorHigh?: string
  height?: number
  formatValue?: (v: number) => string
  onRowClick?: (y: string) => void
  activeRow?: string | null
  rowOrder?: string[]  // if provided, overrides alphabetical sort; entries starting with § are section headers
}

function interpolate(min: number, max: number, v: number): number {
  if (max === min) return 0.5
  return (v - min) / (max - min)
}

export default function HeatmapChart({
  data, xLabel, yLabel,
  colorHigh = '#7C6FF7',
  formatValue = String,
  onRowClick,
  activeRow,
  rowOrder,
}: Props) {
  let xs = Array.from(new Set(data.map(d => d.x))).sort((a, b) => Number(a) - Number(b))
  
  // Force a continuous 24-hour sequence if this is an hourly heatmap
  if (xLabel === 'Hour') {
    xs = Array.from({ length: 24 }, (_, i) => String(i))
  } else if (xs.length > 0 && !isNaN(Number(xs[0]))) {
    // Fill in gaps for other continuous numeric sequences
    const nums = xs.map(Number)
    const minX = Math.min(...nums)
    const maxX = Math.max(...nums)
    if (maxX - minX < 100) {
      xs = Array.from({ length: maxX - minX + 1 }, (_, i) => String(minX + i))
    }
  }
  const dataYs = Array.from(new Set(data.map(d => String(d.y))))
  // If rowOrder provided, use it (§-prefixed entries are section headers); else sort alphabetically
  const ys = rowOrder
    ? rowOrder.filter(r => r.startsWith('§') || dataYs.includes(r))
    : dataYs.sort()

  const vals = data.map(d => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)

  const lookup = new Map(data.map(d => [`${d.x}__${d.y}`, d.value]))

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {yLabel && <p className="text-xs text-txt-muted mb-2">{yLabel}</p>}
        <div className="flex gap-1">
          {/* Y axis labels */}
          <div className="flex flex-col gap-1 pr-1">
            {ys.map(y => {
              if (y.startsWith('§')) {
                const label = y.slice(1)
                return (
                  <div key={y} className="flex items-center h-5 mt-1">
                    <span className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider w-36 text-right pr-1">{label}</span>
                  </div>
                )
              }
              return (
                <div
                  key={y}
                  onClick={() => onRowClick?.(y)}
                  className={`flex items-center h-7 ${onRowClick ? 'cursor-pointer hover:text-accent' : ''} transition-colors`}
                >
                  <span className={`text-xs w-36 text-right truncate transition-colors ${activeRow === y ? 'text-accent font-semibold' : 'text-txt-muted'}`}>
                    {y}
                  </span>
                  {onRowClick && (
                    <span className={`ml-1 text-[10px] transition-opacity ${activeRow === y ? 'text-accent opacity-100' : 'text-txt-muted opacity-0 group-hover:opacity-60'}`}>
                      {activeRow === y ? '▸' : '›'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Grid */}
          <div className="flex flex-col gap-1">
            {ys.map(y => {
              if (y.startsWith('§')) {
                return <div key={y} className="h-5 mt-1 border-b border-bg-border/60" />
              }
              return (
                <div
                  key={y}
                  className={`flex gap-1 rounded transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${activeRow === y ? 'ring-1 ring-accent/40' : ''}`}
                  onClick={() => onRowClick?.(y)}
                >
                  {xs.map(x => {
                    const v = lookup.get(`${x}__${y}`)
                    const t = v !== undefined ? interpolate(min, max, v) : 0
                    const opacity = v !== undefined ? 0.1 + t * 0.9 : 0.04
                    return (
                      <div
                        key={x}
                        title={v !== undefined ? `${y} @ ${x}:00 — ${formatValue(v)}` : `${y} @ ${x}:00 — no activity`}
                        className="w-7 h-7 rounded flex items-center justify-center transition-opacity"
                        style={{ backgroundColor: colorHigh, opacity }}
                      >
                        {v !== undefined && v > 0 && (
                          <span className="text-white text-[9px] font-medium leading-none select-none">
                            {v > 99 ? '99+' : v}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* X axis labels */}
            <div className="flex gap-1 mt-1">
              {xs.map(x => (
                <span key={x} className="w-7 text-center text-[10px] text-txt-muted">{x}</span>
              ))}
            </div>
            {xLabel && <p className="text-xs text-txt-muted mt-1 text-center">{xLabel}</p>}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-txt-muted">Low</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(o => (
              <div key={o} className="w-4 h-3 rounded-sm" style={{ backgroundColor: colorHigh, opacity: o }} />
            ))}
          </div>
          <span className="text-[10px] text-txt-muted">High</span>
          {onRowClick && (
            <span className="text-[10px] text-txt-muted ml-3">Click a row to drill into event breakdown</span>
          )}
        </div>
      </div>
    </div>
  )
}
