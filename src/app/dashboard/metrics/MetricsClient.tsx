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
  { label: 'DAU / MAU Ratio',              formula: 'daily_active_users / monthly_active_users * 100' },
  { label: 'Failure Rate',                 formula: 'failed_events / total_events * 100' },
  { label: '% High-Health Users',          formula: 'users with health_score >= 75 / total_active_users * 100' },
  { label: 'Avg Events per User',          formula: 'total_events_30d / active_users_30d' },
  { label: 'Report Efficiency',            formula: 'total_reports_exported / total_reports_generated * 100' },
  { label: 'Institute Admin users',        formula: 'how many Institute Admin users are active' },
  { label: 'Backend Engineer health',      formula: 'average health score of Backend Engineer users' },
  { label: 'Super Admin sessions',         formula: 'average sessions for Super Admin users' },
  { label: 'Top 5 users by sessions',      formula: 'top 5 users by session count' },
  { label: 'Student Fee Headers rate',     formula: 'success rate of Student Fee Headers' },
  { label: 'Cross-module rate',            formula: 'cross module rate' },
  { label: 'Dormant users',                formula: 'dormant users count' },
  { label: 'Top service by success',       formula: 'top service by success rate' },
]

function MetricResultBadge({ result }: { result: unknown }) {
  const display = result === null || result === undefined
    ? '—'
    : typeof result === 'object'
      ? JSON.stringify(result)
      : String(result)
  return (
    <span className="inline-block bg-[#F0FDF4] text-[#16A34A] font-black text-sm px-4 py-1.5 rounded-xl border border-emerald-100 shadow-sm">
      {display}
    </span>
  )
}

export default function MetricsClient() {
  const { metrics, addMetric, removeMetric, pinMetric, unpinMetric } = useMetricsStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formula, setFormula] = useState('')
  const [computing, setComputing] = useState(false)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [source,    setSource]    = useState<'builtin' | 'ai' | 'gemini' | 'ollama' | 'error' | null>(null)
  const [error,     setError]     = useState('')

  async function compute(save = false) {
    if (!formula.trim()) { setError('Enter a formula or query'); return }
    setError(''); setComputing(true); setPreview(null); setSource(null)

    try {
      const res  = await fetch('/api/metrics/compute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name || 'Custom Metric', description, formula }),
      })
      const data = await res.json() as { result?: string; source?: string; error?: string }
      if (!res.ok || data.error) { setError(data.error ?? 'Compute failed'); return }

      const result = data.result ?? ''
      setPreview(result)
      setSource((data.source as 'builtin' | 'ai' | 'error') ?? null)

      if (save) {
        if (!name.trim()) { setError('Name is required to save'); return }
        addMetric({ name: name.trim(), description, formula, result, pinnedTo: [] })
        setName(''); setDescription(''); setFormula(''); setPreview(null); setSource(null)
      }
    } catch {
      setError('Network error — check that the dev server is running')
    } finally {
      setComputing(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      {/* Builder Panel */}
      <div className="xl:col-span-2 space-y-4">
        <div className="mb-2">
          <h1 className="text-2xl font-black text-[#111827] tracking-tight">Metrics Builder</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">AI-powered custom data engine.</p>
        </div>

        <div className="card p-5 space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[#64748B] uppercase tracking-widest ml-1">Metric Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Core Engagement"
              className="w-full px-4 py-2.5 rounded-2xl bg-white/50 border border-white/60 focus:outline-none focus:border-[#6366F1] transition-all text-sm font-medium"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Formula / Query</label>
              <span className="text-[9px] text-[#9CA3AF]">plain English or math expression</span>
            </div>
            <textarea
              value={formula}
              onChange={e => setFormula(e.target.value)}
              placeholder='e.g. "how many Institute Admin users are active" or "failed_events / total_events * 100"'
              className="w-full px-4 py-3 rounded-2xl bg-white/50 border border-white/60 focus:outline-none focus:border-[#6366F1] transition-all text-sm font-medium min-h-[100px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest ml-1">Templates</p>
            <div className="flex flex-wrap gap-2">
              {FORMULA_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => { setFormula(t.formula); setName(t.label) }}
                  className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-white border border-slate-100 text-[#475569] hover:bg-slate-50 transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {preview && (
            <div className="p-4 rounded-2xl bg-[#F0F9FF] border border-blue-100 animate-in fade-in slide-in-from-bottom-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Result</p>
                {source && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    source === 'builtin'
                      ? 'bg-green-100 text-green-700'
                      : source === 'gemini'
                        ? 'bg-purple-100 text-purple-700'
                        : source === 'ollama'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-600'
                  }`}>
                    {source === 'builtin' ? '⚡ instant' : source === 'gemini' ? '✦ Gemini' : source === 'ollama' ? '⚡ qwen2.5' : 'error'}
                  </span>
                )}
              </div>
              <MetricResultBadge result={preview} />
            </div>
          )}

          {error && <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => compute(false)}
              disabled={computing}
              className="flex-1 py-3 rounded-2xl bg-white border border-slate-100 text-[#111827] text-sm font-bold shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {computing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin block" />
                  Computing…
                </span>
              ) : 'Preview'}
            </button>
            <button
              onClick={() => compute(true)}
              disabled={computing}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              Save Metric
            </button>
          </div>
        </div>
      </div>

      {/* Saved Metrics */}
      <div className="xl:col-span-3 space-y-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#111827] tracking-tight">Saved Insights</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">Custom metrics pinned to your dashboard.</p>
          </div>
        </div>

        {metrics.length === 0 ? (
          <div className="card p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-[#EEF2FF] flex items-center justify-center mb-4">
              <span className="text-3xl">📐</span>
            </div>
            <p className="text-base font-black text-[#111827]">No Custom Metrics</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Start building unique business insights on the left.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metrics.map(metric => (
              <div key={metric.id} className="card p-5 group hover:border-[#6366F1]/30 transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#111827] truncate">{metric.name}</h3>
                    <p className="text-[10px] text-[#9CA3AF] line-clamp-1">{metric.formula}</p>
                  </div>
                  <button onClick={() => removeMetric(metric.id)} className="text-slate-300 hover:text-red-500 transition-colors text-lg">×</button>
                </div>
                
                <MetricResultBadge result={metric.result} />

                <div className="mt-4 pt-3 border-t border-white/40">
                  <p className="text-[9px] font-black text-[#64748B] uppercase tracking-widest mb-2">Pin to View</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SECTION_OPTIONS.map(s => {
                      const pinned = metric.pinnedTo.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => pinned ? unpinMetric(metric.id, s.id) : pinMetric(metric.id, s.id)}
                          className={`text-[9px] font-black px-2 py-1 rounded-full border transition-all ${
                            pinned ? 'bg-[#EEF2FF] border-blue-200 text-blue-600' : 'bg-white border-slate-100 text-slate-400'
                          }`}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
