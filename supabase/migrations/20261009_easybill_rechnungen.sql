-- Rechnungsentwürfe, die die App in easybill angelegt hat. Darüber erkennt die App später,
-- dass eine Rechnung abgeschlossen wurde, und setzt die Berichte auf abgerechnet.
create table public.easybill_rechnungen (
  id uuid primary key default gen_random_uuid(),
  auftrag_id text not null references public.orders(id) on delete cascade,
  easybill_auftrag_id bigint not null,
  easybill_rechnung_id bigint not null,
  bericht_ids uuid[] not null default '{}',
  erstellt_am timestamptz not null default now(),
  erstellt_von uuid references public.employees(id),
  netto_cent bigint,
  rechnung_nummer text,
  abgeschlossen_am timestamptz,
  verworfen_am timestamptz
);
create index easybill_rechnungen_auftrag_idx on public.easybill_rechnungen(auftrag_id);
alter table public.easybill_rechnungen enable row level security;
-- Das Büro liest, geschrieben wird nur über die Serverfunktion (Service-Role).
create policy "Buero sieht easybill-Rechnungen" on public.easybill_rechnungen
  for select using ((select role from current_employee()) = any (array['Administrator','Disposition','CEO']));

-- Verknüpfung eines Ersatzteils im Bericht mit dem easybill-Artikel (Katalog-Position).
alter table public.servicebericht_ersatzteile add column easybill_position_id bigint;
