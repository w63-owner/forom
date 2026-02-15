/**
 * Import discover_categories from CSV.
 * Universe values must match universe_type ENUM exactly (uppercase).
 * Generates UUID for each row.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-discover-categories.mjs
 *
 * Options:
 *   --dry-run    Log what would be inserted without writing
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const csvPath = join(__dirname, "../src/lib/discover-categories.csv")

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
  console.log("DRY RUN – no inserts will be written\n")
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ENUM values - must match universe_type exactly (uppercase)
const VALID_UNIVERSES = new Set([
  "MOBILITY_TRAVEL",
  "PUBLIC_SERVICES",
  "TECH_PRODUCTS",
  "CONSUMPTION",
  "LOCAL_LIFE",
  "ENERGY_UTILITIES",
  "MEDIA_CULTURE",
  "HOUSING_REAL_ESTATE",
  "PROFESSIONAL_LIFE",
  "LUXE_LIFESTYLE",
  "FINANCE_INVESTMENT",
  "INNOVATION_LAB",
])

function parseCSV(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase()
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",")
    const universe = (parts[0] ?? "").trim().toUpperCase()
    const category = (parts[1] ?? "").trim()
    const sub_category = (parts[2] ?? "").trim()
    if (!universe || !category) continue
    if (!VALID_UNIVERSES.has(universe)) {
      console.warn(`Skipping invalid universe: ${universe} (line ${i + 1})`)
      continue
    }
    rows.push({ universe, category, sub_category: sub_category || "" })
  }
  return rows
}

async function main() {
  const raw = readFileSync(csvPath, "utf8")
  const rows = parseCSV(raw)

  const unique = new Map()
  for (const row of rows) {
    const key = `${row.universe}::${row.category}::${row.sub_category}`
    if (!unique.has(key)) unique.set(key, row)
  }
  const deduped = Array.from(unique.values())

  console.log(`Parsed ${deduped.length} unique (universe, category, sub_category) rows`)

  if (!dryRun && deduped.length > 0) {
    const { error } = await supabase.from("discover_categories").upsert(
      deduped.map((r) => ({
        universe: r.universe,
        category: r.category,
        sub_category: r.sub_category,
      })),
      { onConflict: "universe,category,sub_category" }
    )
    if (error) {
      console.error("Insert failed:", error.message)
      process.exit(1)
    }
    console.log(`Inserted/updated ${deduped.length} rows into discover_categories.`)
  } else if (dryRun) {
    console.log("\nDry run: no inserts written.")
    console.log("Sample rows:", deduped.slice(0, 3))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})