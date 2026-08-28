# Onboarding Merdeka — Karang Taruna Inti

**Tipe project:** PWA Event Management  
**Stack:** HTML/CSS/Vanilla JS, Supabase backend, Cloudflare Workers assets  
**Entry point:** `index.html` → `js/app.bundle.min.js`  
**Build:** `npm run build` → `app.bundle.min.js`, `style.min.css`, `lucide-icons.local.min.js`

## Struktur Utama

- `/js/*.js` = source modular (30 file ekor)
- `js/app.bundle.min.js` = hasil build bundle semua modul
- `js/00-config.js` = SUPABASE_URL, ANON_KEY
- `index.html` = entry point, urutan modul kritis
- `style.css` / `style.min.css` = styling
- `build.js` = ESBuild bundler

## Workflow Development

```bash
cd <path-project-lokal>/merdeka-main
npm install        # sekali
npm run build      # tiap perubahan kode
```

## Konvensi & Gotcha

- Semua modul pakai pattern global (tidak ES modules)
- Urutan load di `index.html` = urutan di `MODULE_ORDER` di `build.js`
- Semua data utama → `db` global + `ARRAY_TABLE_MAP`
- **Gudang (modul 17a-17c)** pakai fetch langsung ke tabel `kt_gudang_*` — tidak ikut backup otomatis kecuali di-handle khusus

## Keamanan (Catatan penting)

- RLS berbasis sesi (bukan lagi `anon_full_access` terbuka) sejak `sql/34-hardening-migration.sql` — login custom (bcrypt) + rate limit + `kt_sessions`. Detail lengkap di `DEPLOY-HARDENING.md` & `AUDIT-STANDAR-SAAS.md`.
- Bot token Telegram sudah dipindah jadi secret Cloudflare Worker (`src/worker.js`), bukan lagi disimpan di database — lihat `EDGE_FUNCTIONS.md`/`DEPLOYMENT.md` Langkah 5.
- CSP dipasang lewat file `_headers` root — domain Supabase di `connect-src` harus disesuaikan tiap ganti project (lihat `DEPLOYMENT.md` Langkah 3).

## Backup & Restore

- Snapshot otomatis: tabel `kt_snapshot` (1x/hari, retensi 10)
- Backup manual: `exportData()` → file JSON, `importData()` → timpa semua
- Gudang punya backup khusus: `gudangExportJSON()`/`gudangImportJSON()`

## File Utama yang Perlu Diingat

| File | Fungsi |
|------|--------|
| `js/00-config.js` | Konfigurasi Supabase |
| `js/03-db-core.js` | Wrapper akses DB, syncArrayTable |
| `js/17a-gudang-core.js` etc | Modul Gudang (eksklusi db global) |
| `js/05-navigation.js` | Routing SPA |
| `sw-register.js` | Service Worker |

## Deployment

- Dideploy ke **Cloudflare Workers** (assets folder + `_headers`)
- Tahap: `npm run build` → verifikasi bundle → push ke GitHub

---
*Buat: Agent Hermes — 2026-08-28*