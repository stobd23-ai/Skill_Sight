
create table public.interview_invitations (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid references interviews(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  invited_by_manager text not null,
  target_role_id uuid references roles(id),
  status text default 'pending',
  message text,
  preset_pack text,
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  expires_at timestamptz default (now() + interval '7 days')
);

alter table public.interview_invitations enable row level security;

create policy "Allow all access" on public.interview_invitations for all using (true) with check (true);
