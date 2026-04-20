import { getPeopleData } from '@/lib/data'
import PeopleClient from './PeopleClient'

export default function PeoplePage() {
  const data = getPeopleData()
  return <PeopleClient data={data} />
}
