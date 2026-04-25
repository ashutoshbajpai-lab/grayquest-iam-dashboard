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
  labelSuffix?: string
}

function CustomYAxisTick(props: any) {
  const { x, y, payload, tickFormatter } = props
  const val = String(payload.value || '')
  
  // Truncate long labels
  const displayVal = val.length > 30 ? val.slice(0, 27) + '...' : val

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-10}
        y={0}
        dy={4}
        textAnchor="end"
        fill="#64748B"
        fontSize={10}
        fontWeight={800}
        className="uppercase tracking-tight"
      >
        {tickFormatter ? tickFormatter(displayVal) : displayVal}
      </text>
    </g>
  )
}

export default function BarChart({
  data, bars, xKey, height = 220,
  horizontal = false, formatX, formatY, showLabels = false, yAxisWidth = 220,
  labelSuffix = '',
}: Props) {
  const tooltipStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    fontSize: '11px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    color: '#111827',
  }

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartBar 
          data={data} 
          layout="vertical" 
          margin={{ top: 5, right: 40, bottom: 5, left: 0 }}
        >
          <XAxis type="number" hide domain={[0, 'dataMax + 10']} />
          <YAxis
            type="category"
            dataKey={xKey}
            tick={<CustomYAxisTick tickFormatter={formatX} />}
            tickLine={false}
            axisLine={false}
            width={yAxisWidth}
            interval={0}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: '#F1F5F9', opacity: 0.4 }}
          />
          {bars.map(b => (
            <Bar 
              key={b.key} 
              dataKey={b.key} 
              name={b.label || b.key} 
              fill={b.color} 
              radius={[0, 4, 4, 0]} 
              barSize={12}
            >
              {showLabels && (
                <LabelList 
                  dataKey={b.key} 
                  position="right" 
                  style={{ fill: '#111827', fontSize: 10, fontWeight: 900 }} 
                  formatter={v => v ? `${v}${labelSuffix}` : ''} 
                  offset={8}
                />
              )}
            </Bar>
          ))}
        </RechartBar>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartBar data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={formatX} />
        <YAxis tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={formatY} />
        <Tooltip contentStyle={tooltipStyle} />
        {bars.map(b => (
          <Bar key={b.key} dataKey={b.key} name={b.label || b.key} fill={b.color} radius={[4, 4, 0, 0]} barSize={24} />
        ))}
      </RechartBar>
    </ResponsiveContainer>
  )
}
