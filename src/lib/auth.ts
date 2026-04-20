import { SignJWT, jwtVerify } from 'jose'
import { AUTH_COOKIE } from './constants'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
const EXPIRY = '8h'

export async function signToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as { email: string; exp: number }
  } catch {
    return null
  }
}

export function getTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.split(';').find(c => c.trim().startsWith(`${AUTH_COOKIE}=`))
  return match ? match.trim().split('=')[1] : null
}
