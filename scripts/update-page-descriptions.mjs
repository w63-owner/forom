/**
 * Update page descriptions from a CSV.
 *
 * Usage:
 *   node --env-file=.env.local scripts/update-page-descriptions.mjs "/absolute/path.csv"
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
const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
if (lines.length <= 1) {
  console.error("No data rows found.")
  process.exit(1)
}

const parseCsvLine = (line) => {
  const result = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      const nextChar = line[i + 1]
      if (inQuotes && nextChar === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
      continue
    }
    current += char
  }
  result.push(current)
  return result
}

const header = parseCsvLine(lines[0]).map((item) => item.trim())
const idIndex = header.indexOf("id")
const descriptionIndex = header.indexOf("description")

if (idIndex === -1 || descriptionIndex === -1) {
  console.error("CSV must include id and description columns.")
  process.exit(1)
}

const updates = []
for (const line of lines.slice(1)) {
  const values = parseCsvLine(line)
  const id = (values[idIndex] ?? "").trim()
  const description = (values[descriptionIndex] ?? "").trim()
  if (!id) continue
  updates.push({ id, description: description || null })
}

if (updates.length === 0) {
  console.error("No valid rows with id found.")
  process.exit(1)
}

const chunkSize = 100
let updated = 0
for (let i = 0; i < updates.length; i += chunkSize) {
  const chunk = updates.slice(i, i + chunkSize)
  const results = await Promise.all(
    chunk.map((row) =>
      supabase
        .from("pages")
        .update({ description: row.description })
        .eq("id", row.id)
    )
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) {
    console.error("Update failed:", failed.error.message)
    process.exit(1)
  }
  updated += chunk.length
}

console.log(`Updated ${updated} page descriptions.`)