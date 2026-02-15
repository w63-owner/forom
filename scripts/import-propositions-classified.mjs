/**
 * Import classifications (universe, category, sub_category) from propositions_classified.csv.
 * Updates existing propositions by ID.
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-propositions-classified.mjs /path/to/propositions_classified.csv
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const csvPath = process.argv[2] || "/Users/Antonin/Downloads/propositions_classified.csv"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const VALID_UNIVERSES = new Set([
  "MOBILITY_TRAVEL", "PUBLIC_SERVICES", "TECH_PRODUCTS", "CONSUMPTION",
  "LOCAL_LIFE", "ENERGY_UTILITIES", "MEDIA_CULTURE", "HOUSING_REAL_ESTATE",
  "PROFESSIONAL_LIFE", "LUXE_LIFESTYLE", "FINANCE_INVESTMENT", "INNOVATION_LAB",
])

function parseCSV(raw) {
  const rows = []
  const lines = raw.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    let line = lines[i]
    while ((line.match(/"/g) || []).length % 2 !== 0 && i + 1 < lines.length) {
      line += "\n" + lines[++i]
    }
    i++
    const parts = []
    let cur = ""
    let inQ = false
    for (let j = 0; j < line.length; j++) {
      const c = line[j]
      if (c === '"') inQ = !inQ
      else if (c === "," && !inQ) {
        parts.push(cur.trim())
        cur = ""
      } else cur += c
    }
    parts.push(cur.trim())
    if (parts.length < 13) continue
    const id = parts[0]
    const universe = (parts[parts.length - 3] || "").trim().toUpperCase()
    const category = (parts[parts.length - 2] || "").trim() || null
    const sub_category = (parts[parts.length - 1] || "").trim() || null
    if (!id || !VALID_UNIVERSES.has(universe)) continue
    rows.push({ id, universe, category, sub_category })
  }
  return rows
}

async function main() {
  const raw = readFileSync(csvPath, "utf8")
  const rows = parseCSV(raw)
  console.log(`Parsed ${rows.length} rows from CSV`)

  let updated = 0
  let errors = 0
  for (const row of rows) {
    const { error } = await supabase
      .from("propositions")
      .update({
        universe: row.universe,
        category: row.category,
        sub_category: row.sub_category,
      })
      .eq("id", row.id)
    if (error) {
      errors++
      if (errors <= 3) console.warn(`Update failed for ${row.id}:`, error.message)
    } else {
      updated++
    }
  }
  console.log(`Updated ${updated} propositions. ${errors} errors.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})