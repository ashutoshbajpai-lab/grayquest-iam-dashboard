import { NextResponse } from 'next/server'
import { getPeopleData, getHealthData, getServicesData } from '@/lib/data'
import type { Alert, Section } from '@/types'
import { HEALTH, SUCCESS_RATE, LOGIN_RATE, SESSION, PEOPLE_ALERTS, SERVICE_ALERTS, SERVICE_FAILURE_RATE } from '@/lib/config'

function makeAlert(id: string, message: string, metric: string, section: Section): Alert {
  return { id, message, metric, section, timestamp: new Date().toISOString(), dismissed: false }
}

export async function GET() {
  const p  = getPeopleData()  as Record<string, unknown>
  const h  = getHealthData()  as Record<string, unknown>
  const sv = getServicesData() as Record<string, unknown>

  const ok  = ((p.overview  as Record<string, unknown>).kpis     as Record<string, number>)
  const hk  = ((h.health    as Record<string, unknown>).kpis     as Record<string, number | string>)
  const sk  = ((h.sessions  as Record<string, unknown>).kpis     as Record<string, number | string>)
  const svs = ((sv.services as Record<string, unknown>).services as Record<string, number | string>[])

  const alerts: Alert[] = []

  // ── People alerts ──────────────────────────────────────────────
  if (ok.active_users_today < PEOPLE_ALERTS.MIN_DAU)
    alerts.push(makeAlert('a1', `Only ${ok.active_users_today} users active today — below threshold of ${PEOPLE_ALERTS.MIN_DAU}`, 'dau', 'people'))

  if (ok.avg_health_score < HEALTH.AVG_ALERT)
    alerts.push(makeAlert('a2', `Avg health score dropped to ${ok.avg_health_score} — below ${HEALTH.AVG_ALERT} threshold`, 'health_score', 'people'))

  if (ok.new_activations_30d === 0)
    alerts.push(makeAlert('a3', 'No new user activations in the last 30 days', 'new_activations', 'people'))

  const users = ((p.users as Record<string, unknown>).users as Record<string, number | string>[])
  const atRisk = users.filter(u => Number(u.health_score) < HEALTH.ALERT_LOW)
  if (atRisk.length > 0)
    alerts.push(makeAlert('a4', `${atRisk.length} user${atRisk.length > 1 ? 's' : ''} with health score below ${HEALTH.ALERT_LOW} — needs attention`, 'at_risk_users', 'people'))

  // ── Health alerts ───────────────────────────────────────────────
  if (Number(hk.overall_success_rate) < SUCCESS_RATE.ALERT)
    alerts.push(makeAlert('a5', `Overall success rate at ${hk.overall_success_rate}% — below ${SUCCESS_RATE.ALERT}% threshold`, 'success_rate', 'health'))

  if (Number(hk.login_success_rate) < LOGIN_RATE.ALERT)
    alerts.push(makeAlert('a6', `Login success rate at ${hk.login_success_rate}% — users may be locked out`, 'login_failure', 'health'))

  if (Number(sk.shallow_session_pct) > SESSION.SHALLOW_ALERT)
    alerts.push(makeAlert('a7', `${sk.shallow_session_pct}% of sessions are login-only — engagement low`, 'shallow_sessions', 'health'))

  if (Number(hk.api_error_rate) > SESSION.API_ERROR_ALERT)
    alerts.push(makeAlert('a8', `API error rate at ${hk.api_error_rate}% — above ${SESSION.API_ERROR_ALERT}% threshold`, 'api_errors', 'health'))

  // ── Services alerts ─────────────────────────────────────────────
  const lowSuccess = svs.filter(s => Number(s.success_rate) < SERVICE_FAILURE_RATE.ALERT)
  lowSuccess.forEach((s, i) =>
    alerts.push(makeAlert(`a9_${i}`, `${s.service_name} success rate at ${s.success_rate}% — below ${SERVICE_FAILURE_RATE.ALERT}%`, 'service_failure', 'services'))
  )

  const trendDown = svs.filter(s => Number(s.trend) < SERVICE_ALERTS.TREND_DROP)
  trendDown.forEach((s, i) =>
    alerts.push(makeAlert(`a10_${i}`, `${s.service_name} usage dropped ${Math.abs(Number(s.trend))}% vs last period`, 'service_trend', 'services'))
  )

  return NextResponse.json({ alerts })
}
