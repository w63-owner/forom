import DOMPurify from "isomorphic-dompurify"

/**
 * Sanitizes HTML to prevent XSS when rendering user content via dangerouslySetInnerHTML.
 * Allows safe tags (headings, paragraphs, lists, links, images) while stripping scripts,
 * event handlers, and other dangerous attributes.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (html == null || html === "") return ""
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
}
