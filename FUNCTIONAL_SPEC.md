# Spécification Fonctionnelle — Plateforme de Feedback Collaboratif

## Website purpose

"Comme vous, j'utilise chaque jour des dizaines de services et d'applications. Et comme vous, je me suis souvent dit : 'Si seulement ils changeaient ce petit détail, ce serait parfait !'."

Mais souvent, nos feedbacks finissent aux oubliettes. C'est pour cette raison que FOROM existe : le premier moteur de co-construction qui transforme les idées en actions concrètes.

### Pourquoi cette aventure ?

💡 **Pour les utilisateurs**
- Donner un vrai pouvoir d'action.
- Sur FOROM, une idée ne s'arrête pas à la suggestion : elle est portée, votée par la communauté, puis suivie jusqu'au statut "DONE".

💎 **Pour les entreprises**
- Les clients sont les meilleurs experts des produits.
- FOROM apporte une mine de retours concrets pour prioriser ce que les gens veulent vraiment, tout en prouvant une vraie écoute.

🌍 **Pour les entrepreneurs**
- Créer un radar à opportunités pour détecter des problèmes réels encore sans solution satisfaisante.

### Ambition

Réduire la distance entre ceux qui utilisent et ceux qui fabriquent.  
Passer de "J'aimerais que..." à "C'est fait !".

## 1. Objectifs et portée
### Objectifs
- Centraliser les propositions d’amélioration, idées et signalements.
- Permettre la découverte de propositions existantes avant création.
- Faciliter la gestion et le suivi des propositions par les propriétaires de pages.
- Encourager la participation via votes, commentaires, solutions et volontariat.

### Hors périmètre (v1)
- Modération avancée (anti-spam, contenu interdit).
- Facturation / abonnements.
- Export analytique avancé.

## 2. Rôles et permissions
### Rôles
- **Visiteur** (non authentifié)
- **Utilisateur authentifié**
- **Propriétaire de Page** (owner_id)

### Capacités par rôle
**Visiteur**
- Lire pages, propositions, commentaires.
- Rechercher via omnibar.

**Utilisateur authentifié**
- Ajouter une proposition.
- Voter (1 vote par proposition).
- Commenter.
- Se déclarer volontaire (orphelines).
- Créer une page (devient owner).

**Propriétaire de Page**
- Changer le statut des propositions liées à sa page.
- Mettre en avant les nouveautés (Done).
- Répondre officiellement (v2).

## 3. Modèle de données (résumé fonctionnel)
### Users
- id, email, username, avatar_url, level, created_at
### Pages
- id, owner_id, name, description, category
- certification_type (NONE | OFFICIAL), is_verified
- reactivity_score, website_url, created_at
### Propositions
- id, author_id, page_id (nullable)
- title, description, status
- labels_location, labels_category, completion_proof
- votes_count, created_at
### Votes
- user_id, proposition_id, type (Upvote | Downvote)
### Volunteers
- user_id, proposition_id, skills_offered, status (Pending | Accepted)
### Comments
- id, proposition_id, user_id, content, is_solution, created_at

## 4. Parcours utilisateurs
### 4.1 Omnibar (Recherche unifiée)
1. L’utilisateur saisit une idée.
2. Le système cherche des propositions similaires.
3. Scénarios:
   - Si existante: clic => page proposition.
   - Sinon: option de création avec titre pré-rempli.

### 4.2 Création d’une proposition
1. Arrivée sur le formulaire avec titre pré-rempli.
2. Saisie description (éditeur riche).
3. Choix d’une page existante ou proposition orpheline.
4. Soumission, redirection vers détail.

### 4.3 Cycle de vie d’une proposition
- Statuts: Open, In Progress, Done, Won’t Do.
- Si proposition liée à une page, owner peut modifier le statut.

### 4.4 Volontariat (orphelines)
- Un utilisateur peut proposer ses compétences.
- Les volontaires sont listés sur la proposition.

### 4.5 Solutions
- Les commentaires peuvent être marqués “solution” par l’auteur.
- Une seule solution active à la fois.

### 4.6 Profil utilisateur
Affiche:
- Niveau (basé sur nb de propositions Done).
- Historique des propositions créées.
- Pages possédées.

### 4.7 Page produit/service
Affiche:
- Infos page (nom, description, badges).
- Propositions associées.
- Changelog “Nouveautés” (Done).

## 5. Écrans et composants
### 5.1 Accueil
- Omnibar centrée
- CTA vers Explorer

### 5.2 Explorer
- Table des propositions
- Tri multi-colonnes
- Filtre multi-statuts

### 5.3 Page proposition
- Description riche
- Votes + statut
- Volontaires (si orpheline)
- Commentaires + solutions

### 5.4 Page produit/service
- Badge certification
- Propositions liées
- Nouveautés Done

### 5.5 Profil
- Résumé niveau
- Historique propositions
- Pages possédées

### 5.6 Création de page
- Formulaire nom + description + catégorie
- Message suggérant certification

## 6. Règles métier
- Un utilisateur ne vote qu’une fois par proposition.
- Owner = créateur de la page.
- Certification: par défaut NONE, badge affiché si OFFICIAL.
- Propositions orphelines = page_id null.
- Solutions: seul auteur peut valider.

## 7. Messages et états
### États de chargement / erreurs
- Recherche omnibar: “Recherche en cours…”
- Commentaires: “Chargement…”
- Pas de résultats: “Aucune proposition…”

### Feedbacks
- Création page: message “Demander une certification”.
- Erreurs Supabase affichées côté UI.

## 8. Non-fonctionnel
- Accessibilité: focus visible, labels.
- Performance: pagination / limit (max 10-20 résultats).
- Sécurité: RLS Supabase appliqué sur updates sensibles.

## 9. Extensions futures
- Modération
- Notifications (email / in-app)
- Analytics page/feedback
- Workflow certification