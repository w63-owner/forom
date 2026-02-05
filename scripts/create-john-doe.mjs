/**
 * Crée le compte John Doe (une seule fois).
 * À la racine du projet :
 *   node --env-file=.env.local scripts/create-john-doe.mjs
 *
 * Identifiants par défaut :
 *   Email: john.doe@example.com
 *   Mot de passe: ChangeMe123!
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY. Lancez avec : node --env-file=.env.local scripts/create-john-doe.mjs"
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = "john.doe@example.com"
const password = "ChangeMe123!"
const username = "John Doe"

const { error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { username },
})

if (error) {
  if (error.message?.includes("already been registered")) {
    console.log("Le compte John Doe existe déjà (email:", email, "). Rien à faire.")
    process.exit(0)
  }
  console.error("Erreur:", error.message)
  process.exit(1)
}

console.log("Compte créé :", username)
console.log("  Email:", email)
console.log("  Mot de passe:", password)
console.log("  (pensez à changer le mot de passe après la première connexion)")
