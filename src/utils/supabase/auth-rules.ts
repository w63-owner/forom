/**
 * Règles pour éviter les faux négatifs auth : on ne considère l'utilisateur
 * comme déconnecté que lorsque l'API a répondu 200 avec user: null.
 * En cas d'erreur réseau ou 500, on ne passe pas en "déconnecté".
 */

export type ServerSessionResult =
  | { ok: true; user: unknown }
  | { ok: false }

/**
 * Retourne true seulement quand il faut passer l'UI en "non connecté".
 * - ok: false (erreur réseau / 500) → false : ne pas déconnecter (évite faux négatif)
 * - ok: true, user: null → true (explicit logout)
 * - ok: true, user: {...} → false
 */
export function shouldSetUnauthenticatedFromServerResult(
  result: ServerSessionResult | null,
  hadUser: boolean
): boolean {
  if (result == null) return false
  if (!result.ok) return false
  if (result.user !== null) return false
  if (hadUser) return false
  return true
}