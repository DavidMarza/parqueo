-- =====================================================================
-- SISTEMA DE PARQUEO — SQL COMPLETO (ejecutar UNA sola vez)
-- Supabase → SQL Editor → pegar todo y ejecutar (RUN)
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONES
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. PROFILES (usuarios internos: admin / staff)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  full_name   text not null default 'S/N',
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Función helper: evita recursión de RLS al comprobar si el usuario actual es admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

-- ---------------------------------------------------------------------
-- 2. PERMISOS
-- ---------------------------------------------------------------------
create table if not exists public.permissions (
  code        text primary key,
  description text not null,
  category    text not null default 'general'
);

create table if not exists public.profile_permissions (
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  granted_at      timestamptz not null default now(),
  granted_by      uuid references public.profiles(id),
  primary key (profile_id, permission_code)
);

insert into public.permissions (code, description, category) values
  ('dashboard.view',            'Ver panel principal',                 'general'),
  ('parking.entry',             'Registrar ingreso',                   'parqueo'),
  ('parking.exit',              'Registrar salida',                    'parqueo'),
  ('parking.edit',              'Modificar registros',                 'parqueo'),
  ('parking.ticket',            'Reimprimir ticket',                   'parqueo'),
  ('parking.amount_override',   'Modificar monto cobrado',             'parqueo'),
  ('reports.view',              'Ver reportes',                        'reportes'),
  ('reports.export',            'Exportar reportes a Excel',           'reportes'),
  ('reports.peak_hours',        'Ver reporte de horas pico',           'reportes'),
  ('reports.recurrent',         'Ver reporte de vehículos recurrentes','reportes'),
  ('vehicle_types.manage',      'Configurar tipos de vehículo',        'configuracion'),
  ('time_ranges.manage',        'Configurar rangos de tiempo',         'configuracion'),
  ('rates.manage',              'Configurar tarifas',                  'configuracion'),
  ('users.manage',              'Crear/administrar usuarios',          'configuracion'),
  ('permissions.manage',        'Administrar permisos',                'configuracion')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 3. TRIGGER: nuevo usuario en auth.users -> fila en profiles
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', 'S/N'),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. VEHICLE TYPES
-- ---------------------------------------------------------------------
create table if not exists public.vehicle_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.vehicle_types (name, description) values
  ('Auto', 'Vehículo liviano estándar'),
  ('Grande', 'Vehículo de mayor tamaño (camioneta, SUV, etc.)'),
  ('Motocicleta', 'Motocicleta'),
  ('Bicicleta', 'Bicicleta'),
  ('Diario', 'Tarifa por día completo'),
  ('Noche', 'Tarifa nocturna'),
  ('Segunda vez', 'Reingreso del mismo vehículo el mismo día'),
  ('Segunda vez moto', 'Reingreso de motocicleta el mismo día')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 5. OWNERS (propietarios — NO son usuarios del sistema)
-- ---------------------------------------------------------------------
create table if not exists public.owners (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null default 'S/N',
  ci          text,
  phone       text,
  comments    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists owners_full_name_idx on public.owners using gin (full_name gin_trgm_ops);

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- 6. VEHICLES
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id          uuid primary key default gen_random_uuid(),
  plate       text not null unique,
  owner_id    uuid not null references public.owners(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists vehicles_plate_idx on public.vehicles (upper(plate));

-- ---------------------------------------------------------------------
-- 7. TIME RANGES (tramos de tiempo)
-- ---------------------------------------------------------------------
create table if not exists public.time_ranges (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  min_minutes integer not null,
  max_minutes integer, -- null = sin límite superior
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint time_ranges_valid_range check (max_minutes is null or max_minutes >= min_minutes)
);

-- ---------------------------------------------------------------------
-- 8. RATES (tarifa por tipo de vehículo + rango de tiempo)
-- ---------------------------------------------------------------------
create table if not exists public.rates (
  id              uuid primary key default gen_random_uuid(),
  vehicle_type_id uuid not null references public.vehicle_types(id) on delete cascade,
  time_range_id   uuid not null references public.time_ranges(id) on delete cascade,
  amount          numeric(10,2) not null check (amount >= 0),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (vehicle_type_id, time_range_id)
);

-- Datos iniciales de ejemplo de rangos y tarifas para "Auto"
insert into public.time_ranges (name, min_minutes, max_minutes) values
  ('0-20 min', 0, 20),
  ('21-30 min', 21, 30),
  ('31-45 min', 31, 45),
  ('46-65 min', 46, 65)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 9. PARKING RECORDS
-- ---------------------------------------------------------------------
create table if not exists public.parking_records (
  id                 uuid primary key default gen_random_uuid(),
  vehicle_id         uuid not null references public.vehicles(id) on delete restrict,
  vehicle_type_id    uuid not null references public.vehicle_types(id) on delete restrict,
  entry_at           timestamptz not null default now(),
  exit_at            timestamptz,
  comments           text,
  key_left           boolean not null default false,
  photo_path         text,
  calculated_amount  numeric(10,2),
  charged_amount     numeric(10,2),
  applied_rate_snapshot jsonb, -- historial: tarifas/rangos vigentes al momento del cálculo
  status             text not null default 'inside' check (status in ('inside', 'completed')),
  created_by         uuid references public.profiles(id),
  closed_by          uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists parking_records_status_idx on public.parking_records (status);
create index if not exists parking_records_entry_idx on public.parking_records (entry_at);
create index if not exists parking_records_vehicle_idx on public.parking_records (vehicle_id);

-- ---------------------------------------------------------------------
-- 10. updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','vehicle_types','owners','vehicles','time_ranges','rates','parking_records']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.profile_permissions enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.owners enable row level security;
alter table public.vehicles enable row level security;
alter table public.time_ranges enable row level security;
alter table public.rates enable row level security;
alter table public.parking_records enable row level security;

-- PROFILES ---------------------------------------------------------
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own_limited on public.profiles;
create policy profiles_update_own_limited on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()))
  );

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert with check (true); -- el trigger inserta con security definer; signUp normal cae aquí también

-- PERMISSIONS (catálogo) --------------------------------------------
drop policy if exists permissions_select_authenticated on public.permissions;
create policy permissions_select_authenticated on public.permissions
  for select using (auth.uid() is not null);

drop policy if exists permissions_manage_admin on public.permissions;
create policy permissions_manage_admin on public.permissions
  for all using (public.is_admin()) with check (public.is_admin());

-- PROFILE_PERMISSIONS -------------------------------------------------
drop policy if exists profile_permissions_select on public.profile_permissions;
create policy profile_permissions_select on public.profile_permissions
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists profile_permissions_manage_admin on public.profile_permissions;
create policy profile_permissions_manage_admin on public.profile_permissions
  for all using (public.is_admin()) with check (public.is_admin());

-- VEHICLE_TYPES ---------------------------------------------------
drop policy if exists vehicle_types_select on public.vehicle_types;
create policy vehicle_types_select on public.vehicle_types
  for select using (auth.uid() is not null);

drop policy if exists vehicle_types_manage on public.vehicle_types;
create policy vehicle_types_manage on public.vehicle_types
  for insert with check (public.is_admin());
drop policy if exists vehicle_types_update on public.vehicle_types;
create policy vehicle_types_update on public.vehicle_types
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists vehicle_types_delete on public.vehicle_types;
create policy vehicle_types_delete on public.vehicle_types
  for delete using (public.is_admin());

-- OWNERS / VEHICLES / PARKING_RECORDS: cualquier usuario autenticado activo
-- puede leer y crear (necesario para operar el parqueo); solo admin borra.
drop policy if exists owners_select on public.owners;
create policy owners_select on public.owners for select using (auth.uid() is not null);
drop policy if exists owners_insert on public.owners;
create policy owners_insert on public.owners for insert with check (auth.uid() is not null);
drop policy if exists owners_update on public.owners;
create policy owners_update on public.owners for update using (auth.uid() is not null);

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles for select using (auth.uid() is not null);
drop policy if exists vehicles_insert on public.vehicles;
create policy vehicles_insert on public.vehicles for insert with check (auth.uid() is not null);
drop policy if exists vehicles_update on public.vehicles;
create policy vehicles_update on public.vehicles for update using (auth.uid() is not null);

drop policy if exists time_ranges_select on public.time_ranges;
create policy time_ranges_select on public.time_ranges for select using (auth.uid() is not null);
drop policy if exists time_ranges_manage on public.time_ranges;
create policy time_ranges_manage on public.time_ranges for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists rates_select on public.rates;
create policy rates_select on public.rates for select using (auth.uid() is not null);
drop policy if exists rates_manage on public.rates;
create policy rates_manage on public.rates for all using (public.is_admin()) with check (public.is_admin());

-- PARKING_RECORDS: select para cualquier autenticado; insert requiere permiso parking.entry;
-- update de monto cobrado requiere parking.amount_override (validado también en frontend).
drop policy if exists parking_records_select on public.parking_records;
create policy parking_records_select on public.parking_records
  for select using (auth.uid() is not null);

drop policy if exists parking_records_insert on public.parking_records;
create policy parking_records_insert on public.parking_records
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.profile_permissions
      where profile_id = auth.uid() and permission_code = 'parking.entry'
    )
  );

drop policy if exists parking_records_update on public.parking_records;
create policy parking_records_update on public.parking_records
  for update using (
    public.is_admin() or exists (
      select 1 from public.profile_permissions
      where profile_id = auth.uid()
        and permission_code in ('parking.exit', 'parking.edit')
    )
  );

-- =====================================================================
-- FIN DEL SCRIPT
-- Recordatorio manual (fuera de este script):
-- 1) Crear el primer usuario admin desde Authentication → Add user,
--    y luego: update public.profiles set role = 'admin' where id = '<uuid-del-usuario>';
-- 2) Crear el bucket de Storage "parking-photos" manualmente.
-- =====================================================================
