import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './auth'
import { AUTH_COOKIE } from './constants'

/**
 * Verifies the auth cookie on an API route request.
 * Returns a 401 NextResponse if auth fails, or null if the request is authorised.
 *
 * Usage in a route handler:
 *   const authError = await requireApiAuth(req)
 *   if (authError) return authError
 */
export async function requireApiAuth(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
