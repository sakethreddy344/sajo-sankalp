# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

The account profile menu lets you view the profile photo larger or replace it. A selected photo is resized and stored in this browser only.

## AI assistant

The AI analysis button opens a chat with current-month money analysis, trip-spending analysis, and open-ended questions about the signed-in workspace. The assistant sends only the relevant text and financial fields to Groq when a request is made. It never sends important documents, files, attachments, images, or storage links. Review AI-generated answers before relying on them.

Chat conversations are saved to the private, user-scoped `ai_chat_conversations` table and appear under Recent chats, including after starting a new chat. Run [`supabase/migrations/20261105000000_ai_chat_history.sql`](./supabase/migrations/20261105000000_ai_chat_history.sql) and [`supabase/migrations/20261105000001_ai_chat_history_delete.sql`](./supabase/migrations/20261105000001_ai_chat_history_delete.sql) in the Supabase SQL Editor before deploying the frontend changes. Chats can be renamed or permanently deleted from Recent chats.

The Groq API key is used only by the authenticated Supabase Edge Function; never add it to a `VITE_` variable. Copy the `GROQ_API_KEY` and optional `GROQ_MODEL` entries from [`.env.example`](./.env.example) into your ignored local `.env` file. For local Supabase development, serve the function with `supabase functions serve ai-assistant --env-file .env`. The function requires a signed-in Supabase user.

Deploy the function with `supabase functions deploy ai-assistant`, then set `GROQ_API_KEY` in Supabase project secrets (for example, `supabase secrets set GROQ_API_KEY=your-key`). Set `GROQ_MODEL` in Supabase Function secrets as well to select an available Groq chat model. The default is `openai/gpt-oss-120b`; `llama-3.3-70b-versatile` was retired on August 16, 2026.

Assistant system prompts are maintained in [`supabase/functions/_shared/ai-prompts.ts`](./supabase/functions/_shared/ai-prompts.ts). Edit that file to adjust money analysis, trip analysis, or general chat behavior, then redeploy the function for the change to take effect.

## Business exploration notes

Business exploration notes are saved per idea in the `business_exploration_notes` Supabase table. Attached images are stored in the private `business-exploration-images` Storage bucket; the table keeps their paths. Row-level security policies restrict notes and images to their signed-in owner.

Before using this feature, run [`supabase/migrations/20261028000000_business_exploration_notes.sql`](./supabase/migrations/20261028000000_business_exploration_notes.sql) in the Supabase SQL Editor. The app allows JPEG, PNG, WebP, and GIF images up to 5 MB each, with up to 8 images per idea.

Personal & life goal notes are saved in the separate `personal_life_notes` table and use the same private image bucket. After setting up business exploration notes, run [`supabase/migrations/20261028000001_personal_life_notes.sql`](./supabase/migrations/20261028000001_personal_life_notes.sql) in the Supabase SQL Editor.

Trips are saved in the private `trips` table with free-text trip dates, short notes, and media paths. Photos and videos are stored in the private `trip-memories` bucket (10 MB per photo, 50 MB per video). Run [`supabase/migrations/20261028000002_trips.sql`](./supabase/migrations/20261028000002_trips.sql) in the Supabase SQL Editor to set up the table, storage policies, and Realtime publication. If that migration was already applied, also run [`supabase/migrations/20261028000003_trip_date.sql`](./supabase/migrations/20261028000003_trip_date.sql) to add the trip date column.

The Trips section includes a places wishlist stored in the existing `trips` table; no new table is created. Wishlist places support notes and a completion checkbox, with completed places highlighted separately. Run [`supabase/migrations/20261031000001_trip_place_wishlist.sql`](./supabase/migrations/20261031000001_trip_place_wishlist.sql) after the trips migration to add the wishlist flags.

Trips also includes one saved packing checklist and a password-gated Important documents area; both reuse the existing `trips` table, with attachments in the private `important-documents` Storage bucket. Run [`supabase/migrations/20261031000002_trip_checklist_documents.sql`](./supabase/migrations/20261031000002_trip_checklist_documents.sql) after the wishlist migration. Documents support PDF, common image, text/CSV, Word, and Excel files up to 25 MB. The password prompt verifies the signed-in account's current password and is an additional UI check, not file encryption; private Storage policies continue to enforce account ownership.

Trip Money Analysis appears below Chit fund in Money. It reuses the existing `trips` table to save separate trip records, multiple expenses per trip, and booking details with notes and named attachments; these entries never affect the main income or spending records. Run [`supabase/migrations/20261103000000_trip_money_analysis.sql`](./supabase/migrations/20261103000000_trip_money_analysis.sql) after the trips migration and [`supabase/migrations/20261103000001_trip_booking_details.sql`](./supabase/migrations/20261103000001_trip_booking_details.sql) in the Supabase SQL Editor. Attachments reuse the private `important-documents` Storage bucket created by [`supabase/migrations/20261031000002_trip_checklist_documents.sql`](./supabase/migrations/20261031000002_trip_checklist_documents.sql) and support its allowed file types up to 25 MB.

Available credit card names are stored separately from cards used for payment tracking. Run [`supabase/migrations/20261028000004_available_credit_cards.sql`](./supabase/migrations/20261028000004_available_credit_cards.sql) in the Supabase SQL Editor to set up the private, user-scoped list.

EMI completion status is stored on the existing `emis` table; no new table is required. Run [`supabase/migrations/20261029000000_emi_completion.sql`](./supabase/migrations/20261029000000_emi_completion.sql) in the Supabase SQL Editor to enable marking EMIs as completed.

EMI records include a start date and due day; an end date is stored on the same table. Run [`supabase/migrations/20261029000002_emi_end_date.sql`](./supabase/migrations/20261029000002_emi_end_date.sql) in the Supabase SQL Editor to add the end-date column.

EMI payments logged from the commitments panel are tracked separately on the existing `emis` table and also added to the spending ledger. Run [`supabase/migrations/20261029000006_emi_payment_tracker.sql`](./supabase/migrations/20261029000006_emi_payment_tracker.sql) in the Supabase SQL Editor. It preserves existing EMI payments by backfilling the independent tracker from linked EMI ledger entries; later changes to monthly ledger entries do not affect EMI paid and remaining totals.

Subscriptions are stored per user with an amount, start date, and end date. Run [`supabase/migrations/20261029000001_subscriptions.sql`](./supabase/migrations/20261029000001_subscriptions.sql) in the Supabase SQL Editor to enable the subscriptions section.

Holdings are stored per user with a monthly or daily SIP and current value. Run [`supabase/migrations/20261029000003_holdings.sql`](./supabase/migrations/20261029000003_holdings.sql) and [`supabase/migrations/20261029000004_holdings_sip_frequency.sql`](./supabase/migrations/20261029000004_holdings_sip_frequency.sql) in the Supabase SQL Editor to enable the holdings section. The Monthly SIP summary totals each monthly amount and calculates daily SIPs at 30 days. Monthly SIP payments are entered separately for each selected month; daily SIP completion calculates the daily amount times the number of days in the selected month. Both are saved as spending entries in the existing money ledger.

Chit funds reuse the existing `cards` table; no new table is created. Run [`supabase/migrations/20261029000005_chit_funds.sql`](./supabase/migrations/20261029000005_chit_funds.sql) in the Supabase SQL Editor to add chit fund details and paid-month records. Chit fund months expand and collapse individually. Marking a month paid adds its monthly amount as spending in the existing money ledger and stores the resulting ledger entry ID with that month's record; marking it unpaid removes that linked spending entry. An optional transaction ID is saved with each paid month.

The Money section's Dashboard button opens month-specific budget, cash-flow, spending-by-payment-source, and payment-reminder insights. Choose a month in the month overview to update the dashboard. Monthly budgets are saved in the current browser; the other insights use existing Supabase finance records.

Gifts & occasions and Recipe ideas are available as shortcuts in Personal & life. Gifts & occasions stores people, dates, gift ideas, and celebration plans; annual occasions appear on their next date, and occasions due tomorrow appear in notifications. Recipe ideas stores ingredients, methods, and notes for recipes to try or make again; it is not a meal planner. Run [`supabase/migrations/20261031000000_gifts_and_recipes.sql`](./supabase/migrations/20261031000000_gifts_and_recipes.sql) in the Supabase SQL Editor to set up both private, user-scoped collections.

Career & skills topics, nested subtopics, and notes are stored in the private `career_skill_topics` table. Run [`supabase/migrations/20261028000005_career_skill_topics.sql`](./supabase/migrations/20261028000005_career_skill_topics.sql) in the Supabase SQL Editor to enable the learning workspace.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
