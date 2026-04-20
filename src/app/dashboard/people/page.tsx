import { getPeopleData } from '@/lib/data'
import PeopleClient from './PeopleClient'

export default async function PeoplePage() {
  const data = await getPeopleData()
  return <PeopleClient data={data} />
}
