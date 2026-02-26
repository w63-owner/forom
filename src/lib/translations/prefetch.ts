import type { SupabaseClient } from "@supabase/supabase-js"
import { translateText } from "./deepl-client"

const HTML_FIELDS = new Set(["description"])
const DEEPL_LANG_MAP: Record<string, "FR" | "EN"> = { fr: "FR", en: "EN" }

/**
 * Server-side translation prefetch that guarantees translated content
 * is available before the page renders, eliminating any client-side flash.
 *
 * 1. Reads cached translations from the DB
 * 2. For any missing IDs/fields, fetches source content + calls DeepL
 * 3. Caches the new translations for future requests
 * 4. Returns a serializable Record for passing as a Server Component prop
 *
 * Result shape: { [sourceId]: { [field]: translatedText } }
 */
export async function prefetchTranslations(
  supabase: SupabaseClient,
  ids: string[],
  sourceTable: string,
  fields: string[],
  targetLang: string
): Promise<Record<string, Record<string, string>>> {
  if (ids.length === 0) return {}

  const deepLTarget = DEEPL_LANG_MAP[targetLang]
  if (!deepLTarget) return {}

  // --- 1. Batch cache lookup ---
  const { data: cached } = await supabase
    .from("translations")
    .select("source_id, source_field, translated_text")
    .eq("source_table", sourceTable)
    .in("source_id", ids)
    .in("source_field", fields)
    .eq("target_lang", targetLang)

  const result: Record<string, Record<string, string>> = {}
  const cachedSet = new Set<string>()

  for (const row of cached ?? []) {
    result[row.source_id] ??= {}
    result[row.source_id][row.source_field] = row.translated_text
    cachedSet.add(`${row.source_id}:${row.source_field}`)
  }

  // --- 2. Find uncached IDs/fields ---
  type MissingEntry = { id: string; field: string }
  const missing: MissingEntry[] = []
  for (const id of ids) {
    for (const field of fields) {
      if (!cachedSet.has(`${id}:${field}`)) {
        missing.push({ id, field })
      }
    }
  }

  if (missing.length === 0) return result

  // No API key → return what we have from cache, client will handle the rest
  if (!process.env.DEEPL_API_KEY) return result

  // --- 3. Fetch source content for uncached items ---
  const missingIds = [...new Set(missing.map((m) => m.id))]
  const missingFields = [...new Set(missing.map((m) => m.field))]
  const selectCols = ["id", ...missingFields].join(", ")

  const { data: sourceRows } = await supabase
    .from(sourceTable)
    .select(selectCols)
    .in("id", missingIds)

  if (!sourceRows || sourceRows.length === 0) return result

  const sourceIndex = new Map(
    (sourceRows as unknown as Array<Record<string, unknown>>).map((row) => [
      row.id as string,
      row,
    ])
  )

  // --- 4. Translate via DeepL (parallel, capped at 10 concurrent) ---
  const CONCURRENCY = 10
  const tasks = missing
    .map((entry) => {
      const sourceRow = sourceIndex.get(entry.id)
      if (!sourceRow) return null
      const sourceText = sourceRow[entry.field] as string | null
      if (!sourceText?.trim()) return null
      return { ...entry, sourceText }
    })
    .filter(Boolean) as Array<MissingEntry & { sourceText: string }>

  const translateAndCache = async (task: MissingEntry & { sourceText: string }) => {
    try {
      const { translatedText, detectedSourceLang } = await translateText({
        text: task.sourceText,
        targetLang: deepLTarget,
        isHtml: HTML_FIELDS.has(task.field),
      })

      if (detectedSourceLang === targetLang) {
        result[task.id] ??= {}
        result[task.id][task.field] = task.sourceText
        return
      }

      result[task.id] ??= {}
      result[task.id][task.field] = translatedText

      // Fire-and-forget cache upsert
      void supabase.from("translations").upsert(
        {
          source_table: sourceTable,
          source_id: task.id,
          source_field: task.field,
          source_lang: detectedSourceLang,
          target_lang: targetLang,
          translated_text: translatedText,
          char_count: task.sourceText.length,
        },
        { onConflict: "source_table,source_id,source_field,target_lang" }
      )
    } catch {
      // DeepL error for this item — original text will be used as fallback
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(translateAndCache))
  }

  return result
}
