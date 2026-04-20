'use client'

import { useFilterStore } from '@/store/filterStore'
import { DATE_PRESETS, FILTER_BAR_SECTIONS, ROLE_OPTIONS, SERVICE_NAMES } from '@/lib/constants'
import { usePathname } from 'next/navigation'
import { Section } from '@/types'

export default function FilterBar() {
  const pathname = usePathname()
  const {
    dateRange, setDateRange,
    search, setSearch,
    clearAll,
    roles, setRoles,
    services, setServices,
    hourRange, setHourRange,
  } = useFilterStore()

  const currentSection = pathname.split('/')[2] as Section
  if (!FILTER_BAR_SECTIONS.includes(currentSection)) return null

  function toggleRole(r: string) {
    setRoles(roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r])
  }

  function toggleService(s: string) {
    setServices(services.includes(s) ? services.filter(x => x !== s) : [...services, s])
  }

  const isCustom = dateRange.preset === 'custom'

  return (
    <div className="bg-bg-surface/80 backdrop-blur-sm border-b border-bg-border px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* Search */}
      <input
        type="text"
        placeholder="Search users, events, services…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="input-base w-52 h-8 py-1.5 text-xs"
      />

      {/* Date presets */}
      <div className="flex items-center gap-1">
        {DATE_PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => setDateRange({ preset: p.value as never, from: p.from, to: p.to })}
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

      {/* Custom date range inputs — BUG-010 fix */}
      {isCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.from}
            max={dateRange.to || undefined}
            onChange={e => setDateRange({ preset: 'custom', from: e.target.value, to: dateRange.to })}
            className="input-base h-8 py-1 text-xs"
          />
          <span className="text-xs text-txt-muted">→</span>
          <input
            type="date"
            value={dateRange.to}
            min={dateRange.from || undefined}
            onChange={e => setDateRange({ preset: 'custom', from: dateRange.from, to: e.target.value })}
            className="input-base h-8 py-1 text-xs"
          />
        </div>
      )}

      {/* Role chips — People page only — BUG-011 fix */}
      {currentSection === 'people' && (
        <div className="flex items-center gap-1 border-l border-bg-border pl-3">
          <span className="text-[10px] text-txt-muted font-semibold uppercase tracking-wide mr-1">Role</span>
          {ROLE_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => toggleRole(r)}
              title={r}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                roles.includes(r)
                  ? 'text-white'
                  : 'bg-bg-elevated text-txt-muted hover:text-txt-primary border border-bg-border'
              }`}
              style={roles.includes(r) ? { backgroundColor: '#1C1C1E' } : {}}
            >
              {r.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Service chips + Hour range — Services page only — BUG-011 fix */}
      {currentSection === 'services' && (
        <>
          <div className="flex items-center gap-1 border-l border-bg-border pl-3 flex-wrap">
            <span className="text-[10px] text-txt-muted font-semibold uppercase tracking-wide mr-1">Service</span>
            {SERVICE_NAMES.map(s => (
              <button
                key={s}
                onClick={() => toggleService(s)}
                title={s}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                  services.includes(s)
                    ? 'text-white'
                    : 'bg-bg-elevated text-txt-muted hover:text-txt-primary border border-bg-border'
                }`}
                style={services.includes(s) ? { backgroundColor: '#1C1C1E' } : {}}
              >
                {s.split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border-l border-bg-border pl-3">
            <span className="text-[10px] text-txt-muted font-semibold uppercase tracking-wide">Hours</span>
            <input
              type="number"
              min={0} max={23}
              value={hourRange[0]}
              onChange={e => {
                const v = Math.max(0, Math.min(23, Number(e.target.value)))
                setHourRange([Math.min(v, hourRange[1]), hourRange[1]])
              }}
              className="input-base w-12 h-7 py-0.5 text-xs text-center"
            />
            <span className="text-xs text-txt-muted">–</span>
            <input
              type="number"
              min={0} max={23}
              value={hourRange[1]}
              onChange={e => {
                const v = Math.max(0, Math.min(23, Number(e.target.value)))
                setHourRange([hourRange[0], Math.max(v, hourRange[0])])
              }}
              className="input-base w-12 h-7 py-0.5 text-xs text-center"
            />
          </div>
        </>
      )}

      {/* Clear */}
      <button onClick={clearAll} className="ml-auto text-xs text-txt-muted hover:text-txt-primary transition-colors">
        Clear filters
      </button>
    </div>
  )
}
