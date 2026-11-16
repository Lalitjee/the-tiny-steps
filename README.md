# The Tiny Steps

A small family PWA for motivating kids with reward points. Parents add or deduct points and tick off daily, weekly or monthly habits. A shared "kid" login can view everything but change nothing.

**Stack:** React 19 + TypeScript + Vite, TanStack Router and Query, Tailwind v4 + shadcn/ui, Supabase (auth, Postgres, Row Level Security), Vercel. Installable as a PWA (`vite-plugin-pwa`).

## Setup
1. **Database:** run `supabase/migrations/001_rw_schema.sql` once in the Supabase SQL Editor. It only creates `rw_`-prefixed objects and shares the project with the Cashbook app.
2. **Env:** copy `.env.example` to `.env` and fill in the same Supabase URL and anon key Cashbook uses. In Vercel, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project settings.
3. **Run:** `npm install`, then `npm run dev`. Build with `npm run build`.
4. **Deploy:** import this repo in Vercel. Every push to `main` redeploys. `vercel.json` rewrites client-side routes to `index.html`.

## Roles
- **parent:** read everything in the family; add, edit and delete kids, habits and manual points; review habits and undo.
- **kid:** read only, sees all kids in the family.

The full spec lives in the "Child Rewarding App" Claude project.
