-- Dulce Crecer / Babysmart SpA
-- Permisos para edición en página de Clases, Reglas de servicio y Usuarios.
-- Clases/reglas: admin y conciliador activos.
-- Usuarios: solo administrador activo.
-- Las eliminaciones desde la interfaz son lógicas (active=false).

create or replace function public.can_write_ar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin','conciliador')
  );
$$;

create or replace function public.is_ar_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role = 'admin'
  );
$$;

revoke all on function public.can_write_ar() from public;
revoke all on function public.is_ar_admin() from public;
grant execute on function public.can_write_ar() to authenticated;
grant execute on function public.is_ar_admin() to authenticated;

-- CLASES
alter table public.classes enable row level security;
alter table public.class_sessions enable row level security;

drop policy if exists classes_insert_operadores on public.classes;
create policy classes_insert_operadores
on public.classes for insert
to authenticated
with check (public.can_write_ar());

drop policy if exists classes_update_operadores on public.classes;
create policy classes_update_operadores
on public.classes for update
to authenticated
using (public.can_write_ar())
with check (public.can_write_ar());

drop policy if exists class_sessions_insert_operadores on public.class_sessions;
create policy class_sessions_insert_operadores
on public.class_sessions for insert
to authenticated
with check (public.can_write_ar());

drop policy if exists class_sessions_update_operadores on public.class_sessions;
create policy class_sessions_update_operadores
on public.class_sessions for update
to authenticated
using (public.can_write_ar())
with check (public.can_write_ar());

-- REGLAS DE SERVICIO
alter table public.service_rules enable row level security;

drop policy if exists service_rules_insert_operadores on public.service_rules;
create policy service_rules_insert_operadores
on public.service_rules for insert
to authenticated
with check (public.can_write_ar());

drop policy if exists service_rules_update_operadores on public.service_rules;
create policy service_rules_update_operadores
on public.service_rules for update
to authenticated
using (public.can_write_ar())
with check (public.can_write_ar());

-- USUARIOS / PERFILES
-- La creación continúa pasando por el flujo de invitación y Auth.
-- Solo admin puede modificar nombre, rol o estado de perfiles existentes.
alter table public.profiles enable row level security;

drop policy if exists profiles_update_admin_ar on public.profiles;
create policy profiles_update_admin_ar
on public.profiles for update
to authenticated
using (public.is_ar_admin())
with check (public.is_ar_admin());

grant select, insert, update on public.classes to authenticated;
grant select, insert, update on public.class_sessions to authenticated;
grant select, insert, update on public.service_rules to authenticated;
grant select, update on public.profiles to authenticated;

-- Los permisos sobre secuencias no evitan RLS; solo permiten usar IDs identity/serial.
grant usage, select on all sequences in schema public to authenticated;
