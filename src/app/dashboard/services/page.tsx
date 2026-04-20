import { getServicesData } from '@/lib/data'
import ServicesClient from './ServicesClient'

export default function ServicesPage() {
  const data = getServicesData()
  return <ServicesClient data={data} />
}
