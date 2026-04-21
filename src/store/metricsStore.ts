'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CustomMetric, Section } from '@/types'

interface MetricsStore {
  metrics: CustomMetric[]
  addMetric:    (m: Omit<CustomMetric, 'id' | 'createdAt'>) => void
  removeMetric: (id: string) => void
  pinMetric:    (id: string, section: Section) => void
  unpinMetric:  (id: string, section: Section) => void
  updateResult: (id: string, result: string | number) => void
}

function sanitizeResult(r: unknown): string {
  if (r === null || r === undefined) return ''
  if (typeof r === 'object') return JSON.stringify(r)
  return String(r)
}

export const useMetricsStore = create<MetricsStore>()(
  persist(
    (set) => ({
      metrics: [],

      addMetric: (m) => set((s) => ({
        metrics: [...s.metrics, {
          ...m,
          result:    sanitizeResult(m.result),
          id:        crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }],
      })),

      removeMetric: (id) => set((s) => ({ metrics: s.metrics.filter(m => m.id !== id) })),

      pinMetric: (id, section) => set((s) => ({
        metrics: s.metrics.map(m =>
          m.id === id && !m.pinnedTo.includes(section)
            ? { ...m, pinnedTo: [...m.pinnedTo, section] }
            : m
        ),
      })),

      unpinMetric: (id, section) => set((s) => ({
        metrics: s.metrics.map(m =>
          m.id === id
            ? { ...m, pinnedTo: m.pinnedTo.filter(p => p !== section) }
            : m
        ),
      })),

      updateResult: (id, result) => set((s) => ({
        metrics: s.metrics.map(m => m.id === id ? { ...m, result } : m),
      })),
    }),
    {
      name: 'gq-custom-metrics',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.metrics = state.metrics.map(m => ({
          ...m,
          result: sanitizeResult(m.result),
        }))
      },
    }
  )
)
