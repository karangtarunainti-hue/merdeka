-- ============================================================
-- MIGRASI: tabel kt_ai_insight_lomba
-- Cache ringkasan naratif AI untuk panel "Haloo Inti!" di halaman
-- Lomba — lihat js/27-ai-insight.js (renderLombaInsightPanel dkk).
--
-- Struktur & alasan SAMA PERSIS seperti kt_ai_insight (Dashboard),
-- lihat catatan lengkap di supabase-ai-insight-migration.sql. Dipisah
-- jadi tabel sendiri (bukan menambah kolom "kind" ke kt_ai_insight)
-- supaya skema tetap sederhana dan tiap insight independen — cache
-- salah satu tidak pernah ikut invalid saat yang lain di-generate ulang.
--
-- Event-scoped (1 baris per event_id).
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================
create table if not exists kt_ai_insight_lomba (
  event_id text primary key references kt_events(id) on delete cascade,
  ringkasan text not null default '',
  data_hash text not null default '',
  generated_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_set_updated_at on kt_ai_insight_lomba;
create trigger trg_set_updated_at before update on kt_ai_insight_lomba
  for each row execute function kt_set_updated_at();

alter table kt_ai_insight_lomba enable row level security;
drop policy if exists "anon_full_access" on kt_ai_insight_lomba;
create policy "anon_full_access" on kt_ai_insight_lomba
  for all to anon using (true) with check (true);
