create table plans (
  user_id int primary key references users(id) on delete cascade,
  cal numeric,
  protein numeric,
  fat numeric,
  carb numeric,
  steps numeric,
  training numeric,
  updated_at timestamptz not null default now()
);

create table reports (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED')),
  data jsonb not null,
  plan_snapshot jsonb,
  submitted_at timestamptz,
  seen_by_coach_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
