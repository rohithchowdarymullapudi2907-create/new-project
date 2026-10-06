-- FreshTrack schema for Supabase PostgreSQL.
-- Run this file in the Supabase SQL Editor or with the Supabase CLI.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  avatar_url text,
  household_name text,
  notification_enabled boolean not null default true,
  reminder_days_before integer not null default 3
    check (reminder_days_before in (1, 2, 3, 5, 7)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  category text not null default 'Other'
    check (category in (
      'Dairy', 'Fruits', 'Vegetables', 'Meat', 'Seafood', 'Grains',
      'Bakery', 'Snacks', 'Beverages', 'Frozen', 'Canned', 'Condiments', 'Other'
    )),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit text not null default 'pieces'
    check (unit in ('kg', 'g', 'L', 'ml', 'pieces', 'packets', 'boxes', 'bottles', 'cans')),
  purchase_date date,
  expiry_date date not null,
  storage_location text not null default 'Refrigerator'
    check (storage_location in ('Refrigerator', 'Freezer', 'Pantry', 'Kitchen Counter', 'Other')),
  brand text,
  notes text,
  image_url text,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_expiry_not_before_purchase
    check (purchase_date is null or expiry_date >= purchase_date),
  constraint food_item_id_user_id_unique unique (id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  food_item_id uuid references public.food_items (id) on delete set null,
  type text not null default 'system'
    check (type in ('expiring_soon', 'expired', 'system')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  expiry_date date,
  dedupe_key text,
  created_at timestamptz not null default now(),
  constraint notifications_user_dedupe_unique unique (user_id, dedupe_key)
);

create table if not exists public.consumption_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  food_item_id uuid references public.food_items (id) on delete set null,
  food_name text not null,
  quantity_used numeric(12, 3) not null check (quantity_used > 0),
  consumed_at timestamptz not null default now(),
  notes text
);

create index if not exists food_items_user_id_idx
  on public.food_items (user_id);
create index if not exists food_items_user_expiry_idx
  on public.food_items (user_id, expiry_date)
  where consumed_at is null;
create index if not exists food_items_user_category_idx
  on public.food_items (user_id, category);
create index if not exists food_items_user_location_idx
  on public.food_items (user_id, storage_location);
create index if not exists food_items_user_created_idx
  on public.food_items (user_id, created_at desc);
create index if not exists notifications_user_id_idx
  on public.notifications (user_id);
create index if not exists notifications_user_read_idx
  on public.notifications (user_id, is_read);
create index if not exists consumption_logs_user_id_idx
  on public.consumption_logs (user_id);
create index if not exists consumption_logs_user_consumed_idx
  on public.consumption_logs (user_id, consumed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists food_items_set_updated_at on public.food_items;
create trigger food_items_set_updated_at
before update on public.food_items
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

-- Seed a realistic pantry for an authenticated user's demo. This is opt-in,
-- scoped to auth.uid(), and only runs when that user's active inventory is empty.
create or replace function public.seed_demo_food_items()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  if exists (
    select 1 from public.food_items
     where user_id = auth.uid() and consumed_at is null
  ) then
    return 0;
  end if;

  insert into public.food_items (
    user_id, name, category, quantity, unit, purchase_date, expiry_date,
    storage_location, brand, notes
  ) values
    (auth.uid(), 'Milk', 'Dairy', 1, 'L', current_date - 5, current_date - 1, 'Refrigerator', 'Farmhouse', 'Demo item: check before use.'),
    (auth.uid(), 'Eggs', 'Dairy', 6, 'pieces', current_date - 4, current_date, 'Refrigerator', null, null),
    (auth.uid(), 'Spinach', 'Vegetables', 1, 'packets', current_date - 2, current_date + 1, 'Refrigerator', null, 'Use in a curry or omelette.'),
    (auth.uid(), 'Yogurt', 'Dairy', 2, 'boxes', current_date - 3, current_date + 2, 'Refrigerator', 'Daily', null),
    (auth.uid(), 'Tomatoes', 'Vegetables', 5, 'pieces', current_date - 2, current_date + 3, 'Kitchen Counter', null, null),
    (auth.uid(), 'Bread', 'Bakery', 1, 'boxes', current_date - 1, current_date + 4, 'Pantry', 'Daily Bake', null),
    (auth.uid(), 'Chicken breast', 'Meat', 500, 'g', current_date, current_date + 7, 'Freezer', null, 'Defrost safely before cooking.'),
    (auth.uid(), 'Apples', 'Fruits', 4, 'pieces', current_date - 1, current_date + 10, 'Refrigerator', null, null),
    (auth.uid(), 'Cheddar cheese', 'Dairy', 250, 'g', current_date - 7, current_date + 14, 'Refrigerator', null, null),
    (auth.uid(), 'Orange juice', 'Beverages', 1, 'L', current_date - 2, current_date + 20, 'Refrigerator', null, null),
    (auth.uid(), 'Rice', 'Grains', 1, 'kg', current_date - 30, current_date + 180, 'Pantry', null, null),
    (auth.uid(), 'Frozen peas', 'Frozen', 1, 'packets', current_date - 14, current_date + 90, 'Freezer', null, null);

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.seed_demo_food_items() from public;
grant execute on function public.seed_demo_food_items() to authenticated;

-- Consume a quantity and write its history as one database transaction.
-- Full consumption archives the item via consumed_at instead of deleting it.
create or replace function public.consume_food_item(
  p_food_item_id uuid,
  p_quantity_used numeric,
  p_notes text default null
)
returns public.food_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.food_items;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
    into v_item
    from public.food_items
   where id = p_food_item_id
     and user_id = auth.uid()
     and consumed_at is null
   for update;

  if not found then
    raise exception 'Food item not found' using errcode = 'P0002';
  end if;

  if p_quantity_used is null or p_quantity_used <= 0 or p_quantity_used > v_item.quantity then
    raise exception 'Quantity used must be greater than zero and no more than the available quantity'
      using errcode = '22023';
  end if;

  insert into public.consumption_logs (
    user_id, food_item_id, food_name, quantity_used, notes
  ) values (
    auth.uid(), v_item.id, v_item.name, p_quantity_used, p_notes
  );

  if p_quantity_used = v_item.quantity then
    update public.food_items
       set consumed_at = now()
     where id = v_item.id
     returning * into v_item;
  else
    update public.food_items
       set quantity = quantity - p_quantity_used
     where id = v_item.id
     returning * into v_item;
  end if;

  return v_item;
end;
$$;

revoke all on function public.consume_food_item(uuid, numeric, text) from public;
grant execute on function public.consume_food_item(uuid, numeric, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.food_items enable row level security;
alter table public.notifications enable row level security;
alter table public.consumption_logs enable row level security;

drop policy if exists "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Profiles are insertable by their owner" on public.profiles;
create policy "Profiles are insertable by their owner"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Profiles are updatable by their owner" on public.profiles;
create policy "Profiles are updatable by their owner"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Food items are readable by their owner" on public.food_items;
create policy "Food items are readable by their owner"
  on public.food_items for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Food items are insertable by their owner" on public.food_items;
create policy "Food items are insertable by their owner"
  on public.food_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Food items are updatable by their owner" on public.food_items;
create policy "Food items are updatable by their owner"
  on public.food_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Food items are deletable by their owner" on public.food_items;
create policy "Food items are deletable by their owner"
  on public.food_items for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Notifications are readable by their owner" on public.notifications;
create policy "Notifications are readable by their owner"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Notifications are insertable by their owner" on public.notifications;
create policy "Notifications are insertable by their owner"
  on public.notifications for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      food_item_id is null
      or exists (
        select 1 from public.food_items fi
         where fi.id = food_item_id and fi.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Notifications are updatable by their owner" on public.notifications;
create policy "Notifications are updatable by their owner"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      food_item_id is null
      or exists (
        select 1 from public.food_items fi
         where fi.id = food_item_id and fi.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Notifications are deletable by their owner" on public.notifications;
create policy "Notifications are deletable by their owner"
  on public.notifications for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Consumption logs are readable by their owner" on public.consumption_logs;
create policy "Consumption logs are readable by their owner"
  on public.consumption_logs for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Consumption logs are insertable by their owner" on public.consumption_logs;
create policy "Consumption logs are insertable by their owner"
  on public.consumption_logs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      food_item_id is null
      or exists (
        select 1 from public.food_items fi
         where fi.id = food_item_id and fi.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Consumption logs are updatable by their owner" on public.consumption_logs;
create policy "Consumption logs are updatable by their owner"
  on public.consumption_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      food_item_id is null
      or exists (
        select 1 from public.food_items fi
         where fi.id = food_item_id and fi.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Consumption logs are deletable by their owner" on public.consumption_logs;
create policy "Consumption logs are deletable by their owner"
  on public.consumption_logs for delete to authenticated
  using ((select auth.uid()) = user_id);
