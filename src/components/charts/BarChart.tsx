'use client'

import {
  ResponsiveContainer, BarChart as RechartBar, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts'
import { useChartColors } from '@/hooks/useChartColors'

interface Props {
  data: Record<string, unknown>[]
  bars: { key: string; color: string; label?: string }[]
  xKey: string
  height?: number
  horizontal?: boolean
  formatX?: (v: string) => string
  formatY?: (v: number) => string
  showLabels?: boolean
  yAxisWidth?: number
}

export default function BarChart({
  data, bars, xKey, height = 220,
  horizontal = false, formatX, formatY, showLabels = false, yAxisWidth,
}: Props) {
  const c = useChartColors()

  const tooltipStyle = {
    backgroundColor: c.tooltipBg,
    border: `1px solid ${c.tooltipBorder}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: c.tooltipText,
  }

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartBar data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
          <XAxis type="number" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatY} />
          <YAxis type="category" dataKey={xKey} tick={{ fill: c.label, fontSize: 11 }} tickLine={false} axisLine={false} width={yAxisWidth ?? 120} tickFormatter={formatX} />
          <Tooltip contentStyle={tooltipStyle} />
          {bars.map(b => (
            <Bar key={b.key} dataKey={b.key} name={b.label || b.key} fill={b.color} radius={[0, 4, 4, 0]} maxBarSize={20}>
              {showLabels && <LabelList dataKey={b.key} position="right" style={{ fill: c.label, fontSize: 11 }} />}
            </Bar>
          ))}
        </RechartBar>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartBar data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatX} />
        <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatY} />
        <Tooltip contentStyle={tooltipStyle} />
        {bars.map(b => (
          <Bar key={b.key} dataKey={b.key} name={b.label || b.key} fill={b.color} radius={[3, 3, 0, 0]} maxBarSize={32} />
        ))}
      </RechartBar>
    </ResponsiveContainer>
  )
}
