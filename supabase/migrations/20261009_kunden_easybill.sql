-- Kunden mit easybill verknüpfen: Kundennummer und interne easybill-ID, dazu die Preisstufe
-- (SALEPRICE2 … SALEPRICE7, leer = Standardpreis), die die App beim Anlegen abfragt.
alter table public.customers
  add column easybill_id bigint,
  add column kundennummer text,
  add column preisstufe text;
create unique index customers_easybill_id_idx on public.customers(easybill_id) where easybill_id is not null;

-- Kunden legen nur noch Büro, CEO und Administrator an (Techniker weiterhin Maschinen und Ansprechpartner).
drop policy "Anlegen: alle eingeloggten Mitarbeiter" on public.customers;
create policy "Anlegen: Administrator, Disposition und CEO" on public.customers
  for insert with check ((select role from current_employee()) = any (array['Administrator','Disposition','CEO']));
