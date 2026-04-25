'use client'

import { PieChart, Pie, Cell, Tooltip } from 'recharts'

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

  return (
    <div>
      {/* Chart */}
      <div className="relative flex justify-center" style={{ height }}>
        <PieChart width={220} height={height}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={1.5}
            stroke="#fff"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value} (${(((value as number)/total)*100).toFixed(1)}%)`]}
            contentStyle={{
              backgroundColor: '#ffffff',
              border: 'none',
              borderRadius: '14px',
              boxShadow: '0 8px 32px rgba(148, 163, 184, 0.18)',
              fontSize: '12px',
              color: '#0F172A',
              fontWeight: 500,
              padding: '10px 14px',
            }}
          />
        </PieChart>

        {/* Center text */}
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-[#111827] tracking-tight leading-none">{centerLabel}</span>
            {centerSub && (
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mt-2 text-center">
                {centerSub}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
