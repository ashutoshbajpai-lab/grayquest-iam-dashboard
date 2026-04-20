import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

// ── Supabase client (server-side, using service role for SSR reads) ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const sbClient = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) },
    })
  : null

// ── JSON fallback (bundled real data → mock) ─────────────────────────
const REAL_DIR = path.join(process.cwd(), 'src/data/real')
const MOCK_DIR = path.join(process.cwd(), 'src/data/mock')

function loadJsonFallback<T>(snapshotId: string, mockFile: string): T {
  const realFile = path.join(REAL_DIR, `dx_${snapshotId}.json`)
  if (fs.existsSync(realFile)) {
    try { return JSON.parse(fs.readFileSync(realFile, 'utf-8')) as T } catch { /* fall through */ }
  }
  return JSON.parse(fs.readFileSync(path.join(MOCK_DIR, mockFile), 'utf-8')) as T
}

// ── Core loader: Supabase first, bundled JSON fallback ───────────────
async function loadSnapshot<T>(id: string, mockFile: string): Promise<T> {
  if (sbClient) {
    const { data, error } = await sbClient
      .from('dx_snapshots')
      .select('data')
      .eq('id', id)
      .single()
    if (!error && data?.data) return data.data as T
  }
  return loadJsonFallback<T>(id, mockFile)
}

// ── Sync wrapper for pages that can't be async (RSC pages ARE async) ─
// All page.tsx files use React Server Components which support async,
// so we export async bundle loaders below.

// ── Section bundle loaders (used by RSC pages) ───────────────────────
export async function getPeopleData() {
  const [overview, dau, users, roles, cohort, sessions] = await Promise.all([
    loadSnapshot<Record<string, unknown>>('overview',          'overview.json'),
    loadSnapshot<Record<string, unknown>>('dau_series',        'dau_series.json'),
    loadSnapshot<Record<string, unknown>>('users',             'users.json'),
    loadSnapshot<Record<string, unknown>>('role_distribution', 'role_distribution.json'),
    loadSnapshot<Record<string, unknown>>('cohort_retention',  'cohort_retention.json'),
    loadSnapshot<Record<string, unknown>>('session_stats',     'session_stats.json'),
  ])
  return { overview, dau, users, roles, cohort, sessions, real: {} }
}

export async function getServicesData() {
  const [services, heatmap, events, drill, heatmapDrill, servicesWindows] = await Promise.all([
    loadSnapshot<Record<string, unknown>>('service_usage',        'service_usage.json'),
    loadSnapshot<Record<string, unknown>>('event_heatmap',        'event_heatmap.json'),
    loadSnapshot<Record<string, unknown>>('user_events',          'user_events.json'),
    loadSnapshot<Record<string, unknown>>('service_drill',        'service_drill.json'),
    loadSnapshot<Record<string, unknown>>('event_heatmap_drill',  'event_heatmap.json'),
    loadSnapshot<Record<string, unknown>>('services_windows',     'service_usage.json'),
  ])
  return { services, heatmap, events, drill, heatmapDrill, servicesWindows, real: {} }
}

export async function getHealthData() {
  const [health, sessions, overview] = await Promise.all([
    loadSnapshot<Record<string, unknown>>('health_overview', 'health_overview.json'),
    loadSnapshot<Record<string, unknown>>('session_stats',   'session_stats.json'),
    loadSnapshot<Record<string, unknown>>('overview',        'overview.json'),
  ])
  return { health, sessions, overview, real: {} }
}

// ── Individual loaders (used by API routes) ──────────────────────────
export const getOverview         = () => loadSnapshot<Record<string, unknown>>('overview',          'overview.json')
export const getDauSeries        = () => loadSnapshot<Record<string, unknown>>('dau_series',        'dau_series.json')
export const getUsers            = () => loadSnapshot<Record<string, unknown>>('users',             'users.json')
export const getRoleDistribution = () => loadSnapshot<Record<string, unknown>>('role_distribution', 'role_distribution.json')
export const getCohortRetention  = () => loadSnapshot<Record<string, unknown>>('cohort_retention',  'cohort_retention.json')
export const getServiceUsage     = () => loadSnapshot<Record<string, unknown>>('service_usage',     'service_usage.json')
export const getEventHeatmap     = () => loadSnapshot<Record<string, unknown>>('event_heatmap',     'event_heatmap.json')
export const getSessionStats     = () => loadSnapshot<Record<string, unknown>>('session_stats',     'session_stats.json')
export const getHealthOverview   = () => loadSnapshot<Record<string, unknown>>('health_overview',   'health_overview.json')
export const getUserEvents       = () => loadSnapshot<Record<string, unknown>>('user_events',       'user_events.json')
export const getServiceDrill     = () => loadSnapshot<Record<string, unknown>>('service_drill',     'service_drill.json')
export const getServicesWindows  = () => loadSnapshot<Record<string, unknown>>('services_windows',  'service_usage.json')
