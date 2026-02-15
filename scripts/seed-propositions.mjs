/**
 * Seed propositions with realistic data using the Discover taxonomy.
 * Table: propositions (not proposals)
 *
 * Classification fallback:
 * - Level 1 (ideal): universe + category + sub_category
 * - Level 2: universe + category, sub_category = null
 * - Level 3: universe only, category = null, sub_category = null
 * universe is ALWAYS required.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-propositions.mjs
 *
 * Options:
 *   --dry-run    Log what would be inserted without writing
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const csvPath = join(__dirname, "../src/lib/discover-categories.csv")

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  )
  process.exit(1)
}

const dryRun = process.argv.includes("--dry-run")
if (dryRun) {
  console.log("DRY RUN – no inserts will be written\n")
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Load taxonomy from CSV (source of truth) ───────────────────────────────

const VALID_UNIVERSES = new Set([
  "MOBILITY_TRAVEL",
  "PUBLIC_SERVICES",
  "TECH_PRODUCTS",
  "CONSUMPTION",
  "LOCAL_LIFE",
  "ENERGY_UTILITIES",
  "MEDIA_CULTURE",
  "HOUSING_REAL_ESTATE",
  "PROFESSIONAL_LIFE",
  "LUXE_LIFESTYLE",
  "FINANCE_INVESTMENT",
  "INNOVATION_LAB",
])

function loadTaxonomy() {
  const raw = readFileSync(csvPath, "utf8")
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const byUniverse = {}
  const byUniverseCategory = {}
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",")
    const u = (parts[0] ?? "").trim().toUpperCase()
    const c = (parts[1] ?? "").trim()
    const s = (parts[2] ?? "").trim() || ""
    if (!u || !c || !VALID_UNIVERSES.has(u)) continue
    if (!byUniverse[u]) byUniverse[u] = new Set()
    byUniverse[u].add(c)
    const key = `${u}::${c}`
    if (!byUniverseCategory[key]) byUniverseCategory[key] = new Set()
    byUniverseCategory[key].add(s)
  }
  return { byUniverse, byUniverseCategory }
}

const { byUniverse, byUniverseCategory } = loadTaxonomy()

function classify(universe, category, sub_category) {
  if (!VALID_UNIVERSES.has(universe)) return null
  const catSet = byUniverse[universe]
  const subKey = `${universe}::${category}`
  const subSet = byUniverseCategory[subKey]

  let level = 3
  let outCategory = null
  let outSubCategory = null

  if (category && catSet?.has(category)) {
    outCategory = category
    level = 2
    if (sub_category && subSet?.has(sub_category)) {
      outSubCategory = sub_category
      level = 1
    }
  }

  return {
    universe,
    category: outCategory,
    sub_category: outSubCategory,
    level,
  }
}

// ─── Proposition seeds (title, universe, category, sub_category) ────────────

const PROPOSITION_SEEDS = [
  {
    title: "Améliorer la ponctualité du RER B",
    universe: "PUBLIC_SERVICES",
    category: "Transports Publics",
    sub_category: "Ponctualité & Régularité (Train/Métro)",
    pageHint: "sncf",
  },
  {
    title: "Baisse des frais de service Uber Eats",
    universe: "CONSUMPTION",
    category: "Restauration",
    sub_category: "Livraison de Repas (Délais/État)",
    pageHint: "uber",
  },
  {
    title: "Simplifier la déclaration d'impôts en ligne",
    universe: "PUBLIC_SERVICES",
    category: "Administration",
    sub_category: "Simplification des Formulaires",
    pageHint: "impots",
  },
  {
    title: "Ajouter le mode sombre sur l'appli bancaire",
    universe: "CONSUMPTION",
    category: "Services Financiers",
    sub_category: "Ergonomie App Bancaire",
    pageHint: "bnp",
  },
  {
    title: "Une idée vague sur la transition énergétique",
    universe: "ENERGY_UTILITIES",
    category: null,
    sub_category: null,
    pageHint: null,
  },
  {
    title: "Prises de RDV plus rapides chez les spécialistes",
    universe: "PUBLIC_SERVICES",
    category: "Santé Publique",
    sub_category: "Prise de RDV Médecins Spécialistes",
    pageHint: "doctolib",
  },
  {
    title: "Propreté des rames et gares de métro",
    universe: "PUBLIC_SERVICES",
    category: "Transports Publics",
    sub_category: "Propreté des Rames & Gares",
    pageHint: "ratp",
  },
  {
    title: "Améliorer les recommandations Netflix",
    universe: "MEDIA_CULTURE",
    category: "Streaming Vidéo",
    sub_category: "Recommandation & Découverte",
    pageHint: "netflix",
  },
  {
    title: "Politique de retour plus claire sur Vinted",
    universe: "CONSUMPTION",
    category: "E-commerce",
    sub_category: "Politique de Retour & Remboursement",
    pageHint: "vinted",
  },
  {
    title: "Mode sombre pour toutes les apps",
    universe: "TECH_PRODUCTS",
    category: "Apps Grand Public",
    sub_category: "Mode Sombre & Accessibilité",
    pageHint: "google",
  },
  {
    title: "Nettoyage des trottoirs et rues du quartier",
    universe: "LOCAL_LIFE",
    category: "Quartier & Voirie",
    sub_category: "Propreté des Rues & Trottoirs",
    pageHint: "mairie",
  },
  {
    title: "Facture Linky plus compréhensible",
    universe: "ENERGY_UTILITIES",
    category: "Électricité & Gaz",
    sub_category: "Compréhension des Factures",
    pageHint: "edf",
  },
  {
    title: "Transparence des prix Uber",
    universe: "MOBILITY_TRAVEL",
    category: "VTC & Taxis",
    sub_category: "Transparence des Prix & Majorations",
    pageHint: "uber",
  },
  {
    title: "Moins de notifications intrusives",
    universe: "TECH_PRODUCTS",
    category: "Apps Grand Public",
    sub_category: "Gestion des Notifications & Intrusivité",
    pageHint: "meta",
  },
  {
    title: "Réparabilité des smartphones",
    universe: "TECH_PRODUCTS",
    category: "Hardware & IoT",
    sub_category: "Réparabilité & Pièces Détachées",
    pageHint: "apple",
  },
  {
    title: "Attente en caisse Decathlon",
    universe: "CONSUMPTION",
    category: "Retail Physique",
    sub_category: "Attente en Caisse & Fluidité",
    pageHint: "decathlon",
  },
  {
    title: "Transparence des annonces immobilières",
    universe: "HOUSING_REAL_ESTATE",
    category: "Location",
    sub_category: "Transparence des Annonces",
    pageHint: "leboncoin",
  },
  {
    title: "Télétravail et flexibilité des horaires",
    universe: "PROFESSIONAL_LIFE",
    category: "Vie au Travail",
    sub_category: "Télétravail & Flexibilité",
    pageHint: "linkedin",
  },
  {
    title: "Sécurité des wallets crypto",
    universe: "FINANCE_INVESTMENT",
    category: "Crypto & Web3",
    sub_category: "Sécurité des Wallets & Clés",
    pageHint: null,
  },
  {
    title: "Confort des sièges en avion",
    universe: "MOBILITY_TRAVEL",
    category: "Aviation Commerciale",
    sub_category: "Confort Cabine (Siège/Espace)",
    pageHint: "airfrance",
  },
]

// ─── Random date in last 3 months ───────────────────────────────────────────

function randomCreatedAt() {
  const now = new Date()
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const start = threeMonthsAgo.getTime()
  const end = now.getTime()
  return new Date(start + Math.random() * (end - start)).toISOString()
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const pageBySlug = new Map()
  const { data: pages } = await supabase
    .from("pages")
    .select("id, slug, name")
  ;(pages ?? []).forEach((p) => {
    if (p.slug) pageBySlug.set(p.slug.toLowerCase(), p.id)
    if (p.name) pageBySlug.set(p.name.toLowerCase(), p.id)
  })

  const toInsert = []
  for (const seed of PROPOSITION_SEEDS) {
    const c = classify(seed.universe, seed.category, seed.sub_category)
    if (!c) {
      console.warn(`Skipping invalid: ${seed.title} (universe ${seed.universe})`)
      continue
    }

    let pageId = null
    if (seed.pageHint) {
      pageId = pageBySlug.get(seed.pageHint.toLowerCase()) ?? null
    }

    toInsert.push({
      title: seed.title,
      status: "Open",
      universe: c.universe,
      category: c.category,
      sub_category: c.sub_category,
      page_id: pageId,
      created_at: randomCreatedAt(),
    })
  }

  console.log(`Prepared ${toInsert.length} propositions`)
  const byLevel = { 1: 0, 2: 0, 3: 0 }
  toInsert.forEach((r) => {
    const l = r.sub_category ? 1 : r.category ? 2 : 3
    byLevel[l]++
  })
  console.log(`  Level 1 (full): ${byLevel[1]}, Level 2 (cat only): ${byLevel[2]}, Level 3 (universe only): ${byLevel[3]}`)

  if (!dryRun && toInsert.length > 0) {
    const { data, error } = await supabase
      .from("propositions")
      .insert(toInsert)
      .select("id")
    if (error) {
      console.error("Insert failed:", error.message)
      process.exit(1)
    }
    console.log(`\nInserted ${data?.length ?? 0} propositions.`)
  } else if (dryRun) {
    console.log("\nDry run: no inserts written.")
    console.log("Sample:", toInsert.slice(0, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})