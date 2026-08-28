-- ============================================================
-- MIGRASI: kt_second_brain — "memori" semantik aplikasi
-- Catatan/ide/dokumen/konteks bebas (bukan data transaksional
-- seperti anggota/kas/dsb) yang bisa dicari BERDASARKAN MAKNA
-- (semantic search, bukan cuma cocok kata kunci) lewat embedding
-- vector, dipakai baik oleh manusia (menu "Second Brain") maupun
-- oleh Asisten AI (RAG — lihat js/29-asisten-ai.js) buat cari
-- catatan yang relevan dengan pertanyaan sebelum dijawab.
--
-- Butuh extension pgvector (sudah tersedia bawaan di semua project
-- Supabase, tinggal diaktifkan).
--
-- POLA AKSES: beda dari tabel data umum (yang SELECT-nya dibuka untuk
-- anon/guest, lihat BAGIAN 3 di supabase-hardening-migration.sql) —
-- tabel ini SENGAJA ditutup total dari anon yang belum login, baik baca
-- maupun tulis. Alasannya: isinya bisa memuat konteks organisasi yang
-- lebih bebas/sensitif daripada data transaksional biasa (nama, rencana,
-- catatan internal), dan js/29-asisten-ai.js memang cuma mengizinkan
-- Asisten AI dipakai user yang login (lihat asistenBolehDipakai()) —
-- jadi tidak ada gunanya tabel sumbernya malah terbuka untuk anon.
--
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================

create extension if not exists vector;

-- Dimensi 768 = rekomendasi Google untuk gemini-embedding-001 kalau mau
-- hemat storage/index tanpa banyak kehilangan kualitas dibanding default
-- 3072 (lihat outputDimensionality di supabase/functions/ai-embed).
-- KALAU nanti ganti dimensi, kolom ini HARUS diganti juga (drop & create
-- ulang, data lama re-embed) — vector(N) itu tetap, tidak otomatis
-- menyesuaikan panjang array yang beda.
create table if not exists kt_second_brain (
  id text primary key,
  judul text not null default '',
  konten text not null default '',
  kategori text not null default 'catatan', -- 'catatan' | 'ide' | 'dokumen' | 'konteks'
  tags text[] not null default '{}'::text[],
  -- event_id NULL = catatan lintas-kegiatan (default); diisi kalau memang
  -- mau dikaitkan ke satu event tertentu saja. Kolom ini TIDAK dipakai FK
  -- (beda dari tabel lain) supaya catatan tidak ikut terhapus kalau event
  -- lama dibersihkan — second brain sengaja dirancang untuk bertahan lebih
  -- lama daripada siklus hidup satu event/kegiatan.
  event_id text,
  embedding vector(768),
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index approximate-nearest-neighbor untuk pencarian cosine similarity
-- (dipakai kt_second_brain_search di bawah). ivfflat butuh baris untuk
-- di-"latih" secara statistik — dengan sedikit baris kualitasnya tidak
-- optimal tapi tetap jalan benar (fallback ke scan biasa kalau index-nya
-- belum bermanfaat), jadi aman dibuat dari awal walau tabel masih kosong.
create index if not exists kt_second_brain_embedding_idx
  on kt_second_brain using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists kt_second_brain_event_idx on kt_second_brain (event_id);
create index if not exists kt_second_brain_kategori_idx on kt_second_brain (kategori);

-- Trigger updated_at (pola sama seperti tabel lain di app ini yang
-- mengandalkan kolom updated_at untuk deteksi konflik multi-device —
-- lihat syncArrayTable() di js/03-db-core.js — walau kt_second_brain
-- SENGAJA TIDAK ikut lewat syncArrayTable itu, lihat catatan di
-- js/30-second-brain.js kenapa modul ini fetch langsung sendiri, sama
-- seperti pola Gudang).
create or replace function kt_second_brain_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_kt_second_brain_updated_at on kt_second_brain;
create trigger trg_kt_second_brain_updated_at
  before update on kt_second_brain
  for each row execute function kt_second_brain_set_updated_at();

-- ============================================================
-- RLS — tertutup total untuk anon yang belum login (lihat catatan
-- akses di atas). Butuh session_is_logged_in() dari
-- supabase-hardening-migration.sql — JALANKAN migrasi itu dulu kalau
-- belum pernah, migrasi ini akan gagal kalau fungsi itu belum ada.
-- ============================================================
alter table kt_second_brain enable row level security;
drop policy if exists "kt_second_brain_all" on kt_second_brain;
create policy "kt_second_brain_all" on kt_second_brain
  for all to anon
  using (session_is_logged_in())
  with check (session_is_logged_in());

-- ============================================================
-- RPC: pencarian semantik. SECURITY DEFINER supaya bisa jalan dari
-- anon key (RLS di atas tetap dicek manual di dalam fungsi lewat
-- session_is_logged_in(), bukan diandalkan ke policy select biasa,
-- karena SECURITY DEFINER melewati RLS pemanggilnya).
-- p_event_id: NULL = cari lintas semua catatan (global + semua event).
--   Diisi id event tertentu = cari catatan global ATAU milik event itu
--   saja (bukan event lain) — supaya pertanyaan soal kegiatan "17 Agustus
--   2026" tidak kecampur konteks kegiatan tahun-tahun lain yang tidak
--   relevan.
-- ============================================================
create or replace function kt_second_brain_search(
  p_query_embedding vector(768),
  p_match_count int default 6,
  p_event_id text default null
)
returns table(
  id text, judul text, konten text, kategori text, tags text[],
  event_id text, similarity float
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not session_is_logged_in() then
    raise exception 'Akses ditolak: login diperlukan.' using errcode = 'P0001';
  end if;

  return query
    select b.id, b.judul, b.konten, b.kategori, b.tags, b.event_id,
           1 - (b.embedding <=> p_query_embedding) as similarity
    from kt_second_brain b
    where b.embedding is not null
      and (p_event_id is null or b.event_id is null or b.event_id = p_event_id)
    order by b.embedding <=> p_query_embedding
    limit greatest(1, least(p_match_count, 20));
end;
$$;
grant execute on function kt_second_brain_search(vector, int, text) to anon;
