-- Push-Nachricht aufs Handy, wenn einem Techniker ein Auftrag zugewiesen wird.
--
-- Ablauf: Eintrag in order_techniker -> Trigger legt eine Meldung in push_meldungen an
-- (je Auftrag und Techniker nur einmal, auch wenn das Formular die Zuordnung neu schreibt)
-- -> pg_net ruft die Edge Function "push-senden" auf -> die schickt die Meldung an alle
-- Geräte des Technikers (push_abos).
--
-- Der private VAPID-Schlüssel liegt nur im Vault (Name push_vapid_private), nicht im Repo.

create extension if not exists pg_net with schema extensions;

-- Geräte, die Push-Nachrichten empfangen wollen (ein Eintrag je Gerät/Browser).
create table if not exists public.push_abos (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  geraet text,
  created_at timestamptz not null default now(),
  zuletzt_ok timestamptz
);
alter table public.push_abos enable row level security;
-- Jeder sieht nur die eigenen Geräte. Anlegen/Löschen nur über die Funktionen unten.
create policy "Eigene Push-Geraete sehen" on public.push_abos for select
  using (employee_id = (select id from public.current_employee()));

-- Warteschlange der Meldungen. Nur der Server (Service-Role) liest und schreibt.
create table if not exists public.push_meldungen (
  id bigserial primary key,
  order_id text not null references public.orders(id) on delete cascade on update cascade,
  techniker_id uuid not null references public.employees(id) on delete cascade,
  created_at timestamptz not null default now(),
  gesendet_am timestamptz,
  ergebnis text,
  unique (order_id, techniker_id)
);
alter table public.push_meldungen enable row level security;

-- Gerät anmelden (ein Gerät gehört immer dem, der gerade angemeldet ist).
create or replace function public.push_abo_speichern(p_endpoint text, p_p256dh text, p_auth text, p_geraet text)
returns void language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  select id into v_emp from employees where auth_user_id = auth.uid() and aktiv;
  if v_emp is null then raise exception 'kein aktiver Mitarbeiter'; end if;
  if p_endpoint !~ '^https://' then raise exception 'ungültige Adresse'; end if;
  insert into push_abos (employee_id, endpoint, p256dh, auth, geraet)
  values (v_emp, p_endpoint, p_p256dh, p_auth, left(p_geraet, 200))
  on conflict (endpoint) do update
    set employee_id = excluded.employee_id, p256dh = excluded.p256dh, auth = excluded.auth,
        geraet = excluded.geraet, created_at = now();
end $$;

create or replace function public.push_abo_loeschen(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_abos where endpoint = p_endpoint
    and employee_id = (select id from employees where auth_user_id = auth.uid());
$$;

revoke all on function public.push_abo_speichern(text, text, text, text) from public, anon;
revoke all on function public.push_abo_loeschen(text) from public, anon;
grant execute on function public.push_abo_speichern(text, text, text, text) to authenticated;
grant execute on function public.push_abo_loeschen(text) to authenticated;

-- Privater VAPID-Schlüssel für die Edge Function (nur Service-Role).
create or replace function public.push_vapid_privat()
returns text language sql security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private' limit 1;
$$;
revoke all on function public.push_vapid_privat() from public, anon, authenticated;
grant execute on function public.push_vapid_privat() to service_role;

-- Trigger: neue Zuordnung Techniker <-> Auftrag.
create or replace function public.push_bei_zuweisung()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Keine Meldung für erledigte/stornierte Aufträge und nicht an sich selbst.
  if exists (select 1 from orders o where o.id = new.order_id
             and (o.storniert_am is not null or o.status in ('erledigt', 'abgerechnet', 'storniert'))) then
    return new;
  end if;
  if new.techniker_id = (select id from employees where auth_user_id = auth.uid()) then
    return new;
  end if;

  insert into push_meldungen (order_id, techniker_id) values (new.order_id, new.techniker_id)
  on conflict do nothing;
  if found then
    perform net.http_post(
      url := 'https://cyvjcskxqluqmerjxqty.supabase.co/functions/v1/push-senden',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    );
  end if;
  return new;
exception when others then
  -- Eine fehlgeschlagene Benachrichtigung darf das Zuweisen nie verhindern.
  raise warning 'push_bei_zuweisung: %', sqlerrm;
  return new;
end $$;


create trigger trg_push_bei_zuweisung after insert on public.order_techniker
  for each row execute function public.push_bei_zuweisung();
