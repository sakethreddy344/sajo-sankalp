create table if not exists public.ai_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('chat', 'money', 'trips')),
  messages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_chat_conversations_user_updated_idx
  on public.ai_chat_conversations (user_id, updated_at desc);

alter table public.ai_chat_conversations enable row level security;

create policy "Users can read their own AI chat conversations"
  on public.ai_chat_conversations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own AI chat conversations"
  on public.ai_chat_conversations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own AI chat conversations"
  on public.ai_chat_conversations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update
  on public.ai_chat_conversations
  to authenticated;
