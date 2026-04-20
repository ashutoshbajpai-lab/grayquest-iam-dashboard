'use client'

import { useState } from 'react'
import type { IamUser as User } from '@/types/people'
import { AVATAR_PALETTE, HEALTH } from '@/lib/config'

function Avatar({ name }: { name: string }) {
  const { bg, fg } = AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length]
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 select-none"
      style={{ backgroundColor: bg, color: fg }}
    >
      {initials}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────
function StatusBadge({ score }: { score: number }) {
  const cfg =
    score >= HEALTH.ACTIVE
      ? { label: 'Active',   bgColor: 'rgba(16,185,129,0.10)', textColor: '#059669',  dot: '#10B981' }
      : score >= HEALTH.AT_RISK
      ? { label: 'At Risk',  bgColor: 'rgba(217,119,6,0.10)',  textColor: '#D97706',  dot: '#F59E0B' }
      : { label: 'Inactive', bgColor: 'rgba(239,68,68,0.10)',  textColor: '#DC2626',  dot: '#EF4444' }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bgColor, color: cfg.textColor }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

// ── Role badge ────────────────────────────────────────────────────
const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  'Institute Admin': { bg: 'rgba(124,111,247,0.10)', color: '#7C6FF7' },
  'IAM Admin':       { bg: 'rgba(16,185,129,0.10)',  color: '#059669' },
  'Service Manager': { bg: 'rgba(14,165,233,0.10)',  color: '#0284C7' },
  'Finance Officer': { bg: 'rgba(217,119,6,0.10)',   color: '#D97706' },
  'Audit Officer':   { bg: 'rgba(239,68,68,0.10)',   color: '#DC2626' },
}

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? {
    bg: 'var(--color-bg-elevated)',
    color: 'var(--color-txt-secondary)',
  }
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {role}
    </span>
  )
}

// ── Sort types ────────────────────────────────────────────────────
type SortKey = 'name' | 'health_score' | 'sessions_30d' | 'last_active' | 'login_success_rate'

interface Props {
  users: User[]
  onSelect: (user: User) => void
  search?: string
}

export default function UserTable({ users, onSelect, search = '' }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'health_score', dir: 'desc',
  })

  const filtered = users
    .filter(u => {
      const q = search.toLowerCase()
      return (
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.group.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key]
      const cmp =
        typeof av === 'string'
          ? av.localeCompare(String(bv))
          : (av as number) - (bv as number)
      return sort.dir === 'asc' ? cmp : -cmp
    })

  function toggle(key: SortKey) {
    setSort(s =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' }
    )
  }

  function Th({ k, label }: { k: SortKey; label: string }) {
    const active = sort.key === k
    return (
      <th
        onClick={() => toggle(k)}
        className="px-5 py-3.5 text-left text-[11px] font-semibold text-txt-muted uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-txt-primary transition-colors"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (
            <span className="text-accent font-bold">{sort.dir === 'desc' ? '↓' : '↑'}</span>
          ) : (
            <span className="opacity-30">↕</span>
          )}
        </span>
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {/* Header */}
        <thead>
          <tr className="border-b border-bg-border bg-bg-elevated/50">
            <Th k="name" label="User" />
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-txt-muted uppercase tracking-wider whitespace-nowrap">
              Department
            </th>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-txt-muted uppercase tracking-wider whitespace-nowrap">
              Role
            </th>
            <Th k="health_score"       label="Status"     />
            <Th k="sessions_30d"       label="Sessions"   />
            <Th k="login_success_rate" label="Login Rate" />
            <Th k="last_active"        label="Last Active" />
            <th className="px-5 py-3.5 w-12" />
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {filtered.map((user, i) => (
            <tr
              key={user.user_id}
              onClick={() => onSelect(user)}
              className={`group cursor-pointer transition-colors hover:bg-accent/[0.04] ${
                i % 2 !== 0 ? 'bg-bg-elevated/20' : ''
              }`}
            >
              {/* User — avatar + name + email */}
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-txt-primary group-hover:text-accent transition-colors truncate leading-snug">
                      {user.name}
                    </p>
                    <p className="text-xs text-txt-muted truncate mt-0.5">{user.email}</p>
                  </div>
                </div>
              </td>

              {/* Department */}
              <td className="px-5 py-3.5">
                <span className="text-sm text-txt-secondary">{user.group}</span>
              </td>

              {/* Role */}
              <td className="px-5 py-3.5">
                <RoleBadge role={user.role} />
              </td>

              {/* Status */}
              <td className="px-5 py-3.5">
                <StatusBadge score={user.health_score} />
              </td>

              {/* Sessions */}
              <td className="px-5 py-3.5">
                <span className="text-sm font-semibold text-txt-primary">{user.sessions_30d}</span>
                <p className="text-[10px] text-txt-muted mt-0.5">30 days</p>
              </td>

              {/* Login rate — mini bar + % */}
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-14 h-1.5 rounded-full bg-bg-border overflow-hidden flex-shrink-0">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${user.login_success_rate}%`,
                        backgroundColor:
                          user.login_success_rate >= 90
                            ? 'var(--color-status-success)'
                            : user.login_success_rate >= 75
                            ? 'var(--color-status-pending)'
                            : 'var(--color-status-failure)',
                      }}
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      user.login_success_rate >= 90
                        ? 'text-status-success'
                        : user.login_success_rate >= 75
                        ? 'text-status-pending'
                        : 'text-status-failure'
                    }`}
                  >
                    {user.login_success_rate}%
                  </span>
                </div>
              </td>

              {/* Last active */}
              <td className="px-5 py-3.5">
                <span className="text-sm text-txt-muted">{user.last_active}</span>
              </td>

              {/* View action */}
              <td className="px-5 py-3.5">
                <button
                  onClick={e => { e.stopPropagation(); onSelect(user) }}
                  title="View details"
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-txt-muted hover:text-accent hover:bg-accent/10"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </td>
            </tr>
          ))}

          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-3 text-txt-muted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-9 h-9 opacity-35">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <p className="text-sm font-medium">No users match the current filters</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
