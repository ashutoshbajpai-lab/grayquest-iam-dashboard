'use client'

import { useState } from 'react'
import { useFilterStore } from '@/store/filterStore'
import { DATE_PRESETS, FILTER_BAR_SECTIONS, ROLE_OPTIONS, SERVICE_NAMES } from '@/lib/constants'
import { usePathname } from 'next/navigation'
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown'
import type { Section } from '@/types'

const ROLE_OPTS = ROLE_OPTIONS.map(r => ({ value: r, label: r }))
const SERVICE_OPTS = SERVICE_NAMES.map(s => ({ value: s, label: s }))

// Inner component — all hooks here, no early returns
function FilterBarInner({ currentSection }: { currentSection: Section }) {
  const {
    dateRange, setDateRange,
    clearAll,
    roles, setRoles,
    services, setServices,
  } = useFilterStore()

  const [customFrom, setCustomFrom] = useState(dateRange.preset === 'custom' ? dateRange.from : '')
  const [customTo,   setCustomTo]   = useState(dateRange.preset === 'custom' ? dateRange.to   : '')
  const [dateError,  setDateError]  = useState('')

  const isCustom = dateRange.preset === 'custom'

  function applyCustomRange(from: string, to: string) {
    setDateError('')
    if (!from || !to) return
    if (from > to) {
      setDateError('Start date must be on or before end date')
      return
    }
    setDateRange({ preset: 'custom', from, to })
  }

  function handleCustomFrom(v: string) {
    setCustomFrom(v)
    applyCustomRange(v, customTo)
  }

  function handleCustomTo(v: string) {
    setCustomTo(v)
    applyCustomRange(customFrom, v)
  }

  function handlePreset(preset: string, from: string, to: string) {
    setDateError('')
    if (preset === 'custom') {
      setCustomFrom('')
      setCustomTo('')
    }
    setDateRange({ preset: preset as never, from, to })
  }

  return (
    <div className="sticky top-0 z-[60] bg-bg-surface/80 backdrop-blur-sm border-b border-bg-border px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* Date presets */}
      <div className="flex items-center gap-1">
        {DATE_PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value, p.from, p.to)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150 ${
              dateRange.preset === p.value
                ? 'text-white'
                : 'text-txt-secondary hover:text-txt-primary hover:bg-bg-elevated'
            }`}
            style={dateRange.preset === p.value ? { backgroundColor: '#1C1C1E' } : {}}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range inputs */}
      {isCustom && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => handleCustomFrom(e.target.value)}
              className="input-base h-8 py-1 text-xs"
            />
            <span className="text-xs text-txt-muted">→</span>
            <input
              type="date"
              value={customTo}
              onChange={e => handleCustomTo(e.target.value)}
              className="input-base h-8 py-1 text-xs"
            />
          </div>
          {dateError && (
            <span className="text-[11px] text-status-failure">{dateError}</span>
          )}
        </div>
      )}

      {/* Role dropdown — People page only */}
      {currentSection === 'people' && (
        <div className="flex items-center gap-2 border-l border-bg-border pl-3">
          <span className="text-[10px] text-txt-muted font-semibold uppercase tracking-wide">Role</span>
          <MultiSelectDropdown
            options={ROLE_OPTS}
            selected={roles}
            onChange={setRoles}
            label="Role"
          />
        </div>
      )}

      {/* Service dropdown — Services page only */}
      {currentSection === 'services' && (
        <div className="flex items-center gap-2 border-l border-bg-border pl-3">
          <span className="text-[10px] text-txt-muted font-semibold uppercase tracking-wide">Service</span>
          <MultiSelectDropdown
            options={SERVICE_OPTS}
            selected={services}
            onChange={setServices}
            label="Service"
          />
        </div>
      )}

      {/* Clear */}
      <button
        onClick={() => {
          setCustomFrom('')
          setCustomTo('')
          setDateError('')
          clearAll()
        }}
        className="ml-auto text-xs text-txt-muted hover:text-txt-primary transition-colors"
      >
        Clear filters
      </button>
    </div>
  )
}

// Outer component — only usePathname here, safe to return null before hooks
export default function FilterBar() {
  const pathname = usePathname()
  const currentSection = pathname.split('/')[2] as Section
  if (!FILTER_BAR_SECTIONS.includes(currentSection)) return null
  return <FilterBarInner currentSection={currentSection} />
}
