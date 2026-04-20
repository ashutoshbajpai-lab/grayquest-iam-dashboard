'use client'

import { useState } from 'react'
import { useMetricsStore } from '@/store/metricsStore'
import type { CustomMetric, Section } from '@/types'

const SECTION_OPTIONS: { id: Section; label: string }[] = [
  { id: 'people',   label: 'People'         },
  { id: 'services', label: 'Services'        },
  { id: 'health',   label: 'Platform Health' },
]

const FORMULA_TEMPLATES = [
  { label: 'DAU / MAU Ratio',            formula: 'daily_active_users / monthly_active_users * 100' },
  { label: 'Failure Rate',               formula: 'failed_events / total_events * 100' },
  { label: '% High-Health Users',        formula: 'users with health_score >= 75 / total_active_users * 100' },
  { label: 'Avg Events per Active User', formula: 'total_events_30d / active_users_30d' },
  { label: 'Report Export Efficiency',   formula: 'total_reports_exported / total_reports_generated * 100' },
  { label: 'Session Engagement Score',   formula: 'avg_events_per_session * completion_rate / 100' },
  { label: 'Cross-Module Rate',          formula: 'sessions spanning 3 or more services / total sessions' },
  { label: 'Top Service by Success',     formula: 'service with highest success rate' },
]

function MetricResultBadge({ result }: { result: string | number }) {
  return (
    <span className="inline-block bg-accent/15 text-accent font-mono text-sm px-3 py-1 rounded-lg">
      {result}
    </span>
  )
}

function PinToggle({ metric }: { metric: CustomMetric }) {
  const { pinMetric, unpinMetric } = useMetricsStore()

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {SECTION_OPTIONS.map(s => {
        const pinned = metric.pinnedTo.includes(s.id)
        return (
          <button
            key={s.id}
            onClick={() => pinned ? unpinMetric(metric.id, s.id) : pinMetric(metric.id, s.id)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              pinned
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-bg-border text-txt-muted hover:border-accent/50 hover:text-txt-secondary'
            }`}
          >
            {pinned ? '📌' : '+'} {s.label}
          </button>
        )
      })}
    </div>
  )
}

export default function MetricsClient() {
  const { metrics, addMetric, removeMetric } = useMetricsStore()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [formula,     setFormula]     = useState('')
  const [computing,   setComputing]   = useState(false)
  const [preview,     setPreview]     = useState<string | null>(null)
  const [error,       setError]       = useState('')
  const [aiSource,    setAiSource]    = useState<string>('')

  async function compute(save = false) {
    if (!formula.trim()) { setError('Enter a formula or description'); return }
    setError(''); setComputing(true); setPreview(null)

    try {
      const res = await fetch('/api/metrics/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || 'Custom Metric', description, formula }),
      })
      const data = await res.json() as { result?: string; error?: string; source?: string }
      if (!res.ok || data.error) { setError(data.error ?? 'Compute failed'); return }

      const result = data.result ?? ''
      setPreview(result)
      setAiSource(data.source ?? '')

      if (save) {
        if (!name.trim()) { setError('Name is required to save'); return }
        addMetric({ name: name.trim(), description, formula, result, pinnedTo: [] })
        setName(''); setDescription(''); setFormula(''); setPreview(null)
      }
    } catch {
      setError('Network error')
    } finally {
      setComputing(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Builder panel */}
      <div className="xl:col-span-2 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-txt-primary">Metrics Builder</h2>
          <p className="text-xs text-txt-muted mt-0.5">Define metrics in plain English or formula syntax — AI computes the result from your dashboard data.</p>
        </div>

        <div className="card p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-txt-secondary">Metric Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Power User Rate"
              className="input-base w-full"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-txt-secondary">Description <span className="text-txt-muted">(optional)</span></label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this metric measure?"
              className="input-base w-full"
            />
          </div>

          {/* Formula */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-txt-secondary">Formula / Query</label>
            <textarea
              value={formula}
              onChange={e => setFormula(e.target.value)}
              placeholder={'Plain English or formula:\n"users with health_score >= 75 / total_active_users * 100"\nor\n"average session duration for Institute Admins"'}
              className="input-base w-full resize-none text-xs font-mono"
              rows={4}
            />
          </div>

          {/* Templates */}
          <div className="space-y-1.5">
            <p className="text-xs text-txt-muted">Quick templates</p>
            <div className="flex flex-wrap gap-1.5">
              {FORMULA_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => { setFormula(t.formula); setName(prev => prev || t.label) }}
                  className="text-xs px-2 py-1 rounded bg-bg-elevated text-txt-secondary hover:text-txt-primary hover:bg-bg-border transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview result */}
          {preview && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-1">
              <p className="text-xs text-txt-muted">Result {aiSource && <span className="text-accent">· {aiSource}</span>}</p>
              <MetricResultBadge result={preview} />
            </div>
          )}

          {error && (
            <p className="text-xs text-status-failure bg-status-failure/10 border border-status-failure/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => compute(false)}
              disabled={computing || !formula.trim()}
              className="btn-ghost flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {computing ? 'Computing…' : 'Preview'}
            </button>
            <button
              onClick={() => compute(true)}
              disabled={computing || !formula.trim() || !name.trim()}
              className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Metric
            </button>
          </div>
        </div>

        {/* AI info */}
        <div className="card p-4 space-y-1">
          <p className="text-xs font-medium text-txt-secondary">AI Engine</p>
          <p className="text-xs text-txt-muted">
            Tries <span className="text-txt-primary">Ollama phi3:mini</span> locally first.
            Falls back to <span className="text-txt-primary">Gemini 1.5 Flash</span> (free tier, 1500 req/day) if Ollama is unavailable.
            Common formulas are resolved instantly without AI.
          </p>
          <p className="text-xs text-txt-muted mt-1">
            To enable Gemini: add <code className="text-accent text-[11px]">GEMINI_API_KEY</code> to <code className="text-accent text-[11px]">.env.local</code>
          </p>
        </div>
      </div>

      {/* Saved metrics list */}
      <div className="xl:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-txt-primary">Saved Metrics</h2>
            <p className="text-xs text-txt-muted mt-0.5">Pin metrics to dashboard sections to surface them contextually</p>
          </div>
          <span className="text-xs text-txt-muted">{metrics.length} metric{metrics.length !== 1 ? 's' : ''}</span>
        </div>

        {metrics.length === 0 ? (
          <div className="card p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
              <span className="text-accent text-xl">📐</span>
            </div>
            <p className="text-sm text-txt-secondary font-medium">No custom metrics yet</p>
            <p className="text-xs text-txt-muted mt-1 max-w-xs">Build your first metric using the panel on the left. Try a template to get started quickly.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {metrics.map(metric => (
              <div key={metric.id} className="card p-4 hover:border-accent/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-txt-primary">{metric.name}</p>
                    {metric.description && (
                      <p className="text-xs text-txt-muted mt-0.5">{metric.description}</p>
                    )}
                    <p className="text-xs font-mono text-txt-secondary bg-bg-elevated rounded px-2 py-1 mt-2 line-clamp-2">
                      {metric.formula}
                    </p>
                  </div>
                  <button
                    onClick={() => removeMetric(metric.id)}
                    className="text-txt-muted hover:text-status-failure transition-colors text-lg leading-none flex-shrink-0"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <MetricResultBadge result={metric.result} />
                  <span className="text-xs text-txt-muted">{new Date(metric.createdAt).toLocaleDateString()}</span>
                </div>

                <PinToggle metric={metric} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
