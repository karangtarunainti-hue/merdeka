-- ============================================================
-- SKEMA DASAR (REKONSTRUKSI) — Merdeka / Karang Taruna Inti
-- ============================================================
-- ⚠️ PENTING — BACA DULU SEBELUM MENJALANKAN:
--
-- Repo asli TIDAK menyertakan skema tabel dasar ini (lihat catatan di
-- sql/README.md — tabel-tabel `kt_*` inti diasumsikan sudah ada duluan,
-- dibuat manual lewat Table Editor jauh sebelum migrasi bernomor
-- `sql/01`–`sql/39` ditulis).
--
-- File ini adalah HASIL REKONSTRUKSI, disusun dengan menelusuri:
--   1. Field apa saja yang dibaca/ditulis oleh kode JS (js/*.js) untuk
--      tiap tabel (mis. db.anggota.push({...}) di js/08-anggota.js).
--   2. Kolom apa yang di-ALTER/ditambahkan oleh sql/01–39 — kolom itu
--      SENGAJA TIDAK dimasukkan di sini, dibiarkan ditambahkan oleh
--      migrasi bernomor yang bersangkutan (supaya urutan deploy asli
--      tetap valid & idempotent).
--   3. Untuk kolom yang dipakai kode tapi TIDAK PERNAH di-ALTER oleh
--      migrasi manapun (berarti memang sudah ada di skema dasar), kolom
--      itu dimasukkan di sini (mis. kt_settings.tarif, kt_donatur.nama_donatur).
--
-- Karena ini rekonstruksi (bukan dump asli), ada kemungkinan meleset di
-- detail kecil (constraint, default value persis, atau kolom yang
-- memang tidak pernah dipakai lagi oleh kode aktif). Yang paling tidak
-- pasti: **kt_panitia_sinoman** — tidak direferensikan sama sekali oleh
-- kode JS aktif saat ini (kemungkinan fitur "Generator Panitia/Sinoman"
-- sudah tidak dipakai/dihapus dari UI), jadi strukturnya di bawah cuma
-- tebakan minimal supaya migrasi sql/06 (yang meng-ALTER tabel ini)
-- tidak gagal karena tabelnya tidak ada.
--
-- Kalau kamu MASIH punya akses ke project Supabase lama, jauh lebih
-- aman untuk export skema asli dari sana (Dashboard lama → Database →
-- Backups, atau `pg_dump --schema-only`) daripada memakai file ini.
-- Jalankan file ini HANYA kalau project lama sudah benar-benar tidak
-- bisa diakses lagi.
--
-- Aman dijalankan berkali-kali (semua pakai `if not exists`).
-- Jalankan file ini PALING PERTAMA, sebelum sql/01-rls-setup.sql dst.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- kt_events — daftar event/tahun kegiatan
-- ============================================================
create table if not exists kt_events (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  tahun text,
  created_at timestamptz default now()
);

-- ============================================================
-- kt_users — akun login (custom, bukan Supabase Auth)
-- passwordHash/allowed_sections/last_seen_at ditambahkan oleh sql/01 & sql/02
-- ============================================================
create table if not exists kt_users (
  id text primary key,
  name text,
  username text unique,
  password text,
  role text
);

-- ============================================================
-- kt_settings — pengaturan per event (tarif iuran, kategori toko, dst)
-- hadiah_budget & dokumen ditambahkan oleh sql/01 & sql/07
-- updated_at + trigger disiapkan di sini karena tidak ada migrasi lain
-- yang menanganinya (beda dari tabel-tabel di sql/13 yang sudah diurus).
-- ============================================================
create table if not exists kt_settings (
  event_id uuid primary key references kt_events(id) on delete cascade,
  tarif jsonb not null default '{"sekolah":0,"bekerja":0,"perantauan":0,"khusus":0}'::jsonb,
  kategori_toko jsonb not null default '{"customCategories":[],"keywords":{}}'::jsonb,
  kupon_jalan_santai jsonb not null default '{"harga":0,"stok":0}'::jsonb,
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

drop trigger if exists trg_set_updated_at on kt_settings;
create trigger trg_set_updated_at before update on kt_settings
  for each row execute function kt_set_updated_at();

-- ============================================================
-- kt_telegram_settings — 1 baris (id='main'), preferensi notifikasi Telegram
-- Kolom notifikasi_maksimal ditambahkan oleh sql/33.
-- bot_token ada di sini untuk kompatibilitas versi lama (sebelum hardening
-- memindahkannya jadi secret Cloudflare Worker — lihat sql/34 & src/worker.js).
-- ============================================================
create table if not exists kt_telegram_settings (
  id text primary key default 'main',
  bot_token text,
  chat_id text,
  enabled boolean not null default false,
  categories jsonb not null default '{}'::jsonb,
  quiet_hours jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

drop trigger if exists trg_set_updated_at on kt_telegram_settings;
create trigger trg_set_updated_at before update on kt_telegram_settings
  for each row execute function kt_set_updated_at();

insert into kt_telegram_settings (id) values ('main') on conflict (id) do nothing;

-- ============================================================
-- kt_anggota — data anggota/warga per event (iuran)
-- ============================================================
create table if not exists kt_anggota (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  nama text not null,
  kategori text,           -- 'sekolah' | 'bekerja' | 'perantauan' | 'khusus'
  rt text,
  gender text,
  nominal_wajib numeric default 0,
  status text default 'belum_lunas',   -- 'belum_lunas' | 'lunas'
  tanggal_bayar date
);

-- ============================================================
-- kt_donatur — donasi (uang/barang)
-- jenis/nama_barang/qty/satuan ditambahkan oleh sql/05, nota oleh sql/12
-- ============================================================
create table if not exists kt_donatur (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  nama_donatur text,
  jumlah numeric default 0,
  tanggal date
);

-- ============================================================
-- kt_transaksi_lain — donasi/transaksi lain-lain (mis. penjualan kupon)
-- kuponqty ditambahkan oleh sql/08, nota oleh sql/12
-- ============================================================
create table if not exists kt_transaksi_lain (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  jumlah numeric default 0,
  tanggal date,
  keterangan text
);

-- ============================================================
-- kt_operasional — biaya operasional
-- created_at/satuan/qty ditambahkan oleh sql/09, nota oleh sql/12
-- ============================================================
create table if not exists kt_operasional (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  keterangan text,
  jumlah numeric default 0,
  tanggal date
);

-- ============================================================
-- kt_jadwal — jadwal/agenda umum per event
-- kolom jam ditambahkan oleh sql/16
-- ============================================================
create table if not exists kt_jadwal (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  judul text not null,
  tanggal date,
  kategori text,
  deskripsi text,
  status text default 'aktif'
);

-- ============================================================
-- kt_lomba — data lomba 17-an
-- jadwal_id ditambahkan oleh sql/15, jam oleh sql/16,
-- koordinator_anggota_ids (multi) oleh sql/17
-- ============================================================
create table if not exists kt_lomba (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  nama text not null,
  kategori_peserta text,
  tanggal date,
  jumlah_anggota_regu integer default 1,
  hadiah_per_regu boolean default false,
  estimasi_peserta integer default 0,
  koordinator_anggota_id uuid references kt_anggota(id)
);

-- ============================================================
-- kt_lomba_kebutuhan — daftar kebutuhan/perlengkapan per lomba
-- ============================================================
create table if not exists kt_lomba_kebutuhan (
  id uuid primary key default gen_random_uuid(),
  lomba_id uuid references kt_lomba(id) on delete cascade,
  nama_item text not null,
  harga_estimasi numeric default 0,
  harga_realisasi numeric,
  qty numeric default 1
);

-- ============================================================
-- kt_daftar_belanja_perlengkapan — status belanja tiap kt_lomba_kebutuhan
-- ============================================================
create table if not exists kt_daftar_belanja_perlengkapan (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  kebutuhan_id uuid references kt_lomba_kebutuhan(id) on delete cascade,
  status text default 'belum_dibeli',
  tanggal_beli date,
  nominal_realisasi numeric
);

-- ============================================================
-- kt_hadiah_kategori — paket hadiah per kategori peserta + juara ke-berapa
-- `items` jsonb menyimpan daftar item hadiah (masing-masing item punya
-- `id`, `nama`, `harga_satuan`, `qty_dibeli`, dst — lihat js/10-lomba.js
-- & js/11-belanja.js), BUKAN kolom terpisah.
-- ============================================================
create table if not exists kt_hadiah_kategori (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  kategori_peserta text,
  juara_ke text,
  items jsonb not null default '[]'::jsonb
);

-- ============================================================
-- kt_lomba_hadiah — relasi lomba ke paket hadiah (kategori+juara)
-- ============================================================
create table if not exists kt_lomba_hadiah (
  id uuid primary key default gen_random_uuid(),
  lomba_id uuid references kt_lomba(id) on delete cascade,
  hadiah_kategori_id uuid references kt_hadiah_kategori(id) on delete cascade
);

-- ============================================================
-- kt_daftar_belanja_hadiah — status belanja tiap item di kt_hadiah_kategori.items
-- item_id (uuid, penanda item di dalam jsonb items) ditambahkan oleh sql/14;
-- snapshot harga (qty/harga_satuan/harga_eceran/isi_per_pack) oleh sql/22.
-- item_index (posisi lama, sebelum ada item_id) tetap disediakan untuk
-- kompatibilitas mundur.
-- ============================================================
create table if not exists kt_daftar_belanja_hadiah (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  hadiah_kategori_id uuid references kt_hadiah_kategori(id) on delete cascade,
  item_index integer,
  status text default 'belum_dibeli',
  tanggal_beli date
);

-- ============================================================
-- kt_hadiah_jalan_santai — daftar hadiah jalan santai
-- ============================================================
create table if not exists kt_hadiah_jalan_santai (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  nama_hadiah text not null,
  qty numeric default 1,
  harga_satuan numeric default 0
);

-- ============================================================
-- kt_daftar_belanja_jalan_santai — status belanja tiap kt_hadiah_jalan_santai
-- ============================================================
create table if not exists kt_daftar_belanja_jalan_santai (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  hadiah_jalan_id uuid references kt_hadiah_jalan_santai(id) on delete cascade,
  status text default 'belum_dibeli',
  tanggal_beli date,
  nominal_realisasi numeric
);

-- ============================================================
-- kt_panitia_sinoman — ⚠️ TIDAK dipakai kode JS aktif saat ini (kemungkinan
-- fitur lama/sudah dihapus dari UI). Struktur di bawah cuma tebakan minimal
-- supaya sql/06-panitia-empunya-hajat-migration.sql (yang meng-ALTER tabel
-- ini) tidak gagal karena tabel tidak ada. Kalau kamu tahu struktur aslinya
-- (mis. dari export project lama), ganti/lengkapi tabel ini secara manual.
-- ============================================================
create table if not exists kt_panitia_sinoman (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references kt_events(id) on delete cascade,
  nama text,
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- SELESAI. Lanjutkan ke sql/01-rls-setup.sql, lalu 02 s/d 39 berurutan
-- (lihat sql/README.md untuk urutan lengkap & alasannya).
-- ============================================================
