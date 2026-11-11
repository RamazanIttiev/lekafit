create table users (
  id serial primary key,
  telegram_id bigint not null unique,
  first_name text not null,
  last_name text,
  username text,
  role text not null check (role in ('CLIENT', 'COACH')),
  created_at timestamptz not null default now()
);
