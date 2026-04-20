'use client'

import { useMetricsStore } from '@/store/metricsStore'
import type { Section } from '@/types'

export default function PinnedMetrics({ section }: { section: Section }) {
  const { metrics } = useMetricsStore()
  const pinned = metrics.filter(m => m.pinnedTo.includes(section))
  if (pinned.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold text-txt-muted uppercase tracking-widest">Pinned Metrics</span>
        <span className="text-[10px] text-txt-muted">· from Metrics Builder</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {pinned.map(m => (
          <div key={m.id} className="card px-4 py-3 flex flex-col gap-0.5 min-w-[130px] hover:border-accent/30 transition-colors">
            <p className="text-[10px] text-txt-muted uppercase tracking-wide truncate max-w-[160px]">{m.name}</p>
            <p className="text-lg font-bold text-accent font-mono">{m.result}</p>
            {m.description && (
              <p className="text-[10px] text-txt-muted truncate max-w-[160px]">{m.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
