import { NextResponse } from 'next/server'
import { getPeopleData } from '@/lib/data'

export async function GET() {
  return NextResponse.json(await getPeopleData())
}
