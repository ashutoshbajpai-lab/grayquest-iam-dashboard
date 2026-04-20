import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { AUTH_COOKIE, ROUTES } from '@/lib/constants'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/dashboard')) {
    const token = req.cookies.get(AUTH_COOKIE)?.value
    if (!token) {
      return NextResponse.redirect(new URL(ROUTES.LOGIN, req.url))
    }
    const payload = await verifyToken(token)
    if (!payload) {
      const res = NextResponse.redirect(new URL(ROUTES.LOGIN, req.url))
      res.cookies.delete(AUTH_COOKIE)
      return res
    }
  }

  if (pathname === '/') {
    const token = req.cookies.get(AUTH_COOKIE)?.value
    if (token && await verifyToken(token)) {
      return NextResponse.redirect(new URL(ROUTES.PEOPLE, req.url))
    }
    return NextResponse.redirect(new URL(ROUTES.LOGIN, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
}
