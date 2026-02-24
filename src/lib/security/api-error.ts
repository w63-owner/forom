type MappedHttpError = {
  status: number
  message: string
}

export function mapSupabaseErrorToHttp(error: {
  code?: string
  message?: string
}): MappedHttpError {
  if (error.code === "42501") {
    return { status: 403, message: "Forbidden." }
  }
  if (error.code === "23505") {
    return { status: 409, message: "Conflict." }
  }
  if (error.code === "57014") {
    return { status: 503, message: "Request timeout." }
  }
  if (error.code === "42703") {
    return { status: 500, message: "Database schema out of date. Please run latest migrations." }
  }
  return { status: 500, message: "Internal server error." }
}
