/**
 * Pure utilities for proposition creation/validation.
 * Used by proposition-client and tests.
 */

/** Escape % and _ for Supabase ilike patterns */
export function sanitizeQuery(value: string): string {
    return value.replace(/[%_]/g, "\\$&")
  }
  
  /** Strip HTML tags and trim */
  export function stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, "").trim()
  }
  
  /** Detect duplicate proposition error (DB unique constraint 23505) */
  export function isDuplicatePropositionError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false
    return (
      error.code === "23505" ||
      (error.message ?? "").toLowerCase().includes("unique") ||
      (error.message ?? "").toLowerCase().includes("duplicate")
    )
  }
  
  /** Validate if form can submit: title required (non-empty after trim), page required when linking */
  export function canSubmitProposition(
    trimmedTitle: string,
    linkChoice: "none" | "existing" | "create",
    hasSelectedPage: boolean
  ): boolean {
    if (!trimmedTitle?.trim()) return false
    if (linkChoice === "existing" && !hasSelectedPage) return false
    return true
  }