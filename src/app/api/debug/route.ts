import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  return NextResponse.json({
    PLATFORM_ID: process.env.NEXT_PUBLIC_PLATFORM_ID,
    NODE_ENV: process.env.NODE_ENV,
  })
}
