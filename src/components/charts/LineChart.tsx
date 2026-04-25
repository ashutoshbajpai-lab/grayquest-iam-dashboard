'use client'

import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip,
} from 'recharts'

interface Props {
  data: Record<string, unknown>[]
  lines: { key: string; color: string; label: string }[]
  xKey: string
  height?: number
  formatX?: (v: string) => string
  formatY?: (v: number) => string
  formatTooltipLabel?: (v: string) => string
}

export default function LineChart({ data, lines, xKey, height = 220, formatX, formatY, formatTooltipLabel }: Props) {

  const tooltipStyle = {
    backgroundColor: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
    border: 'none',
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(100,116,180,0.18)',
    fontSize: '12px',
    color: '#111827',
    fontWeight: 500,
    padding: '10px 14px',
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: -20 }}>
        <defs>
          {lines.map(l => (
            <linearGradient key={`g-${l.key}`} id={`g-${l.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={l.color} stopOpacity={0.22} />
              <stop offset="95%" stopColor={l.color} stopOpacity={0.0} />
            </linearGradient>
          ))}
        </defs>
        <XAxis
          dataKey={xKey}
          tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatX}
          interval="preserveStartEnd"
          dy={8}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatY}
          dx={-4}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: '#6B7280', marginBottom: 4, fontWeight: 600, fontSize: 11 }}
          labelFormatter={formatTooltipLabel ? (v: unknown) => formatTooltipLabel(String(v)) : formatX ? (v: unknown) => formatX(String(v)) : undefined}
          cursor={{ stroke: 'rgba(100,116,180,0.2)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
        />
        {lines.map(l => (
          <Area
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            strokeWidth={2.5}
            fillOpacity={1}
            fill={`url(#g-${l.key})`}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: l.color }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
