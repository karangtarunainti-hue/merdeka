# Urutan Deploy Migrasi SQL

Semua migrasi SQL project ini sekarang ada di satu folder ini (`sql/`), diberi
prefix angka 2 digit sesuai **urutan deploy yang aman** — kalau kamu setup
project Supabase baru dari nol, jalankan file-file ini **berurutan dari 01
sampai 39** di Supabase Dashboard → SQL Editor.

Hampir semua file idempotent (aman dijalankan berkali-kali, pakai
`if not exists` / `if exists`), tapi urutannya tetap penting karena beberapa
file punya dependensi nyata ke tabel/kolom yang dibuat file lain (foreign key,
migrasi data antar tabel, atau daftar tabel hardcoded yang diproses satu per
satu). Urutan di bawah disusun dengan menelusuri dependensi tsb satu per satu.

> **Catatan penting:** repo ini **tidak** menyertakan migrasi skema paling
> awal (pembuatan tabel dasar seperti `kt_events`, `kt_anggota`, `kt_settings`,
> `kt_lomba`, `kt_jadwal`, `kt_users`, dst). Tabel-tabel itu diasumsikan sudah
> ada di project Supabase (dibuat manual lewat Table Editor jauh sebelum
> migrasi bernomor ini ada). File 01–39 di bawah adalah patch/fitur yang
> ditumpuk di atas skema dasar tsb.

| # | File | Alasan urutan |
|---|------|---------------|
| 01 | `01-rls-setup.sql` | Setup RLS + login custom (`kt_users`, RPC login) — pondasi keamanan yang dibutuhkan sejak awal. Sudah mencakup kolom `last_seen_at` di versi terbaru ini. |
| 02 | `02-add_last_seen_to_users.sql` | Patch lama untuk project yang sudah pernah jalankan versi **lama** dari file 01 (sebelum `last_seen_at` digabung ke sana). Kalau kamu setup baru dari file 01 versi ini, file 02 **tidak perlu dijalankan lagi** (sudah termasuk) — aman dilewati, atau dijalankan saja karena idempotent. |
| 03 | `03-events-fitur-migration.sql` | Kolom `fitur` di `kt_events`. |
| 04 | `04-warna-tema-migration.sql` | Kolom `warna_tema` di `kt_events` — komentar filenya sendiri bilang "sama seperti kasus kolom fitur sebelumnya" → setelah file 03. |
| 05 | `05-donatur-barang-migration.sql` | Kolom donasi barang di `kt_donatur` (tabel dasar). |
| 06 | `06-panitia-empunya-hajat-migration.sql` | Kolom di `kt_panitia_sinoman` (tabel dasar). |
| 07 | `07-dokumen-migration.sql` | Kolom `dokumen` (jsonb per-event) di `kt_settings` — kelak digantikan pola global di file 25. |
| 08 | `08-kupon-stok-migration.sql` | Kolom `kuponqty` di `kt_transaksi_lain` (tabel dasar). |
| 09 | `09-operasional-created-at-migration.sql` | Kolom `created_at`/`satuan`/`qty` di `kt_operasional` (tabel dasar). |
| 10 | `10-agenda-migration.sql` | **Membuat tabel `kt_agenda`.** Wajib sebelum file 13 & 15 yang bergantung padanya. |
| 11 | `11-kas-migration.sql` | **Membuat tabel `kt_kas`.** Wajib sebelum file 12, 13, 22 yang bergantung padanya. |
| 12 | `12-nota-transaksi-migration.sql` | Kolom `nota` di `kt_kas` (butuh file 11) + `kt_transaksi_lain`/`kt_operasional`. |
| 13 | `13-conflict-detection-migration.sql` | Trigger `updated_at` untuk 16 tabel termasuk `kt_agenda` (file 10) & `kt_kas` (file 11) — **wajib** setelah keduanya dibuat. |
| 14 | `14-daftar-belanja-hadiah-item-id-migration.sql` | Kolom `item_id` di `kt_daftar_belanja_hadiah` (tabel dasar). |
| 15 | `15-lomba-jadwal-migration.sql` | Memindahkan data **dari** `kt_agenda` (file 10) ke `kt_jadwal` — wajib setelah file 10 ada. |
| 16 | `16-lomba-jadwal-jam-migration.sql` | Lanjutan tema jadwal lomba (kolom `jam`) — setelah file 15. |
| 17 | `17-lomba-koordinator-multi-migration.sql` | Kolom koordinator multi di `kt_lomba` — independen, dikelompokkan di sini. |
| 18 | `18-dana-sosial-migration.sql` | **Membuat tabel `kt_dana_sosial_anggota` & `kt_dana_sosial_bayar`.** Wajib sebelum file 19–22 & 34. |
| 19 | `19-dana-sosial-perantauan-migration.sql` | Butuh file 18. |
| 20 | `20-dana-sosial-audit-migration.sql` | Butuh file 18 (nambah kolom di `kt_dana_sosial_bayar`). |
| 21 | `21-dana-sosial-hapus-perantauan-migration.sql` | Menghapus fitur yang ditambahkan file 19 — wajib setelahnya. |
| 22 | `22-financial-integrity-fix-migration.sql` | Butuh `kt_kas` (file 11) & `kt_dana_sosial_anggota` (file 18). |
| 23 | `23-bookmark-migration.sql` | **Membuat tabel `kt_bookmark`** — wajib sebelum file 34 (hardening). |
| 24 | `24-organisasi-profil-migration.sql` | **Membuat tabel `kt_organisasi_profil`** — wajib sebelum file 34. |
| 25 | `25-dokumen-global-migration.sql` | **Membuat tabel `kt_dokumen_global`**, menggantikan pola per-event dari file 07 — wajib sebelum file 34. |
| 26 | `26-error-log-migration.sql` | **Membuat tabel `kt_error_log`** — sebaiknya sebelum file 34 (yang mengatur RLS-nya). |
| 27 | `27-lomba-arsip-migration.sql` | **Membuat tabel `kt_lomba_arsip`** — wajib sebelum file 34. |
| 28 | `28-snapshot-migration.sql` | **Membuat tabel `kt_snapshot`** — wajib sebelum file 34. |
| 29 | `29-gudang-migration.sql` | **Membuat tabel-tabel `kt_gudang_*` dasar** — wajib sebelum file 30, 31, 32, 34. |
| 30 | `30-gudang-race-fix-migration.sql` | Butuh file 29. |
| 31 | `31-gudang-import-atomic-migration.sql` | Butuh file 29. |
| 32 | `32-gudang-atomic-fix-migration.sql` | Butuh file 29 (dan best-effort setelah 30/31 sebagai penyempurnaan lanjutan). |
| 33 | `33-telegram-notifikasi-maksimal-migration.sql` | Kolom di `kt_telegram_settings` — independen, ditaruh sebelum hardening karena menyentuh tabel yang sama. |
| 34 | `34-hardening-migration.sql` | **Overhaul keamanan besar** (session RLS, bcrypt, rate limit login). Daftar tabel hardcoded di file ini mencakup `kt_dana_sosial_*`(18), `kt_bookmark`(23), `kt_organisasi_profil`(24), `kt_dokumen_global`(25), `kt_lomba_arsip`(27), `kt_snapshot`(28), `kt_gudang_inventory`/`kt_gudang_transactions`(29) — jadi **wajib** dijalankan setelah semuanya. Sebaliknya, tabel-tabel AI insight & Second Brain (35–39) TIDAK ada di daftar ini, artinya file hardening ini ditulis **sebelum** fitur-fitur itu ada. |
| 35 | `35-ai-insight-migration.sql` | **Membuat tabel `kt_ai_insight`** (Dashboard) — versi rujukan pertama, disebut sebagai pola dasar oleh file 36 & 37. |
| 36 | `36-ai-insight-lomba-migration.sql` | Struktur sama seperti file 35 (disebut eksplisit di komentarnya). |
| 37 | `37-ai-insight-belanja-hadiah-migration.sql` | Struktur sama seperti file 35 (disebut eksplisit di komentarnya). |
| 38 | `38-kalender-peringatan-migration.sql` | Komentarnya membandingkan diri secara eksplisit dengan file 35/36/37 sebagai pola yang sudah ada — jadi setelah ketiganya. |
| 39 | `39-second-brain-migration.sql` | Fitur paling baru (pgvector, RAG Asisten AI) — modul JS-nya (`29-asisten-ai.js`, `30-second-brain.js`) juga bernomor paling akhir di `MODULE_ORDER` (lihat README utama). |

## Catatan: file `fix_server_side_updated_at.sql` sudah dihapus

File ini dulu ada di folder `sql/` lama, tapi ternyata menyebut tabel
`transactions`, `settings`, `payment_reminders` — bukan tabel `kt_*` yang
dipakai skema Merdeka. Setelah ditelusuri, ini ternyata peninggalan dari
project lain ("SinarKeu") yang tidak sengaja ikut ter-bundle, sama seperti
`api/emas.js` dan `SECURITY_AUDIT.md` yang juga sudah dihapus dari repo ini
(lihat `AUDIT-STANDAR-SAAS.md` §4 & §5, dan `DEPLOY-HARDENING.md`). Tidak ada
kode di project ini yang memakai tabel-tabel generik tsb — semua migrasi lain
konsisten memakai prefix `kt_`.

## Kalau kamu sudah pernah menjalankan sebagian file secara manual sebelumnya

Semua file ini (kecuali catatan file 40 di atas) ditulis idempotent
(`if not exists` / `if exists` / `create or replace`), jadi aman dijalankan
ulang dari 01 meski sebagian sudah pernah kamu jalankan lewat nama file
lamanya. Tidak akan menimpa data yang sudah ada.
