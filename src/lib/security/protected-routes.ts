import { routing } from "@/i18n/routing"

export const stripLocalePrefix = (pathname: string): { locale: string; normalizedPath: string } => {
  const segments = pathname.split("/").filter(Boolean)
  const firstSegment = segments[0] ?? ""
  const isLocale = (routing.locales as readonly string[]).includes(firstSegment)
  const locale = isLocale ? firstSegment : routing.defaultLocale
  const normalizedPath = isLocale
    ? `/${segments.slice(1).join("/") || ""}`.replace(/\/+$/, "") || "/"
    : pathname
  return { locale, normalizedPath }
}

export function isProtectedAppPath(pathname: string): boolean {
  if (
    pathname === "/profile" ||
    pathname === "/pages/create" ||
    pathname === "/propositions/create"
  ) {
    return true
  }
  if (/^\/propositions\/[^/]+\/edit$/.test(pathname)) {
    return true
  }
  return false
}
