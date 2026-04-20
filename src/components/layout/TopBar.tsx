'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useFilterStore } from '@/store/filterStore'
import AlertsPanel from '@/components/ui/AlertsPanel'
import { NAV_TABS } from '@/lib/constants'
import { DASHBOARD_USER_NAME, COLORS } from '@/lib/config'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1"  x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

export default function TopBar() {
  const pathname = usePathname()
  const { isDark, setDark, setSidebarOpen } = useFilterStore()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)

  // Sync Zustand isDark with what the pre-hydration script already applied to <html>
  useEffect(() => {
    const wantDark = document.documentElement.classList.contains('dark')
    if (wantDark !== isDark) {
      // Update Zustand without calling setDark (which would re-toggle the DOM)
      // We just need state to match the DOM
      setDark(wantDark)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pageTitle = NAV_TABS.find(t => pathname.startsWith(t.href))?.label ?? 'Dashboard'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <header className="sticky top-0 z-40 bg-bg-surface border-b border-bg-border flex-shrink-0"
      style={{ boxShadow: '0 1px 0 var(--raw-bg-border)' }}>
      <div className="flex items-center justify-between px-6 h-16">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-txt-muted hover:text-txt-primary hover:bg-bg-elevated transition-all border border-bg-border mr-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5" aria-hidden="true">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Page title */}
        <div>
          <h1 className="text-xl font-extrabold text-txt-primary tracking-tight">{pageTitle}</h1>
          <p className="text-xs text-txt-muted">{greeting}, {DASHBOARD_USER_NAME.split(' ')[0]}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setDark(!isDark)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-txt-muted hover:text-txt-primary hover:bg-bg-elevated transition-all border border-bg-border"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Alerts bell */}
          <div className="relative">
            <button
              onClick={() => setAlertsOpen(o => !o)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-txt-muted hover:text-txt-primary hover:bg-bg-elevated transition-all border border-bg-border relative"
              aria-label="Open alerts"
              title="Alerts"
            >
              <BellIcon />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-status-failure text-white text-[10px] font-bold flex items-center justify-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
            {alertsOpen && (
              <AlertsPanel
                onClose={() => setAlertsOpen(false)}
                onCountChange={setAlertCount}
              />
            )}
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: 'var(--color-accent)' }}>
            {DASHBOARD_USER_NAME[0]?.toUpperCase() ?? 'A'}
          </div>
        </div>
      </div>
    </header>
  )
}
