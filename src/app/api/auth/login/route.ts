import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    const validEmail = process.env.DASHBOARD_USER_EMAIL
    const hash       = process.env.DASHBOARD_USER_PASSWORD_HASH

    if (!validEmail || !hash) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const emailMatch    = email === validEmail
    const passwordMatch = await bcrypt.compare(password, hash)

    if (!emailMatch || !passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = await signToken(email)
    const res   = NextResponse.json({ success: true })

    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 8, // 8 hours
      path:     '/',
    })

    return res
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
