import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

// ── Supabase client ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const sbClient = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) },
    })
  : null

const REAL_DIR = path.join(process.cwd(), 'src/data/real')

/**
 * Strict Loader: NO MOCK FALLBACK.
 */
async function loadSnapshot<T>(id: string, defaultValue: T): Promise<T> {
  const realFile = path.join(REAL_DIR, `dx_${id}.json`)
  if (fs.existsSync(realFile)) {
    try { 
      const content = fs.readFileSync(realFile, 'utf-8')
      if (content) return JSON.parse(content) as T 
    } catch (e) {
      console.error(`[DATA] Error parsing real snapshot ${id}:`, e)
    }
  }
  if (sbClient) {
    try {
      const { data, error } = await sbClient
        .from('dx_snapshots')
        .select('data')
        .eq('id', id)
        .single()
      if (!error && data?.data) return data.data as T
    } catch (e) {
      console.error(`[DATA] Supabase error for ${id}:`, e)
    }
  }
  return defaultValue
}

// ── DATA LOADERS (Direct Pass-through, No redundant filtering) ──

export async function getPeopleData() {
  const [overview, dau, users, roles, cohort, sessions, events] = await Promise.all([
    loadSnapshot<any>('overview', { kpis: {}, trends: {} }),
    loadSnapshot<any>('dau_series', { series: [] }),
    loadSnapshot<any>('users', { users: [] }),
    loadSnapshot<any>('role_distribution', { roles: [] }),
    loadSnapshot<any>('cohort_retention', { cohorts: [] }),
    loadSnapshot<any>('session_stats', { by_role: [] }),
    loadSnapshot<any>('user_events', { events: [] }),
  ])

  return { overview, dau, users, roles, cohort, sessions, events, real: {} }
}

export async function getServicesData() {
  const [services, heatmap, events, drill, heatmapDrill, servicesWindows] = await Promise.all([
    loadSnapshot<any>('service_usage', { services: [] }),
    loadSnapshot<any>('event_heatmap', { matrix: [] }),
    loadSnapshot<any>('user_events', { events: [] }),
    loadSnapshot<any>('service_drill', {}),
    loadSnapshot<any>('event_heatmap_drill', { cells: [] }),
    loadSnapshot<any>('services_windows', {}),
  ])

  return { services, heatmap, events, drill, heatmapDrill, servicesWindows, real: {} }
}

export async function getHealthData() {
  const [health, sessions, overview, events, healthWindows] = await Promise.all([
    loadSnapshot<any>('health_overview', { kpis: {}, success_rate_series: [], failure_by_service: [], failure_by_event: [], login_funnel: [] }),
    loadSnapshot<any>('session_stats', { kpis: {}, duration_buckets: [], events_per_session_buckets: [], by_role: [] }),
    loadSnapshot<any>('overview', { kpis: {}, trends: {} }),
    loadSnapshot<any>('user_events', { events: [] }),
    loadSnapshot<any>('health_windows', {}),
  ])
  return { health, sessions, overview, events, healthWindows, real: {} }
}

export const getOverview         = () => loadSnapshot<any>('overview', {})
export const getDauSeries        = () => loadSnapshot<any>('dau_series', { series: [] })
export const getUsers            = () => loadSnapshot<any>('users', { users: [] })
export const getRoleDistribution = () => loadSnapshot<any>('role_distribution', { roles: [] })
export const getCohortRetention  = () => loadSnapshot<any>('cohort_retention', { cohorts: [] })
export const getServiceUsage     = () => loadSnapshot<any>('service_usage', { services: [] })
export const getEventHeatmap     = () => loadSnapshot<any>('event_heatmap', { matrix: [] })
export const getSessionStats     = () => loadSnapshot<any>('session_stats', { by_role: [] })
export const getHealthOverview   = () => loadSnapshot<any>('health_overview', { kpis: {} })
export const getUserEvents       = () => loadSnapshot<any>('user_events', { events: [] })
export const getServiceDrill     = () => loadSnapshot<any>('service_drill', {})
export const getServicesWindows  = () => loadSnapshot<any>('services_windows', {})
