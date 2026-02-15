"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Alert } from "@/components/ui/alert"

type RecentProposition = {
  id: string
  title: string
  author: string
  pageName?: string | null
  pageSlug?: string | null
}

type Props = {
  items: RecentProposition[]
}

export function RecentPropositionsTicker({ items }: Props) {
  const tHome = useTranslations("Home")
  const tCommon = useTranslations("Common")
  const safeItems = useMemo(
    () =>
      items
        .filter((item) => item.title && item.title.trim().length > 0)
        .map((item) => ({
          ...item,
          author: item.author || tCommon("anonymous"),
        })),
    [items, tCommon]
  )
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (safeItems.length <= 1) return
    let mounted = true
    let timeoutId: ReturnType<typeof setTimeout>

    const schedule = () => {
      timeoutId = setTimeout(() => {
        if (!mounted) return
        setVisible(false)
        setOffset(-8)
        timeoutId = setTimeout(() => {
          if (!mounted) return
          setIndex((prev) => (prev + 1) % safeItems.length)
          setOffset(8)
          requestAnimationFrame(() => {
            setVisible(true)
            setOffset(0)
          })
          schedule()
        }, 200)
      }, 3000)
    }

    schedule()
    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [safeItems.length])

  if (safeItems.length === 0) return null
  const current = safeItems[index]
  const hasPage = Boolean(current.pageSlug && current.pageName)
  const pageName = current.pageName ?? ""
  const pageSlug = current.pageSlug ?? ""

  return (
    <div className="flex items-center justify-center">
      <div
        className={`transition-all duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ transform: `translateY(${offset}px)` }}
      >
        <Alert variant="info" className="items-center">
          <span className="text-sm text-sky-900 dark:text-sky-100">
            {hasPage
              ? tHome.rich("recentWithPage", {
                  author: current.author,
                  pageName,
                  propositionTitle: current.title,
                  page: (chunks) => (
                    <Link
                      href={`/pages/${pageSlug}`}
                      className="font-medium text-sky-900 underline underline-offset-2 dark:text-sky-100"
                    >
                      {chunks}
                    </Link>
                  ),
                  proposition: (chunks) => (
                    <Link
                      href={`/propositions/${current.id}`}
                      className="font-medium text-sky-900 underline underline-offset-2 dark:text-sky-100"
                    >
                      {chunks}
                    </Link>
                  ),
                })
              : tHome.rich("recentWithoutPage", {
                  author: current.author,
                  propositionTitle: current.title,
                  proposition: (chunks) => (
                    <Link
                      href={`/propositions/${current.id}`}
                      className="font-medium text-sky-900 underline underline-offset-2 dark:text-sky-100"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
          </span>
        </Alert>
      </div>
    </div>
  )
}