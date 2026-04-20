export interface IamUser {
  user_id: number
  name: string
  email: string
  role: string
  group: string
  health_score: number
  last_active: string
  sessions_30d: number
  events_30d: number
  services_used: number
  login_success_rate: number
  status: string
  avg_session_min: number
  first_seen: string
}
