-- ============================================================
-- MIGRASI: tabel kt_kalender_insight
-- Cache ringkasan naratif AI untuk panel "Kesadaran Kalender" di
-- Dashboard — lihat js/28-kalender-peringatan.js.
--
-- BEDA dari kt_ai_insight/kt_ai_insight_lomba/kt_ai_insight_belanja_hadiah
-- (lihat supabase-ai-insight*-migration.sql): tabel-tabel itu event-scoped
-- (1 baris per event_id), sedangkan kalender hari libur/hari besar Islam
-- berlaku ORGANISASI, bukan per kegiatan — jadi tabel ini cuma 1 baris
-- global (id='global'), sama pola satu-baris-saja seperti
-- kt_telegram_settings/kt_organisasi_profil/kt_whatsapp_settings (yang
-- masing-masing pakai id='main' — di sini dipakai 'global' saja supaya
-- jelas ini bukan pengaturan per-organisasi tapi cache kalender bersama).
--
-- Isinya HASIL AI yang sudah jadi (teks + hash data sumber), bukan data
-- yang diedit user lewat form — sama seperti kt_ai_insight lainnya, TIDAK
-- pakai mekanisme deteksi konflik updated_at.
--
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================
create table if not exists kt_kalender_insight (
  id text primary key default 'global',
  ringkasan text not null default '',
  data_hash text not null default '',
  generated_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- create or replace: aman walau fungsi ini sudah pernah dibuat dari
-- supabase-ai-insight-migration.sql, dan tetap jalan kalau migrasi ini
-- dijalankan berdiri sendiri di database baru.
create or replace function kt_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at on kt_kalender_insight;
create trigger trg_set_updated_at before update on kt_kalender_insight
  for each row execute function kt_set_updated_at();

alter table kt_kalender_insight enable row level security;
drop policy if exists "anon_full_access" on kt_kalender_insight;
create policy "anon_full_access" on kt_kalender_insight
  for all to anon using (true) with check (true);
