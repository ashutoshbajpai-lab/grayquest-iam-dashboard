export interface Service {
  service_id: number
  service_name: string
  events_30d: number
  active_users_30d: number
  success_rate: number
  avg_events_per_session: number
  top_events: string[]
  has_reports: boolean
  report_count_30d: number
  report_export_rate: number
  trend: number
  peak_hour: number
}
