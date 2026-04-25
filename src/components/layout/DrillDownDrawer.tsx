'use client'

import { useEffect, useRef } from 'react'

export interface DrawerBreadcrumb {
  label: string
  onClick: () => void
}

interface DrillDownDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  breadcrumbs?: DrawerBreadcrumb[]
  children: React.ReactNode
}

export default function DrillDownDrawer({ open, onClose, title, breadcrumbs = [], children }: DrillDownDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel (Glassmorphic) */}
      <div
        ref={drawerRef}
        className="relative h-[calc(100vh-24px)] w-[50%] min-w-[480px] max-w-[720px] my-3 mr-3 bg-white/75 backdrop-blur-3xl rounded-[32px] border border-white/60 shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden animate-in slide-in-from-right duration-500 ease-out"
      >
        {/* Header Section */}
        <div className="px-8 pt-8 pb-4 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1.5 text-[11px] font-black text-[#94A3B8] uppercase tracking-widest">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <button onClick={crumb.onClick} className="hover:text-[#6366F1] transition-colors">{crumb.label}</button>
                    <span>/</span>
                  </span>
                ))}
                <span className="text-[#64748B]">{title}</span>
              </div>
            </div>
            
            {/* Close Button (Circle X) */}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/50 border border-white/80 shadow-sm flex items-center justify-center text-[#64748B] hover:text-[#111827] hover:bg-white transition-all group"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4 group-hover:scale-110 transition-transform">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  )
}
