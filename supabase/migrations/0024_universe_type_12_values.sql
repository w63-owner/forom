-- Migration: étendre universe_type de 4 à 12 univers
-- Note: la table s'appelle "propositions" (pas "proposals")

-- 1. Créer le nouveau type avec les 12 univers
CREATE TYPE universe_type_new AS ENUM (
  'MOBILITY_TRAVEL',
  'PUBLIC_SERVICES',
  'TECH_PRODUCTS',
  'CONSUMPTION',
  'LOCAL_LIFE',
  'ENERGY_UTILITIES',
  'MEDIA_CULTURE',
  'HOUSING_REAL_ESTATE',
  'PROFESSIONAL_LIFE',
  'LUXE_LIFESTYLE',
  'FINANCE_INVESTMENT',
  'INNOVATION_LAB'
);

-- 2. Migrer la colonne vers le nouveau type (conserve les données existantes)
-- Les 4 valeurs actuelles (PUBLIC_SERVICES, TECH_PRODUCTS, CONSUMPTION, LOCAL_LIFE) sont dans le nouveau type
ALTER TABLE public.propositions
ALTER COLUMN universe TYPE universe_type_new
USING universe::text::universe_type_new;

-- 3. Supprimer l'ancien type
DROP TYPE universe_type;

-- 4. Renommer le nouveau type
ALTER TYPE universe_type_new RENAME TO universe_type;

-- 5. Mettre à jour le commentaire
COMMENT ON COLUMN public.propositions.universe IS 'Universe for Discover: 12 univers (MOBILITY_TRAVEL, PUBLIC_SERVICES, TECH_PRODUCTS, etc.)';