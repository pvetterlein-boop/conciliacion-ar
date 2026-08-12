-- Dulce Crecer / Babysmart SpA
-- Limpieza segura de documentos AR duplicados.
-- Clave fiscal canonica: tipo de documento (41/34/61) + folio.
-- Conserva el registro de menor ID (el originalmente cargado).
-- Se detiene si una copia que se eliminaria ya tiene conciliaciones asociadas.

begin;

create temporary table _ar_doc_rank on commit drop as
select
  id,
  folio,
  case
    when doc_type in ('41','Boleta Exenta') then '41'
    when doc_type in ('34','Factura Exenta') then '34'
    when doc_type in ('61','Nota de Crédito','Nota de Credito') then '61'
    else lower(trim(doc_type))
  end as doc_code,
  min(id) over (
    partition by
      case
        when doc_type in ('41','Boleta Exenta') then '41'
        when doc_type in ('34','Factura Exenta') then '34'
        when doc_type in ('61','Nota de Crédito','Nota de Credito') then '61'
        else lower(trim(doc_type))
      end,
      folio
  ) as keep_id,
  row_number() over (
    partition by
      case
        when doc_type in ('41','Boleta Exenta') then '41'
        when doc_type in ('34','Factura Exenta') then '34'
        when doc_type in ('61','Nota de Crédito','Nota de Credito') then '61'
        else lower(trim(doc_type))
      end,
      folio
    order by id
  ) as rn
from public.ar_documents;

-- No borrar una copia si ya fue usada en una conciliación.
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

-- Eliminar únicamente las copias posteriores.
delete from public.ar_documents d
using _ar_doc_rank r
where d.id = r.id
  and r.rn > 1;

-- La situación reportada corresponde a 136 filas = 62 existentes + 74 del acumulado.
-- Después de deduplicar deben quedar 74 claves fiscales únicas.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.ar_documents;
  if v_count <> 74 then
    raise exception 'Limpieza detenida: después de deduplicar quedarían % documentos, no 74. Se revierte la operación.', v_count;
  end if;
end $$;

-- Barrera de base de datos: no permitir nuevamente el mismo tipo fiscal + folio.
create unique index if not exists ar_documents_tipo_folio_unique
on public.ar_documents (
  (case
    when doc_type in ('41','Boleta Exenta') then '41'
    when doc_type in ('34','Factura Exenta') then '34'
    when doc_type in ('61','Nota de Crédito','Nota de Credito') then '61'
    else lower(trim(doc_type))
  end),
  folio
);

commit;

-- Verificación esperada:
select count(*) as documentos_ar from public.ar_documents;
