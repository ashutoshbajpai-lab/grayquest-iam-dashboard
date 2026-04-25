export const SECTION_SUGGESTIONS: Record<string, string[]> = {
  '/dashboard/people': [
    'Who are the top 5 users by session count?',
    'How many users have a health score below 50?',
    'Which role has the lowest average health score?',
    'How many users are dormant right now?',
    'Show me users active today',
  ],
  '/dashboard/services': [
    'Which service has the highest failure rate?',
    'What are the top 3 services by event volume?',
    'What is the success rate of Student Fee Headers?',
    'Which service has the most active users?',
    'What is the cross-module rate?',
  ],
  '/dashboard/health': [
    'What is the overall success rate this month?',
    'Which events fail most often?',
    'What is the login success rate?',
    'What percentage of sessions are shallow?',
    'What is the average session duration?',
  ],
  '/dashboard/metrics': [
    'How many Institute Admin users are active?',
    'Average health score of Backend Engineer users',
    'How many users have 3 or more sessions?',
    'DAU to MAU ratio',
    'Top 5 users by session count',
  ],
}

export function getSuggestions(pathname: string): string[] {
  return SECTION_SUGGESTIONS[pathname] ?? [
    'What is the overall success rate?',
    'Who are the most active users?',
    'Which service has the most events?',
    'How many users are active today?',
    'Take me to the Health page',
  ]
}
