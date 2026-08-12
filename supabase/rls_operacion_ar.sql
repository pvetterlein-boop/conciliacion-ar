-- Dulce Crecer / Babysmart SpA
-- Permisos RLS para operación del sistema de Conciliación AR.
-- Mantiene RLS activo. Solo admin y conciliador activos pueden escribir.

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

revoke all on function public.can_write_ar() from public;
grant execute on function public.can_write_ar() to authenticated;

-- Documentos AR
drop policy if exists ar_documents_insert_operadores on public.ar_documents;
create policy ar_documents_insert_operadores
on public.ar_documents for insert
to authenticated
with check (public.can_write_ar());

drop policy if exists ar_documents_update_operadores on public.ar_documents;
create policy ar_documents_update_operadores
on public.ar_documents for update
to authenticated
using (public.can_write_ar())
with check (public.can_write_ar());

drop policy if exists ar_documents_delete_operadores on public.ar_documents;
create policy ar_documents_delete_operadores
on public.ar_documents for delete
to authenticated
using (public.can_write_ar());

-- Transferencias bancarias
drop policy if exists bank_payments_insert_operadores on public.bank_payments;
create policy bank_payments_insert_operadores
on public.bank_payments for insert
to authenticated
with check (public.can_write_ar());

drop policy if exists bank_payments_update_operadores on public.bank_payments;
create policy bank_payments_update_operadores
on public.bank_payments for update
to authenticated
using (public.can_write_ar())
with check (public.can_write_ar());

-- Tuu y Mercado Pago
drop policy if exists tuu_transactions_insert_operadores on public.tuu_transactions;
create policy tuu_transactions_insert_operadores
on public.tuu_transactions for insert
to authenticated
with check (public.can_write_ar());

drop policy if exists tuu_transactions_update_operadores on public.tuu_transactions;
create policy tuu_transactions_update_operadores
on public.tuu_transactions for update
to authenticated
using (public.can_write_ar())
with check (public.can_write_ar());

-- Conciliaciones Banco <-> Documentos AR
drop policy if exists bank_document_matches_insert_operadores on public.bank_document_matches;
create policy bank_document_matches_insert_operadores
on public.bank_document_matches for insert
to authenticated
with check (public.can_write_ar());

drop policy if exists bank_document_matches_update_operadores on public.bank_document_matches;
create policy bank_document_matches_update_operadores
on public.bank_document_matches for update
to authenticated
using (public.can_write_ar())
with check (public.can_write_ar());

-- Conciliaciones Tuu/MP <-> Documentos AR
drop policy if exists tuu_document_matches_insert_operadores on public.tuu_document_matches;
create policy tuu_document_matches_insert_operadores
on public.tuu_document_matches for insert
to authenticated
with check (public.can_write_ar());

drop policy if exists tuu_document_matches_update_operadores on public.tuu_document_matches;
create policy tuu_document_matches_update_operadores
on public.tuu_document_matches for update
to authenticated
using (public.can_write_ar())
with check (public.can_write_ar());

-- Historial de cargas
drop policy if exists imports_insert_operadores on public.imports;
create policy imports_insert_operadores
on public.imports for insert
to authenticated
with check (public.can_write_ar());
