export function canUseSeedPagesEndpoint(args: {
  userId: string
  nodeEnv: string | undefined
  adminUserIdsEnv: string | undefined
}): boolean {
  if (args.nodeEnv !== "production") {
    return true
  }
  const adminIds = (args.adminUserIdsEnv ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  return adminIds.includes(args.userId)
}
