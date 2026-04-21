// ─────────────────────────────────────────────────────────────────
// Central configuration — every magic number lives here.
// Import from this file instead of scattering literals across the codebase.
// ─────────────────────────────────────────────────────────────────

// ── Dataset / Date ────────────────────────────────────────────────
// The most recent date present in the source CSVs.
// Update this when the data pipeline is refreshed.
export const DATASET_END_DATE = process.env.NEXT_PUBLIC_DATASET_END_DATE ?? '2026-04-18'

// ── Platform ──────────────────────────────────────────────────────
export const PLATFORM_ID = process.env.NEXT_PUBLIC_PLATFORM_ID ?? '6'
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'GrayQuest'

// ── Dashboard user identity ───────────────────────────────────────
function _parseName(email: string): string {
  return email.split('@')[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
export const DASHBOARD_USER_EMAIL = process.env.NEXT_PUBLIC_DASHBOARD_USER_EMAIL ?? ''
export const DASHBOARD_USER_NAME  = process.env.NEXT_PUBLIC_DASHBOARD_USER_NAME  ?? (_parseName(DASHBOARD_USER_EMAIL) || 'Admin')
export const DASHBOARD_USER_ROLE  = process.env.NEXT_PUBLIC_DASHBOARD_USER_ROLE  ?? 'IAM Admin'

// ── Auth ──────────────────────────────────────────────────────────
export const AUTH_COOKIE_NAME   = 'gq-dashboard-token'
export const AUTH_TOKEN_EXPIRY  = '8h'
export const AUTH_TOKEN_ALGO    = 'HS256'
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 8  // 8 hours in seconds

// ── localStorage keys ─────────────────────────────────────────────
export const THEME_STORAGE_KEY = 'gq-theme'

// ── Theme transition ──────────────────────────────────────────────
export const THEME_TRANSITION_MS = 300

// ── Health score thresholds ───────────────────────────────────────
// Used in: PeopleClient, UserTable, UserDrawer, alerts/route, compute_metrics.py
export const HEALTH = {
  ACTIVE:   75,   // score >= ACTIVE  → "Active"  (green)
  AT_RISK:  50,   // score >= AT_RISK → "At Risk" (amber)
  // score < AT_RISK → "Inactive" (red)
  // Alert threshold — separate from display thresholds
  ALERT_LOW: 40,
  AVG_ALERT: 65,
} as const

// ── Success rate thresholds ───────────────────────────────────────
// Used in: ServicesClient, HealthClient, ServiceDrawer, alerts/route
export const SUCCESS_RATE = {
  GOOD:    90,   // >= GOOD  → success / green
  WARNING: 80,   // >= WARNING → warning / amber
  // < WARNING → danger / red
  ALERT:   85,   // alert fires when overall rate drops below this
} as const

// ── Login success rate thresholds ────────────────────────────────
export const LOGIN_RATE = {
  ALERT: 88,     // alert fires when login rate drops below this
} as const

// ── Service failure rate thresholds ──────────────────────────────
export const SERVICE_FAILURE_RATE = {
  GOOD:    8,    // <= GOOD  → success
  WARNING: 15,   // <= WARNING → warning
  // > WARNING → danger
  ALERT:   80,   // per-service success rate alert floor
} as const

// ── Session / engagement thresholds ──────────────────────────────
export const SESSION = {
  CROSS_MODULE_GOOD:    40,   // cross-module rate >= this → success
  SHALLOW_ALERT:        30,   // shallow session % alert ceiling
  API_ERROR_ALERT:       5,   // API error % alert ceiling
  COMPLETION_GOOD:      70,   // completion rate >= this → success
} as const

// ── DAU / people alerts ───────────────────────────────────────────
export const PEOPLE_ALERTS = {
  MIN_DAU:          5,    // DAU below this → alert
} as const

// ── Service trend alert ───────────────────────────────────────────
export const SERVICE_ALERTS = {
  TREND_DROP:  -10,   // trend % below this → alert
} as const

// ── Chart / UI display limits ─────────────────────────────────────
export const CHART_LIMITS = {
  TOP_EVENTS_BAR:         8,    // ServicesClient top-events bar chart
  TOP_FAILING_EVENTS:     6,    // HealthClient failing events chart
  ROLE_SLICES:            9,    // donut slices before "Other" bucket
  SERVICE_DRILL_EVENTS:  10,    // per-service event breakdown rows
  SERVICE_DRILL_USERS:    8,    // per-service top-users rows
  SERVICE_DRILL_REPORTS:  6,    // report-usage-by-user rows
  RECENT_EVENTS_FEED:    50,    // user events feed rows
  SUCCESS_SERIES_DAYS:   14,    // days in service drill success series
  DAU_SERIES_DAYS:       30,    // days in DAU time series
} as const

// ── Bar chart row height (px) — used for dynamic chart heights ────
export const CHART_ROW_HEIGHT = {
  STANDARD: 44,   // standard horizontal bar chart
  REPORT:   48,   // report-by-user bar chart
  USER:     32,   // user-by-service bar chart
} as const

// ── AI provider configuration ─────────────────────────────────────
export const AI = {
  OLLAMA_URL:         process.env.OLLAMA_URL          ?? 'http://127.0.0.1:11434/api/generate',
  OLLAMA_MODEL:       process.env.OLLAMA_MODEL        ?? 'phi3:mini',
  OLLAMA_TIMEOUT_MS:  Number(process.env.OLLAMA_TIMEOUT_MS ?? 3_000),
  GEMINI_MODEL:       process.env.GEMINI_MODEL        ?? 'gemini-2.0-flash',
  GEMINI_TIMEOUT_MS:  Number(process.env.GEMINI_TIMEOUT_MS ?? 8_000),
  COMPUTE_TIMEOUT_MS: Number(process.env.GEMINI_COMPUTE_TIMEOUT_MS ?? 20_000),
  MAX_RESULT_WORDS:   25,
} as const

// Derived — build the Gemini endpoint URL from the model name
export function geminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${AI.GEMINI_MODEL}:generateContent?key=${apiKey}`
}

// ── Semantic color palette (light mode) ──────────────────────────
// These are used in chart-less UI components (badges, pills, gauges).
// Chart colors live in useChartColors.ts which has dark-mode variants.
export const COLORS = {
  SUCCESS:       '#0D9B6A',
  SUCCESS_BG:    'rgba(16,185,129,0.10)',
  WARNING:       '#D97706',
  WARNING_BG:    'rgba(217,119,6,0.10)',
  DANGER:        '#DC2626',
  DANGER_BG:     'rgba(239,68,68,0.10)',
  ACCENT:        '#4F46E5',   // active-state background (nav, buttons)
  TREND_UP:      '#22C55E',
  TREND_DOWN:    '#EF4444',
  TREND_NEUTRAL: '#F59E0B',
  KPI_FALLBACK:  'var(--color-txt-primary)',   // fallback text color in drawer KPI tiles

  // Inline bar / gauge colors (not part of useChartColors since they're fixed)
  EVENTS_BAR:    '#6C63FF',
  REPORT_BAR:    '#22C55E',
} as const

// ── Role avatar palette ───────────────────────────────────────────
// Cycled by index for user initials avatars
export const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: '#EEF2FF', fg: '#4338CA' },
  { bg: '#F5F3FF', fg: '#5B21B6' },
  { bg: '#EFF6FF', fg: '#1D4ED8' },
  { bg: '#ECFDF5', fg: '#065F46' },
  { bg: '#FDF4FF', fg: '#7E22CE' },
  { bg: '#FFF1F2', fg: '#BE123C' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#F0FDF4', fg: '#166534' },
]

// ── Python metrics engine defaults ───────────────────────────────
// These are documented here for reference; the actual values live in
// compute_metrics.py at the top-level CONSTANTS block.
export const PYTHON_DEFAULTS = {
  SESSION_GAP_SECS:  3600,   // 60-min inactivity → new session
  POWER_TOP_PCT:     0.10,   // top 10% by activity = power users
  HEAVY_THRESHOLD:   20,     // avg actions/week = heavy user
  DORMANT_DAYS:      30,
  LATE_HOUR_START:   19,     // 7 PM
  SHORT_SESSION:     3600,
  MULTI_MODULE_MIN:  3,
  HEALTH_WEIGHTS: {           // must sum to 1.0
    login_freq:       0.25,
    action_count:     0.25,
    module_diversity: 0.25,
    report_usage:     0.25,
  },
  HEALTH_BUCKETS: [25, 50, 75, 100],
} as const
