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
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full w-[45%] min-w-[400px] max-w-[760px] bg-bg-surface border-l border-bg-border z-50 flex flex-col animate-slide-in shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-bg-border flex-shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-txt-muted flex-wrap">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span>/</span>}
                    <button
                      onClick={crumb.onClick}
                      className="hover:text-txt-primary transition-colors"
                    >
                      {crumb.label}
                    </button>
                  </span>
                ))}
                <span>/</span>
                <span className="text-txt-secondary">{title}</span>
              </div>
            )}
            <h2 className="text-base font-semibold text-txt-primary truncate">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="text-txt-muted hover:text-txt-primary text-xl leading-none ml-4 flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </>
  )
}
