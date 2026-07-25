# CLAUDE.md

Panduan untuk Claude Code (atau Claude di alat lain) saat bekerja di repo ini.

## Ringkasan Proyek

**Merdeka** — PWA event management untuk Karang Taruna Inti. Situs statis
murni (HTML/CSS/JS, tanpa framework, tanpa proses build saat deploy),
dideploy ke **Cloudflare Workers (assets)** dengan backend **Supabase**.

## Arsitektur

- **Tanpa ES modules** — semua modul di `js/*.js` adalah script biasa yang
  saling bergantung lewat variabel/fungsi **global**. Urutan load di
  `index.html` HARUS sama persis dengan `MODULE_ORDER` di `build.js`.
- **File yang di-deploy vs file source**:
  - Source: `js/00-config.js` ... `js/25-tour.js`, `style.css`,
    `icons/lucide-icons.local.js`
  - Hasil build (JANGAN diedit manual, hasil `npm run build`):
    `js/app.bundle.min.js`, `style.min.css`, `icons/lucide-icons.local.min.js`
  - Kedua versi (source & bundle) ikut di-commit — bundle di-generate lokal
    lalu di-commit seperti file biasa, bukan build step di CI/CD.
- **Routing**: SPA via `wrangler.jsonc` (`not_found_handling:
  single-page-application`) — semua path non-file balik ke `index.html`,
  routing internal ditangani JS (`05-navigation.js`).
- **Database**: Supabase. Setiap perubahan skema ada file migrasi SQL
  terpisah di root (`supabase-*-migration.sql`) atau di `sql/` — HARUS
  dijalankan manual di Supabase Dashboard, tidak otomatis.
- **Service worker**: `sw.js` — hati-hati dengan cache-busting saat ubah
  file yang di-cache (riwayat bug: deadlock `ERR_FAILED` di Cloudflare
  Workers).

## Perintah

```bash
npm install        # sekali saja (install esbuild)
npm run build       # regenerate app.bundle.min.js, style.min.css,
                     # lucide-icons.local.min.js dari source
```

Jalankan `npm run build` setiap selesai edit file di `js/*.js` atau
`style.css`, **sebelum** commit/push/deploy. Tidak ada dev server/test
runner — situs 100% statis, testing manual di browser.

## Modul JS (urutan load, lihat `build.js` untuk urutan otoritatif)

| # | File | Area |
|---|------|------|
| 00 | config.js | konfigurasi global |
| 01 | utils-currency.js | util umum & format mata uang |
| 02 | auth.js | autentikasi |
| 03 | db-core.js | wrapper akses Supabase |
| 04 | event-settings.js | pengaturan event |
| 05 | navigation.js | routing SPA |
| 06 | login-users.js | manajemen user login |
| 07 | dashboard.js | dashboard |
| 08 | anggota.js | data anggota |
| 09 | donatur-transaksi-operasional.js | donatur & transaksi operasional |
| 10, 10b | lomba.js, database-lomba.js | modul lomba |
| 11 | belanja.js | belanja hadiah/kebutuhan |
| 12 | jadwal-agenda-kas.js | jadwal, agenda, kas |
| 13 | lpj.js | laporan pertanggungjawaban |
| 14 | dokumen.js | generator dokumen (WYSIWYG + export JPEG via html2canvas) |
| 15, 15b | pengaturan-event.js, snapshot.js | pengaturan lanjutan & snapshot |
| 16 | ui-helpers.js | helper UI bersama |
| 17a-17c | gudang-*.js | modul gudang (stok, pinjam, histori) |
| 18 | getters-refresh.js | getter data & refresh state |
| 19 | init.js | inisialisasi aplikasi (load terakhir) |
| 20 | panduan.js | panduan penggunaan |
| 21 | icons-lucide.js | auto-replace ikon emoji → Lucide |
| 22 | dana-sosial.js | dana sosial (iuran bulanan) |
| 23 | install-prompt.js | prompt install PWA |
| 24 | bookmark.js | bookmark |
| 25 | tour.js | tur onboarding |

## Konvensi Kode

- Bahasa: **Bahasa Indonesia** untuk nama variabel/fungsi/komentar domain
  bisnis (mis. `hadiahPerRegu`, `kategoriToko`, `bukaModalKelolaKategoriToko`).
- Styling: tema "Corporate Formal" hijau, font Sora + JetBrains Mono.
  `--merah` sudah direpurpose jadi forest green; pakai `--bahaya` untuk
  warna danger/merah.
- Ikon: pakai Lucide (`icons/lucide-icons.local.js`), bukan emoji — ada
  MutationObserver di `21-icons-lucide.js` yang auto-replace emoji lama.
- Saat generate JSON dari user input (import/export, backup), selalu
  cek field `.error` per-row — jangan asumsikan sukses hanya karena
  tidak ada exception (riwayat bug: toast sukses palsu di beberapa modul).
- Saat edit form yang merekonstruksi objek dari field parsial (mis. form
  edit paket hadiah), pastikan field lama yang tidak ditampilkan di form
  tetap disalin, jangan sampai hilang diam-diam.

## Hal yang Perlu Diperhatikan

- Migrasi SQL bertambah terus (28+ file) — cek file migrasi terbaru
  sebelum asumsi skema tabel tertentu.
- `CATATAN-MERGER-GUDANG.md` dan `SECURITY_AUDIT.md` di root berisi
  catatan historis penting, baca kalau menyentuh modul gudang atau
  keamanan.
- Jangan tambah dependency runtime baru tanpa alasan kuat — proyek
  sengaja statis tanpa framework/bundler runtime (`esbuild` cuma untuk
  build lokal).
