import { NextRequest, NextResponse } from 'next/server'
import { computeAllMetrics } from '@/lib/compute'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  // RECOMPUTE_SECRET must be set — never allow unauthenticated recompute
  const secret = process.env.RECOMPUTE_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'RECOMPUTE_SECRET is not configured on this server' }, { status: 401 })
  }
  const auth = req.headers.get('authorization') ?? req.headers.get('x-webhook-secret') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[recompute] Starting metric computation...')
    await computeAllMetrics()
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[recompute] Failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Allow GET for manual trigger testing (protected the same way)
export async function GET(req: NextRequest) {
  return POST(req)
}
