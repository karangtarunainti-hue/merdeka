# Merdeka — Event & Finance Management App

PWA untuk manajemen event dan keuangan **Karang Taruna Inti** (rebrand umum: **Baleasri Event**). Situs statis murni — HTML/CSS/JS tanpa framework — dideploy ke **Cloudflare Workers (assets)** dengan backend **Supabase**.

> 📌 Dokumen ini adalah gambaran arsitektur untuk siapa pun (manusia atau AI) yang mulai kerja di repo ini. Untuk aturan kerja detail level kode (pola global, konvensi penamaan, gotcha spesifik modul), baca **`CLAUDE.md`** — dokumen ini melengkapi, bukan menggantikan.

---

## Cara Kerja Repo Ini (Penting — Baca Dulu)

Pemilik project (**Inti**) mengelola repo ini **lewat GitHub Web UI, bukan Git CLI/terminal**. Ritme kerjanya:

1. Download repo sebagai **ZIP** dari GitHub (`Code → Download ZIP`).
2. Upload ZIP itu ke Claude (claude.ai).
3. Claude membaca, memperbaiki, atau menambah fitur di dalamnya.
4. Claude **mengirim balik hanya file yang berubah** (bukan ZIP ulang seluruh repo).
5. Inti upload file-file itu satu per satu lewat GitHub Web UI (drag & drop ke path yang sesuai, replace file lama) — **sekali upload beres**, tanpa perlu bongkar-pasang struktur folder dari ZIP penuh.

**Konsekuensi praktis untuk siapa pun (termasuk Claude di sesi berikutnya) yang mengerjakan repo ini:**

- **Jangan** kirim ulang ZIP penuh sebagai output kalau perubahan cuma menyentuh beberapa file — ini bikin Inti harus bongkar ZIP dan mencocokkan struktur folder manual, boros waktu.
- **Selalu** sebutkan dengan jelas **path lengkap** tiap file yang diberikan (mis. `js/17a-gudang-core.js`, bukan cuma `gudang-core.js`), supaya Inti tahu persis ke mana file itu di-upload di GitHub UI.
- Kalau perubahan menyentuh file `js/*.js` atau `style.css` → **wajib** ikut sertakan hasil build-nya juga (`js/app.bundle.min.js` dan/atau `style.min.css`), karena **tidak ada proses build otomatis di deploy** (lihat bagian Build & Deploy di bawah). Inti tidak menjalankan `npm run build` sendiri lewat CLI.
- Kalau ada file baru yang perlu dibuat (migrasi SQL baru, misalnya), sebutkan juga **apakah itu perlu dijalankan manual di Supabase SQL Editor** — Inti tidak pakai Supabase CLI.
- Ringkas daftar "file yang berubah" di akhir respons dalam bentuk list path, supaya gampang dicek satu-satu sebelum upload.

---

## Arsitektur Singkat

```
Browser (index.html + js/*.js global scripts)
        │
        ├── Supabase (Postgres + RLS + Edge Functions)
        │     ├── Tabel data utama (lewat db.xxx + ARRAY_TABLE_MAP)
        │     ├── Tabel Gudang (kt_gudang_*) — akses langsung, di luar db.xxx
        │     ├── Tabel Second Brain (kt_second_brain) — akses langsung, pgvector
        │     ├── Edge Function ai-generate  → proxy ke Gemini API (teks)
        │     └── Edge Function ai-embed     → proxy ke Gemini API (embedding)
        │
        └── Cloudflare Worker (src/worker.js)
              ├── /api/telegram  → kirim notifikasi, pegang bot token sbg secret
              ├── /api/health
              └── path lain      → diteruskan ke static assets (env.ASSETS.fetch)
```

**Prinsip inti:**

- **Tanpa ES modules.** Semua file di `js/*.js` adalah script biasa yang saling terhubung lewat variabel/fungsi **global**. Urutan load di `index.html` harus identik dengan `MODULE_ORDER` di `build.js`.
- **State management**: satu object global `db` (`js/03-db-core.js`, `defaultDB()`). Tiap array di `db` dipetakan ke satu tabel Supabase lewat `ARRAY_TABLE_MAP`. `saveDB()` men-diff tiap tabel terhadap server (upsert + delete + deteksi konflik multi-device).
- **Pengecualian pola `db`**: modul **Gudang** (`17a`–`17c`) dan **Second Brain** (`30`) fetch/tulis **langsung** ke tabel Supabase masing-masing, di luar `db`/`saveDB()`. Konsekuensi: apa pun yang mengasumsikan "seluruh data app" = `JSON.stringify(db)` akan melewatkan keduanya kecuali ditangani eksplisit (lihat detail di `CLAUDE.md`).
- **Build**: file source (`js/*.js`, `style.css`) di-bundle+minify lokal via `npm run build` (esbuild) menjadi `js/app.bundle.min.js`, `style.min.css`, `icons/lucide-icons.local.min.js`. **Kedua versi (source & hasil build) di-commit ke repo** — tidak ada build step di CI/CD atau saat deploy.
- **Deploy**: Cloudflare Workers (assets mode), routing SPA (`not_found_handling: single-page-application`), semua path non-file balik ke `index.html`.
- **AI**: dua Supabase Edge Function generik (`ai-generate` untuk teks, `ai-embed` untuk embedding 768 dimensi), proxy ke Gemini dengan fallback multi-key. Klien panggil lewat `AI.tanya()` / `AI.embed()` (`js/26-ai.js`).
- **Backup**: 3 jalur berbeda cakupan & semantik (snapshot otomatis harian, backup manual "timpa semua", backup per-modul "tambah") — lihat `CLAUDE.md` untuk detail penuh, ini area yang gampang salah asumsi.

## Struktur Folder

| Path | Isi |
|---|---|
| `index.html` | Entry point, urutan load modul JS kritis (harus sinkron dengan `build.js`) |
| `js/00-config.js` … `js/30-second-brain.js` | Source 30+ modul JS, bahasa Indonesia untuk domain bisnis |
| `js/app.bundle.min.js` | Hasil build (JANGAN edit manual) |
| `style.css` / `style.min.css` | Styling — tema "Corporate Formal" hijau, font Sora + JetBrains Mono |
| `icons/` | Lucide icon system lokal |
| `build.js` | Script esbuild, sumber kebenaran urutan modul (`MODULE_ORDER`) |
| `src/worker.js` | Cloudflare Worker tipis — `/api/telegram`, `/api/health`, passthrough assets |
| `api/emas.js` | Endpoint tambahan |
| `supabase/functions/ai-generate/` | Edge Function proxy Gemini (teks) |
| `supabase/functions/ai-embed/` | Edge Function proxy Gemini (embedding) |
| `supabase-*-migration.sql` (root) | Migrasi skema, dijalankan manual di Supabase SQL Editor, urut sesuai nama/tanggal |
| `sql/` | Migrasi/patch tambahan lain |
| `sw.js`, `sw-register.js` | Service worker (hati-hati cache-busting) |
| `wrangler.jsonc` | Konfigurasi deploy Cloudflare Workers |
| `manifest.json`, `icons/`, `favicon.ico` | Konfigurasi PWA |
| `_headers` | Header custom (CSP dkk) untuk Cloudflare |
| `tests/` | Test harness (Node.js built-ins) |
| `.github/workflows/` | GitHub Actions — saat ini cuma `keep-supabase-alive.yml` (cron ping supaya project Supabase tidak auto-pause) |
| `CLAUDE.md` | **Dokumen aturan kerja paling detail** — pola data, gotcha, konvensi kode |
| `ONBOARDING-MERDEKA.md` | Ringkasan onboarding versi singkat |
| `CATATAN-MERGER-GUDANG.md`, `SECURITY_AUDIT.md`, `AUDIT-STANDAR-SAAS.md`, `REFACTOR-EVENT-DELEGATION.md`, `DEPLOY-HARDENING.md` | Catatan historis per-topik, baca sebelum menyentuh area terkait |

## Build & Deploy

```bash
npm install        # sekali saja
npm run build       # regenerate app.bundle.min.js, style.min.css, lucide-icons.local.min.js
```

- Wajib dijalankan **setiap kali** ada perubahan di `js/*.js` atau `style.css`, **sebelum** file diupload ke GitHub.
- Karena Inti tidak pakai CLI, **langkah build ini dilakukan oleh Claude** saat menyiapkan file yang akan dikirim — bukan tugas Inti.
- Tidak ada dev server atau test runner otomatis; testing dilakukan manual di browser setelah deploy.
- Migrasi SQL **tidak otomatis** — tiap file `supabase-*-migration.sql` baru harus dijalankan manual oleh Inti di Supabase Dashboard → SQL Editor.

## Dokumen Rujukan Lain

- **`CLAUDE.md`** — bacaan wajib sebelum mengubah kode: pola sinkronisasi data, pengecualian Gudang/Second Brain, sistem backup/restore, setup AI Edge Functions, konvensi kode, dan daftar keterbatasan yang sudah diketahui (known limitations).
- **`SECURITY_AUDIT.md`** — catatan keamanan, termasuk isu RLS yang belum sepenuhnya tertutup.
- **`CATATAN-MERGER-GUDANG.md`** — histori kenapa modul Gudang punya pola data terpisah.
