# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Business exploration notes

Business exploration notes are saved per idea in the `business_exploration_notes` Supabase table. Attached images are stored in the private `business-exploration-images` Storage bucket; the table keeps their paths. Row-level security policies restrict notes and images to their signed-in owner.

Before using this feature, run [`supabase/migrations/20261028000000_business_exploration_notes.sql`](./supabase/migrations/20261028000000_business_exploration_notes.sql) in the Supabase SQL Editor. The app allows JPEG, PNG, WebP, and GIF images up to 5 MB each, with up to 8 images per idea.

Personal & life goal notes are saved in the separate `personal_life_notes` table and use the same private image bucket. After setting up business exploration notes, run [`supabase/migrations/20261028000001_personal_life_notes.sql`](./supabase/migrations/20261028000001_personal_life_notes.sql) in the Supabase SQL Editor.

Trips are saved in the private `trips` table with free-text trip dates, short notes, and media paths. Photos and videos are stored in the private `trip-memories` bucket (10 MB per photo, 50 MB per video). Run [`supabase/migrations/20261028000002_trips.sql`](./supabase/migrations/20261028000002_trips.sql) in the Supabase SQL Editor to set up the table, storage policies, and Realtime publication. If that migration was already applied, also run [`supabase/migrations/20261028000003_trip_date.sql`](./supabase/migrations/20261028000003_trip_date.sql) to add the trip date column.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
