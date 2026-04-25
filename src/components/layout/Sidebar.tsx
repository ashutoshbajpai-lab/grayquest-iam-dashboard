'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { NAV_TABS, ROUTES } from '@/lib/constants'
import { useFilterStore } from '@/store/filterStore'
import { DASHBOARD_USER_NAME, DASHBOARD_USER_ROLE } from '@/lib/config'

const NAV_ICONS: Record<string, React.ReactNode> = {
  people: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  services: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  health: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  metrics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarOpen, setSidebarOpen } = useFilterStore()

  useEffect(() => { setSidebarOpen(false) }, [pathname, setSidebarOpen])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push(ROUTES.LOGIN)
  }

  const content = (
    <div className="flex flex-col h-full bg-transparent">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-20 flex-shrink-0">
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center bg-[#6366F1] shadow-lg shadow-indigo-200">
          <span className="text-white font-black text-lg">G</span>
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-black text-[#111827] leading-tight truncate">GrayQuest</p>
          <p className="text-[10px] font-bold text-[#9CA3AF] leading-tight truncate">IAM Dashboard</p>
        </div>
      </div>

      {/* Nav Section */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.2em] px-3 mb-4">Main Menu</p>
        {NAV_TABS.map(tab => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[13px] font-black transition-all duration-300 group ${
                active
                  ? 'bg-[#6366F1] text-white shadow-lg shadow-indigo-100 scale-[1.02]'
                  : 'text-[#64748B] hover:text-[#111827] hover:bg-white/60'
              }`}
            >
              <span className={`transition-colors ${active ? 'text-white' : 'text-[#94A3B8] group-hover:text-[#6366F1]'}`}>
                {NAV_ICONS[tab.id]}
              </span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Profile Section (Bottom) */}
      <div className="p-4 mt-auto">
        <div className="p-4 rounded-[24px] bg-white/40 border border-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-xs font-black shadow-sm">
              {DASHBOARD_USER_NAME[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-black text-[#111827] truncate">{DASHBOARD_USER_NAME.split(' ')[0]}</p>
              <p className="text-[9px] font-bold text-[#94A3B8] truncate">{DASHBOARD_USER_ROLE}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black text-[#EF4444] hover:bg-red-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="hidden lg:block h-full">
        {content}
      </div>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-[#0F172A]/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute top-4 left-4 bottom-4 w-64 bg-white/90 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-white/60 animate-in slide-in-from-left duration-300">
            {content}
          </div>
        </div>
      )}
    </>
  )
}
