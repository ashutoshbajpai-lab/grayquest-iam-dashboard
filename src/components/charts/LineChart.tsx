'use client'

import {
  ResponsiveContainer, LineChart as RechartLine, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useChartColors } from '@/hooks/useChartColors'

interface Props {
  data: Record<string, unknown>[]
  lines: { key: string; color: string; label: string }[]
  xKey: string
  height?: number
  formatX?: (v: string) => string
  formatY?: (v: number) => string
}

export default function LineChart({ data, lines, xKey, height = 220, formatX, formatY }: Props) {
  const c = useChartColors()

  const tooltipStyle = {
    backgroundColor: c.tooltipBg,
    border: `1px solid ${c.tooltipBorder}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: c.tooltipText,
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartLine data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: c.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatX}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: c.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatY}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: c.label, marginBottom: 4 }}
          labelFormatter={formatX ? (v: unknown) => formatX(String(v)) : undefined}
        />
        {lines.length > 1 && (
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: 11, color: c.label, paddingTop: 8 }}
          />
        )}
        {lines.map(l => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </RechartLine>
    </ResponsiveContainer>
  )
}
