import { NextResponse } from 'next/server'
import { getServicesData } from '@/lib/data'

export async function GET() {
  return NextResponse.json(getServicesData())
}
