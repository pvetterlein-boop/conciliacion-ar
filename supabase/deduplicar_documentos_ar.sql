-- Dulce Crecer / Babysmart SpA
-- Limpieza segura de documentos AR duplicados.
-- Clave fiscal canonica: tipo de documento (41/34/61) + folio.
-- Considera equivalentes las etiquetas antiguas Boleta/Factura y las nuevas Exentas.
-- Conserva el registro de menor ID (el originalmente cargado).

begin;

create temporary table _ar_doc_rank on commit drop as
select
  id,
  folio,
  issue_date,
  amount,
  case
    when lower(trim(doc_type)) in ('41','boleta','boleta exenta') then '41'
    when lower(trim(doc_type)) in ('34','factura','factura exenta') then '34'
    when lower(trim(doc_type)) in ('61','nota de crédito','nota de credito') then '61'
    else lower(trim(doc_type))
  end as doc_code,
  min(id) over (
    partition by
      case
        when lower(trim(doc_type)) in ('41','boleta','boleta exenta') then '41'
        when lower(trim(doc_type)) in ('34','factura','factura exenta') then '34'
        when lower(trim(doc_type)) in ('61','nota de crédito','nota de credito') then '61'
        else lower(trim(doc_type))
      end,
      folio
  ) as keep_id,
  row_number() over (
    partition by
      case
        when lower(trim(doc_type)) in ('41','boleta','boleta exenta') then '41'
        when lower(trim(doc_type)) in ('34','factura','factura exenta') then '34'
        when lower(trim(doc_type)) in ('61','nota de crédito','nota de credito') then '61'
        else lower(trim(doc_type))
      end,
      folio
    order by id
  ) as rn
from public.ar_documents;

-- Seguridad 1: una clave repetida debe tener el mismo monto y fecha.
do $$
begin
  if exists (
    select 1
    from _ar_doc_rank r
    group by r.doc_code, r.folio
    having count(*) > 1
       and (count(distinct r.amount) > 1 or count(distinct r.issue_date) > 1)
  ) then
    raise exception 'Limpieza detenida: existe un mismo tipo+folio con distinto monto o fecha. No se eliminó ningún documento.';
  end if;
end $$;

-- Seguridad 2: no borrar una copia si ya fue usada en una conciliación.
do $$
begin
  if exists (
    select 1
    from _ar_doc_rank r
    where r.rn > 1
      and (
        exists (select 1 from public.bank_document_matches m where m.ar_document_id = r.id)
        or exists (select 1 from public.tuu_document_matches m where m.ar_document_id = r.id)
      )
  ) then
    raise exception 'Limpieza detenida: una copia duplicada ya tiene conciliaciones asociadas. No se eliminó ningún documento.';
  end if;
end $$;

-- Eliminar solamente las copias posteriores; conserva el menor ID.
delete from public.ar_documents d
using _ar_doc_rank r
where d.id = r.id
  and r.rn > 1;

-- En el caso actual: 136 = 62 anteriores + 74 acumulados.
-- El resultado correcto debe ser exactamente 74 documentos.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.ar_documents;
  if v_count <> 74 then
    raise exception 'Limpieza detenida: después de deduplicar quedarían % documentos, no 74. Se revierte toda la operación.', v_count;
  end if;
end $$;

-- Barrera de base de datos: impide volver a guardar el mismo tipo fiscal + folio,
-- incluso si la interfaz tuviera un error futuro.
create unique index if not exists ar_documents_tipo_folio_unique
on public.ar_documents (
  (case
    when lower(trim(doc_type)) in ('41','boleta','boleta exenta') then '41'
    when lower(trim(doc_type)) in ('34','factura','factura exenta') then '34'
    when lower(trim(doc_type)) in ('61','nota de crédito','nota de credito') then '61'
    else lower(trim(doc_type))
  end),
  folio
);

commit;

-- Verificaciones esperadas: 74 documentos y 0 duplicados fiscales.
select count(*) as documentos_ar from public.ar_documents;

select
  case
    when lower(trim(doc_type)) in ('41','boleta','boleta exenta') then '41'
    when lower(trim(doc_type)) in ('34','factura','factura exenta') then '34'
    when lower(trim(doc_type)) in ('61','nota de crédito','nota de credito') then '61'
    else lower(trim(doc_type))
  end as tipo_fiscal,
  folio,
  count(*) as cantidad
from public.ar_documents
group by 1, folio
having count(*) > 1
order by tipo_fiscal, folio;
