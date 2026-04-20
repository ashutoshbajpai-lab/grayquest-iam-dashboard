import { getHealthData } from '@/lib/data'
import HealthClient from './HealthClient'

export default function HealthPage() {
  const data = getHealthData()
  return <HealthClient data={data} />
}
