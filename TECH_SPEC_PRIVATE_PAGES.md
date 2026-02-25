# Spécification Technique — Pages Privées (FOROM)

## 1) Objectif

Permettre de créer une page en mode **privé** dès la création, puis d'en partager l'accès à des membres FOROM via **lien d'invitation**.

Une page privée doit:
- être accessible uniquement aux membres autorisés (owner/admin/viewer),
- ne pas apparaître dans la recherche interne, omnibar, suggestions de mention, explore/discover et listing pages pour les non-membres,
- ne pas être indexée (SEO) ni exposée dans le sitemap.

---

## 2) Périmètre

### In Scope
- Modèle de données (pages + membres + invitations).
- RLS et contrôle d'accès lecture/écriture.
- API d'invitation (création, listing, révocation, redeem).
- Intégration UI (création de page, gestion accès, états d'erreur).
- Exclusion des pages privées dans search/omnibar/sitemap/metadata SEO.
- Tests de non-régression et de sécurité.

### Out of Scope (phase ultérieure)
- Invitations par email transactionnel.
- Partage externe public "unlisted" (sans compte FOROM).
- Audit log complet d'administration.

---

## 3) Décisions d'architecture

- La confidentialité est garantie **au niveau DB (RLS)**, pas uniquement au niveau UI.
- Les mutations sensibles (invitation, membership, changement de visibilité) passent par `src/app/api/**/route.ts`.
- Les tokens d'invitation sont stockés **hachés** (jamais en clair).
- Les non-autorisés reçoivent `404` sur les ressources privées pour limiter l'énumération.

---

## 4) Modèle de données (migration SQL)

## 4.1 Évolution de `pages`

Ajouter la visibilité:
- `visibility text not null default 'public' check (visibility in ('public','private'))`

Optionnel recommandé:
- `private_search_exempt boolean not null default false` (si besoin futur d'exception interne).

## 4.2 Table des membres de page

```sql
create table if not exists public.page_members (
  page_id uuid not null references public.pages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('admin', 'viewer')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);

create index if not exists page_members_user_idx on public.page_members(user_id);
create index if not exists page_members_page_role_idx on public.page_members(page_id, role);
```

Note: le owner reste porté par `pages.owner_id` (pas de duplication obligatoire dans `page_members`).

## 4.3 Table des invitations

```sql
create table if not exists public.page_invitations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer,
  used_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists page_invitations_page_idx on public.page_invitations(page_id);
create index if not exists page_invitations_expires_idx on public.page_invitations(expires_at);
create index if not exists page_invitations_active_idx
  on public.page_invitations(page_id, expires_at)
  where revoked_at is null;
```

---

## 5) RLS et sécurité d'accès

## 5.1 Fonctions SQL utilitaires

```sql
create or replace function public.can_read_page(_page_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pages p
    where p.id = _page_id
      and (
        p.visibility = 'public'
        or p.owner_id = auth.uid()
        or exists (
          select 1
          from public.page_members pm
          where pm.page_id = p.id
            and pm.user_id = auth.uid()
        )
      )
  );
$$;
```

## 5.2 Policy `pages`

- Remplacer `public read pages` actuel.
- Nouvelle policy select:
  - public si `visibility = 'public'`
  - sinon owner ou membre.

Exemple:

```sql
drop policy if exists "public read pages" on public.pages;
create policy "read pages by visibility_or_membership"
on public.pages
for select
to public
using (
  visibility = 'public'
  or owner_id = auth.uid()
  or exists (
    select 1 from public.page_members pm
    where pm.page_id = pages.id
      and pm.user_id = auth.uid()
  )
);
```

Policy update/delete de `pages`:
- owner only (et éventuellement admin selon choix produit).

## 5.3 Propagation aux tables liées

Sur `propositions`, `comments`, `votes`, `volunteers`, `page_subscriptions`:
- lecture autorisée si `can_read_page(page_id)` (ou via jointure vers proposition/page concernée),
- écriture contrôlée au minimum sur owner/membre selon règles métier.

Exemple `propositions` (select):

```sql
drop policy if exists "public read propositions" on public.propositions;
create policy "read propositions if page readable_or_orphan"
on public.propositions
for select
to public
using (
  page_id is null
  or public.can_read_page(page_id)
);
```

Important:
- vérifier les endpoints `comments`/`votes` qui manipulent un `proposition_id` (la RLS doit bloquer automatiquement les non-membres).

## 5.4 RLS de `page_members` et `page_invitations`

- `page_members`:
  - owner de la page peut `select/insert/delete`.
  - utilisateur peut `select` sa propre membership.
- `page_invitations`:
  - owner/admin de la page peut `select/insert/update(revoke)`.
  - pas de select global public.

---

## 6) API (contrats prêts à implémenter)

## 6.1 `POST /api/pages/invitations/create`

Crée un lien d'invitation.

Body:
```json
{
  "pageId": "uuid",
  "expiresInHours": 72,
  "maxUses": 20
}
```

Réponse 200:
```json
{
  "ok": true,
  "invitationId": "uuid",
  "inviteUrl": "https://.../fr/invite/page?token=..."
}
```

Contrôles:
- `supabase.auth.getUser()` obligatoire,
- user owner (ou admin) de la page,
- validation `Origin` via `validateMutationOrigin`.

## 6.2 `POST /api/pages/invitations/revoke`

Body:
```json
{ "invitationId": "uuid" }
```

Réponse:
```json
{ "ok": true }
```

## 6.3 `GET /api/pages/invitations/list?pageId=...`

Retourne les invitations actives/passées pour la page (owner/admin only).

## 6.4 `POST /api/pages/invitations/redeem`

Body:
```json
{ "token": "opaque-token" }
```

Réponse 200:
```json
{ "ok": true, "pageId": "uuid", "pageSlug": "slug" }
```

Erreurs:
- `401` non authentifié,
- `404` token invalide/introuvable,
- `410` expiré/révoqué/uses dépassées.

Logique:
- hash token reçu,
- lookup invitation active,
- transaction: increment `used_count`, insert/upsert membership (`viewer`).

## 6.5 `POST /api/pages/visibility/update`

Body:
```json
{ "pageId": "uuid", "visibility": "public" }
```

Owner only, avec garde-fou UX (confirmation forte avant passage en public).

---

## 7) UI/UX — intégration écrans existants

## 7.1 Création page

Fichier cible: `src/app/[locale]/pages/create/create-page-client.tsx`

Ajouter:
- Toggle de visibilité (`Public`/`Privée`) avec microcopy:
  - Public: "Visible dans recherche, mentions et moteurs."
  - Privée: "Visible uniquement sur invitation. Non indexée."

Payload insert `pages` inclut `visibility`.

Post-création privée:
- CTA immédiat "Générer un lien d'invitation".

## 7.2 Page détail

Fichier cible: `src/app/[locale]/pages/[slug]/page.tsx`

Ajouter:
- badge "Privée" visible aux membres,
- bloc "Gestion des accès" pour owner/admin:
  - créer lien,
  - lister/révoquer invitations,
  - lister membres et retirer un accès.

Non autorisé:
- `notFound()` (pas de fuite d'existence).

## 7.3 Écran d'acceptation d'invitation

Nouveau route segment recommandé:
- `src/app/[locale]/invite/page/page.tsx` (lecture token query param)

Flow:
- pas connecté -> auth modal/redirection login puis reprise,
- connecté -> redeem API,
- succès -> redirect vers `/${locale}/pages/${slug}`,
- erreurs explicites (expiré/révoqué/invalide).

## 7.4 Recherche, mentions, omnibar

Fichiers à impacter:
- `src/app/api/pages/search/route.ts`
- `src/app/api/omnibar/search/route.ts`
- `src/hooks/use-page-search.ts`
- Mentions via `proposition-detail-client` (utilise omnibar)

Règle:
- ne retourner que les pages lisibles par l'utilisateur courant (via RLS),
- aucun fallback service role pour ces endpoints.

---

## 8) SEO, discovery et indexation

## 8.1 Sitemap

Fichier: `src/app/sitemap.ts`

Avec service role, RLS est bypassée. Il faut filtrer explicitement:
- `.eq("visibility", "public")` sur `pages`.

## 8.2 Metadata page privée

Fichier: `src/app/[locale]/pages/[slug]/page.tsx`

Dans `generateMetadata`, si page privée:
- `robots: { index: false, follow: false }`.
- optionnel: meta `noarchive`.

## 8.3 Robots global

`src/app/robot.ts` reste global permissif, le contrôle fin est par page metadata + exclusion sitemap.

---

## 9) Plan de migration / rollout

## Phase A — DB safe
1. Ajouter colonnes/tables + indexes.
2. Déployer policies `page_members`/`page_invitations`.
3. Déployer `can_read_page`.

## Phase B — lecture sécurisée
4. Remplacer policy select `pages`.
5. Propager policy select sur `propositions` puis `comments/votes/volunteers`.

## Phase C — app
6. APIs invitations + update visibilité.
7. UI création + gestion accès + redeem page.
8. Search/omnibar/sitemap/metadata.

## Phase D — hardening
9. Rate-limit redeem (IP + user).
10. Monitoring erreurs 401/403/404/410 sur invitations.

---

## 10) Critères d'acceptation

- Une page privée n'apparaît pas dans:
  - listing pages,
  - omnibar,
  - mention autocomplete,
  - explore/discover,
  - sitemap.
- Un non-membre sur URL privée reçoit 404.
- Un membre invité accède à la page et à ses propositions/commentaires.
- Un token révoqué/expiré ne donne jamais accès.
- Les mutations d'invitation et de visibilité exigent session valide + origin check.

---

## 11) Tests requis

## 11.1 Unit / API
- redeem token: success / expired / revoked / max uses / malformed.
- create/revoke invitation: droits owner/admin uniquement.

## 11.2 Intégration sécurité
- lecture page privée en non-auth => 404.
- auth non-membre => 404.
- auth membre => 200.
- endpoints comments/votes bloqués pour non-membres sur proposition liée à page privée.

## 11.3 Non-régression fonctionnelle
- pages publiques inchangées.
- search/omnibar continuent à répondre pour public.

## 11.4 Résilience (conforme repo)
- ajouter un test `*.chaos.test.ts` sur redeem concurrent (`used_count`, `max_uses`).
- ajouter test `*.stress.test.ts` sur charge de recherche filtrée.

---

## 12) Impacts fichiers (checklist implémentation)

- Migrations SQL:
  - `supabase/migrations/00xx_private_pages_visibility.sql`
  - `supabase/migrations/00xy_private_pages_memberships_invites.sql`
  - `supabase/migrations/00xz_private_pages_rls_propagation.sql`

- API:
  - `src/app/api/pages/invitations/create/route.ts`
  - `src/app/api/pages/invitations/list/route.ts`
  - `src/app/api/pages/invitations/revoke/route.ts`
  - `src/app/api/pages/invitations/redeem/route.ts`
  - `src/app/api/pages/visibility/update/route.ts`

- UI:
  - `src/app/[locale]/pages/create/create-page-client.tsx`
  - `src/app/[locale]/pages/[slug]/page.tsx`
  - `src/app/[locale]/invite/page/page.tsx` (nouveau)
  - messages i18n `messages/fr.json` et `messages/en.json`

- Discovery/SEO:
  - `src/app/api/pages/search/route.ts`
  - `src/app/api/omnibar/search/route.ts`
  - `src/app/sitemap.ts`

---

## 13) Risques & mitigations

- Risque: fuite via endpoint secondaire non filtré.
  - Mitigation: politique RLS d'abord, puis audit de tous les `.from("pages")` et joins.

- Risque: service role bypass dans sitemap.
  - Mitigation: filtre explicite `visibility='public'`.

- Risque: bruteforce token.
  - Mitigation: token long aléatoire + hash + rate limiting + TTL.

- Risque: race condition redeem.
  - Mitigation: transaction SQL atomique (`used_count` + insert membership).

