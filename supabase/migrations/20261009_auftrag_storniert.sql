-- Aufträge stornieren: storniert_am setzt die Serverfunktion (zusammen mit easybill),
-- der Status wird wie bisher berechnet und ist dann „storniert“.
alter table public.orders add column storniert_am timestamptz;
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array['neu','in Arbeit','erledigt','abgerechnet','storniert']));

create or replace function public.compute_order_status(p_order_id text)
 returns text
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v_total_reports integer;
  v_vollstaendige_reports integer;
  v_billed_reports integer;
  v_has_time boolean;
  v_storniert timestamptz;
begin
  select storniert_am into v_storniert from orders where id = p_order_id;
  if v_storniert is not null then
    return 'storniert';
  end if;
  select count(*) into v_total_reports from serviceberichte where auftrag_id = p_order_id;
  select count(*) filter (where bericht_ist_vollstaendig(id)) into v_vollstaendige_reports
    from serviceberichte where auftrag_id = p_order_id;
  select count(*) filter (where abgerechnet) into v_billed_reports
    from serviceberichte where auftrag_id = p_order_id;
  select exists(
    select 1 from servicebericht_tage t join serviceberichte b on b.id = t.servicebericht_id
    where b.auftrag_id = p_order_id
  ) into v_has_time;

  if v_total_reports > 0 and v_total_reports = v_billed_reports then
    return 'abgerechnet';
  elsif v_total_reports > 0 and v_total_reports = v_vollstaendige_reports then
    return 'erledigt';
  elsif v_has_time then
    return 'in Arbeit';
  else
    return 'neu';
  end if;
end;
$function$;

-- Beim Setzen von storniert_am sieht der BEFORE-Trigger noch den alten Wert in der Tabelle;
-- deshalb hier direkt aus NEW lesen.
create or replace function public.enforce_computed_status()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.storniert_am is not null then
    new.status := 'storniert';
  else
    new.status := compute_order_status(new.id);
  end if;
  return new;
end;
$function$;
