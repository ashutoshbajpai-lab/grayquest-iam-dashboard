import { NextRequest, NextResponse } from 'next/server'
import { getServicesData } from '@/lib/data'
import { requireApiAuth } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  const authError = await requireApiAuth(req)
  if (authError) return authError
  return NextResponse.json(await getServicesData())
}
