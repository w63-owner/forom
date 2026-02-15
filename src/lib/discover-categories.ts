/**
 * Central definitions for Discover section: universes, categories, and sub-categories.
 * Source of truth for propositions.universe, propositions.category, propositions.sub_category.
 */

import type { Universe } from "@/types/schema"
import discoverData from "./discover-categories.json"
import discoverByUniverse from "./discover-categories-by-universe.json"

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DiscoverSubCategory {
  value: string
  key: string
}

export interface DiscoverCategory {
  value: string
  key: string
  subCategories: DiscoverSubCategory[]
}

export type DiscoverCategoriesConfig = Record<Universe, DiscoverCategory[]>

// ─── Data (from JSON) ──────────────────────────────────────────────────────

const raw = discoverData as {
  categories: Record<
    string,
    { value: string; key: string; subCategories: { value: string; key: string }[] }[]
  >
  seedKeywords: Record<string, string[]>
  seedCategoryRules: Record<
    string,
    { keywords: string[]; category: string }[]
  >
}

export const DISCOVER_CATEGORIES: DiscoverCategoriesConfig = raw.categories as DiscoverCategoriesConfig

/** Keywords (lowercase) used by seed script to infer universe from page name/slug */
export const SEED_UNIVERSE_KEYWORDS: Record<Universe, string[]> =
  raw.seedKeywords as Record<Universe, string[]>

/** Rules used by seed script to infer category within an universe */
export const SEED_CATEGORY_RULES: Record<
  Universe,
  { keywords: string[]; category: string }[]
> = raw.seedCategoryRules as Record<
  Universe,
  { keywords: string[]; category: string }[]
>

// ─── Helpers ───────────────────────────────────────────────────────────────

/** All category values for a given universe */
export function getCategoriesForUniverse(universe: Universe): DiscoverCategory[] {
  return DISCOVER_CATEGORIES[universe] ?? []
}

/** All category values across universes (for validation) */
export const ALL_CATEGORY_VALUES: string[] = Object.values(
  DISCOVER_CATEGORIES
).flatMap((cats) => cats.map((c) => c.value))

/** All sub-category values for a given category */
export function getSubCategoriesForCategory(
  universe: Universe,
  categoryValue: string
): DiscoverSubCategory[] {
  const cat = getCategoriesForUniverse(universe).find(
    (c) => c.value === categoryValue
  )
  return cat?.subCategories ?? []
}

/** Check if a category value is valid for an universe */
export function isValidCategory(
  universe: Universe,
  categoryValue: string | null | undefined
): boolean {
  if (!categoryValue) return false
  return getCategoriesForUniverse(universe).some((c) => c.value === categoryValue)
}

/** i18n key for a category value (e.g. "Transports" -> "transports") */
export function getCategoryI18nKey(categoryValue: string | null | undefined): string | null {
  if (!categoryValue) return null
  for (const cats of Object.values(DISCOVER_CATEGORIES)) {
    const found = cats.find((c) => c.value === categoryValue)
    if (found) return found.key
  }
  return null
}

/** CSV-based taxonomy: categories and sub-categories per universe (matches propositions) */
export const DISCOVER_CATEGORIES_BY_UNIVERSE: Record<
  Universe,
  { category: string; subCategories: string[] }[]
> = discoverByUniverse as Record<
  Universe,
  { category: string; subCategories: string[] }[]
>

/** Categories for a universe from CSV (for filters and UniverseGrid) */
export function getCategoriesForUniverseFromCsv(universe: Universe) {
  return DISCOVER_CATEGORIES_BY_UNIVERSE[universe] ?? []
}

/** i18n key for a sub-category value */
export function getSubCategoryI18nKey(
  categoryValue: string,
  subCategoryValue: string | null | undefined
): string | null {
  if (!subCategoryValue) return null
  for (const cats of Object.values(DISCOVER_CATEGORIES)) {
    const cat = cats.find((c) => c.value === categoryValue)
    const sub = cat?.subCategories.find((s) => s.value === subCategoryValue)
    if (sub) return sub.key
  }
  return null
}