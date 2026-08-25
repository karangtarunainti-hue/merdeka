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

## Arsitektur

### Diagram Komponen

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                             │
│  index.html                                                          │
│    ├─ vendor/supabase.js          (Supabase JS client, vendored)     │
│    ├─ icons/lucide-icons.local.min.js                                │
│    ├─ js/app.bundle.min.js  ◄── hasil build dari 33 file js/*.js     │
│    │     (script classic, TANPA ES modules — semua saling terhubung  │
│    │      lewat variabel/fungsi GLOBAL, urutan load = MODULE_ORDER)  │
│    └─ js/sw-register.js           (daftarkan sw.js)                  │
│                                                                        │
│  State di memori: object global `db` (js/03-db-core.js)              │
│  Session: token disimpan localStorage (`kt_session_token`),          │
│           dikirim ulang tiap request lewat header `x-session-token`  │
└───────────────┬───────────────────────────────────┬──────────────────┘
                │                                     │
                ▼                                     ▼
┌───────────────────────────────────┐   ┌──────────────────────────────┐
│  SUPABASE (Postgres + PostgREST)   │   │  CLOUDFLARE WORKER            │
│                                     │   │  (src/worker.js — "main" di   │
│  Auth: BUKAN Supabase Auth bawaan. │   │   wrangler.jsonc)              │
│  Login custom via RPC:             │   │                                │
│    rpc_login()      → cek user +   │   │  Alasan Worker ada: cabut bot  │
│      terbitkan session_token       │   │  token Telegram dari browser. │
│    rpc_session_user() → verifikasi │   │                                │
│      x-session-token tiap request  │   │  Route:                       │
│                                     │   │   /api/telegram → kirim pesan,│
│  Tabel via db.xxx + ARRAY_TABLE_MAP│   │     token disimpan sbg secret │
│  (RLS diterapkan per tabel, lihat  │   │     Cloudflare, verifikasi     │
│  supabase-rls-setup.sql &          │   │     sesi ke Supabase dulu,     │
│  supabase-hardening-migration.sql) │   │     rate-limited in-memory     │
│                                     │   │   /api/health → healthcheck   │
│  Tabel di luar pola db.xxx         │   │     public                     │
│  (fetch/tulis langsung):           │   │   (path lain) → diteruskan ke  │
│    kt_gudang_*      (Gudang)       │   │     static assets via          │
│    kt_second_brain  (Second Brain, │   │     env.ASSETS.fetch (mode      │
│      RLS: wajib login, beda dari   │   │     "assets" di wrangler.jsonc,│
│      kebanyakan tabel lain yg      │   │     not_found_handling:         │
│      guest boleh baca)             │   │     single-page-application)   │
│    kt_snapshot      (auto-backup)  │   └──────────────────────────────┘
│                                     │
│  Edge Functions (Deno/TS):         │
│    ai-generate → proxy teks ke     │
│      Gemini API, fallback multi-key│
│      (GEMINI_API_KEY/_2/_3),       │
│      verifikasi sesi manual via    │
│      rpc_session_user (BUKAN verify│
│      _jwt bawaan Supabase, karena  │
│      app tidak pakai Supabase Auth)│
│    ai-embed → proxy embedding 768d │
│      ke Gemini, auth/fallback sama │
│      persis dgn ai-generate        │
└───────────────────────────────────┘

Endpoint eksternal lain:
  api/emas.js → endpoint tambahan (harga emas, dsb — cek isi file untuk detail)
```

### Alur Data (Data Flow)

1. **Load awal**: `index.html` load `js/app.bundle.min.js` → `19-init.js` (modul terakhir di `MODULE_ORDER`) jalan paling akhir, inisialisasi app, load data dari Supabase ke object `db`.
2. **Baca data**: modul UI membaca langsung dari `db.xxx` (array in-memory), tidak query Supabase tiap render.
3. **Tulis data (pola normal)**: modul UI ubah `db.xxx` di memori → panggil `saveDB()` (`js/03-db-core.js`) → `saveDB()` loop tiap entry di `ARRAY_TABLE_MAP`, jalankan `syncArrayTable()` per tabel: diff array in-memory vs `_lastKnownIds` (baris yang terakhir diketahui tab ini) → upsert baris baru/berubah, delete baris yang hilang dari array **tapi cuma yang ID-nya pernah dikenal tab ini** (lihat catatan konflik di bawah).
4. **Tulis data (pola Gudang/Second Brain)**: modul fetch/insert/update/delete **langsung** ke tabel Supabase terkait, tidak lewat `db`/`saveDB()`. Lihat "Pengecualian Pola Data" di bawah.
5. **Auth**: bukan Supabase Auth. Login custom (`js/02-auth.js`) panggil RPC `rpc_login()` → dapat `session_token` → disimpan di localStorage key `kt_session_token` → dikirim ulang di header `x-session-token` pada request berikutnya yang perlu verifikasi (RLS policies & Edge Functions cek token ini lewat `rpc_session_user()`).
6. **Notifikasi Telegram**: klien POST ke `/api/telegram` (Cloudflare Worker) → Worker verifikasi sesi ke Supabase → cek rate limit in-memory per isolate → teruskan ke Telegram Bot API dengan token yang disimpan sebagai Cloudflare secret (token **tidak pernah** sampai ke browser).
7. **AI (teks)**: klien panggil `AI.tanya(prompt, {system})` (`js/26-ai.js`) → `sb.functions.invoke('ai-generate', ...)` → Edge Function verifikasi sesi via `rpc_session_user` → panggil Gemini (coba `GEMINI_API_KEY` utama, fallback ke `_2`/`_3` hanya kalau gagal karena kuota/503) → balikin teks.
8. **AI (embedding + semantic search)**: `AI.embed()` → Edge Function `ai-embed` → vector 768 dimensi → disimpan di kolom `embedding` tabel `kt_second_brain` (pgvector) → dicari via RPC `kt_second_brain_search` (cosine similarity). Dipakai fitur Second Brain dan RAG di Asisten AI (`js/29-asisten-ai.js`): tiap pertanyaan user di-embed dulu, dicocokkan ke catatan tersimpan, hasilnya digabung ke prompt sebelum dikirim ke `ai-generate`.
9. **Backup otomatis**: `15b-snapshot.js` ambil snapshot `db` + data Gudang (lewat `fetchGudangBackupData()`) → simpan ke tabel `kt_snapshot` (retensi 10 baris terakhir), dipicu 1×/hari + tepat sebelum aksi berisiko (impor timpa-semua, restore snapshot lain).

### Prinsip Inti

- **Tanpa ES modules.** Semua file di `js/*.js` adalah script biasa yang saling terhubung lewat variabel/fungsi **global**. Urutan load di `index.html` harus identik dengan `MODULE_ORDER` di `build.js` — kalau tidak, `ReferenceError` karena modul yang butuh fungsi/variabel dari modul lain dimuat lebih dulu.
- **State management**: satu object global `db` (`js/03-db-core.js`, `defaultDB()`). Tiap array di `db` dipetakan ke satu tabel Supabase lewat `ARRAY_TABLE_MAP` (lihat tabel lengkap di bawah). `saveDB()` men-diff tiap tabel terhadap server (upsert + delete + deteksi konflik multi-device).
- **Pengecualian pola `db`**: modul **Gudang** (`17a`–`17c`) dan **Second Brain** (`30`) fetch/tulis **langsung** ke tabel Supabase masing-masing, di luar `db`/`saveDB()`. Konsekuensi: apa pun yang mengasumsikan "seluruh data app" = `JSON.stringify(db)` akan melewatkan keduanya kecuali ditangani eksplisit (lihat `fetchGudangBackupData()`/`restoreGudangFromPayload()` di `15b-snapshot.js`; Second Brain belum punya export/import sendiri di versi ini).
- **Data terikat event vs tidak**: sebagian besar tabel (anggota, donatur, lomba, belanja, dst.) terikat ke `event_id` aktif. Beberapa modul sengaja **lintas-event/tidak terikat event**: `agenda`, `kas`, `danaSosialAnggota`/`danaSosialBayar`, `bookmark`, Gudang, Second Brain — ini tetap tampil walau belum ada event 17-an yang aktif.
- **Build**: file source (`js/*.js`, `style.css`) di-bundle+minify lokal via `npm run build` (esbuild) menjadi `js/app.bundle.min.js`, `style.min.css`, `icons/lucide-icons.local.min.js`. **Kedua versi (source & hasil build) di-commit ke repo** — tidak ada build step di CI/CD atau saat deploy; situs 100% file statis di runtime.
- **Deploy**: Cloudflare Workers, mode "assets" + Worker tipis (`src/worker.js` sbg `main`), routing SPA (`not_found_handling: single-page-application`), semua path non-file balik ke `index.html`, routing internal ditangani `js/05-navigation.js`.
- **AI**: dua Supabase Edge Function generik (`ai-generate` untuk teks, `ai-embed` untuk embedding), proxy ke Gemini dengan fallback multi-key. Sengaja generik (teks-masuk/teks-keluar atau vector-keluar) — fitur baru tinggal panggil `AI.tanya()`/`AI.embed()` tanpa ubah Edge Function, selama masih pola itu.
- **Backup**: 3 jalur berbeda cakupan & semantik (snapshot otomatis harian, backup manual "timpa semua", backup per-modul "tambah") — lihat `CLAUDE.md` untuk detail penuh, ini area yang gampang salah asumsi.
- **Service worker** (`sw.js`): hati-hati cache-busting saat ubah file yang di-cache — ada riwayat bug deadlock `ERR_FAILED` di Cloudflare Workers.

### Peta Tabel Data Utama (`db.xxx` → tabel Supabase, via `ARRAY_TABLE_MAP`)

| Array `db.xxx` | Tabel Supabase | Catatan |
|---|---|---|
| `events` | `kt_events` | Daftar event/kegiatan |
| `anggota` | `kt_anggota` | Anggota + iuran per event |
| `donatur` | `kt_donatur` | Donatur & donasi barang |
| `transaksiLain` | `kt_transaksi_lain` | Transaksi kas utama |
| `operasional` | `kt_operasional` | Biaya operasional |
| `lomba` | `kt_lomba` | Data lomba |
| `lombaKebutuhan` | `kt_lomba_kebutuhan` | Kebutuhan per lomba |
| `lombaArsip` | `kt_lomba_arsip` | Arsip beku lomba yang sudah dihapus (snapshot permanen) |
| `hadiahKategori` | `kt_hadiah_kategori` | Kategori hadiah |
| `lombaHadiah` | `kt_lomba_hadiah` | Hadiah per lomba |
| `daftarBelanjaHadiah` | `kt_daftar_belanja_hadiah` | Belanja hadiah |
| `daftarBelanjaPerlengkapan` | `kt_daftar_belanja_perlengkapan` | Belanja perlengkapan |
| `hadiahJalanSantai` | `kt_hadiah_jalan_santai` | Hadiah jalan santai |
| `daftarBelanjaJalanSantai` | `kt_daftar_belanja_jalan_santai` | Belanja jalan santai |
| `jadwal` | `kt_jadwal` | Jadwal per event |
| `agenda` | `kt_agenda` | Agenda umum — **tidak terikat event** |
| `kas` | `kt_kas` | Kas Karang Taruna — **tidak terikat event**, saldo dihitung runtime (running balance), tidak disimpan di DB |
| `danaSosialAnggota` | `kt_dana_sosial_anggota` | Master anggota Dana Sosial — **tidak terikat event**, terpisah dari `anggota` |
| `danaSosialBayar` | `kt_dana_sosial_bayar` | Pembayaran iuran Dana Sosial |
| `bookmark` | `kt_bookmark` | Tautan penting organisasi — **tidak terikat event** |

**Di luar `ARRAY_TABLE_MAP` (akses langsung, bukan lewat `db`):**

| Tabel | Modul | Catatan |
|---|---|---|
| `kt_gudang_*` | `js/17a-17c-gudang-*.js` | Stok, pinjam, histori. Restore lewat RPC atomik `kt_gudang_restore_snapshot` |
| `kt_second_brain` | `js/30-second-brain.js` | Catatan/ide bebas + `embedding` (pgvector). RLS wajib login |
| `kt_snapshot` | `js/15b-snapshot.js` | Backup otomatis harian, retensi 10 baris |
| `kt_organisasi_profil` | `js/03-db-core.js` (`getOrgProfil()`) | Profil organisasi dinamis (nama, logo, nama kas) |
| `kt_users` | `js/06-login-users.js`, `js/02-auth.js` | User login + `last_seen_at` |

### Peta Modul JS (urutan load = `MODULE_ORDER` di `build.js`, sumber kebenaran)

| # | File | Area |
|---|------|------|
| 00 | `00-config.js` | Konfigurasi global (`SUPABASE_URL`, `ANON_KEY`) |
| 01 | `01-utils-currency.js` | Util umum & format mata uang/tanggal |
| 02 | `02-auth.js` | Autentikasi custom (bukan Supabase Auth), session token |
| 03 | `03-db-core.js` | `db` global, `ARRAY_TABLE_MAP`, `saveDB()`/`syncArrayTable()`, profil organisasi |
| 04 | `04-event-settings.js` | Pengaturan event, kategori & jam tenang notifikasi Telegram |
| 05 | `05-navigation.js` | Routing SPA |
| 06 | `06-login-users.js` | Manajemen user login |
| 07 | `07-dashboard.js` | Dashboard |
| 08 | `08-anggota.js` | Data anggota |
| 09 | `09-donatur-transaksi-operasional.js` | Donatur & transaksi operasional |
| 10, 10b | `10-lomba.js`, `10b-database-lomba.js` | Modul lomba + database lomba (arsip) |
| 11 | `11-belanja.js` | Belanja hadiah/kebutuhan |
| 12 | `12-jadwal-agenda-kas.js` | Jadwal, agenda, kas |
| 13 | `13-lpj.js` | Laporan pertanggungjawaban |
| 14 | `14-dokumen.js` | Generator dokumen (WYSIWYG + export JPEG via html2canvas, lazy-loaded) |
| 15, 15b | `15-pengaturan-event.js`, `15b-snapshot.js` | Pengaturan lanjutan, export/import & snapshot |
| 16, 16b | `16-ui-helpers.js`, `16b-event-delegation.js` | Helper UI bersama, sistem `data-action` (event delegation, ganti `onclick` inline) |
| 17a–17c | `gudang-core.js`, `gudang-pinjam.js`, `gudang-histori-kelola.js` | Modul Gudang (stok, pinjam, histori) — pola data terpisah |
| 18 | `18-getters-refresh.js` | Getter data & refresh state |
| 26 | `26-ai.js` | Client AI generik — `AI.tanya()`, `AI.embed()` |
| 27 | `27-ai-insight.js` | Insight berbasis AI |
| 24 | `24-bookmark.js` | Tautan penting |
| 22 | `22-dana-sosial.js` | Dana sosial (iuran bulanan) |
| 20 | `20-panduan.js` | Panduan penggunaan |
| 21 | `21-icons-lucide.js` | Auto-replace ikon emoji → Lucide (MutationObserver) |
| 23 | `23-install-prompt.js` | Prompt install PWA |
| 30 | `30-second-brain.js` | Second Brain — catatan bebas + semantic search |
| 29 | `29-asisten-ai.js` | Asisten AI (chat mengambang) — RAG pakai Second Brain |
| 19 | `19-init.js` | Inisialisasi aplikasi (**load terakhir**) |

> Catatan: urutan di atas adalah urutan **load/eksekusi** (sesuai `MODULE_ORDER`), bukan urutan numerik nama file — mis. `26`, `27`, `24`, `22`, `20` dst. dimuat sebelum `19-init.js` yang justru harus paling akhir.

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
