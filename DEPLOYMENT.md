# Panduan Deploy Merdeka dengan Akun Baru (dari Nol)

Dokumen ini merangkum **semua langkah** untuk deploy ulang aplikasi ini di akun Supabase + Cloudflare yang benar-benar baru. Ikuti berurutan — jangan dibalik, karena beberapa langkah bergantung pada langkah sebelumnya.

> ⚠️ **Gap penting (baca dulu):** repo ini aslinya **tidak menyertakan skema tabel dasar** (`kt_events`, `kt_anggota`, `kt_users`, `kt_settings`, `kt_lomba`, `kt_jadwal`, `kt_donatur`, `kt_panitia_sinoman`, `kt_transaksi_lain`, `kt_operasional`, `kt_daftar_belanja_hadiah`, `kt_telegram_settings`, dll) — lihat `sql/README.md`. Sudah dibuatkan **rekonstruksi**-nya di `sql/00-skema-dasar.sql` (hasil telusur dari kode aplikasi, bukan dump asli — ada 1 tabel yang strukturnya cuma tebakan minimal, `kt_panitia_sinoman`, karena sudah tidak dipakai kode aktif). Kalau kamu **masih punya akses ke project Supabase lama**, lebih aman export skema asli dari sana (Dashboard lama → Database → Backups, atau `pg_dump --schema-only`) daripada memakai file rekonstruksi ini. Pakai `00-skema-dasar.sql` hanya kalau project lama sudah benar-benar tidak bisa diakses.

---

## Prasyarat

- Akun **Supabase** baru (project baru)
- Akun **Cloudflare** dengan akses Workers
- Akun **Google AI Studio** (untuk `GEMINI_API_KEY` di https://aistudio.google.com/apikey)
- Node.js + npm terpasang lokal (untuk build)
- (Opsional) Bot Telegram + token, kalau fitur notifikasi Telegram dipakai
- `supabase` CLI dan `wrangler` CLI terpasang (`npm install -g supabase wrangler` atau pakai `npx`)

---

## Langkah 1 — Siapkan skema dasar di project Supabase baru

Pilih salah satu:
- **Sudah ada project Supabase lama yang bisa diakses:** export skema dari sana (Database → Backups, atau `pg_dump --schema-only`), import ke project baru.
- **Tidak ada akses ke project lama:** jalankan `sql/00-skema-dasar.sql` di SQL Editor project baru (Dashboard → SQL Editor → New query → tempel isi file → Run). File ini rekonstruksi tabel dasar, aman dijalankan berkali-kali. Baca catatan caveat di bagian atas file tsb, terutama soal `kt_panitia_sinoman`.

---

## Langkah 2 — Jalankan migrasi SQL 01–39 berurutan

Supabase Dashboard (project baru) → **SQL Editor** → New query → jalankan isi tiap file di `sql/` **satu per satu dari `01-rls-setup.sql` sampai `39-second-brain-migration.sql`**, sesuai urutan nomor filenya.

Catatan:
- Hampir semua file idempotent (`if not exists`/`if exists`), tapi urutan tetap penting karena ada dependensi antar file (dijelaskan lengkap di `sql/README.md`).
- File `02-add_last_seen_to_users.sql` boleh dilewati kalau `01` yang dijalankan sudah versi terbaru (sudah include `last_seen_at`) — aman dijalankan juga karena idempotent.
- File `34-hardening-migration.sql` adalah overhaul keamanan besar (session RLS, bcrypt, rate limit login) — **wajib** dijalankan setelah tabel 18, 23, 24, 25, 27, 28, 29 ada (semua sudah terpenuhi kalau ikut urutan 01→39).
- Setelah `34`, verifikasi tidak ada lagi policy tulis yang terbuka:
  ```sql
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public' and qual = 'true' and cmd <> 'SELECT';
  ```
- File 39 mengaktifkan pgvector untuk fitur Second Brain/Asisten AI — pastikan extension `vector` bisa diaktifkan di project (biasanya otomatis tersedia di Supabase).

---

## Langkah 3 — Update konfigurasi klien (`js/00-config.js`)

Ambil **Project URL** dan **anon public key** dari Supabase Dashboard (project baru) → Project Settings → API, lalu ganti di `js/00-config.js`:

```js
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

⚠️ **Jangan lupa juga update CSP di file `_headers`** — baris `connect-src` di sana masih hardcode domain Supabase lama:
```
connect-src 'self' https://tykahltxzlpctfqdylno.supabase.co;
```
Ganti `tykahltxzlpctfqdylno.supabase.co` dengan domain project Supabase baru. Kalau tidak diganti, semua request ke Supabase akan diblokir browser (CSP violation) meski `00-config.js` sudah benar.

---

## Langkah 4 — Deploy Supabase Edge Functions (fitur AI)

Sudah didokumentasikan detail di `EDGE_FUNCTIONS.md`. Ringkasnya:

```bash
supabase login
supabase link --project-ref <ref-project-baru>

supabase functions deploy ai-generate
supabase functions deploy ai-embed
supabase secrets set GEMINI_API_KEY=xxxxx
# opsional, fallback kuota:
supabase secrets set GEMINI_API_KEY_2=yyyyy
supabase secrets set GEMINI_API_KEY_3=zzzzz
```

`SUPABASE_URL` & `SUPABASE_ANON_KEY` untuk Edge Function otomatis tersedia dari env runtime — tidak perlu di-set manual.

---

## Langkah 5 — Deploy Cloudflare Worker (assets + `/api/telegram`)

`wrangler.jsonc` mengatur Worker `src/worker.js` sebagai `main`, dengan static assets di root (`./`) dan routing SPA (`not_found_handling: single-page-application`).

1. Login wrangler:
   ```bash
   npx wrangler login
   ```
2. Set 3 secret (jangan pernah taruh langsung di `wrangler.jsonc`, supaya tidak ikut ter-commit):
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   ```
   `SUPABASE_URL`/`SUPABASE_ANON_KEY` di sini dipakai Worker untuk memverifikasi sesi login sebelum meneruskan ke Telegram — isi dengan project Supabase baru yang sama seperti Langkah 3.
3. Kalau nama project Cloudflare baru berbeda dari `"merdeka"`, update field `name` di `wrangler.jsonc`.
4. Deploy:
   ```bash
   npx wrangler deploy
   ```

---

## Langkah 6 — Build ulang bundle sebelum deploy/push

Tidak ada build otomatis di deploy — situs berjalan 100% sebagai file statis dari hasil build yang di-commit.

```bash
npm install
npm run build
```
Ini meregenerasi `js/app.bundle.min.js`, `style.min.css`, `icons/lucide-icons.local.min.js` dari source. Pastikan hasil build ini ikut di-commit/di-upload bersama perubahan `00-config.js` dan `_headers` di Langkah 3.

---

## Langkah 7 — Verifikasi akhir

- Buka situs, cek Network tab: tidak ada request Supabase yang gagal karena CSP atau 401.
- Coba login (RPC sesi custom) — pastikan `kt_sessions` & `rpc_session_user` (dari `sql/34`) berjalan.
- Coba fitur AI (Asisten AI/Second Brain) — pastikan `ai-generate`/`ai-embed` merespons (cek log via `supabase functions logs ai-generate`).
- Coba fitur notifikasi Telegram (kalau dipakai) — cek `/api/telegram` lewat Worker log (`npx wrangler tail`).

---

## Ringkasan urutan (checklist singkat)

1. ☐ Skema tabel dasar ada di project Supabase baru (export dari lama, atau jalankan `sql/00-skema-dasar.sql`)
2. ☐ Jalankan `sql/01` → `sql/39` berurutan
3. ☐ Update `js/00-config.js` (URL + anon key baru)
4. ☐ Update `connect-src` di `_headers` (domain Supabase baru)
5. ☐ Deploy `ai-generate` + `ai-embed`, set `GEMINI_API_KEY`
6. ☐ Set 3 secret wrangler (`TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`)
7. ☐ `npm run build` lalu deploy Worker (`npx wrangler deploy`) / push ke GitHub
8. ☐ Verifikasi login, fitur AI, dan Telegram di situs live
