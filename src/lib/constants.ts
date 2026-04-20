export const ROUTES = {
  LOGIN: '/login',
  PEOPLE: '/dashboard/people',
  SERVICES: '/dashboard/services',
  HEALTH: '/dashboard/health',
  METRICS: '/dashboard/metrics',
  CHAT: '/dashboard/chat',
}

export const NAV_TABS = [
  { id: 'people',   label: 'People',           href: ROUTES.PEOPLE   },
  { id: 'services', label: 'Services',          href: ROUTES.SERVICES },
  { id: 'health',   label: 'Platform Health',   href: ROUTES.HEALTH   },
  { id: 'metrics',  label: 'Metrics Builder',   href: ROUTES.METRICS  },
  { id: 'chat',     label: 'Chat',              href: ROUTES.CHAT     },
] as const

export const FILTER_BAR_SECTIONS = ['people', 'services', 'health']

import { DATASET_END_DATE, AUTH_COOKIE_NAME } from './config'

function daysAgo(n: number) {
  const d = new Date(DATASET_END_DATE)
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export const DATE_PRESETS = [
  { value: 'today',  label: 'Today',  from: DATASET_END_DATE,  to: DATASET_END_DATE  },
  { value: '7d',     label: '7d',     from: daysAgo(7),        to: DATASET_END_DATE  },
  { value: '30d',    label: '30d',    from: daysAgo(30),       to: DATASET_END_DATE  },
  { value: 'custom', label: 'Custom', from: '',           to: ''          },
] as const

export const STATUS_OPTIONS = [
  { value: 'SUCCESS', label: 'Success', activeClass: 'badge-success' },
  { value: 'FAILED',  label: 'Failed',  activeClass: 'badge-failure' },
  { value: 'PENDING', label: 'Pending', activeClass: 'badge-pending' },
] as const

export const AUTH_COOKIE = AUTH_COOKIE_NAME

export const KPI_DESCRIPTIONS: Record<string, string> = {
  active_users:        'Users with at least one login in the selected period',
  retention_7d:        '% of new users who returned within 7 days of first login',
  retention_30d:       '% of new users who returned within 30 days of first login',
  dormant_users:       'Users with no login in the last 30 days',
  avg_health_score:    'Weighted score: login frequency + actions + module diversity + report usage',
  new_users_activated: 'First-time users who performed at least one action after logging in',
  active_services:     'Distinct services used in the selected period',
  overall_success_rate:'% of all events with status SUCCESS',
  cross_module_rate:   '% of sessions where users worked across 3 or more services',
  avg_session_duration:'Average time from first to last event in a session',
  completion_rate:     '% of login sessions where the user took at least one action',
  shallow_session_pct: '% of sessions with zero actions after login',
}

export const ROLE_OPTIONS = [
  'Institute Admin', 'IAM Admin', 'Service Manager', 'Finance Officer', 'Audit Officer',
] as const

export const SERVICE_NAMES = [
  'Fee Collection', 'Student Management', 'User Administration', 'Loan Management',
  'Institute Management', 'Audit Logs', 'Settings', 'Notifications',
] as const

export const EMPTY_STATES: Record<string, string> = {
  no_data:     'No data available for the selected filters.',
  no_users:    'No users match the current filters.',
  no_services: 'No services found for this filter combination.',
  no_events:   'No events recorded in this period.',
}
