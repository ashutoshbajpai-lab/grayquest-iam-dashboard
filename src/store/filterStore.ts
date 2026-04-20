'use client'
import { create } from 'zustand'
import type { FilterState, DateRange } from '@/types'
import { DATASET_END_DATE, THEME_STORAGE_KEY, THEME_TRANSITION_MS } from '@/lib/config'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const defaultDateRange: DateRange = {
  preset: '30d',
  from: new Date(new Date(DATASET_END_DATE).getTime() - 30 * MS_PER_DAY).toISOString().split('T')[0],
  to: DATASET_END_DATE,
}

interface FilterStore extends FilterState {
  isDark: boolean
  setDark: (v: boolean) => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  setDateRange: (r: DateRange) => void
  setRoles: (r: string[]) => void
  setServices: (s: string[]) => void
  setStatuses: (s: FilterState['statuses']) => void
  setHourRange: (h: [number, number]) => void
  setSearch: (s: string) => void
  clearAll: () => void
  removeRole: (r: string) => void
  removeService: (s: string) => void
  removeStatus: (s: FilterState['statuses'][number]) => void
}

export const useFilterStore = create<FilterStore>((set) => ({
  isDark:      false,
  sidebarOpen: false,
  dateRange: defaultDateRange,
  roles:     [],
  services:  [],
  statuses:  [],
  hourRange: [0, 23],
  search:    '',

  setDark: (v) => {
    set({ isDark: v })
    try {
      localStorage.setItem(THEME_STORAGE_KEY, v ? 'dark' : 'light')
      const html = document.documentElement
      html.classList.add('transitioning')
      html.classList.toggle('dark', v)
      setTimeout(() => html.classList.remove('transitioning'), THEME_TRANSITION_MS)
    } catch(e) {}
  },
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setDateRange: (r) => set({ dateRange: r }),
  setRoles:     (r) => set({ roles: r }),
  setServices:  (s) => set({ services: s }),
  setStatuses:  (s) => set({ statuses: s }),
  setHourRange: (h) => set({ hourRange: h }),
  setSearch:    (s) => set({ search: s }),

  clearAll: () => set({
    roles: [], services: [], statuses: [], search: '',
    hourRange: [0, 23] as [number, number], dateRange: defaultDateRange,
  }),

  removeRole:    (r) => set((s) => ({ roles:    s.roles.filter(x => x !== r) })),
  removeService: (s) => set((st) => ({ services: st.services.filter(x => x !== s) })),
  removeStatus:  (s) => set((st) => ({ statuses: st.statuses.filter(x => x !== s) })),
}))
