-- Sicherheitspruefung 12.11.2026 (am selben Tag direkt in der Datenbank eingespielt)
-- 1) "Angemeldet" reicht nicht mehr: Zugriff nur fuer aktive Mitarbeiter.
create or replace function public.ist_mitarbeiter() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where auth_user_id = auth.uid() and aktiv);
$$;
revoke all on function public.ist_mitarbeiter() from public, anon;
grant execute on function public.ist_mitarbeiter() to authenticated, service_role;

alter policy "Lesen: alle eingeloggten Mitarbeiter" on public.abwesenheiten using (public.ist_mitarbeiter());
alter policy "Anlegen: alle eingeloggten Mitarbeiter" on public.ansprechpartner with check (public.ist_mitarbeiter());
alter policy "Lesen: alle eingeloggten Mitarbeiter" on public.ansprechpartner using (public.ist_mitarbeiter());
alter policy "Lesen: alle eingeloggten Mitarbeiter" on public.customers using (public.ist_mitarbeiter());
alter policy "Eingeloggte Mitarbeiter sehen die Mitarbeiterliste" on public.employees using (public.ist_mitarbeiter());
alter policy "Anlegen: alle eingeloggten Mitarbeiter" on public.machine_arbeiten with check (public.ist_mitarbeiter());
alter policy "Lesen: alle eingeloggten Mitarbeiter" on public.machine_arbeiten using (public.ist_mitarbeiter());
alter policy "Abschliessen/Bearbeiten: alle eingeloggten Mitarbeiter" on public.machine_arbeiten using (public.ist_mitarbeiter());
alter policy "Anlegen: alle eingeloggten Mitarbeiter" on public.machine_bilder with check (public.ist_mitarbeiter());
alter policy "Lesen: alle eingeloggten Mitarbeiter" on public.machine_bilder using (public.ist_mitarbeiter());
alter policy "Anlegen: alle eingeloggten Mitarbeiter" on public.machine_notizen with check (public.ist_mitarbeiter());
alter policy "Lesen: alle eingeloggten Mitarbeiter" on public.machine_notizen using (public.ist_mitarbeiter());
alter policy "Anlegen: alle eingeloggten Mitarbeiter" on public.machines with check (public.ist_mitarbeiter());
alter policy "Lesen: alle eingeloggten Mitarbeiter" on public.machines using (public.ist_mitarbeiter());

alter policy "Authenticated delete machine photos" on storage.objects using (bucket_id = 'machine-photos' and public.ist_mitarbeiter());
alter policy "Authenticated upload signatures" on storage.objects with check (bucket_id = 'signatures' and public.ist_mitarbeiter());
alter policy "Authenticated upload machine photos" on storage.objects with check (bucket_id = 'machine-photos' and public.ist_mitarbeiter());
create policy "Mitarbeiter lesen Unterschriften" on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and public.ist_mitarbeiter());

-- 2) Interne Wissens-Funktionen nicht mehr ohne Anmeldung aufrufbar.
revoke execute on function public.wissen_verarbeite_naechsten_batch(integer) from public, anon, authenticated;
revoke execute on function public.wissen_suche(vector, integer) from public, anon;
grant execute on function public.wissen_suche(vector, integer) to authenticated, service_role;

-- 3) Unterschriften-Ordner geschuetzt (nach Auslieferung der App-Aenderung in pdf.ts):
--    update storage.buckets set public = false where id = 'signatures';
--    drop policy "Public read signatures" on storage.objects;
