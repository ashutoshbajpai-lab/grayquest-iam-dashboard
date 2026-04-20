'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { NAV_TABS, ROUTES } from '@/lib/constants'
import { useFilterStore } from '@/store/filterStore'
import { DASHBOARD_USER_NAME, DASHBOARD_USER_ROLE } from '@/lib/config'

const NAV_ICONS: Record<string, React.ReactNode> = {
  people: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  services: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  health: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  metrics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
}

export default function Sidebar() {
  const pathname       = usePathname()
  const router         = useRouter()
  const { sidebarOpen, setSidebarOpen } = useFilterStore()

  // Close sidebar on navigation
  useEffect(() => { setSidebarOpen(false) }, [pathname, setSidebarOpen])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [setSidebarOpen])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push(ROUTES.LOGIN)
  }

  const sidebarContent = (
    <aside
      className="flex flex-col w-56 flex-shrink-0 h-full bg-bg-sidebar border-r border-bg-border"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-bg-border flex-shrink-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
          <span className="text-white font-bold text-sm" aria-hidden="true">G</span>
        </div>
        <div>
          <p className="text-sm font-bold text-txt-primary leading-tight">GrayQuest</p>
          <p className="text-[10px] text-txt-muted leading-tight">IAM Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-txt-muted uppercase tracking-widest px-3 mb-2">Menu</p>
        {NAV_TABS.map(tab => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'text-white shadow-sm'
                  : 'text-txt-secondary hover:text-txt-primary hover:bg-bg-elevated'
              }`}
              style={active ? { backgroundColor: 'var(--color-accent)' } : {}}
            >
              <span className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-txt-muted group-hover:text-txt-primary'}`}>
                {NAV_ICONS[tab.id]}
              </span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-bg-border space-y-1 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
            style={{ background: 'var(--color-accent)' }}
            aria-hidden="true">
            {DASHBOARD_USER_NAME[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-txt-primary truncate">{DASHBOARD_USER_NAME.split(' ')[0]}</p>
            <p className="text-[10px] text-txt-muted truncate">{DASHBOARD_USER_ROLE}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-txt-muted hover:text-status-failure transition-all duration-150"
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'color-mix(in srgb, #EF4444 8%, transparent)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="font-medium">Sign out</span>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop — always visible */}
      <div className="hidden lg:flex min-h-screen">
        {sidebarContent}
      </div>

      {/* Mobile — overlay */}
      {sidebarOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="lg:hidden fixed top-0 left-0 h-full z-50 animate-slide-in-left">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
