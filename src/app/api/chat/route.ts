import { NextRequest, NextResponse } from 'next/server'
import { getPeopleData, getServicesData, getHealthData } from '@/lib/data'
import { AI, COMPANY_NAME, PLATFORM_ID, geminiUrl } from '@/lib/config'

interface Message { role: 'user' | 'assistant'; content: string }

export interface MetricSuggestion {
  name: string
  value: string
  formula: string
  description: string
}

async function buildSystemContext(): Promise<string> {
  const p  = await getPeopleData()  as Record<string, unknown>
  const sv = await getServicesData() as Record<string, unknown>
  const h  = await getHealthData()  as Record<string, unknown>

  const ok   = ((p.overview  as Record<string, unknown>).kpis as Record<string, number>)
  const sk   = ((h.sessions  as Record<string, unknown>).kpis as Record<string, number|string>)
  const hk   = ((h.health    as Record<string, unknown>).kpis as Record<string, number|string>)
  const svs  = ((sv.services as Record<string, unknown>).services as Record<string, unknown>[])
  const users = ((p.users    as Record<string, unknown>).users as Record<string, unknown>[])

  return `You are an AI analyst for ${COMPANY_NAME}'s IAM dashboard. ${COMPANY_NAME} is an Indian fee-collection and loan management platform for educational institutions. platform_id=${PLATFORM_ID}.

CURRENT METRICS (last 30 days):
- Active users: ${ok.active_users_30d} of ${ok.total_users} total (${ok.active_users_today} today)
- Avg health score: ${ok.avg_health_score}/100
- Overall success rate: ${ok.overall_success_rate}%
- Login success rate: ${hk.login_success_rate}%
- Total sessions: ${ok.total_sessions_30d} | Total events: ${ok.total_events_30d}
- Session completion rate: ${ok.completion_rate}%
- Cross-module rate: ${sk.cross_module_rate}% (users using 3+ services per session)
- Avg session duration: ${sk.avg_duration_min} minutes
- New activations (30d): ${ok.new_activations_30d}
- Failed events: ${hk.failed_events_30d} (${hk.unique_error_types} error types)
- Shallow sessions: ${ok.shallow_session_pct}%

SERVICES:
${svs.map(s => `  - ${s.service_name}: ${s.events_30d} events, ${s.success_rate}% success, ${s.active_users_30d} users, trend: ${s.trend}%`).join('\n')}

USERS (top 20 active):
${users.slice(0, 20).map(u => `  - ${u.name} (${u.role}): health ${u.health_score}, ${u.sessions_30d} sessions, login rate ${u.login_success_rate}%, last active ${u.last_active}`).join('\n')}

ROLES: ${[...new Set(users.map(u => String(u.role)))].map(r => `${r}(${users.filter(u => u.role === r).length})`).join(', ')}

Answer concisely. Use bullet points for lists. Be specific with numbers. Do not hallucinate.`
}

// Detect if the AI response contains a quantifiable metric result
function extractMetricSuggestion(userQuestion: string, aiResponse: string): MetricSuggestion | null {
  // Look for a number/percentage/ratio in the response
  const patterns = [
    /(\d+\.?\d*)\s*%/,           // percentage: 74.5%
    /(\d+\.?\d*)\s*\/\s*100/,   // score: 62/100
    /:\s*(\d+\.?\d*)\b/,         // "value: 42"
    /\b(\d+)\s+users?\b/i,       // "15 users"
    /\b(\d+)\s+sessions?\b/i,    // "312 sessions"
    /\b(\d+\.?\d*)\s+minutes?\b/i, // "18.7 minutes"
  ]

  const hasMetric = patterns.some(p => p.test(aiResponse))
  if (!hasMetric) return null

  // Only suggest saving for clearly quantitative questions
  const metricKeywords = [
    'rate', 'ratio', 'percentage', '%', 'how many', 'count', 'total',
    'average', 'avg', 'score', 'how much', 'what is', 'what are',
    'highest', 'lowest', 'top', 'most', 'least', 'duration',
  ]
  const isMetricQuestion = metricKeywords.some(k =>
    userQuestion.toLowerCase().includes(k)
  )
  if (!isMetricQuestion) return null

  // Extract the first meaningful number as the value
  let value = ''
  const pctMatch  = aiResponse.match(/(\d+\.?\d*)\s*%/)
  const numMatch  = aiResponse.match(/\b(\d+\.?\d*)\b/)
  if (pctMatch)      value = `${pctMatch[1]}%`
  else if (numMatch) value = numMatch[1]
  else               value = '—'

  // Build a clean metric name from the question
  const name = userQuestion
    .replace(/\?/g, '')
    .replace(/^(what is|what are|how many|how much|show me|tell me|give me)\s+/i, '')
    .split(' ')
    .slice(0, 6)
    .map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ')
    .trim()

  return {
    name,
    value,
    formula: userQuestion,
    description: aiResponse.split('\n')[0].slice(0, 120),
  }
}

async function callOllama(messages: Message[], system: string): Promise<string | null> {
  try {
    const prompt = `${system}\n\n${messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}\nAssistant:`
    const res = await fetch(AI.OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI.OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(AI.OLLAMA_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = await res.json() as { response?: string }
    return data.response?.trim() ?? null
  } catch {
    return null
  }
}

async function callGemini(messages: Message[], system: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  try {
    const contents = [
      { role: 'user',  parts: [{ text: system + '\n\nStart conversation.' }] },
      { role: 'model', parts: [{ text: 'Understood. Ready to answer questions about your GrayQuest IAM data.' }] },
      ...messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    ]
    const res = await fetch(geminiUrl(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal: AbortSignal.timeout(AI.GEMINI_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { messages: Message[] }
  const { messages } = body

  if (!messages?.length) {
    return NextResponse.json({ error: 'Messages required' }, { status: 400 })
  }

  const system  = await buildSystemContext()
  const content = (await callOllama(messages, system)) ?? (await callGemini(messages, system))

  if (!content) {
    return NextResponse.json({
      content: 'AI service unavailable. Make sure `ollama serve` is running in a terminal, or add GEMINI_API_KEY to .env.local.',
      source: 'fallback',
    })
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
  const metricSuggestion = extractMetricSuggestion(lastUserMsg, content)

  return NextResponse.json({ content, source: 'ai', metricSuggestion })
}
