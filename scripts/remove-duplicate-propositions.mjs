/**
 * Remove duplicate propositions (same title + same page_id).
 * Keeps the oldest proposition (created_at) in each duplicate group.
 *
 * Usage:
 *   node --env-file=.env.local scripts/remove-duplicate-propositions.mjs
 *   node --env-file=.env.local scripts/remove-duplicate-propositions.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js"

const DRY_RUN = process.argv.includes("--dry-run")

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: propositions, error } = await supabase
    .from("propositions")
    .select("id, page_id, title, created_at")

  if (error) {
    console.error("Failed to fetch propositions:", error.message)
    process.exit(1)
  }

  // Group by (lower(trim(title)), page_id)
  const groups = new Map()
  for (const p of propositions) {
    const key = `${(p.title || "").trim().toLowerCase()}::${p.page_id || ""}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(p)
  }

  const toDelete = []
  for (const [, arr] of groups) {
    if (arr.length <= 1) continue
    // Sort by created_at asc, then id asc; keep first, delete rest
    arr.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime()
      const tb = new Date(b.created_at || 0).getTime()
      if (ta !== tb) return ta - tb
      return (a.id || "").localeCompare(b.id || "")
    })
    toDelete.push(...arr.slice(1))
  }

  console.log(`Found ${toDelete.length} duplicate propositions to remove`)

  if (toDelete.length === 0) {
    console.log("No duplicates found.")
    return
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Would delete:")
    for (const p of toDelete.slice(0, 20)) {
      console.log(`  - ${p.id} | "${p.title}" | page ${p.page_id}`)
    }
    if (toDelete.length > 20) {
      console.log(`  ... and ${toDelete.length - 20} more`)
    }
    return
  }

  const ids = toDelete.map((p) => p.id)
  const { error: delErr } = await supabase.from("propositions").delete().in("id", ids)

  if (delErr) {
    console.error("Failed to delete:", delErr.message)
    process.exit(1)
  }

  console.log(`Deleted ${ids.length} duplicate propositions.`)
}

main()