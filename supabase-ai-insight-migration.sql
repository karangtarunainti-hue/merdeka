-- ============================================================
-- MIGRASI: tabel kt_ai_insight
-- Cache ringkasan naratif AI untuk panel "Insight" di Buku Kegiatan
-- (Dashboard) — lihat js/27-ai-insight.js.
--
-- Event-scoped (1 baris per event_id), sama seperti kt_settings.
-- event_id bertipe TEXT (bukan uuid) karena mengikuti tipe kolom
-- kt_events.id (id event di app ini string custom, bukan UUID).
-- Isinya HASIL AI yang sudah jadi (teks + hash data sumber), bukan
-- data yang diedit user lewat form — makanya TIDAK pakai mekanisme
-- deteksi konflik updated_at seperti kt_settings/kt_organisasi_profil.
-- Race antar client paling buruk cuma bikin 1-2 kali panggilan AI
-- yang tumpang tindih (harmless, hasilnya sama karena data sumbernya
-- sama) — last-write-wins sudah cukup.
--
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================
create table if not exists kt_ai_insight (
  event_id text primary key references kt_events(id) on delete cascade,
  ringkasan text not null default '',
  data_hash text not null default '',
  generated_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function kt_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at on kt_ai_insight;
create trigger trg_set_updated_at before update on kt_ai_insight
  for each row execute function kt_set_updated_at();

alter table kt_ai_insight enable row level security;
drop policy if exists "anon_full_access" on kt_ai_insight;
create policy "anon_full_access" on kt_ai_insight
  for all to anon using (true) with check (true);
