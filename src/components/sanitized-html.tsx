"use client"

import { useMemo } from "react"
import DOMPurify from "isomorphic-dompurify"

type Props = {
  html: string
  className?: string
}

export function SanitizedHtml({ html, className }: Props) {
  const safeHtml = useMemo(() => {
    if (!html) return ""
    try {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "strong",
          "b",
          "em",
          "i",
          "u",
          "s",
          "a",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
          "h4",
          "blockquote",
          "code",
          "pre",
          "img",
        ],
        ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title"],
        ADD_ATTR: ["target"],
      })
    } catch {
      return html
    }
  }, [html])

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
