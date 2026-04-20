/**
 * TypeScript metric computation engine.
 * Reads from Supabase raw_* tables and produces all 13 dx_* dashboard datasets.
 * Called by /api/recompute when Supabase webhook fires after a CSV import.
 */

import { createClient } from '@supabase/supabase-js'
import { PLATFORM_ID as CFG_PLATFORM_ID, HEALTH } from './config'

// ── Constants ──────────────────────────────────────────────────────────────
const PLATFORM_ID      = CFG_PLATFORM_ID
const SESSION_GAP_SECS = 1800
const DORMANT_DAYS     = 30
const MULTI_MODULE_MIN = 3
const REPORT_KEYWORDS  = ['report', 'export', 'download', 'summary']

// ── Types ──────────────────────────────────────────────────────────────────
interface RawUser       { id: string; email: string; parent_id?: string; is_active?: string; created_on?: string; updated_on?: string; deleted_on?: string }
interface RawActivity   { id: string; user_id: string; platform_id: string; type: string; created_on?: string }
interface RawUserGroup  { id: string; user_id: string; group_id: string; created_on?: string; updated_on?: string; deleted_on?: string }
interface RawGroup      { id: string; code?: string; name: string; description?: string; is_active?: string; created_on?: string }
interface RawService    { id: string; code?: string; slug?: string; name: string; is_active?: string; created_on?: string }
interface RawEvent      { id: string; code?: string; label: string; slug?: string; is_active?: string }
interface RawAuditLog   { id: string; code?: string; user_id: string; platform_id: string; service_id?: string; event_id?: string; type?: string; data?: unknown; comment?: string; status?: string; created_on?: string }

interface Session {
  session_id: number
  user_id:    string
  start:      Date
  end:        Date
  hour:       number
  date:       string
  week:       string
  month:      string
  login_type: string
  duration_sec: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
function parseTs(s: string | undefined | null): Date | null {
  if (!s || !s.trim()) return null
  const d = new Date(s.trim())
  return isNaN(d.getTime()) ? null : d
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }

function isoWeek(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function isoMonth(d: Date): string { return d.toISOString().slice(0, 7) }

function pct(num: number, den: number): number {
  return den ? Math.round((num / den) * 10000) / 100 : 0
}

function mapIncr<K>(m: Map<K, number>, k: K, v = 1) {
  m.set(k, (m.get(k) ?? 0) + v)
}

function mapSetAdd<K, V>(m: Map<K, Set<V>>, k: K, v: V) {
  if (!m.has(k)) m.set(k, new Set())
  m.get(k)!.add(v)
}

function mapArrPush<K, V>(m: Map<K, V[]>, k: K, v: V) {
  if (!m.has(k)) m.set(k, [])
  m.get(k)!.push(v)
}

// ── Data loading ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAllTables(sb: any) {
  const fetchAll = async <T>(table: string): Promise<T[]> => {
    const PAGE = 1000
    let rows: T[] = []
    let from = 0
    while (true) {
      const { data, error } = await sb.from(table).select('*').range(from, from + PAGE - 1)
      if (error) throw new Error(`${table}: ${error.message}`)
      if (!data || data.length === 0) break
      rows = rows.concat(data as T[])
      if (data.length < PAGE) break
      from += PAGE
    }
    return rows
  }

  const [users, activities, userGroups, groups, services, events, auditAll] = await Promise.all([
    fetchAll<RawUser>('raw_iam_users'),
    fetchAll<RawActivity>('raw_iam_activities'),
    fetchAll<RawUserGroup>('raw_iam_user_groups'),
    fetchAll<RawGroup>('raw_iam_groups'),
    fetchAll<RawService>('raw_iam_services'),
    fetchAll<RawEvent>('raw_iam_events'),
    fetchAll<RawAuditLog>('raw_audit_logs'),
  ])

  const iam   = activities.filter(r => r.platform_id === PLATFORM_ID)
  const audit = auditAll.filter(r => r.platform_id === PLATFORM_ID)
  return { users, activities, userGroups, groups, services, events, iam, audit }
}

// ── Lookup builders ───────────────────────────────────────────────────────
function buildServiceMap(services: RawService[]): Map<string, string> {
  return new Map(services.map(r => [r.id, r.name]))
}

function buildEventMap(events: RawEvent[]): Map<string, string> {
  return new Map(events.map(r => [r.id, r.label]))
}

function buildUserRoleMap(userGroups: RawUserGroup[], groups: RawGroup[]): Map<string, string[]> {
  const groupMap = new Map(groups.map(g => [g.id, g.name]))
  const m = new Map<string, string[]>()
  for (const r of userGroups) {
    if (!r.deleted_on) {
      const name = groupMap.get(r.group_id) ?? 'Unknown'
      if (!m.has(r.user_id)) m.set(r.user_id, [])
      m.get(r.user_id)!.push(name)
    }
  }
  return m
}

// ── Session builder ───────────────────────────────────────────────────────
function buildSessions(iam: RawActivity[]): { sessions: Session[]; iamWithSession: (RawActivity & { session_id: number; _ts: Date })[] } {
  const rows = iam
    .map(r => ({ ...r, _ts: parseTs(r.created_on) }))
    .filter((r): r is RawActivity & { _ts: Date } => r._ts !== null)
    .sort((a, b) => a.user_id.localeCompare(b.user_id) || a._ts.getTime() - b._ts.getTime())

  const sessions: Session[] = []
  const iamWithSession: (RawActivity & { session_id: number; _ts: Date })[] = []
  let prevUid = '', prevTs: Date | null = null
  let sid = 0
  let cur: Omit<Session, 'duration_sec'> | null = null

  for (const r of rows) {
    const uid = r.user_id, ts = r._ts
    const newSess = uid !== prevUid || (prevTs !== null && (ts.getTime() - prevTs.getTime()) / 1000 > SESSION_GAP_SECS)

    if (newSess) {
      if (cur) sessions.push({ ...cur, duration_sec: (cur.end.getTime() - cur.start.getTime()) / 1000 })
      sid++
      cur = { session_id: sid, user_id: uid, start: ts, end: ts, hour: ts.getHours(), date: isoDate(ts), week: isoWeek(ts), month: isoMonth(ts), login_type: r.type }
    }
    cur!.end = ts
    iamWithSession.push({ ...r, session_id: sid })
    prevUid = uid; prevTs = ts
  }
  if (cur) sessions.push({ ...cur, duration_sec: (cur.end.getTime() - cur.start.getTime()) / 1000 })

  return { sessions, iamWithSession }
}

function buildAuditSessions(sessions: Session[], audit: RawAuditLog[]): (RawAuditLog & { session_id: number | null; _ts: Date })[] {
  const userSess = new Map<string, Session[]>()
  for (const s of sessions) mapArrPush(userSess, s.user_id, s)

  const enriched: (RawAuditLog & { session_id: number | null; _ts: Date })[] = []
  for (const r of audit) {
    const ts = parseTs(r.created_on)
    if (!ts) continue
    const uid = r.user_id
    let sid: number | null = null
    for (const s of userSess.get(uid) ?? []) {
      const ws = s.start.getTime() - 300_000, we = s.end.getTime() + 1_800_000
      if (ts.getTime() >= ws && ts.getTime() <= we) { sid = s.session_id; break }
    }
    enriched.push({ ...r, session_id: sid, _ts: ts })
  }
  return enriched
}

// ── Health score ──────────────────────────────────────────────────────────
function computeHealthScores(iam: RawActivity[], audit: RawAuditLog[]): Map<string, number> {
  const loginCnt   = new Map<string, number>()
  const actionCnt  = new Map<string, number>()
  const userModules= new Map<string, Set<string>>()
  const reportCnt  = new Map<string, number>()

  for (const r of iam) if (r.type === 'LOGIN') mapIncr(loginCnt, r.user_id)
  for (const r of audit) {
    mapIncr(actionCnt, r.user_id)
    if (r.service_id) mapSetAdd(userModules, r.user_id, r.service_id)
    if (r.type && ['REPORT', 'REPORT-ALL-GILE'].includes(r.type)) mapIncr(reportCnt, r.user_id)
  }

  const allUsers = new Set([...loginCnt.keys(), ...actionCnt.keys()])

  function minmax(vals: Map<string, number>): Map<string, number> {
    const arr = [...allUsers].map(u => vals.get(u) ?? 0)
    const mn = Math.min(...arr), mx = Math.max(...arr)
    const res = new Map<string, number>()
    for (const u of allUsers) {
      const v = vals.get(u) ?? 0
      res.set(u, mx > mn ? (v - mn) / (mx - mn) : 0.5)
    }
    return res
  }

  const nLogin  = minmax(loginCnt)
  const nAction = minmax(actionCnt)
  const nModule = minmax(new Map([...allUsers].map(u => [u, userModules.get(u)?.size ?? 0])))
  const nReport = minmax(reportCnt)

  const scores = new Map<string, number>()
  for (const uid of allUsers) {
    const score = Math.round(((nLogin.get(uid)! + nAction.get(uid)! + nModule.get(uid)! + nReport.get(uid)!) / 4) * 1000) / 10
    scores.set(uid, score)
  }
  return scores
}

// ── Main compute function ─────────────────────────────────────────────────
export async function computeAllMetrics(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')

  const sb = createClient(url, key, { auth: { persistSession: false } })

  // ── Load data ────────────────────────────────────────────────────────
  const { users, userGroups, groups, services, events, iam, audit } = await loadAllTables(sb)

  const serviceMap  = buildServiceMap(services)
  const eventMap    = buildEventMap(events)
  const userRoleMap = buildUserRoleMap(userGroups, groups)

  const { sessions, iamWithSession: _iamWS } = buildSessions(iam)
  const auditEnriched = buildAuditSessions(sessions, audit)

  // ── Compute dataset end date dynamically ─────────────────────────────
  let maxTs = new Date('2020-01-01')
  for (const r of [...iam, ...audit]) {
    const ts = parseTs(r.created_on)
    if (ts && ts > maxTs) maxTs = ts
  }
  const TODAY = maxTs
  const D30_START  = new Date(TODAY.getTime() - 30 * 86400_000)
  const D7_START   = new Date(TODAY.getTime() - 7  * 86400_000)
  const PREV30_START = new Date(D30_START.getTime() - 30 * 86400_000)
  const PREV7_START  = new Date(D7_START.getTime()  - 7  * 86400_000)

  // ── Health scores ────────────────────────────────────────────────────
  const healthScores = computeHealthScores(iam, audit)
  const avgHealth = healthScores.size > 0
    ? Math.round([...healthScores.values()].reduce((a, b) => a + b, 0) / healthScores.size * 10) / 10
    : 0

  // ── Per-user login stats ─────────────────────────────────────────────
  const userLoginCnt   = new Map<string, number>()
  const userInvalidCnt = new Map<string, number>()
  const userLastActive = new Map<string, Date>()
  const userFirstSeen  = new Map<string, Date>()
  const active30d = new Set<string>()
  const active7d  = new Set<string>()
  const activeToday = new Set<string>()
  const activePrev30 = new Set<string>()
  const activePrev7  = new Set<string>()

  for (const r of iam) {
    const ts = parseTs(r.created_on)
    if (!ts) continue
    const uid = r.user_id
    if (r.type === 'LOGIN') {
      mapIncr(userLoginCnt, uid)
      if (!userFirstSeen.has(uid) || ts < userFirstSeen.get(uid)!) userFirstSeen.set(uid, ts)
      if (!userLastActive.has(uid) || ts > userLastActive.get(uid)!) userLastActive.set(uid, ts)
      if (ts >= D30_START) active30d.add(uid)
      if (ts >= D7_START)  active7d.add(uid)
      if (isoDate(ts) === isoDate(TODAY)) activeToday.add(uid)
      if (ts >= PREV30_START && ts < D30_START) activePrev30.add(uid)
      if (ts >= PREV7_START  && ts < D7_START)  activePrev7.add(uid)
    } else if (r.type === 'INVALID LOGIN') {
      mapIncr(userInvalidCnt, uid)
    }
  }

  // ── Per-user audit stats (30d) ───────────────────────────────────────
  const userEvents30d   = new Map<string, number>()
  const userSvcsUsed    = new Map<string, Set<string>>()
  const userReports30d  = new Map<string, number>()
  const userSess30d     = new Map<string, number>()
  const userSessDurs    = new Map<string, number[]>()

  for (const r of audit) {
    const ts = parseTs(r.created_on)
    if (!ts) continue
    if (ts >= D30_START) {
      mapIncr(userEvents30d, r.user_id)
      if (r.service_id) mapSetAdd(userSvcsUsed, r.user_id, r.service_id)
      if (r.type && ['REPORT', 'REPORT-ALL-GILE'].includes(r.type)) mapIncr(userReports30d, r.user_id)
    }
  }
  for (const s of sessions) {
    const ts = parseTs(s.date)
    if (ts && ts >= D30_START) mapIncr(userSess30d, s.user_id)
    mapArrPush(userSessDurs, s.user_id, s.duration_sec)
  }

  // ── Global event/session counts ──────────────────────────────────────
  const sessionsWithAction = new Set(auditEnriched.filter(r => r.session_id !== null).map(r => r.session_id!))
  const sessions30d   = sessions.filter(s => { const t = parseTs(s.date); return t && t >= D30_START })
  const completionSess = sessions30d.filter(s => sessionsWithAction.has(s.session_id))
  const completionRate = pct(completionSess.length, sessions30d.length)
  const shallowPct = Math.round((100 - completionRate) * 10) / 10

  let totalEvents30d = 0, totalEventsPrev = 0, success30d = 0, successPrev = 0
  for (const r of audit) {
    const ts = parseTs(r.created_on)
    if (!ts) continue
    if (ts >= D30_START) {
      totalEvents30d++
      if (r.status === 'SUCCESS') success30d++
    } else if (ts >= PREV30_START) {
      totalEventsPrev++
      if (r.status === 'SUCCESS') successPrev++
    }
  }
  const sr30d  = pct(success30d, totalEvents30d)
  const srPrev = pct(successPrev, totalEventsPrev)

  const dur30d = sessions30d.map(s => s.duration_sec)
  const avgDurMin = dur30d.length ? Math.round(dur30d.reduce((a, b) => a + b, 0) / dur30d.length / 60 * 10) / 10 : 0

  const svcPerSession = new Map<number, Set<string>>()
  for (const r of auditEnriched) {
    if (r.session_id && r.service_id) {
      if (!svcPerSession.has(r.session_id)) svcPerSession.set(r.session_id, new Set())
      svcPerSession.get(r.session_id)!.add(r.service_id)
    }
  }
  const crossModRate = pct(
    [...svcPerSession.values()].filter(s => s.size >= MULTI_MODULE_MIN).length,
    svcPerSession.size
  )
  const activeSvcs = new Set(audit.filter(r => { const t = parseTs(r.created_on); return t && t >= D30_START && r.service_id }).map(r => r.service_id!))

  const firstLoginByUser = new Map<string, Date>()
  for (const r of [...iam].sort((a, b) => (a.created_on ?? '').localeCompare(b.created_on ?? ''))) {
    if (r.type === 'LOGIN' && !firstLoginByUser.has(r.user_id)) {
      const ts = parseTs(r.created_on); if (ts) firstLoginByUser.set(r.user_id, ts)
    }
  }
  const newActivations30d = [...firstLoginByUser.values()].filter(t => t >= D30_START).length

  const trend7d  = Math.round((active7d.size  - activePrev7.size)  / Math.max(activePrev7.size, 1)  * 1000) / 10
  const trend30d = Math.round((active30d.size - activePrev30.size) / Math.max(activePrev30.size, 1) * 1000) / 10
  const trendSr  = Math.round((sr30d - srPrev) * 10) / 10

  // ════════════════════════════════════════════════════════════════
  // Build dx_ datasets
  // ════════════════════════════════════════════════════════════════

  // ── dx_overview ──────────────────────────────────────────────────────
  const dxOverview = {
    kpis: {
      active_users_30d:         active30d.size,
      active_users_7d:          active7d.size,
      active_users_today:       activeToday.size,
      dormant_users:            users.filter(u => u.is_active === '1').length - active30d.size,
      total_users:              users.length,
      new_activations_30d:      newActivations30d,
      avg_health_score:         avgHealth,
      overall_success_rate:     sr30d,
      active_services:          activeSvcs.size,
      cross_module_rate:        crossModRate,
      avg_session_duration_min: avgDurMin,
      completion_rate:          Math.round(completionRate * 10) / 10,
      shallow_session_pct:      shallowPct,
      total_events_30d:         totalEvents30d,
      total_sessions_30d:       sessions30d.length,
    },
    trends: {
      active_users_7d_vs_prev:  trend7d,
      active_users_30d_vs_prev: trend30d,
      success_rate_vs_prev:     trendSr,
      health_score_vs_prev:     0.0,
    },
  }

  // ── dx_dau_series ────────────────────────────────────────────────────
  const loginByDay    = new Map<string, Set<string>>()
  const eventsByDay   = new Map<string, number>()
  const sessionsByDay = new Map<string, number>()
  for (const r of iam) {
    if (r.type === 'LOGIN') { const ts = parseTs(r.created_on); if (ts) { const d = isoDate(ts); if (!loginByDay.has(d)) loginByDay.set(d, new Set()); loginByDay.get(d)!.add(r.user_id) } }
  }
  for (const r of audit) { const ts = parseTs(r.created_on); if (ts) mapIncr(eventsByDay, isoDate(ts)) }
  for (const s of sessions) { if (s.date) mapIncr(sessionsByDay, s.date) }
  const allDates = [...new Set([...loginByDay.keys(), ...eventsByDay.keys()])].sort()
  const dxDauSeries = { series: allDates.slice(-30).map(d => ({
    date:     d,
    dau:      loginByDay.get(d)?.size ?? 0,
    sessions: sessionsByDay.get(d) ?? 0,
    events:   eventsByDay.get(d) ?? 0,
  }))}

  // ── dx_users ─────────────────────────────────────────────────────────
  const userEmail = new Map(users.map(u => [u.id, u.email]))
  const allUids = new Set([...userLoginCnt.keys(), ...userEvents30d.keys()].filter(u => u !== ''))
  const userList = [...allUids].map(uid => {
    const email   = userEmail.get(uid) ?? `user_${uid}@grayquest.com`
    const roles   = userRoleMap.get(uid) ?? ['Unknown']
    const primary = roles[0]
    const tl      = userLoginCnt.get(uid) ?? 0
    const ti      = userInvalidCnt.get(uid) ?? 0
    const loginSr = pct(tl, tl + ti)
    const durs    = userSessDurs.get(uid) ?? [0]
    const avgS    = Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 60 * 10) / 10
    const hs      = healthScores.get(uid) ?? 0
    const lastA   = userLastActive.get(uid)
    const firstS  = userFirstSeen.get(uid)
    const status  = hs >= HEALTH.ACTIVE ? 'active' : hs >= HEALTH.AT_RISK ? 'at_risk' : 'inactive'
    const name    = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return {
      user_id:            isNaN(Number(uid)) ? uid : Number(uid),
      name,
      email,
      role:               primary,
      group:              primary,
      health_score:       hs,
      last_active:        lastA ? isoDate(lastA) : 'Never',
      sessions_30d:       userSess30d.get(uid) ?? 0,
      events_30d:         userEvents30d.get(uid) ?? 0,
      services_used:      userSvcsUsed.get(uid)?.size ?? 0,
      login_success_rate: loginSr,
      status,
      first_seen:         firstS ? isoDate(firstS) : 'Unknown',
      avg_session_min:    avgS,
    }
  }).sort((a, b) => b.health_score - a.health_score)
  const dxUsers = { users: userList }

  // ── dx_role_distribution ─────────────────────────────────────────────
  const activeUids = new Set(userList.map(u => String(u.user_id)))
  const roleUids = new Map<string, Set<string>>()
  for (const [uid, rls] of userRoleMap) {
    if (!activeUids.has(uid)) continue
    for (const r of rls) mapSetAdd(roleUids, r, uid)
  }
  const sortedRoles = [...roleUids.entries()].sort((a, b) => b[1].size - a[1].size)
  const topRoles = sortedRoles.slice(0, 9)
  const otherUids = new Set<string>()
  for (const [, uids] of sortedRoles.slice(9)) uids.forEach(u => otherUids.add(u))
  if (otherUids.size > 0) topRoles.push(['Other', otherUids])
  const roleActiveToday = new Map<string, Set<string>>()
  for (const r of iam) {
    if (r.type === 'LOGIN') { const ts = parseTs(r.created_on); if (ts && isoDate(ts) === isoDate(TODAY)) { for (const rl of userRoleMap.get(r.user_id) ?? []) mapSetAdd(roleActiveToday, rl, r.user_id) } }
  }
  const roleHs = new Map<string, number[]>()
  for (const u of userList) mapArrPush(roleHs, u.role, u.health_score)
  const totalR = topRoles.reduce((s, [, u]) => s + u.size, 0)
  const dxRoleDistribution = { roles: topRoles.map(([rl, uids]) => ({
    role:         rl,
    count:        uids.size,
    pct:          pct(uids.size, totalR),
    avg_health:   (() => { const h = roleHs.get(rl) ?? [0]; return Math.round(h.reduce((a, b) => a + b, 0) / h.length * 10) / 10 })(),
    active_today: roleActiveToday.get(rl)?.size ?? 0,
  }))}

  // ── dx_cohort_retention ──────────────────────────────────────────────
  const allLogins = new Map<string, Date[]>()
  for (const r of iam) {
    if (r.type === 'LOGIN') { const ts = parseTs(r.created_on); if (ts) mapArrPush(allLogins, r.user_id, ts) }
  }
  const cohorts = new Map<string, string[]>()
  for (const [uid, fl] of firstLoginByUser) mapArrPush(cohorts, isoMonth(fl), uid)
  const dxCohortRetention = { cohorts: [...cohorts.entries()].sort().map(([month, cohortUsers]) => {
    const cohortDt = new Date(month + '-01')
    const row: Record<string, unknown> = { month, size: cohortUsers.length }
    for (let offset = 1; offset <= 3; offset++) {
      const target = isoMonth(new Date(cohortDt.getFullYear(), cohortDt.getMonth() + offset, 1))
      const kept = cohortUsers.filter(uid => (allLogins.get(uid) ?? []).some(t => isoMonth(t) === target)).length
      row[`w${offset}`] = null
      row[offset === 1 ? 'w1' : offset === 2 ? 'm2' : 'm3'] = pct(kept, cohortUsers.length)
    }
    row['w2'] = null; row['w4'] = null
    return row
  })}

  // ── dx_service_usage ─────────────────────────────────────────────────
  const svcEv  = new Map<string, number>(); const svcUsers  = new Map<string, Set<string>>()
  const svcOk  = new Map<string, number>(); const svcTot    = new Map<string, number>()
  const svcPrev= new Map<string, number>(); const svcRep    = new Map<string, number>()
  const svcTe  = new Map<string, Map<string, number>>()
  const svcHrs = new Map<string, number[]>()
  for (const r of audit) {
    const ts = parseTs(r.created_on); if (!ts || !r.service_id) continue
    const sid = r.service_id
    if (ts >= D30_START) {
      mapIncr(svcEv, sid); mapSetAdd(svcUsers, sid, r.user_id)
      mapIncr(svcTot, sid)
      if (r.status === 'SUCCESS') mapIncr(svcOk, sid)
      if (r.type && ['REPORT','REPORT-ALL-GILE'].includes(r.type)) mapIncr(svcRep, sid)
      if (r.event_id) {
        const evLabel = eventMap.get(r.event_id) ?? r.event_id
        if (!svcTe.has(sid)) svcTe.set(sid, new Map())
        mapIncr(svcTe.get(sid)!, evLabel)
      }
      mapArrPush(svcHrs, sid, ts.getHours())
    } else if (ts >= PREV30_START) { mapIncr(svcPrev, sid) }
  }
  const svcEpsMap = new Map<string, number[]>()
  for (const r of auditEnriched) {
    if (r.service_id && r.session_id) mapArrPush(svcEpsMap, r.service_id, r.session_id)
  }
  const svcsOut = [...svcEv.entries()].map(([sid, ev]) => {
    const hrs = svcHrs.get(sid) ?? []
    const peakHr = hrs.length ? hrs.sort((a, b) => hrs.filter(h => h === b).length - hrs.filter(h => h === a).length)[0] : 0
    const te = svcTe.get(sid) ?? new Map()
    const topEvents = [...te.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e]) => e)
    const epsList = svcEpsMap.get(sid) ?? []
    const epsAvg = epsList.length ? Math.round(epsList.length / new Set(epsList).size * 10) / 10 : 1.0
    const prevEv = svcPrev.get(sid) ?? ev
    return {
      service_id:             sid,
      service_name:           serviceMap.get(sid) ?? `Service ${sid}`,
      events_30d:             ev,
      active_users_30d:       svcUsers.get(sid)?.size ?? 0,
      success_rate:           pct(svcOk.get(sid) ?? 0, svcTot.get(sid) ?? 1),
      avg_events_per_session: epsAvg,
      top_events:             topEvents,
      has_reports:            (svcRep.get(sid) ?? 0) > 0,
      report_count_30d:       svcRep.get(sid) ?? 0,
      report_export_rate:     0,
      trend:                  Math.round((ev - prevEv) / Math.max(prevEv, 1) * 1000) / 10,
      peak_hour:              peakHr,
    }
  }).sort((a, b) => b.events_30d - a.events_30d)
  const dxServiceUsage = { services: svcsOut }

  // ── dx_event_heatmap & dx_event_heatmap_drill ────────────────────────
  const hmData  = new Map<string, Map<number, number>>()
  const hmDrill = new Map<string, Map<string, Map<number, number>>>()
  for (const r of audit) {
    const ts = parseTs(r.created_on); if (!ts || !r.service_id) continue
    const svcName = serviceMap.get(r.service_id) ?? `Svc ${r.service_id}`
    if (!hmData.has(svcName)) hmData.set(svcName, new Map())
    mapIncr(hmData.get(svcName)!, ts.getHours())
    if (r.event_id) {
      const evtName = eventMap.get(r.event_id) ?? `Evt ${r.event_id}`
      if (!hmDrill.has(svcName)) hmDrill.set(svcName, new Map())
      if (!hmDrill.get(svcName)!.has(evtName)) hmDrill.get(svcName)!.set(evtName, new Map())
      mapIncr(hmDrill.get(svcName)!.get(evtName)!, ts.getHours())
    }
  }
  const dxEventHeatmap = { matrix: [...hmData.entries()].sort().flatMap(([svc, hours]) =>
    [...hours.entries()].filter(([, c]) => c > 0).map(([h, c]) => ({ service: svc, hour: h, count: c }))
  )}
  const dxEventHeatmapDrill: Record<string, unknown[]> = {}
  for (const [svc, evts] of hmDrill) {
    dxEventHeatmapDrill[svc] = [...evts.entries()].flatMap(([evt, hrs]) =>
      [...hrs.entries()].filter(([, c]) => c > 0).map(([h, c]) => ({ event: evt, hour: h, count: c }))
    )
  }

  // ── dx_session_stats ─────────────────────────────────────────────────
  const allDurs = sessions.map(s => s.duration_sec)
  const sessEvCnt = new Map<number, number>()
  for (const r of auditEnriched) if (r.session_id) mapIncr(sessEvCnt, r.session_id)
  const epc = [...sessEvCnt.values()]
  const peakH = Array.from({length: 24}, (_, h) => h)
    .sort((a, b) => sessions.filter(s => s.hour === b).length - sessions.filter(s => s.hour === a).length)[0] ?? 9
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const dayCnt = new Map<string, number>()
  for (const s of sessions) { const dt = parseTs(s.date); if (dt) mapIncr(dayCnt, dayNames[dt.getDay() === 0 ? 6 : dt.getDay() - 1]) }
  const peakDay = [...dayCnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Mon'
  const roleSl = new Map<string, number[]>()
  for (const s of sessions) for (const rl of userRoleMap.get(s.user_id) ?? ['Unassigned']) mapArrPush(roleSl, rl, s.duration_sec)
  const dxSessionStats = {
    kpis: {
      total_sessions_30d:     sessions30d.length,
      avg_duration_min:       allDurs.length ? Math.round(allDurs.reduce((a, b) => a + b, 0) / allDurs.length / 60 * 10) / 10 : 0,
      median_duration_min:    allDurs.length ? Math.round([...allDurs].sort((a, b) => a - b)[Math.floor(allDurs.length / 2)] / 60 * 10) / 10 : 0,
      avg_events_per_session: epc.length ? Math.round(epc.reduce((a, b) => a + b, 0) / epc.length * 10) / 10 : 0,
      bounce_rate:            pct(sessions.filter(s => !sessionsWithAction.has(s.session_id)).length, sessions.length),
      cross_module_rate:      crossModRate,
      peak_hour:              peakH,
      peak_day_of_week:       peakDay,
      sessions_per_user_avg:  Math.round(sessions.length / Math.max(new Set(sessions.map(s => s.user_id)).size, 1) * 100) / 100,
      completion_rate:        Math.round(completionRate * 10) / 10,
    },
    duration_buckets: [
      { label: '< 5 min',   count: allDurs.filter(d => d < 300).length },
      { label: '5\u201315 min',  count: allDurs.filter(d => d >= 300  && d < 900).length },
      { label: '15\u201330 min', count: allDurs.filter(d => d >= 900  && d < 1800).length },
      { label: '30\u201360 min', count: allDurs.filter(d => d >= 1800 && d < 3600).length },
      { label: '> 60 min',  count: allDurs.filter(d => d >= 3600).length },
    ],
    events_per_session_buckets: [
      { label: '1\u20133',   count: epc.filter(e => e >= 1  && e <= 3).length },
      { label: '4\u20138',   count: epc.filter(e => e >= 4  && e <= 8).length },
      { label: '9\u201315',  count: epc.filter(e => e >= 9  && e <= 15).length },
      { label: '16\u201325', count: epc.filter(e => e >= 16 && e <= 25).length },
      { label: '> 25',  count: epc.filter(e => e > 25).length },
    ],
    by_role: [...roleSl.entries()].sort((a, b) => {
      const avgA = a[1].reduce((x, y) => x + y, 0) / a[1].length
      const avgB = b[1].reduce((x, y) => x + y, 0) / b[1].length
      return avgB - avgA
    }).slice(0, 10).map(([role, durs]) => ({
      role,
      avg_duration_min: Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 60 * 10) / 10,
      avg_events: 0,
      sessions: durs.length,
    })),
  }

  // ── dx_health_overview ───────────────────────────────────────────────
  const dailySt = new Map<string, Map<string, number>>()
  for (const r of audit) {
    const ts = parseTs(r.created_on); if (!ts) continue
    const d = isoDate(ts)
    if (!dailySt.has(d)) dailySt.set(d, new Map())
    mapIncr(dailySt.get(d)!, r.status ?? 'UNKNOWN')
  }
  const srSeries = [...dailySt.entries()].sort().slice(-14).map(([d, v]) => ({
    date: d,
    rate: pct(v.get('SUCCESS') ?? 0, [...v.values()].reduce((a, b) => a + b, 0)),
  }))
  const totalAtt = iam.filter(r => { const t = parseTs(r.created_on); return t && t >= D30_START }).length
  const validLog = iam.filter(r => r.type === 'LOGIN' && (parseTs(r.created_on) ?? new Date(0)) >= D30_START).length
  const svcFail = new Map<string, { f: number; t: number }>()
  const evtFail = new Map<string, { f: number; t: number }>()
  for (const r of audit) {
    const ts = parseTs(r.created_on); if (!ts || ts < D30_START) continue
    if (r.service_id) {
      if (!svcFail.has(r.service_id)) svcFail.set(r.service_id, { f: 0, t: 0 })
      svcFail.get(r.service_id)!.t++
      if (r.status === 'FAILED' || r.status === 'FAILURE') svcFail.get(r.service_id)!.f++
    }
    if (r.event_id) {
      if (!evtFail.has(r.event_id)) evtFail.set(r.event_id, { f: 0, t: 0 })
      evtFail.get(r.event_id)!.t++
      if (r.status === 'FAILED' || r.status === 'FAILURE') evtFail.get(r.event_id)!.f++
    }
  }
  const dxHealthOverview = {
    kpis: {
      overall_success_rate:      sr30d,
      success_rate:              sr30d,
      login_success_rate:        pct(validLog, totalAtt),
      failed_events_30d:         audit.filter(r => { const t = parseTs(r.created_on); return t && t >= D30_START && (r.status === 'FAILED' || r.status === 'FAILURE') }).length,
      unique_error_types:        new Set(audit.filter(r => (r.status === 'FAILED' || r.status === 'FAILURE') && r.event_id).map(r => r.event_id!)).size,
      api_error_rate:            0,
      p95_latency_ms:            0,
      consecutive_fail_streaks:  0,
    },
    trends: { success_rate_vs_prev: trendSr },
    success_rate_series: srSeries,
    login_funnel: [
      { step: 'Attempt',   count: totalAtt },
      { step: 'Auth Pass', count: validLog },
      { step: 'Session',   count: sessions30d.length },
      { step: 'Action',    count: completionSess.length },
    ],
    failure_by_service: [...svcFail.entries()].filter(([, v]) => v.t > 0)
      .map(([sid, v]) => ({ service: serviceMap.get(sid) ?? sid, failed: v.f, total: v.t, rate: pct(v.f, v.t) }))
      .sort((a, b) => b.rate - a.rate).slice(0, 10),
    failure_by_event: [...evtFail.entries()].filter(([, v]) => v.t > 0)
      .map(([eid, v]) => ({ event: eventMap.get(eid) ?? eid, failed: v.f, total: v.t, failure_rate: pct(v.f, v.t) }))
      .sort((a, b) => b.failure_rate - a.failure_rate).slice(0, 10),
  }

  // ── dx_user_events ───────────────────────────────────────────────────
  const recent50 = [...audit]
    .filter(r => r.service_id && r.event_id)
    .sort((a, b) => (b.created_on ?? '').localeCompare(a.created_on ?? ''))
    .slice(0, 50)
  const dxUserEvents = { events: recent50.map((r, i) => ({
    event_id:   i + 1,
    ts:         r.created_on,
    status:     r.status ?? 'UNKNOWN',
    service:    serviceMap.get(r.service_id!) ?? `Svc ${r.service_id}`,
    event:      eventMap.get(r.event_id!)    ?? `Evt ${r.event_id}`,
    user_name:  userEmail.get(r.user_id) ?? `User ${r.user_id}`,
    user_id:    r.user_id,
    session_id: '',
  }))}

  // ── dx_service_drill ─────────────────────────────────────────────────
  const D14_START = new Date(TODAY.getTime() - 14 * 86400_000)
  const svcDayOk  = new Map<string, Map<string, number>>()
  const svcDayTot = new Map<string, Map<string, number>>()
  const svcEvtOk  = new Map<string, Map<string, number>>()
  const svcEvtTot = new Map<string, Map<string, number>>()
  const svcUsrEv  = new Map<string, Map<string, number>>()
  const reportEvtIds = new Set([...eventMap.entries()].filter(([, l]) => REPORT_KEYWORDS.some(k => l.toLowerCase().includes(k))).map(([id]) => id))
  const svcRepUser       = new Map<string, Map<string, number>>()
  const svcRepExportUser = new Map<string, Map<string, number>>()

  for (const r of audit) {
    const ts = parseTs(r.created_on); const sid = r.service_id
    if (!ts || !sid) continue
    if (ts >= D14_START) {
      const d = isoDate(ts)
      if (!svcDayTot.has(sid)) svcDayTot.set(sid, new Map())
      if (!svcDayOk.has(sid))  svcDayOk.set(sid, new Map())
      mapIncr(svcDayTot.get(sid)!, d)
      if (r.status === 'SUCCESS') mapIncr(svcDayOk.get(sid)!, d)
    }
    if (ts >= D30_START) {
      if (r.event_id) {
        if (!svcEvtTot.has(sid)) svcEvtTot.set(sid, new Map())
        if (!svcEvtOk.has(sid))  svcEvtOk.set(sid, new Map())
        mapIncr(svcEvtTot.get(sid)!, r.event_id)
        if (r.status === 'SUCCESS') mapIncr(svcEvtOk.get(sid)!, r.event_id)
      }
      if (r.user_id) {
        if (!svcUsrEv.has(sid)) svcUsrEv.set(sid, new Map())
        mapIncr(svcUsrEv.get(sid)!, r.user_id)
      }
      if (r.event_id && reportEvtIds.has(r.event_id)) {
        if (!svcRepUser.has(sid)) svcRepUser.set(sid, new Map())
        mapIncr(svcRepUser.get(sid)!, r.user_id)
        if (r.status === 'SUCCESS') {
          if (!svcRepExportUser.has(sid)) svcRepExportUser.set(sid, new Map())
          mapIncr(svcRepExportUser.get(sid)!, r.user_id)
        }
      }
    }
  }
  const dxServiceDrill: Record<string, unknown> = {}
  for (const [sid, svcName] of serviceMap) {
    const dayTot = svcDayTot.get(sid) ?? new Map()
    const dayOk  = svcDayOk.get(sid)  ?? new Map()
    const allD   = [...dayTot.keys()].sort().slice(-14)
    const successSeries = allD.map(d => ({ date: d, rate: pct(dayOk.get(d) ?? 0, dayTot.get(d) ?? 1) }))
    const evtTot = svcEvtTot.get(sid) ?? new Map()
    const evtOk  = svcEvtOk.get(sid)  ?? new Map()
    const eventsBreakdown = [...evtTot.entries()]
      .map(([eid, tot]) => ({ event: eventMap.get(eid) ?? `Evt ${eid}`, count: tot, success: pct(evtOk.get(eid) ?? 0, tot) }))
      .sort((a, b) => b.count - a.count).slice(0, 10)
    const usrEv = svcUsrEv.get(sid) ?? new Map()
    const topUsers = [...usrEv.entries()]
      .map(([uid, cnt]) => ({ name: userEmail.get(uid) ?? `User ${uid}`, role: (userRoleMap.get(uid) ?? ['Unknown'])[0], events: cnt }))
      .sort((a, b) => b.events - a.events).slice(0, 8)
    const repUser = svcRepUser.get(sid)
    let repData = null
    if (repUser && repUser.size > 0) {
      const totalRep  = [...repUser.values()].reduce((a, b) => a + b, 0)
      const exported  = [...(svcRepExportUser.get(sid) ?? new Map()).values()].reduce((a, b) => a + b, 0)
      repData = {
        total_reports: totalRep,
        exported,
        export_rate:   pct(exported, totalRep),
        report_types: [...reportEvtIds].filter(eid => evtTot.has(eid)).map(eid => ({
          type: eventMap.get(eid) ?? eid, count: evtTot.get(eid) ?? 0, exported: evtOk.get(eid) ?? 0,
        })),
        by_user: [...repUser.entries()].map(([uid, cnt]) => ({
          name: userEmail.get(uid) ?? `User ${uid}`, reports: cnt, exports: svcRepExportUser.get(sid)?.get(uid) ?? 0,
        })).sort((a, b) => b.reports - a.reports).slice(0, 6),
      }
    }
    dxServiceDrill[sid] = { success_series: successSeries, events_breakdown: eventsBreakdown, top_users: topUsers, ...(repData ? { report_metrics: repData } : {}) }
    void svcName
  }

  // ── dx_services_windows ──────────────────────────────────────────────
  function computeWindow(windowDays: number) {
    const wStart = new Date(TODAY.getTime() - windowDays * 86400_000)
    const wPrev  = new Date(wStart.getTime() - windowDays * 86400_000)
    const auditW    = audit.filter(r => { const t = parseTs(r.created_on); return t && t >= wStart })
    const auditPrev = audit.filter(r => { const t = parseTs(r.created_on); return t && t >= wPrev && t < wStart })
    const iamW      = iam.filter(r => { const t = parseTs(r.created_on); return t && t >= wStart })
    const sessW     = sessions.filter(s => { const t = parseTs(s.date); return t && t >= wStart })

    const wSvcEv = new Map<string, number>(); const wSvcOk   = new Map<string, number>()
    const wSvcUsr= new Map<string, Set<string>>(); const wSvcHrs= new Map<string, number[]>()
    const wSvcTe = new Map<string, Map<string, number>>(); const wSvcRep= new Map<string, number>()
    for (const r of auditW) {
      const ts = parseTs(r.created_on); const sid = r.service_id
      if (!ts || !sid) continue
      mapIncr(wSvcEv, sid); mapSetAdd(wSvcUsr, sid, r.user_id)
      if (r.status === 'SUCCESS') mapIncr(wSvcOk, sid)
      mapArrPush(wSvcHrs, sid, ts.getHours())
      if (r.event_id) {
        const lbl = eventMap.get(r.event_id) ?? r.event_id
        if (!wSvcTe.has(sid)) wSvcTe.set(sid, new Map())
        mapIncr(wSvcTe.get(sid)!, lbl)
        if (REPORT_KEYWORDS.some(k => lbl.toLowerCase().includes(k))) mapIncr(wSvcRep, sid)
      }
    }
    const wSvcPrevEv = new Map<string, number>()
    for (const r of auditPrev) if (r.service_id) mapIncr(wSvcPrevEv, r.service_id)

    const wServicesOut = [...wSvcEv.entries()].map(([sid, ev]) => {
      const hrs = wSvcHrs.get(sid) ?? []
      const peakHr = hrs.length ? hrs.sort((a, b) => hrs.filter(h => h === b).length - hrs.filter(h => h === a).length)[0] : 0
      const te = wSvcTe.get(sid) ?? new Map()
      const prevEv = wSvcPrevEv.get(sid) ?? ev
      return {
        service_id: sid, service_name: serviceMap.get(sid) ?? `Svc ${sid}`,
        events_30d: ev, active_users_30d: wSvcUsr.get(sid)?.size ?? 0,
        success_rate: Math.round(pct(wSvcOk.get(sid) ?? 0, ev) * 100) / 100,
        avg_events_per_session: Math.round(ev / Math.max(sessW.length, 1) * 10) / 10,
        top_events: [...te.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e]) => e),
        has_reports: (wSvcRep.get(sid) ?? 0) > 0,
        report_count_30d: wSvcRep.get(sid) ?? 0, report_export_rate: 0,
        trend: Math.round((ev - prevEv) / Math.max(prevEv, 1) * 1000) / 10,
        peak_hour: peakHr,
      }
    }).sort((a, b) => b.events_30d - a.events_30d)

    const wHm = new Map<string, Map<number, number>>()
    const wHmDrill = new Map<string, Map<string, Map<number, number>>>()
    for (const r of auditW) {
      const ts = parseTs(r.created_on); if (!ts || !r.service_id) continue
      const svcName = serviceMap.get(r.service_id) ?? `Svc ${r.service_id}`
      if (!wHm.has(svcName)) wHm.set(svcName, new Map())
      mapIncr(wHm.get(svcName)!, ts.getHours())
      if (r.event_id) {
        const evtName = eventMap.get(r.event_id) ?? `Evt ${r.event_id}`
        if (!wHmDrill.has(svcName)) wHmDrill.set(svcName, new Map())
        if (!wHmDrill.get(svcName)!.has(evtName)) wHmDrill.get(svcName)!.set(evtName, new Map())
        mapIncr(wHmDrill.get(svcName)!.get(evtName)!, ts.getHours())
      }
    }
    const heatmap = [...wHm.entries()].sort().flatMap(([svc, hrs]) =>
      [...hrs.entries()].filter(([, c]) => c > 0).map(([h, c]) => ({ service: svc, hour: h, count: c }))
    )
    const heatmapDrill: Record<string, unknown[]> = {}
    for (const [svc, evts] of wHmDrill) {
      heatmapDrill[svc] = [...evts.entries()].flatMap(([evt, hrs]) =>
        [...hrs.entries()].filter(([, c]) => c > 0).map(([h, c]) => ({ event: evt, hour: h, count: c }))
      )
    }

    const totalEv = wServicesOut.reduce((s, r) => s + r.events_30d, 0)
    const wsr = totalEv ? wServicesOut.reduce((s, r) => s + r.success_rate * r.events_30d, 0) / totalEv : 0
    const prevUids = new Set(iam.filter(r => { const t = parseTs(r.created_on); return r.type === 'LOGIN' && t && t >= wPrev && t < wStart }).map(r => r.user_id))
    return {
      services:     wServicesOut,
      heatmap:      { matrix: heatmap },
      heatmapDrill: heatmapDrill,
      kpis: {
        total_events:          totalEv,
        per_day:               Math.round(totalEv / windowDays * 10) / 10,
        weighted_success_rate: Math.round(wsr * 100) / 100,
        active_services:       wSvcEv.size,
        active_users:          new Set(iamW.filter(r => r.type === 'LOGIN').map(r => r.user_id)).size,
        active_users_prev:     prevUids.size,
        top_service:           wServicesOut[0]?.service_name ?? '',
        top_service_events:    wServicesOut[0]?.events_30d   ?? 0,
        report_exports:        wServicesOut.reduce((s, r) => s + r.report_count_30d, 0),
        services_with_reports: wServicesOut.filter(r => r.has_reports).length,
      },
    }
  }
  const dxServicesWindows: Record<string, unknown> = {}
  for (const [label, days] of [['1d', 1], ['7d', 7], ['30d', 30]] as [string, number][]) {
    dxServicesWindows[label] = computeWindow(days)
  }

  // ════════════════════════════════════════════════════════════════
  // Upsert all 13 datasets into dx_snapshots
  // ════════════════════════════════════════════════════════════════
  const datasets: [string, unknown][] = [
    ['overview',         dxOverview],
    ['dau_series',       dxDauSeries],
    ['users',            dxUsers],
    ['role_distribution',dxRoleDistribution],
    ['cohort_retention', dxCohortRetention],
    ['service_usage',    dxServiceUsage],
    ['event_heatmap',    dxEventHeatmap],
    ['event_heatmap_drill', dxEventHeatmapDrill],
    ['session_stats',    dxSessionStats],
    ['health_overview',  dxHealthOverview],
    ['user_events',      dxUserEvents],
    ['service_drill',    dxServiceDrill],
    ['services_windows', dxServicesWindows],
  ]

  const now = new Date().toISOString()
  let ok = 0, fail = 0
  for (const [id, data] of datasets) {
    const { error } = await sb.from('dx_snapshots').upsert({ id, data, updated_at: now }, { onConflict: 'id' })
    if (error) { console.error(`  ✗ ${id}: ${error.message}`); fail++ }
    else { console.log(`  ✓ ${id}`); ok++ }
  }

  console.log(`\nDone — ${ok} datasets updated, ${fail} failed`)
}
