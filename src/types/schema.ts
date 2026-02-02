export interface User {
  id: string
  email: string
  level: number
}

export interface Page {
  id: string
  owner_id: string
  name: string
  verified: boolean
  reactivity_score: number
  category?: string
  certification_type?: "NONE" | "OFFICIAL"
}

export interface Proposition {
  id: string
  page_id: string
  title: string
  status: string
  votes_count: number
}

export interface Vote {
  id: string
  user_id: string
  proposition_id: string
}

export interface Volunteer {
  user_id: string
  proposition_id: string
  skills: string[]
}
