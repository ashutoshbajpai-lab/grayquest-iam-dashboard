import { NextRequest, NextResponse } from 'next/server'
import { getPeopleData, getServicesData, getHealthData, getSessionStats } from '@/lib/data'
import { AI, COMPANY_NAME, PLATFORM_ID, HEALTH, geminiUrl } from '@/lib/config'
import { ROLE_OPTIONS, SERVICE_NAMES } from '@/lib/constants'
import { requireApiAuth } from '@/lib/apiAuth'

// ── Types ────────────────────────────────────────────────────────
interface ServiceRow {
  service_name: string
  events_30d: number
  success_rate: number
  active_users_30d: number
  has_reports: boolean
  report_count_30d: number
  report_export_rate: number
  trend: number
}

interface UserRow {
  name: string
  role: string
  health_score: number
  sessions_30d: number
}

// ── Data helpers ─────────────────────────────────────────────────
function safeDiv(num: number, den: number, scale = 1): string {
  if (!den || !isFinite(den)) return '0'
  return ((num / den) * scale).toFixed(1)
}

async function loadData() {
  const p  = await getPeopleData()  as Record<string, unknown>
  const sv = await getServicesData() as Record<string, unknown>
  const h  = await getHealthData()  as Record<string, unknown>
  const ss = await getSessionStats() as Record<string, unknown>

  const overview  = (p.overview  as Record<string, unknown>).kpis  as Record<string, number>
  const healthK   = (h.health    as Record<string, unknown>).kpis  as Record<string, number>
  const sessionK  = (ss as Record<string, unknown>).kpis            as Record<string, number>
  const services  = ((sv.services as Record<string, unknown>).services as ServiceRow[])
  const users     = ((p.users    as Record<string, unknown>).users  as UserRow[])

  return { overview, healthK, sessionK, services, users }
}

// ── Role / service name extractors ───────────────────────────────
function extractRole(f: string): string | null {
  for (const role of ROLE_OPTIONS) {
    if (f.includes(role.toLowerCase())) return role
  }
  return null
}

function extractService(f: string): string | null {
  // Sort longest first so "Student Fee Headers" matches before "Student"
  const sorted = [...SERVICE_NAMES].sort((a, b) => b.length - a.length)
  for (const svc of sorted) {
    if (f.includes(svc.toLowerCase())) return svc
  }
  return null
}

// ── Builtin evaluator — SPECIFIC patterns first, generic last ───
async function evaluateBuiltin(formula: string): Promise<string | null> {
  const f = formula.toLowerCase().trim()
  const { overview, healthK, sessionK, services, users } = await loadData()

  // ── ROLE-BASED QUERIES ───────────────────────────────────────────
  const role = extractRole(f)
  if (role) {
    const roleUsers = users.filter(u => u.role === role)

    // Role + health score
    if (f.includes('health') || f.includes('score')) {
      if (!roleUsers.length) return `No ${role} users found in last 30 days`
      const avg = roleUsers.reduce((a, u) => a + u.health_score, 0) / roleUsers.length
      return `${avg.toFixed(1)} avg health score for ${roleUsers.length} ${role} user${roleUsers.length !== 1 ? 's' : ''}`
    }

    // Role + sessions
    if (f.includes('session')) {
      if (!roleUsers.length) return `No ${role} users found`
      const total = roleUsers.reduce((a, u) => a + u.sessions_30d, 0)
      const avg   = total / roleUsers.length
      return `${avg.toFixed(1)} avg sessions for ${roleUsers.length} ${role} users (${total} total sessions, 30d)`
    }

    // Role + top users
    if (f.includes('top') || f.includes('most active') || f.includes('highest')) {
      const n   = f.match(/\d+/)?.[0] ? parseInt(f.match(/\d+/)![0]) : 3
      const top = [...roleUsers].sort((a, b) => b.sessions_30d - a.sessions_30d).slice(0, Math.min(n, 10))
      if (!top.length) return `No ${role} users found`
      return top.map((u, i) => `${i + 1}. ${u.name} (${u.sessions_30d} sessions)`).join(', ')
    }

    // Role + count (default for role queries)
    return `${roleUsers.length} ${role} user${roleUsers.length !== 1 ? 's' : ''} active in last 30 days`
  }

  // ── SERVICE-BASED QUERIES ────────────────────────────────────────
  const svc = extractService(f)
  if (svc) {
    const svcData = services.find(s => s.service_name.toLowerCase() === svc.toLowerCase())
    if (!svcData) return `Service "${svc}" not found in data`

    // Service + success / failure rate
    if (f.includes('fail') || f.includes('error')) {
      const failRate = (100 - svcData.success_rate).toFixed(1)
      return `${failRate}% failure rate for ${svcData.service_name} (${svcData.success_rate}% success, ${svcData.events_30d} events in 30d)`
    }
    if (f.includes('success') || f.includes('rate')) {
      return `${svcData.success_rate}% success rate for ${svcData.service_name} (${svcData.events_30d} events, ${svcData.active_users_30d} users in 30d)`
    }

    // Service + events / volume
    if (f.includes('event') || f.includes('volume') || f.includes('usage')) {
      return `${svcData.events_30d} events from ${svcData.active_users_30d} users on ${svcData.service_name} in last 30d (trend: ${svcData.trend > 0 ? '+' : ''}${svcData.trend}%)`
    }

    // Service + users
    if (f.includes('user') || f.includes('active')) {
      return `${svcData.active_users_30d} active users on ${svcData.service_name} in last 30d`
    }

    // Default service summary
    return `${svcData.service_name}: ${svcData.events_30d} events, ${svcData.success_rate}% success, ${svcData.active_users_30d} users (30d)`
  }

  // ── 1. DAU / MAU Ratio ──────────────────────────────────────────
  if ((f.includes('dau') && f.includes('mau')) ||
      (f.includes('daily') && f.includes('monthly'))) {
    const dau = overview.active_users_today ?? 0
    const mau = overview.active_users_30d   ?? 0
    if (!mau) return 'Insufficient data (MAU = 0)'
    return `${safeDiv(dau, mau, 100)}% DAU/MAU ratio (${dau} daily active / ${mau} monthly active)`
  }

  // ── 2. Failure Rate ─────────────────────────────────────────────
  if (f.includes('fail') && (f.includes('rate') || f.includes('/'))) {
    const failed = healthK.failed_events_30d ?? 0
    const total  = healthK.total_events_30d  ?? overview.total_events_30d ?? 0
    if (!total) return 'Insufficient data (no events recorded)'
    return `${safeDiv(failed, total, 100)}% failure rate (${failed} failed of ${total.toLocaleString()} total events)`
  }

  // ── 3. % High-Health Users (must come before generic health_score) ─
  if ((f.includes('high') || f.includes('>= 75') || f.includes('>= 70') || f.includes('above')) && f.includes('health')) {
    const threshold = HEALTH.ACTIVE
    const highCount = users.filter(u => u.health_score >= threshold).length
    const active    = overview.active_users_30d ?? 0
    if (!active) return 'Insufficient data'
    return `${safeDiv(highCount, active, 100)}% (${highCount} of ${active} active users have health score ≥ ${threshold})`
  }

  // ── 4. Avg Events per Active User (before generic total events) ──
  if ((f.includes('avg') || f.includes('average') || f.includes('per user')) && f.includes('event')) {
    const total  = overview.total_events_30d ?? 0
    const active = overview.active_users_30d ?? 0
    if (!active) return 'Insufficient data'
    return `${(total / active).toFixed(1)} avg events per active user (${total.toLocaleString()} events / ${active} users, 30d)`
  }

  // ── 5. Report Export Efficiency ──────────────────────────────────
  if (f.includes('report') && (f.includes('export') || f.includes('effici'))) {
    const withReports    = services.filter(s => s.has_reports && s.report_count_30d > 0)
    const totalReports   = withReports.reduce((s, x) => s + x.report_count_30d, 0)
    const totalExported  = withReports.reduce((s, x) => s + Math.round(x.report_count_30d * x.report_export_rate / 100), 0)
    if (!totalReports) return 'Insufficient data (no reports generated)'
    const weightedRate   = (totalExported / totalReports * 100).toFixed(1)
    return `${weightedRate}% report export rate across ${withReports.length} services (${totalExported} exported of ${totalReports} total reports)`
  }

  // ── 6. Session Engagement Score (before generic session/completion) ─
  if (f.includes('engagement') ||
      (f.includes('events_per_session') || f.includes('events per session')) && f.includes('completion')) {
    const eps  = sessionK.avg_events_per_session ?? 0
    const comp = sessionK.completion_rate        ?? overview.completion_rate ?? 0
    const score = (eps * comp / 100)
    return `${score.toFixed(2)} session engagement score (${eps} avg events/session × ${comp}% completion rate / 100)`
  }

  // ── 7. Cross-Module Rate ─────────────────────────────────────────
  if (f.includes('cross') || (f.includes('span') && f.includes('service')) || f.includes('multi.*module')) {
    const rate = overview.cross_module_rate ?? sessionK.cross_module_rate ?? 0
    return `${rate}% of sessions span 3+ services (cross-module rate, 30d)`
  }

  // ── 8. Top Service by Success Rate (before generic success rate) ──
  if ((f.includes('top') || f.includes('highest') || f.includes('best')) &&
      (f.includes('success') || f.includes('service'))) {
    const top = [...services].sort((a, b) => b.success_rate - a.success_rate)[0]
    if (!top) return 'No service data'
    return `${top.service_name} — ${top.success_rate}% success rate (highest of ${services.length} services)`
  }

  // ── Generic / single-value lookups (kept for free-form queries) ──

  if (f.includes('dau') || f.includes('daily active'))
    return `${overview.active_users_today} users active today (DAU)`

  if (f.includes('mau') || f.includes('monthly active'))
    return `${overview.active_users_30d} users active in last 30 days (MAU)`

  if (f.includes('success rate') || f.includes('success_rate'))
    return `${overview.overall_success_rate}% overall success rate (30d)`

  if (f.includes('health score') || f.includes('health_score'))
    return `Average health score: ${overview.avg_health_score}/100 across ${overview.active_users_30d} active users`

  if (f.includes('session') && f.includes('completion'))
    return `Session completion rate: ${overview.completion_rate}%`

  if (f.includes('dormant')) {
    const pct = safeDiv(overview.dormant_users, overview.total_users, 100)
    return `${overview.dormant_users} dormant users (${pct}% of ${overview.total_users.toLocaleString()} total)`
  }

  // ── 9. Top users by session count ───────────────────────────────
  if ((f.includes('top') || f.includes('most')) && (f.includes('user') || f.includes('session'))) {
    const n = f.match(/\d+/)?.[0] ? parseInt(f.match(/\d+/)![0]) : 3
    const top = [...users].sort((a, b) => b.sessions_30d - a.sessions_30d).slice(0, Math.min(n, 10))
    return top.map((u, i) => `${i + 1}. ${u.name} (${u.sessions_30d} sessions)`).join(', ')
  }

  // ── 10. Who is active / user names active today ──────────────────
  if ((f.includes('who') || f.includes('user name') || f.includes('which user') || f.includes('name')) &&
      (f.includes('active') || f.includes('today') || f.includes('current'))) {
    const dau = overview.active_users_today ?? 0
    const top = [...users].sort((a, b) => b.sessions_30d - a.sessions_30d).slice(0, dau || 5)
    if (!top.length) return `${dau} users active today (no name data available in snapshot)`
    return `${dau} user${dau !== 1 ? 's' : ''} active today. Most active (30d): ${top.map(u => u.name).join(', ')}`
  }

  // ── 11. Lowest health users / at-risk ────────────────────────────
  if ((f.includes('low') || f.includes('worst') || f.includes('at risk') || f.includes('below')) && f.includes('health')) {
    const n = f.match(/\d+/)?.[0] ? parseInt(f.match(/\d+/)![0]) : 5
    const bottom = [...users].sort((a, b) => a.health_score - b.health_score).slice(0, Math.min(n, 10))
    return bottom.map((u, i) => `${i + 1}. ${u.name} (score: ${u.health_score})`).join(', ')
  }

  // ── 12. Failure / error rate by service ─────────────────────────
  if ((f.includes('worst') || f.includes('highest fail') || f.includes('most fail')) && f.includes('service')) {
    const worst = [...services].sort((a, b) => a.success_rate - b.success_rate)[0]
    if (!worst) return 'No service data'
    return `${worst.service_name} — ${(100 - worst.success_rate).toFixed(1)}% failure rate (lowest success rate of ${services.length} services)`
  }

  // ── 13. Total users / user count ────────────────────────────────
  if ((f.includes('total') || f.includes('how many') || f.includes('count')) && f.includes('user'))
    return `${overview.total_users?.toLocaleString() ?? 0} total users (${overview.active_users_30d} active in last 30d, ${overview.dormant_users} dormant)`

  // ── 14. Avg session duration ────────────────────────────────────
  if (f.includes('session') && (f.includes('duration') || f.includes('length') || f.includes('long')))
    return `Average session duration: ${overview.avg_session_duration_min ?? 0} minutes (30d)`

  // ── 15. Login success rate ──────────────────────────────────────
  if (f.includes('login') && (f.includes('rate') || f.includes('success') || f.includes('%')))
    return `${healthK.login_success_rate ?? 0}% login success rate (30d)`

  // LAST: broad total-events match — kept after specific patterns
  if ((f.includes('total') || f.includes('sum')) && f.includes('event'))
    return `${overview.total_events_30d.toLocaleString()} total events in last 30 days`

  if (f.includes('top service') || f.includes('most used')) {
    const top = [...services].sort((a, b) => b.events_30d - a.events_30d)[0]
    return top ? `${top.service_name} — ${top.events_30d} events (most active by volume, 30d)` : 'No service data available'
  }

  return null
}

// ── AI data summary (comprehensive) ─────────────────────────────
async function buildDataSummary(): Promise<string> {
  const { overview, healthK, sessionK, services, users } = await loadData()

  const svcList = services.map(s =>
    `${s.service_name}(events:${s.events_30d},success:${s.success_rate}%,users:${s.active_users_30d}` +
    (s.has_reports ? `,reports:${s.report_count_30d},export_rate:${s.report_export_rate}%` : '') + `)`
  ).join(', ')

  const userList = users.map(u =>
    `${u.name}(role:${u.role},health:${u.health_score},sessions:${u.sessions_30d})`
  ).join('; ')

  return `${COMPANY_NAME} IAM Dashboard — platform_id=${PLATFORM_ID}, data period: last 30 days.
OVERVIEW: active_users_today=${overview.active_users_today}, active_users_30d=${overview.active_users_30d}, total_users=${overview.total_users}, dormant_users=${overview.dormant_users}, avg_health_score=${overview.avg_health_score}, overall_success_rate=${overview.overall_success_rate}%, total_sessions_30d=${overview.total_sessions_30d}, total_events_30d=${overview.total_events_30d}, completion_rate=${overview.completion_rate}%, cross_module_rate=${overview.cross_module_rate}%, avg_session_duration_min=${overview.avg_session_duration_min}, shallow_session_pct=${overview.shallow_session_pct}%.
HEALTH: failed_events_30d=${healthK.failed_events_30d}, login_success_rate=${healthK.login_success_rate}%, api_error_rate=${healthK.api_error_rate}%.
SESSIONS: avg_events_per_session=${sessionK.avg_events_per_session}, avg_duration_min=${sessionK.avg_duration_min}, bounce_rate=${sessionK.bounce_rate}%.
SERVICES: ${svcList}.
USERS (${users.length} active): ${userList}.`
}

// ── AI callers ────────────────────────────────────────────────────
// Gemini is primary (smarter for formula computation + knows industry formulas)
async function callGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  try {
    const res = await fetch(geminiUrl(key), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal:  AbortSignal.timeout(AI.COMPUTE_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch {
    return null
  }
}

// Ollama is fallback — always uses /api/generate (not /api/chat)
async function callOllama(prompt: string): Promise<string | null> {
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b'
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, prompt, stream: false }),
      signal:  AbortSignal.timeout(AI.COMPUTE_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.response?.trim() ?? null
  } catch {
    return null
  }
}

// ── Route handler ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req)
  if (authError) return authError

  const body = await req.json() as { name: string; description: string; formula: string }
  const { name, description, formula } = body

  if (!formula?.trim()) {
    return NextResponse.json({ error: 'Formula is required' }, { status: 400 })
  }

  // Try builtin first (instant, accurate)
  const builtin = await evaluateBuiltin(formula)
  if (builtin) {
    return NextResponse.json({ result: builtin, source: 'builtin' })
  }

  // AI fallback — Gemini primary (smarter for formula + industry knowledge), Ollama fallback
  const dataSummary = await buildDataSummary()
  const prompt = `You are a data analyst for GrayQuest, an Indian educational fee-collection platform. Compute the requested metric using ONLY the data provided.

DATA (use only these numbers — do not hallucinate):
${dataSummary}

METRIC REQUEST:
Name: ${name}
Description: ${description || 'N/A'}
Formula/Query: "${formula}"

RULES:
- If this is a known formula (DAU/MAU, retention, etc.), explain the formula briefly then compute it
- Respond with the computed result in max ${AI.MAX_RESULT_WORDS} words
- Show calculation: e.g. "40% (6 of 15 users)" or "57 users (28.1% of 203 active)"
- If data is insufficient, say "Insufficient data: [specific reason]"
- No markdown headers, no long explanations`

  const result = (await callGemini(prompt)) ?? (await callOllama(prompt))

  if (!result) {
    return NextResponse.json({
      result: 'AI service unavailable — start Ollama (`OLLAMA_NEW_ENGINE=false ollama serve`) or add GEMINI_API_KEY to .env.local.',
      source: 'error',
    })
  }

  return NextResponse.json({ result, source: process.env.GEMINI_API_KEY ? 'gemini' : 'ollama' })
}
