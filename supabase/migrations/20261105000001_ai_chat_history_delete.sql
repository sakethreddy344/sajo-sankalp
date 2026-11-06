do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_chat_conversations'
      and policyname = 'Users can delete their own AI chat conversations'
  ) then
    create policy "Users can delete their own AI chat conversations"
      on public.ai_chat_conversations
      for delete
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$$;

grant delete
  on public.ai_chat_conversations
  to authenticated;
