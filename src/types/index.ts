export type Section = 'people' | 'services' | 'health' | 'metrics' | 'chat'

export type StatusType = 'SUCCESS' | 'FAILED' | 'FAILURE' | 'PENDING'

export interface FilterState {
  dateRange: DateRange
  roles: string[]
  services: string[]
  statuses: StatusType[]
  hourRange: [number, number]
  search: string
}

export interface DateRange {
  preset: 'today' | '7d' | '30d' | 'custom'
  from: string
  to: string
}

export interface Alert {
  id: string
  message: string
  metric: string
  section: Section
  timestamp: string
  dismissed: boolean
}

export interface CustomMetric {
  id: string
  name: string
  description: string
  formula: string
  result: string
  pinnedTo: Section[]
  createdAt: string
}

export interface DrillDownLevel {
  id: string
  title: string
  breadcrumb: string
  section: Section
}

export interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  trendLabel?: string
  status?: 'success' | 'warning' | 'danger' | 'neutral'
  icon?: React.ReactNode
  iconBg?: string
  description?: string
}
