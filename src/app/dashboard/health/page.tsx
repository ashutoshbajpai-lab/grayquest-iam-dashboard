import { getHealthData } from '@/lib/data'
import HealthClient from './HealthClient'

export default async function HealthPage() {
  const data = await getHealthData()
  return <HealthClient data={data} />
}
