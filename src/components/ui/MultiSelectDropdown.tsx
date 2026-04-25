'use client'

import { useState, useRef, useEffect } from 'react'

interface Option { value: string; label: string }

interface Props {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  label: string
}

export default function MultiSelectDropdown({ options, selected, onChange, label }: Props) {
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setFocusIdx(-1); return }
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) }
      return
    }
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, options.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && focusIdx >= 0) { e.preventDefault(); toggle(options[focusIdx].value) }
  }

  const tooltip = selected.length > 0 ? selected.join(', ') : undefined

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        title={tooltip}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
          open || selected.length > 0
            ? 'text-white'
            : 'text-txt-secondary hover:text-txt-primary hover:bg-bg-elevated border border-bg-border'
        }`}
        style={open || selected.length > 0 ? { backgroundColor: '#1C1C1E' } : {}}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {selected.length}
          </span>
        )}
        <svg viewBox="0 0 10 6" fill="currentColor" className={`w-2 h-2 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M0 0l5 6 5-6z" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 mt-1.5 left-0 bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] min-w-[220px] overflow-hidden"
        >
          <div className="overflow-y-auto" style={{ maxHeight: 272 }}>
            {options.map((opt, idx) => {
              const checked = selected.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  role="option"
                  aria-selected={checked}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs transition-colors select-none ${
                    idx === focusIdx ? 'bg-bg-elevated' : 'hover:bg-bg-elevated'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                    className="w-3.5 h-3.5 rounded accent-accent flex-shrink-0"
                  />
                  <span className={checked ? 'text-txt-primary font-medium' : 'text-txt-secondary'}>
                    {opt.label}
                  </span>
                </label>
              )
            })}
          </div>
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-bg-border">
              <button
                onClick={() => onChange([])}
                className="text-[11px] text-txt-muted hover:text-accent transition-colors"
              >
                Clear {label.toLowerCase()}s
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
