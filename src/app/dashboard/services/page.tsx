import { getServicesData } from '@/lib/data'
import ServicesClient from './ServicesClient'

export default async function ServicesPage() {
  const data = await getServicesData()
  return <ServicesClient data={data} />
}
