"use client"

import { useState } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import {
  Briefcase,
  Building2,
  Car,
  ChevronDown,
  ChevronRight,
  Cpu,
  Gem,
  Home,
  Lightbulb,
  MapPin,
  Radio,
  ShoppingBag,
  TrendingUp,
  Zap,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getCategoriesForUniverseFromCsv } from "@/lib/discover-categories"
import type { Universe } from "@/types/schema"
import { UNIVERSE_SLUGS } from "@/types/schema"

const UNIVERSE_ICONS: Record<Universe, React.ComponentType<{ className?: string }>> = {
  MOBILITY_TRAVEL: Car,
  PUBLIC_SERVICES: Building2,
  TECH_PRODUCTS: Cpu,
  CONSUMPTION: ShoppingBag,
  LOCAL_LIFE: MapPin,
  ENERGY_UTILITIES: Zap,
  MEDIA_CULTURE: Radio,
  HOUSING_REAL_ESTATE: Home,
  PROFESSIONAL_LIFE: Briefcase,
  LUXE_LIFESTYLE: Gem,
  FINANCE_INVESTMENT: TrendingUp,
  INNOVATION_LAB: Lightbulb,
}

function UniverseCard({
  universe,
  slug,
  count,
  t,
  tCommon,
}: {
  universe: Universe
  slug: string
  count: number
  t: (key: string, values?: Record<string, number>) => string
  tCommon: (key: string) => string
}) {
  const Icon = UNIVERSE_ICONS[universe]
  const categories = getCategoriesForUniverseFromCsv(universe)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleCategory = (category: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return (
    <Card className="h-full transition-colors hover:bg-muted/30">
      <CardContent className="flex flex-col gap-4 px-5 py-5">
        <Link
          href={`/discover/${slug}`}
          className="flex flex-col items-center gap-2 text-center hover:opacity-90"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t(`universe_${universe}`)}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("propositionCount", { count })}
            </p>
          </div>
        </Link>
        {categories.length > 0 && (
          <div className="space-y-1 border-t border-border pt-3">
            {categories.map(({ category, subCategories }) => {
              const isExpanded = expanded.has(category)
              const hasSubs = subCategories.length > 0
              return (
                <div key={category} className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    {hasSubs ? (
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? tCommon("collapse") : tCommon("expand")}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                    ) : (
                      <span className="size-5 shrink-0" />
                    )}
                    <Link
                      href={`/discover/${slug}?category=${encodeURIComponent(category)}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {category}
                    </Link>
                  </div>
                  {hasSubs && isExpanded && (
                    <ul className="ml-6 space-y-0.5 py-1">
                      {subCategories.map((sub) => (
                        <li key={sub}>
                          <Link
                            href={`/discover/${slug}?category=${encodeURIComponent(category)}&sub_category=${encodeURIComponent(sub)}`}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {sub}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type UniverseGridProps = {
  initialCounts?: Partial<Record<Universe, number>>
}

export function UniverseGrid({ initialCounts = {} }: UniverseGridProps) {
  const t = useTranslations("Discover")
  const tCommon = useTranslations("Common")

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(UNIVERSE_SLUGS) as Universe[]).map((universe) => {
        const slug = UNIVERSE_SLUGS[universe]
        const count = initialCounts[universe] ?? 0
        return (
          <UniverseCard
            key={universe}
            universe={universe}
            slug={slug}
            count={count}
            t={t}
            tCommon={tCommon}
          />
        )
      })}
    </div>
  )
}