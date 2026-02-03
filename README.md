This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`.

### Supabase Storage (images des propositions)

L’app peut **créer le bucket automatiquement** au premier upload si la clé service role est configurée :

- Dans `.env.local`, ajoutez :  
  `SUPABASE_SERVICE_ROLE_KEY=votre_clé_service_role`  
  (récupérable dans Supabase : **Project Settings** → **API** → **service_role**)

Sans cette clé, créez le bucket à la main dans le tableau de bord Supabase :

1. **Storage** → **New bucket**
2. Nom : `proposition-images`
3. **Public bucket** : activé
4. Optionnel : limite 5 MB, types MIME `image/*`

Les politiques RLS sont définies dans la migration `0011_proposition_images.sql`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
