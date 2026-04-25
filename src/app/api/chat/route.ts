import { NextRequest, NextResponse } from 'next/server'
import { getPeopleData, getServicesData, getHealthData } from '@/lib/data'
import { AI, COMPANY_NAME, PLATFORM_ID, geminiUrl } from '@/lib/config'
import { ROLE_OPTIONS, SERVICE_NAMES } from '@/lib/constants'
import { requireApiAuth } from '@/lib/apiAuth'

interface Message { role: 'user' | 'assistant'; content: string }

export interface MetricSuggestion {
  name: string
  value: string
  formula: string
  description: string
}

// ── Navigation intent ──────────────────────────────────────────────
function detectNavigationIntent(msg: string): string | null {
  const m = msg.toLowerCase().trim()
  const patterns: [RegExp, string][] = [
    // "show me the people page/section" — only navigate if section/page/tab qualifier present
    [/\b(show me|open)\b.*\bpeople\s+(page|section|tab|view)\b/,               '/dashboard/people'],
    [/\b(show me|open)\b.*\busers?\s+(page|section|tab|view)\b/,               '/dashboard/people'],
    // Explicit navigation verbs — always navigate regardless of context
    [/\b(go to|take me to|navigate to|switch to)\b.*\bpeople\b/,               '/dashboard/people'],
    [/\b(go to|take me to|navigate to|switch to)\b.*\buser/,                   '/dashboard/people'],
    [/\b(go to|take me to|navigate to|switch to|show me|open)\b.*\bservice\s+(page|section|tab|view)\b/, '/dashboard/services'],
    [/\b(go to|take me to|navigate to|switch to)\b.*\bservice/,                '/dashboard/services'],
    [/\b(go to|take me to|navigate to|switch to|show me|open)\b.*\bhealth\s+(page|section|tab|view)\b/,  '/dashboard/health'],
    [/\b(go to|take me to|navigate to|switch to)\b.*\bhealth\b/,               '/dashboard/health'],
    [/\b(go to|take me to|navigate to|switch to|show me|open)\b.*\bmetric\s+(page|section|tab|view)\b/,  '/dashboard/metrics'],
    [/\b(go to|take me to|navigate to|switch to)\b.*\bmetric/,                 '/dashboard/metrics'],
    [/\b(go to|take me to|navigate to|switch to|show me|open)\b.*\bchat\b/,    '/dashboard/chat'],
    // "people/services/health/metrics section" shorthand
    [/\bpeople\s+(page|section|tab|view)\b/,                                    '/dashboard/people'],
    [/\bservices?\s+(page|section|tab|view)\b/,                                 '/dashboard/services'],
    [/\bhealth\s+(page|section|tab|view)\b/,                                    '/dashboard/health'],
    [/\bmetrics?\s+(page|section|tab|view)\b/,                                  '/dashboard/metrics'],
  ]
  for (const [pattern, route] of patterns) {
    if (pattern.test(m)) return route
  }
  return null
}

// ── Out-of-scope guard ─────────────────────────────────────────────
const GQ_KEYWORDS = [
  'user', 'login', 'session', 'service', 'health', 'metric', 'role',
  'active', 'dormant', 'event', 'failure', 'success', 'rate', 'score',
  'grayquest', 'iam', 'dashboard', 'platform', 'report', 'export',
  'cohort', 'retention', 'module', 'admin', 'institute', 'today',
  'week', 'month', 'count', 'total', 'average', 'avg', 'backend',
  'student', 'fee', 'transaction', 'audit', 'log', 'group',
  'benchmark', 'standard', 'industry', 'improve', 'recommendation',
]

const OOS_PATTERNS = [
  /\b(who is|what is the)\s+(ceo|cto|founder|president|prime minister)\b/i,
  /\b(capital|population|history)\s+of\b/i,
  /\bwrite\s+(me\s+)?(a\s+)?(poem|story|essay|code|song|joke|email)\b/i,
  /\btranslate\b/i,
  /\brecipe\s+for\b/i,
  /\bweather\s+(in|forecast)\b/i,
  /\b(bitcoin|ethereum|crypto|nft)\s+(price|market|value)\b/i,
]

function isOutOfScope(msg: string): boolean {
  if (OOS_PATTERNS.some(p => p.test(msg))) return true
  const lower = msg.toLowerCase()
  const hasGQContext = GQ_KEYWORDS.some(k => lower.includes(k))
  if (hasGQContext) return false
  const isQuestion = /^(who|what|where|when|why|how|is|are|can|could|tell|give|write|make|create)\b/i.test(msg.trim())
  if (isQuestion && msg.split(' ').length < 8) return true
  return false
}

// ── Question classifier ────────────────────────────────────────────
// 'benchmark' → use Gemini (needs world knowledge + data comparison)
// 'data'      → use qwen2.5:0.5b (pure table lookup from provided context)
function classifyQuestion(msg: string): 'data' | 'benchmark' {
  const lower = msg.toLowerCase()
  const benchmarkSignals = [
    'good', 'bad', 'benchmark', 'industry', 'standard', 'compare', 'typical',
    'normal', 'expected', 'should be', 'is it', 'too low', 'too high',
    'best practice', 'recommendation', 'how to improve', 'what should',
    'ideal', 'target', 'goal', 'acceptable', 'threshold', 'satisfactory',
    'world class', 'average company', 'saas', 'fintech', 'edtech',
  ]
  return benchmarkSignals.some(k => lower.includes(k)) ? 'benchmark' : 'data'
}

// ── Raw data cache (5-min TTL) ────────────────────────────────────
interface RawData {
  overview:  Record<string, number>
  healthK:   Record<string, number>
  sessionK:  Record<string, number>
  users:     Record<string, unknown>[]
  services:  Record<string, unknown>[]
}
let _cache: RawData | null = null
let _cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000

async function getRawData(): Promise<RawData> {
  const now = Date.now()
  if (_cache && (now - _cacheTime) < CACHE_TTL) return _cache
  const p  = await getPeopleData()   as Record<string, unknown>
  const sv = await getServicesData() as Record<string, unknown>
  const h  = await getHealthData()   as Record<string, unknown>
  _cache = {
    overview: ((p.overview  as Record<string, unknown>)?.kpis  ?? {}) as Record<string, number>,
    healthK:  ((h.health    as Record<string, unknown>)?.kpis  ?? {}) as Record<string, number>,
    sessionK: ((h.sessions  as Record<string, unknown>)?.kpis  ?? {}) as Record<string, number>,
    users:    ((p.users     as Record<string, unknown>)?.users ?? []) as Record<string, unknown>[],
    services: ((sv.services as Record<string, unknown>)?.services ?? []) as Record<string, unknown>[],
  }
  _cacheTime = now
  return _cache
}

// ── Targeted context builder ──────────────────────────────────────
// Searches users/services tables based on what the question is about
// and injects the most relevant rows — far more accurate than top-30 dump
async function buildTargetedContext(query: string): Promise<string> {
  const lower = query.toLowerCase()
  const { overview, healthK, sessionK, users, services } = await getRawData()

  const kpiBlock = [
    `PLATFORM KPIs (last 30d, platform_id=${PLATFORM_ID}):`,
    `  active_today=${overview.active_users_today}, active_30d=${overview.active_users_30d}, total_users=${overview.total_users}, dormant=${overview.dormant_users}`,
    `  avg_health=${overview.avg_health_score}, success_rate=${overview.overall_success_rate}%, login_success=${healthK.login_success_rate}%`,
    `  sessions=${overview.total_sessions_30d}, events=${overview.total_events_30d}, failed_events=${healthK.failed_events_30d}`,
    `  completion=${overview.completion_rate ?? sessionK.completion_rate ?? 'N/A'}%, cross_module=${overview.cross_module_rate ?? sessionK.cross_module_rate ?? 'N/A'}%`,
    `  avg_session_min=${overview.avg_session_duration_min ?? sessionK.avg_duration_min ?? 'N/A'}, shallow_sessions=${overview.shallow_session_pct ?? 'N/A'}%`,
  ].join('\n')

  const parts: string[] = [kpiBlock]

  // ── User table search ────────────────────────────────────────────
  // 1. Role match
  let matchedUsers: Record<string, unknown>[] = []
  for (const role of ROLE_OPTIONS) {
    if (lower.includes(role.toLowerCase())) {
      matchedUsers = users.filter(u => u.role === role)
      break
    }
  }
  // 2. Name match
  if (!matchedUsers.length) {
    matchedUsers = users.filter(u =>
      u.name && lower.includes(String(u.name).toLowerCase())
    )
  }
  // 3. Health-sorted queries
  if (!matchedUsers.length && (lower.includes('low health') || lower.includes('at risk') || lower.includes('below') || lower.includes('worst health'))) {
    const n = lower.match(/\d+/)?.[0] ? parseInt(lower.match(/\d+/)![0]) : 10
    matchedUsers = [...users].sort((a, b) => Number(a.health_score) - Number(b.health_score)).slice(0, Math.min(n, 20))
  }
  // 4. Top active users
  if (!matchedUsers.length && (lower.includes('top') || lower.includes('most active') || lower.includes('highest session'))) {
    const n = lower.match(/\d+/)?.[0] ? parseInt(lower.match(/\d+/)![0]) : 10
    matchedUsers = [...users].sort((a, b) => Number(b.sessions_30d) - Number(a.sessions_30d)).slice(0, Math.min(n, 20))
  }
  // 5. Generic user question — top 30
  if (!matchedUsers.length && (lower.includes('user') || lower.includes('who') || lower.includes('active'))) {
    matchedUsers = users.slice(0, 30)
  }

  if (matchedUsers.length) {
    const header = matchedUsers.length < users.length
      ? `MATCHED USERS (${matchedUsers.length} of ${users.length} total):`
      : `TOP USERS (${matchedUsers.length}):`
    const rows = matchedUsers.map(u => {
      const loginRate = u.login_success_rate ?? u.auth_success_rate ?? 'N/A'
      return `  ${u.name} | role:${u.role} | health:${u.health_score} | sessions:${u.sessions_30d} | login_rate:${loginRate}% | last_active:${u.last_active}`
    }).join('\n')
    parts.push(`${header}\n${rows}`)

    // Role distribution
    const roleMap: Record<string, number> = {}
    users.forEach(u => { const r = String(u.role); roleMap[r] = (roleMap[r] || 0) + 1 })
    parts.push(`ROLE DISTRIBUTION: ${Object.entries(roleMap).map(([r, c]) => `${r}:${c}`).join(', ')}`)
  }

  // ── Service table search ──────────────────────────────────────────
  let matchedServices: Record<string, unknown>[] = []
  const sortedSvcNames = [...SERVICE_NAMES].sort((a, b) => b.length - a.length)
  for (const svc of sortedSvcNames) {
    if (lower.includes(svc.toLowerCase())) {
      matchedServices = services.filter(s => String(s.service_name).toLowerCase() === svc.toLowerCase())
      break
    }
  }
  if (!matchedServices.length && lower.includes('worst') && lower.includes('service')) {
    matchedServices = [...services].sort((a, b) => Number(a.success_rate) - Number(b.success_rate)).slice(0, 5)
  }
  if (!matchedServices.length && (lower.includes('service') || lower.includes('module'))) {
    matchedServices = services
  }

  if (matchedServices.length) {
    const rows = matchedServices.map(s =>
      `  ${s.service_name} | events:${s.events_30d} | success:${s.success_rate}% | users:${s.active_users_30d} | trend:${s.trend}% | reports:${s.has_reports ? s.report_count_30d : 'N/A'}`
    ).join('\n')
    parts.push(`SERVICE DATA (${matchedServices.length}):\n${rows}`)
  }

  return parts.join('\n\n')
}

// ── Structured answer builder (bypasses LLM for known patterns) ───
// Returns a pre-formatted answer when we can answer deterministically,
// so small models don't have to parse and re-format tabular data.
async function buildStructuredAnswer(query: string): Promise<string | null> {
  const lower = query.toLowerCase()
  const { overview, healthK, users, services } = await getRawData()

  // Role-specific user list
  for (const role of ROLE_OPTIONS) {
    if (lower.includes(role.toLowerCase()) && (lower.includes('user') || lower.includes('show') || lower.includes('list') || lower.includes('who') || lower.includes('health') || lower.includes('session'))) {
      const matched = users.filter(u => u.role === role)
      if (!matched.length) return `No users found with role **${role}**.`
      const rows = matched.map((u, i) =>
        `${i + 1}. **${u.name}** | health: ${u.health_score} | sessions: ${u.sessions_30d} | last active: ${u.last_active}`
      ).join('\n')
      return `Found **${matched.length}** user${matched.length > 1 ? 's' : ''} with role **${role}**:\n\n${rows}`
    }
  }

  // Top N users by sessions
  const topMatch = lower.match(/top\s+(\d+)\s+users?\s+by\s+session/)
  if (topMatch) {
    const n = Math.min(parseInt(topMatch[1]), 20)
    const top = [...users].sort((a, b) => Number(b.sessions_30d) - Number(a.sessions_30d)).slice(0, n)
    const rows = top.map((u, i) =>
      `${i + 1}. **${u.name}** (${u.role}) — **${u.sessions_30d} sessions** | health: ${u.health_score}`
    ).join('\n')
    return `**Top ${n} users by session count (last 30d):**\n\n${rows}`
  }

  // Low health users
  const lowHealthMatch = lower.match(/(\d+)?\s*users?\s*(with\s+)?(health\s+score\s+)?(below|under|less than|<)\s*(\d+)/)
  if (lowHealthMatch) {
    const threshold = parseInt(lowHealthMatch[5] || '50')
    const matched = users.filter(u => Number(u.health_score) < threshold).sort((a, b) => Number(a.health_score) - Number(b.health_score))
    if (!matched.length) return `No users found with health score below **${threshold}**.`
    const rows = matched.slice(0, 20).map((u, i) =>
      `${i + 1}. **${u.name}** (${u.role}) — health: **${u.health_score}** | sessions: ${u.sessions_30d}`
    ).join('\n')
    return `**${matched.length} users with health score below ${threshold}:**\n\n${rows}`
  }

  // Services list / highest failure rate
  if ((lower.includes('highest failure') || lower.includes('worst service') || lower.includes('most failure')) && lower.includes('service')) {
    const sorted = [...services].sort((a, b) => Number(a.success_rate) - Number(b.success_rate)).slice(0, 5)
    const rows = sorted.map((s, i) =>
      `${i + 1}. **${s.service_name}** — success: **${s.success_rate}%** | events: ${s.events_30d} | users: ${s.active_users_30d}`
    ).join('\n')
    return `**Services with highest failure rate (lowest success %):**\n\n${rows}`
  }

  // Login success rate / overall stats
  if (lower.includes('login success rate') || lower.includes('login rate')) {
    return `**Login success rate: ${healthK.login_success_rate}%**\n• Platform overall success rate: ${overview.overall_success_rate}%\n• Total events (30d): ${overview.total_events_30d}\n• Failed events: ${healthK.failed_events_30d}`
  }

  // Dormant users
  if (lower.includes('dormant')) {
    const dormant = users.filter(u => u.status === 'dormant' || (u.last_active && new Date(String(u.last_active)) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
    return `**Dormant users: ${overview.dormant_users ?? dormant.length}** (no activity in 30+ days)\n• Total users: ${overview.total_users}\n• Dormant rate: ${((Number(overview.dormant_users ?? dormant.length) / Number(overview.total_users)) * 100).toFixed(1)}%`
  }

  return null
}

// ── Metric suggestion extractor ────────────────────────────────────
function extractMetricSuggestion(userQuestion: string, aiResponse: string): MetricSuggestion | null {
  const patterns = [
    /(\d+\.?\d*)\s*%/, /:\s*(\d+\.?\d*)\b/,
    /\b(\d+)\s+users?\b/i, /\b(\d+)\s+sessions?\b/i, /\b(\d+\.?\d*)\s+minutes?\b/i,
  ]
  if (!patterns.some(p => p.test(aiResponse))) return null
  const metricKeywords = [
    'rate', 'ratio', 'percentage', '%', 'how many', 'count', 'total',
    'average', 'avg', 'score', 'how much', 'what is', 'what are',
    'highest', 'lowest', 'top', 'most', 'least', 'duration',
  ]
  if (!metricKeywords.some(k => userQuestion.toLowerCase().includes(k))) return null

  let value = '—'
  const pctMatch = aiResponse.match(/(\d+\.?\d*)\s*%/)
  const numMatch = aiResponse.match(/\b(\d+\.?\d*)\b/)
  if (pctMatch) value = `${pctMatch[1]}%`
  else if (numMatch) value = numMatch[1]

  const name = userQuestion
    .replace(/\?/g, '')
    .replace(/^(what is|what are|how many|how much|show me|tell me|give me|is our|is this)\s+/i, '')
    .split(' ').slice(0, 6)
    .map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ').trim()

  return { name, value, formula: userQuestion, description: aiResponse.split('\n')[0].slice(0, 120) }
}

// ── Gemini caller ──────────────────────────────────────────────────
async function callGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  try {
    const res = await fetch(geminiUrl(key), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal:  AbortSignal.timeout(AI.GEMINI_TIMEOUT_MS),
    })
    if (!res.ok) {
      // Log non-OK for debugging but don't expose to client
      console.error('[Gemini] non-OK response:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch (err) {
    console.error('[Gemini] fetch error:', err)
    return null
  }
}

// ── Ollama caller (chat format) ────────────────────────────────────
async function callOllama(messages: Message[], system: string): Promise<string | null> {
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b'
  const url   = process.env.OLLAMA_URL   || 'http://localhost:11434/api/chat'
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream:   false,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(AI.GEMINI_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.message?.content?.trim() ?? null
  } catch {
    return null
  }
}

// ── Route handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req)
  if (authError) return authError

  const body = await req.json() as { messages: Message[]; currentSection?: string }
  const { messages, currentSection } = body

  if (!messages?.length) {
    return NextResponse.json({ error: 'Messages required' }, { status: 400 })
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''

  // 1. Navigation intent — instant
  const navigationTarget = detectNavigationIntent(lastUserMsg)
  if (navigationTarget) {
    const label = navigationTarget.split('/').pop() ?? ''
    return NextResponse.json({
      content:         `Sure! Taking you to the ${label.charAt(0).toUpperCase() + label.slice(1)} section now.`,
      source:          'navigation',
      navigationTarget,
    })
  }

  // 2. Out-of-scope guard — instant
  if (isOutOfScope(lastUserMsg)) {
    return NextResponse.json({
      content: "That's outside my scope. I can help with GrayQuest IAM dashboard data and analytics.",
      source:  'scope_guard',
    })
  }

  const recent  = messages.slice(-12)
  const qType   = classifyQuestion(lastUserMsg)

  // 3a. Structured data query — answer deterministically (no LLM needed)
  const structuredAnswer = await buildStructuredAnswer(lastUserMsg)
  if (structuredAnswer) {
    return NextResponse.json({
      content:          structuredAnswer,
      source:           'builtin',
      metricSuggestion: extractMetricSuggestion(lastUserMsg, structuredAnswer),
    })
  }

  const context = await buildTargetedContext(lastUserMsg)

  // 3. Benchmark question → Gemini (has world knowledge + IAM context)
  if (qType === 'benchmark') {
    const prompt = `You are an IAM analytics expert for ${COMPANY_NAME}, an Indian educational fee-collection platform.

GRAYQUEST ACTUAL DATA:
${context}

USER QUESTION: "${lastUserMsg}"

Provide a structured answer with:
• **Industry benchmark** for the relevant metric(s) — cite typical SaaS/fintech/edtech ranges
• **GrayQuest actual**: [exact value from data above]
• **Assessment**: Excellent / Good / Needs Attention / Critical
• **Recommendation**: one specific, actionable step

Format with bullet points. Bold key numbers. Be concise (under 150 words).`

    const geminiAnswer = await callGemini(prompt)
    if (geminiAnswer) {
      return NextResponse.json({
        content:          geminiAnswer,
        source:           'gemini',
        metricSuggestion: extractMetricSuggestion(lastUserMsg, geminiAnswer),
      })
    }
    // Gemini unavailable — return GrayQuest actual values directly
    return NextResponse.json({
      content: `Here are GrayQuest's actual values:\n\n${context.split('\n').slice(0,8).join('\n')}\n\n_Note: Live industry benchmarks require the Gemini API (quota may be exhausted — resets daily)._`,
      source: 'fallback',
      metricSuggestion: null,
    })
  }

  // 4. Data question → qwen2.5:0.5b with targeted table context
  const dataSystem = `You are the ${COMPANY_NAME} IAM analyst. Answer using ONLY the data provided. Never guess.

${context}

STRICT RULES:
- For user lists: list EACH user ONCE as "• Name | role | health: X | sessions: Y"
- For counts/totals: give the exact number then stop
- Do NOT mix KPI numbers into user rows
- Do NOT repeat the same user more than once
- If data is missing say "not in data"
- Max 10 lines total`

  const ollamaAnswer = await callOllama(recent, dataSystem)
  if (ollamaAnswer) {
    return NextResponse.json({
      content:          ollamaAnswer,
      source:           'ollama',
      metricSuggestion: extractMetricSuggestion(lastUserMsg, ollamaAnswer),
    })
  }

  // 5. Final fallback — Gemini answers the data question too
  const fallbackPrompt = `You are a ${COMPANY_NAME} IAM analyst. Answer this data question using ONLY the data provided.

DATA:
${context}

QUESTION: "${lastUserMsg}"

Respond with bullet points and exact numbers from the data. Bold key values.`

  const fallbackAnswer = await callGemini(fallbackPrompt)
  if (fallbackAnswer) {
    return NextResponse.json({
      content:          fallbackAnswer,
      source:           'gemini',
      metricSuggestion: extractMetricSuggestion(lastUserMsg, fallbackAnswer),
    })
  }

  // Both AI services unavailable — return a data-only answer from context
  const { overview } = await getRawData()
  const quickAnswer = `I'm having trouble reaching the AI service right now. Here's what the data shows directly:

**Platform Overview**
• Total users: ${overview.total_users ?? 'N/A'}
• Active users (30 d): ${overview.active_users_30d ?? 'N/A'}
• Avg health score: ${overview.avg_health_score ?? 'N/A'}
• Login success rate: ${overview.login_success_rate ?? overview.auth_success_rate ?? 'N/A'}%
• Dormant users: ${overview.dormant_users ?? 'N/A'}

Try rephrasing your question or ask about a specific metric.`

  return NextResponse.json({
    content: quickAnswer,
    source:  'fallback',
  })
}
