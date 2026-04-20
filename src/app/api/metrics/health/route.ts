import { NextResponse } from 'next/server'
import { getHealthData } from '@/lib/data'

export async function GET() {
  return NextResponse.json(await getHealthData())
}
