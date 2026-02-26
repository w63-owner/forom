import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Pre-fetches cached translations from the DB for a list of source IDs.
 * Returns a plain Record so it can be serialized as a Next.js Server Component prop.
 *
 * Result shape: { [sourceId]: { [field]: translatedText } }
 * Only IDs/fields already in the cache are returned — missing ones will be
 * fetched client-side by useAutoListTranslations via the batch API.
 */
export async function prefetchTranslations(
  supabase: SupabaseClient,
  ids: string[],
  sourceTable: string,
  fields: string[],
  targetLang: string
): Promise<Record<string, Record<string, string>>> {
  if (ids.length === 0) return {}

  const { data } = await supabase
    .from("translations")
    .select("source_id, source_field, translated_text")
    .eq("source_table", sourceTable)
    .in("source_id", ids)
    .in("source_field", fields)
    .eq("target_lang", targetLang)

  if (!data || data.length === 0) return {}

  const result: Record<string, Record<string, string>> = {}
  for (const row of data) {
    if (!result[row.source_id]) result[row.source_id] = {}
    result[row.source_id][row.source_field] = row.translated_text
  }
  return result
}
