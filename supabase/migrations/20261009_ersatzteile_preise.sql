-- Ersatzteile: optional Einkaufs-/Verkaufspreis und Artikelnummer (Büro/CEO). Mit Verkaufspreis legt
-- die Serverfunktion den Artikel in easybill an; die Artikelnummer verknüpft einen vorhandenen Artikel.
alter table public.servicebericht_ersatzteile
  add column einkaufspreis numeric(10,2),
  add column verkaufspreis numeric(10,2),
  add column artikelnummer text;
