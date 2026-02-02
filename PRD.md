Product Requirement Document (PRD) : Plateforme de Feedback Collaboratif

1. Vue d'ensemble
L'application est une plateforme permettant aux utilisateurs de soumettre des propositions d'amélioration, de nouvelles idées ou des signalements. Ces propositions peuvent être liées à des "Pages" (produits/services existants gérés par un propriétaire) ou être indépendantes (pour inspiration ou résolution communautaire).

2. Architecture Technique (Stack Suggérée pour Cursor)
Frontend : Next.js 14 (App Router), React, Tailwind CSS, Shadcn UI (pour des composants rapides et propres).

Backend/Database : Supabase (PostgreSQL, Auth, Realtime) ou Firebase. Supabase est recommandé pour les relations relationnelles complexes décrites dans le schéma.

Authentification : Email/Mot de passe, OAuth (Google/Github).

3. Modèle de Données (Data Schema)
Basé sur les captures d'écran 2 et 3.

A. Users (Utilisateurs)
id: UUID

email: String

username: String

avatar_url: String

level: Integer (Calculé selon le nombre de propositions passées en statut "Fait")

created_at: Timestamp

B. Pages (Produits/Services)
id: UUID

owner_id: UUID (FK -> Users)

name: String

description: Text

is_verified: Boolean (Badge certification)

reactivity_score: Float (Calculé)

website_url: String

C. Propositions (Idées/Tickets)
id: UUID

author_id: UUID (FK -> Users)

page_id: UUID (Nullable - Si vide, c'est une proposition "orpheline")

title: String

description: Text

status: Enum ('Open', 'Done', 'Won't Do', 'In Progress')

created_at: Timestamp

labels_location: String (facultatif)

labels_category: String (facultatif)

completion_proof: Text (Comment déterminer si c'est fait ?)

D. Votes
user_id: UUID

proposition_id: UUID

type: Enum ('Upvote', 'Downvote')

E. Volunteers (Volontaires)
user_id: UUID

proposition_id: UUID

skills_offered: String (Compétence à apporter)

status: Enum ('Pending', 'Accepted')

F. Comments / Solutions
id: UUID

proposition_id: UUID

user_id: UUID

content: Text

is_solution: Boolean (Si la proposition n'est pas liée à une page, la communauté peut proposer une solution)

4. Flux Utilisateurs (User Flows)
Basé sur la capture d'écran 1.

Flow A : Recherche Unifiée & Création (The "Omnibar")
L'interface : La page d'accueil est minimaliste, centrée sur une grande barre de saisie (Input).

L'action : L'utilisateur commence à taper son idée (ex: "Mode sombre pour l'application mobile").

Réaction en temps réel (Autocomplete) :

À chaque frappe (avec un léger délai "debounce"), le système cherche dans la base de données des propositions similaires.

Un menu déroulant apparaît sous la barre.

Les Scénarios du menu déroulant :

Scénario 1 (Ça existe) : L'utilisateur voit son idée dans la liste. Il clique dessus -> Redirection vers la page de la proposition existante (pour voter).

Scénario 2 (Ça n'existe pas) : L'utilisateur ne voit pas de correspondance. La dernière option du menu est toujours : "✨ Créer la proposition : [Texte saisi]".

Création : Au clic sur "Créer", l'utilisateur est redirigé vers le formulaire de détails. Le titre est déjà pré-rempli avec ce qu'il vient de taper. Il n'a plus qu'à choisir la "Page" (le produit concerné) ou la laisser orpheline.

Flow B : Cycle de vie d'une proposition
Liée à une Page : Le propriétaire (Owner) change le statut :

-> "Fait" (Done).

-> "Ne veux pas le faire" (Won't do).

Non liée à une Page :

Un utilisateur peut se déclarer "Volontaire" (input compétences) -> Email à l'auteur.

Un utilisateur poste une "Solution" -> L'auteur valide (Oui/Non).

Flow C : Recherche et Exploration
Inspiration : Explorer les propositions orphelines.

Amélioration : Chercher une "Page" spécifique pour y déposer une idée.

Volontariat : Chercher des propositions nécessitant des compétences spécifiques.

Ranking : Voir les propositions les plus votées (Global ou par Page).

5. Fonctionnalités Clés (Features)
Page Profil & Gamification :

Affichage du niveau de l'utilisateur.

Historique des propositions soumises.

Liste des pages dont il est propriétaire (avec possibilité de "Revendiquer" une page).

Page "Page" (Détail d'un produit) :

Header avec Badge et Score de réactivité.

Onglet "Nouveautés" (Changelog basé sur les propositions passées en "Fait").

Liste des propositions triables (Votes, Récents).

Système de Vote :

Un utilisateur ne peut voter qu'une fois par proposition.