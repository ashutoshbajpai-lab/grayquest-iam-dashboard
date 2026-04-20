import path from 'path'
import fs from 'fs'

const MOCK_DIR    = path.join(process.cwd(), 'src/data/mock')
const REAL_DIR    = path.join(process.cwd(), 'src/data/real')
const PYTHON_DIR  = path.join(process.cwd(), '..', 'metrics', 'output')

function loadJson<T>(filepath: string): T {
  const raw = fs.readFileSync(filepath, 'utf-8')
  return JSON.parse(raw) as T
}

function loadMock<T>(filename: string): T {
  return loadJson<T>(path.join(MOCK_DIR, filename))
}

// 3-tier fallback: local Python output → bundled real data → mock
function loadReal<T>(pythonFile: string, mockFile: string): T {
  for (const dir of [PYTHON_DIR, REAL_DIR]) {
    const p = path.join(dir, pythonFile)
    if (fs.existsSync(p)) {
      try { return loadJson<T>(p) } catch { /* fall through */ }
    }
  }
  return loadMock<T>(mockFile)
}

// ── Raw loaders (real Python output → mock fallback) ─────────────
export function getOverview()         { return loadReal<Record<string, unknown>>('dx_overview.json',         'overview.json') }
export function getDauSeries()        { return loadReal<Record<string, unknown>>('dx_dau_series.json',       'dau_series.json') }
export function getUsers()            { return loadReal<Record<string, unknown>>('dx_users.json',            'users.json') }
export function getRoleDistribution() { return loadReal<Record<string, unknown>>('dx_role_distribution.json','role_distribution.json') }
export function getCohortRetention()  { return loadReal<Record<string, unknown>>('dx_cohort_retention.json', 'cohort_retention.json') }
export function getServiceUsage()     { return loadReal<Record<string, unknown>>('dx_service_usage.json',    'service_usage.json') }
export function getEventHeatmap()     { return loadReal<Record<string, unknown>>('dx_event_heatmap.json',    'event_heatmap.json') }
export function getSessionStats()     { return loadReal<Record<string, unknown>>('dx_session_stats.json',    'session_stats.json') }
export function getHealthOverview()   { return loadReal<Record<string, unknown>>('dx_health_overview.json',  'health_overview.json') }
export function getUserEvents()       { return loadReal<Record<string, unknown>>('dx_user_events.json',      'user_events.json') }
export function getServiceDrill()          { return loadReal<Record<string, unknown>>('dx_service_drill.json',          'service_drill.json') }
export function getEventHeatmapDrill()    { return loadReal<Record<string, unknown>>('dx_event_heatmap_drill.json',   'event_heatmap.json') }
export function getServicesWindows()      { return loadReal<Record<string, unknown>>('dx_services_windows.json',      'service_usage.json') }

// ── Real Python outputs (auto-blended where available) ───────────
export function getRealDau()          { return loadReal<unknown[]>('m01_dau.json', 'dau_series.json') }
export function getRealHealthScores() { return loadReal<Record<string, unknown>>('m43_user_health_score.json', 'users.json') }
export function getRealSessionStats() { return loadReal<Record<string, unknown>>('m14_session_stats.json', 'session_stats.json') }
export function getRealCohort()       { return loadReal<unknown[]>('m12_cohort_retention.json', 'cohort_retention.json') }
export function getRealReports()      { return loadReal<Record<string, unknown>>('m32_report_metrics.json', 'service_usage.json') }
export function getRealDormant()      { return loadReal<unknown[]>('m13_dormant_users.json', 'users.json') }
export function getRealRoleBreakdown(){ return loadReal<unknown[]>('m06_active_by_role.json', 'role_distribution.json') }

// ── Section bundles ──────────────────────────────────────────────
export function getPeopleData() {
  return {
    overview: getOverview(),
    dau:      getDauSeries(),
    users:    getUsers(),
    roles:    getRoleDistribution(),
    cohort:   getCohortRetention(),
    sessions: getSessionStats(),
    // Supplementary real data (available when Python script has run)
    real: {
      dau:          getRealDau(),
      healthScores: getRealHealthScores(),
      dormant:      getRealDormant(),
      roles:        getRealRoleBreakdown(),
    },
  }
}

export function getServicesData() {
  return {
    services:        getServiceUsage(),
    heatmap:         getEventHeatmap(),
    events:          getUserEvents(),
    drill:           getServiceDrill(),
    heatmapDrill:    getEventHeatmapDrill(),
    servicesWindows: getServicesWindows(),
    real: {
      reports: getRealReports(),
    },
  }
}

export function getHealthData() {
  return {
    health:   getHealthOverview(),
    sessions: getSessionStats(),
    overview: getOverview(),
    real: {
      sessions: getRealSessionStats(),
    },
  }
}
