# Tests auth / session

## Anti-faux négatifs (auth-rules)

- **`auth-rules-faux-negatifs.test.ts`** : règle « ne déconnecter que si 200 + user: null »
  - **QA** : `ok: false` (réseau / 500) → jamais déconnecter ; `ok: true`, `user: null`, `hadUser: false` → déconnecter ; autres cas cohérents
  - **Stress** : 1000 appels avec `ok: false` → toujours false ; 1000 avec `user: null` + `hadUser: true` → toujours false ; mélange de cas
  - **Chaos** : erreur réseau / 500 / null ne doivent jamais donner « déconnecter » ; seul cas true = 200 explicite avec user null et pas de hadUser

Le composant `AuthStatus` utilise `shouldSetUnauthenticatedFromServerResult()` (voir `auth-rules.ts`) pour appliquer cette règle.

## QA (qualité)

- **`auth-check.test.ts`** : comportement de `resolveAuthUser`
  - Client a une session → on retourne l’utilisateur client
  - Client null + API 200 avec user → on retourne l’utilisateur serveur (fallback parallèle)
  - Les deux null → résultat null
  - Préférence client quand les deux ont un user
  - Pas d’appel serveur si `includeServerFallback: false`
  - Réponse 500 → null (pas de crash)
  - Mise à jour du snapshot après résolution

## Stress

- **`auth-check.stress.test.ts`**
  - 50 appels concurrents à `resolveAuthUser` → tous résolus au même user, pas de race
  - 100 appels séquentiels avec reset du snapshot → pas de fuite d’état

## Chaos (résilience)

- **`auth-check.chaos.test.ts`**
  - Client en erreur (getSession throw) → la promesse rejette (Promise.all), pas de fallback serveur dans ce cas
  - Fetch en erreur + client OK → on garde le user client
  - Client null + serveur 200 avec user → user serveur
  - Client + serveur en erreur → rejet explicite (pas de crash)
  - API 500 + client null → null (erreur serveur ne force pas une déconnexion côté UI si on interprète côté appelant)

## Lancer les tests

```bash
npm run test           # tous les tests
npm run test:watch     # mode watch
npm run test:stress    # uniquement les tests dont le nom contient "stress"
npm run test:chaos     # uniquement les tests dont le nom contient "chaos"
```