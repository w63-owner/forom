export const STATUS_VALUES = ["Open", "In Progress", "Done", "Won't Do"] as const

export const STATUS_KEY_BY_VALUE: Record<string, string> = {
  Open: "open",
  "In Progress": "inProgress",
  Done: "done",
  "Won't Do": "wontDo",
}

export function getStatusKey(status: string | null | undefined): string {
  if (status == null || status === "") return STATUS_KEY_BY_VALUE.Open
  return STATUS_KEY_BY_VALUE[status] ?? status
}