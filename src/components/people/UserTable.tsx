'use client'

import { useState } from 'react'
import type { IamUser as User } from '@/types/people'
import { AVATAR_PALETTE } from '@/lib/config'

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

function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === 'active'
      ? { label: 'Active',   bgColor: 'rgba(16,185,129,0.10)', textColor: '#059669',  dot: '#10B981' }
      : status === 'at_risk'
      ? { label: 'At Risk',  bgColor: 'rgba(217,119,6,0.10)',  textColor: '#D97706',  dot: '#F59E0B' }
      : status === 'system'
      ? { label: 'System / API', bgColor: 'var(--color-bg-elevated)', textColor: 'var(--color-txt-secondary)', dot: 'var(--color-bg-border)' }
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

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  'Institute Admin':            { bg: 'rgba(124,111,247,0.12)', color: '#7C6FF7' },
  'IAM Admin':                  { bg: 'rgba(16,185,129,0.12)',  color: '#059669' },
  'Service Manager':            { bg: 'rgba(14,165,233,0.12)',  color: '#0284C7' },
  'Finance Officer':            { bg: 'rgba(217,119,6,0.12)',   color: '#D97706' },
  'Audit Officer':              { bg: 'rgba(239,68,68,0.12)',   color: '#DC2626' },
  'Group manager':              { bg: 'rgba(79,110,247,0.10)',  color: '#4F6EF7' },
  'Block Master Dashboard':     { bg: 'rgba(14,165,233,0.10)', color: '#0284C7' },
  'Group Admissions Manager':   { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  'FMS Dashboard Limited':      { bg: 'rgba(245,158,11,0.10)', color: '#D97706' },
  'Backend Engineer':           { bg: 'rgba(124,111,247,0.10)',color: '#7C6FF7' },
  'Institute Dashboard Manager':{ bg: 'rgba(239,68,68,0.10)',  color: '#DC2626' },
}

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? { bg: 'rgba(107,114,128,0.10)', color: '#6B7280' }
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {role}
    </span>
  )
}

type SortKey = 'name' | 'health_score' | 'sessions_30d' | 'last_active' | 'auth_success_rate'

interface Props {
  users: User[]
  onSelect: (user: User) => void
  totalCount: number
  onShowMore?: () => void
  onCollapse?: () => void
  pageSize: number
}

export default function UserTable({ users, onSelect, totalCount, onShowMore, onCollapse, pageSize }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'health_score', dir: 'desc',
  })

  const sortedUsers = [...users].sort((a, b) => {
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
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/40" style={{ background: 'rgba(240,243,255,0.6)' }}>
              <Th k="name" label="User" />
              <th className="px-5 py-3.5 text-left text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.08em] whitespace-nowrap">Department</th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.08em] whitespace-nowrap">Role</th>
              <Th k="health_score"       label="Status"     />
              <Th k="sessions_30d"       label="Sessions"   />
              <Th k="auth_success_rate"  label="Login Rate" />
              <Th k="last_active"        label="Last Active" />
            </tr>
          </thead>

          <tbody>
            {sortedUsers.map((user) => (
              <tr
                key={user.user_id}
                onClick={() => onSelect(user)}
                className="group cursor-pointer transition-colors border-b border-white/30 last:border-0"
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,110,247,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111827] group-hover:text-[#4F6EF7] transition-colors truncate leading-snug">
                        {user.name}
                      </p>
                      <p className="text-xs text-[#9CA3AF] truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-3.5">
                  <span className="text-sm text-txt-secondary">{user.group}</span>
                </td>

                <td className="px-5 py-3.5">
                  <RoleBadge role={user.role} />
                </td>

                <td className="px-5 py-3.5">
                  <StatusBadge status={user.status} />
                </td>

                <td className="px-5 py-3.5">
                  <span className="text-sm font-semibold text-txt-primary">{user.sessions_30d}</span>
                  <p className="text-[10px] text-txt-muted mt-0.5">30 days</p>
                </td>

                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'rgba(79,110,247,0.12)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${user.auth_success_rate ?? 0}%`,
                          background: 'linear-gradient(90deg, #4F6EF7, #7C3AED)',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#374151]">
                      {user.auth_success_rate ?? 0}%
                    </span>
                  </div>
                </td>

                <td className="px-5 py-3.5">
                  <span className="text-sm text-txt-muted">{user.last_active}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(pageSize < totalCount || pageSize > 10) && (
        <div className="p-6 text-center border-t border-white/40 bg-slate-50/30 flex flex-col items-center gap-3">
          <div className="flex gap-4">
            {pageSize < totalCount && onShowMore && (
              <button
                onClick={onShowMore}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-[#6366F1] text-white text-[13px] font-black shadow-xl shadow-indigo-200/50 hover:bg-[#4F46E5] hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                Show More Users
                <span className="bg-white/20 px-2 py-0.5 rounded-md text-[10px] ml-1">
                  {totalCount - pageSize} remaining
                </span>
              </button>
            )}
            
            {pageSize > 10 && onCollapse && (
              <button
                onClick={onCollapse}
                className="px-8 py-3 rounded-2xl bg-white border border-slate-200 text-[#6B7280] text-[13px] font-black hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-sm"
              >
                Collapse List
              </button>
            )}
          </div>
          
          <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest">
            Showing {pageSize} of {totalCount} verified users
          </p>
        </div>
      )}
    </div>
  )
}
