-- Create user_reading_position table for cross-device reading sync
create table if not exists public.user_reading_position (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state    jsonb        not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_reading_position enable row level security;

-- Users can only read and write their own reading position
create policy "Users can manage their own reading position"
  on public.user_reading_position
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
