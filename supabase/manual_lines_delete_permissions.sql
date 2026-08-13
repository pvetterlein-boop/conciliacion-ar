-- Dulce Crecer / Babysmart SpA
-- Permisos para eliminar líneas sin historial desde la interfaz.
-- La aplicación bloquea eliminación cuando existen conciliaciones/asociaciones históricas.

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

-- Transferencias
drop policy if exists bank_payments_delete_operadores on public.bank_payments;
create policy bank_payments_delete_operadores
on public.bank_payments
for delete
to authenticated
using (public.can_write_ar());

-- Tuu / Mercado Pago
drop policy if exists tuu_transactions_delete_operadores on public.tuu_transactions;
create policy tuu_transactions_delete_operadores
on public.tuu_transactions
for delete
to authenticated
using (public.can_write_ar());

-- Documentos AR
drop policy if exists ar_documents_delete_operadores on public.ar_documents;
create policy ar_documents_delete_operadores
on public.ar_documents
for delete
to authenticated
using (public.can_write_ar());

grant delete on public.bank_payments to authenticated;
grant delete on public.tuu_transactions to authenticated;
grant delete on public.ar_documents to authenticated;
