export const STATUS_VALUES = ["Open", "In Progress", "Done", "Won't Do"] as const
export type PropositionStatus = (typeof STATUS_VALUES)[number]

export const DEFAULT_STATUS: PropositionStatus = "Open"

export const STATUS_DISPLAY_ORDER: readonly PropositionStatus[] = STATUS_VALUES

export const STATUS_KEY_BY_VALUE: Record<PropositionStatus, string> = {
  Open: "open",
  "In Progress": "inProgress",
  Done: "done",
  "Won't Do": "wontDo",
}

const STATUS_RANK: Record<PropositionStatus, number> = {
  Open: 0,
  "In Progress": 1,
  Done: 2,
  "Won't Do": 3,
}

const STATUS_TONE_BY_VALUE: Record<PropositionStatus, string> = {
  Open: "status-open",
  "In Progress": "status-in-progress",
  Done: "status-done",
  "Won't Do": "status-wont-do",
}

export function isKnownStatus(
  status: string | null | undefined
): status is PropositionStatus {
  if (!status) return false
  return (STATUS_VALUES as readonly string[]).includes(status)
}

export function normalizeStatus(
  status: string | null | undefined
): PropositionStatus {
  if (!status) return DEFAULT_STATUS
  return isKnownStatus(status) ? status : DEFAULT_STATUS
}

export function getStatusKey(status: string | null | undefined): string {
  const normalized = normalizeStatus(status)
  return STATUS_KEY_BY_VALUE[normalized]
}

export function getStatusToneClass(status: string | null | undefined): string {
  const normalized = normalizeStatus(status)
  return STATUS_TONE_BY_VALUE[normalized]
}

export function compareStatuses(
  left: string | null | undefined,
  right: string | null | undefined,
  order: "asc" | "desc" = "asc"
): number {
  const rank = STATUS_RANK[normalizeStatus(left)] - STATUS_RANK[normalizeStatus(right)]
  return order === "asc" ? rank : -rank
}