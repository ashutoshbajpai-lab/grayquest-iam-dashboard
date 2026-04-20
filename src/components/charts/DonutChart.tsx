'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useChartColors } from '@/hooks/useChartColors'

interface Slice { name: string; value: number; color: string }

interface Props {
  data: Slice[]
  height?: number
  innerRadius?: number
  outerRadius?: number
  centerLabel?: string
  centerSub?: string
}

export default function DonutChart({
  data, height = 220,
  innerRadius = 55, outerRadius = 85,
  centerLabel, centerSub,
}: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const c = useChartColors()

  return (
    <div>
      {/* Chart */}
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value} (${(((value as number)/total)*100).toFixed(1)}%)`]}
              contentStyle={{
                backgroundColor: c.tooltipBg,
                border: `1px solid ${c.tooltipBorder}`,
                borderRadius: '8px',
                fontSize: '12px',
                color: c.tooltipText,
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-semibold text-txt-primary">{centerLabel}</span>
            {centerSub && <span className="text-xs text-txt-muted">{centerSub}</span>}
          </div>
        )}
      </div>

      {/* Custom legend */}
      <div className="mt-3 flex flex-col gap-1.5">
        {data.map((slice) => (
          <div key={slice.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="text-xs text-txt-secondary truncate">{slice.name}</span>
            </div>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <span className="text-xs font-medium text-txt-primary">{slice.value}</span>
              <span className="text-xs text-txt-muted w-9 text-right">
                {((slice.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
