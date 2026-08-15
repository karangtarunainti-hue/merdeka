-- ============================================================
-- MIGRASI: tabel kt_ai_insight_belanja_hadiah
-- Cache ringkasan naratif AI untuk panel "Haloo Inti!" di halaman
-- Belanja Hadiah — lihat js/27-ai-insight.js (renderBelanjaHadiahInsightPanel dkk).
--
-- Struktur & alasan SAMA PERSIS seperti kt_ai_insight (Dashboard) dan
-- kt_ai_insight_lomba, lihat catatan lengkap di
-- supabase-ai-insight-migration.sql. Tabel terpisah supaya cache
-- masing-masing insight independen.
--
-- Event-scoped (1 baris per event_id).
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================
create table if not exists kt_ai_insight_belanja_hadiah (
  event_id text primary key references kt_events(id) on delete cascade,
  ringkasan text not null default '',
  data_hash text not null default '',
  generated_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_set_updated_at on kt_ai_insight_belanja_hadiah;
create trigger trg_set_updated_at before update on kt_ai_insight_belanja_hadiah
  for each row execute function kt_set_updated_at();

alter table kt_ai_insight_belanja_hadiah enable row level security;
drop policy if exists "anon_full_access" on kt_ai_insight_belanja_hadiah;
create policy "anon_full_access" on kt_ai_insight_belanja_hadiah
  for all to anon using (true) with check (true);
