export interface User {
  id: string
  email: string
  level: number
  username?: string | null
  avatar_url?: string | null
  onboarding_profile_completed_at?: string | null
  onboarding_completed_at?: string | null
  onboarding_version?: number
}

export interface Page {
  id: string
  owner_id: string
  name: string
  verified: boolean
  reactivity_score: number
  category?: string
  certification_type?: "NONE" | "OFFICIAL"
  parent_page_id?: string | null
}

/** Universe for Discover section */
export type Universe =
  | "MOBILITY_TRAVEL"
  | "PUBLIC_SERVICES"
  | "TECH_PRODUCTS"
  | "CONSUMPTION"
  | "LOCAL_LIFE"
  | "ENERGY_UTILITIES"
  | "MEDIA_CULTURE"
  | "HOUSING_REAL_ESTATE"
  | "PROFESSIONAL_LIFE"
  | "LUXE_LIFESTYLE"
  | "FINANCE_INVESTMENT"
  | "INNOVATION_LAB"

export const UNIVERSE_SLUGS: Record<Universe, string> = {
  MOBILITY_TRAVEL: "mobilite-voyage",
  PUBLIC_SERVICES: "services-publics",
  TECH_PRODUCTS: "produits-tech",
  CONSUMPTION: "consommation",
  LOCAL_LIFE: "vie-locale",
  ENERGY_UTILITIES: "energie-utilities",
  MEDIA_CULTURE: "media-culture",
  HOUSING_REAL_ESTATE: "habitat-immobilier",
  PROFESSIONAL_LIFE: "vie-professionnelle",
  LUXE_LIFESTYLE: "luxe-lifestyle",
  FINANCE_INVESTMENT: "finance-investissement",
  INNOVATION_LAB: "innovation-lab",
}

export const SLUG_TO_UNIVERSE: Record<string, Universe> = Object.fromEntries(
  (Object.entries(UNIVERSE_SLUGS) as [Universe, string][]).map(([u, s]) => [s, u])
)

export interface Proposition {
  id: string
  page_id: string
  title: string
  status: string
  votes_count: number
  universe?: Universe | null
  category?: string | null
  sub_category?: string | null
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