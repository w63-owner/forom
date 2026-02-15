#!/usr/bin/env bash
# Vérifie si une session est active en appelant /api/auth/session.
# Sans argument : requête sans cookie → toujours {"user":null}.
# Avec argument : utilise le cookie passé (copié depuis le navigateur).
#
# Récupérer le cookie :
# 1. Ouvre DevTools (F12) → Application → Cookies → http://localhost:3000
# 2. Repère le cookie Supabase (ex. sb-xxxxx-auth-token) ou autre cookie de session
# 3. Copie "Nom=Valeur" ou toute la ligne Cookie
#
# Usage :
#   ./scripts/check-session.sh                    # sans cookie
#   ./scripts/check-session.sh "sb-xxx-auth-token=eyJ..."   # avec cookie

BASE_URL="${BASE_URL:-http://localhost:3000}"
if [ -n "$1" ]; then
  echo "--- Avec cookie de session ---"
  curl -s -w "\nHTTP: %{http_code}\n" -H "Cookie: $1" "$BASE_URL/api/auth/session"
else
  echo "--- Sans cookie (session = null) ---"
  curl -s -w "\nHTTP: %{http_code}\n" "$BASE_URL/api/auth/session"
fi