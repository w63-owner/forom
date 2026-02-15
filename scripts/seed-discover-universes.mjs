/**
 * Seed universe and category for existing propositions (Discover section).
 * Uses discover-categories.json as source of truth for categories.
 * Run migration 0023 first to add universe, category, sub_category columns.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-discover-universes.mjs
 *
 * Options:
 *   --dry-run    Log what would be updated without writing
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const discoverPath = join(__dirname, "../src/lib/discover-categories.json")
const discoverData = JSON.parse(readFileSync(discoverPath, "utf8"))

const { seedKeywords: UNIVERSE_KEYWORDS, seedCategoryRules: SEED_CATEGORY_RULES } =
  discoverData

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  )
  process.exit(1)
}

const dryRun = process.argv.includes("--dry-run")
if (dryRun) {
  console.log("DRY RUN – no updates will be written\n")
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const UNIVERSES = Object.keys(UNIVERSE_KEYWORDS)

// Universe values must match universe_type ENUM exactly (uppercase) - JSON keys are already uppercase
function inferUniverseAndCategory(pageName, pageSlug) {
  const combined = `${pageName ?? ""} ${pageSlug ?? ""}`.toLowerCase()

  for (const [universe, keywords] of Object.entries(UNIVERSE_KEYWORDS)) {
    if (keywords.some((k) => combined.includes(k))) {
      const rules = SEED_CATEGORY_RULES[universe] ?? []
      for (const rule of rules) {
        if (
          rule.keywords.length === 0 ||
          rule.keywords.some((k) => combined.includes(k))
        ) {
          return { universe, category: rule.category }
        }
      }
      return { universe, category: null }
    }
  }

  const defaultUniverse = "TECH_PRODUCTS"
  const defaultRules = SEED_CATEGORY_RULES[defaultUniverse]
  const defaultCategory =
    defaultRules?.[0]?.category ?? "Produits numériques"
  return { universe: defaultUniverse, category: defaultCategory }
}

async function main() {
  const { data: propositions, error } = await supabase
    .from("propositions")
    .select("id, page_id")
    .limit(10000)

  if (error) {
    console.error("Failed to fetch propositions:", error.message)
    process.exit(1)
  }

  const pageIds = [
    ...new Set(
      (propositions ?? []).map((p) => p.page_id).filter(Boolean)
    ),
  ]
  const pageById = new Map()
  if (pageIds.length > 0) {
    const { data: pages } = await supabase
      .from("pages")
      .select("id, name, slug")
      .in("id", pageIds)
    ;(pages ?? []).forEach((p) => pageById.set(p.id, p))
  }

  const updates = []
  for (const prop of propositions ?? []) {
    const page = pageById.get(prop.page_id)
    const pageName = page?.name ?? ""
    const pageSlug = page?.slug ?? ""
    const { universe, category } = inferUniverseAndCategory(pageName, pageSlug)

    updates.push({
      id: prop.id,
      universe,
      category,
      sub_category: null,
    })
  }

  const byUniverse = {}
  UNIVERSES.forEach((u) => (byUniverse[u] = 0))
  updates.forEach((u) => {
    if (u.universe) byUniverse[u.universe]++
  })

  console.log("Planned updates by universe:")
  Object.entries(byUniverse).forEach(([u, c]) => console.log(`  ${u}: ${c}`))
  console.log(`\nTotal: ${updates.length} propositions`)

  if (!dryRun && updates.length > 0) {
    const chunkSize = 100
    let updated = 0
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize)
      for (const row of chunk) {
        const { id, ...rest } = row
        const { error: err } = await supabase
          .from("propositions")
          .update(rest)
          .eq("id", id)
        if (err) {
          console.error(`Update failed for ${id}:`, err.message)
        } else {
          updated++
        }
      }
    }
    console.log(`\nUpdated ${updated} propositions.`)
  } else if (dryRun && updates.length > 0) {
    console.log("\nDry run: no updates written.")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})