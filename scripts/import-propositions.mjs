/**
 * Import propositions from a semi-colon CSV.
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-propositions.mjs "/absolute/path.csv"
 */
import fs from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"

const filePath = process.argv[2]
if (!filePath) {
  console.error("Missing CSV path. Provide an absolute path.")
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const raw = await fs.readFile(filePath, "utf8")
const lines = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

if (lines.length <= 1) {
  console.error("No data rows found.")
  process.exit(1)
}

const rows = []
for (const line of lines.slice(1)) {
  const parts = line.split(";")
  const pageId = (parts[0] ?? "").trim()
  const pageName = (parts[1] ?? "").trim()
  const title = (parts[2] ?? "").trim()
  const description = (parts.slice(3).join(";") ?? "").trim()

  if (!pageId || !pageName) continue
  if (!title) continue

  rows.push({
    page_id: pageId,
    page_name: pageName,
    title,
    description,
  })
}

if (rows.length === 0) {
  console.error("No valid rows with title found.")
  process.exit(1)
}

const unique = new Map()
for (const row of rows) {
  unique.set(`${row.page_id}::${row.title}`.toLowerCase(), row)
}
const deduped = Array.from(unique.values())

const pageIds = Array.from(new Set(deduped.map((row) => row.page_id)))
const { data: existing, error: existingError } = await supabase
  .from("propositions")
  .select("page_id, title")
  .in("page_id", pageIds)

if (existingError) {
  console.error("Failed to fetch existing propositions:", existingError.message)
  process.exit(1)
}

const existingSet = new Set(
  (existing ?? []).map((item) => `${item.page_id}::${item.title}`.toLowerCase())
)

const toInsert = deduped.filter(
  (row) => !existingSet.has(`${row.page_id}::${row.title}`.toLowerCase())
)

if (toInsert.length === 0) {
  console.log("Nothing to insert (all rows already exist).")
  process.exit(0)
}

const payload = toInsert.map((row) => ({
  title: row.title,
  description: row.description || null,
  page_id: row.page_id,
  status: "Open",
}))

const chunkSize = 500
let inserted = 0
for (let i = 0; i < payload.length; i += chunkSize) {
  const chunk = payload.slice(i, i + chunkSize)
  const { error } = await supabase.from("propositions").insert(chunk)
  if (error) {
    console.error("Insert failed:", error.message)
    process.exit(1)
  }
  inserted += chunk.length
}

console.log(`Inserted ${inserted} propositions.`)