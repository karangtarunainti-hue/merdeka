# Perbaikan tahap 1: aktifkan `28-kalender-peringatan.js`

Lingkup perbaikan ini SENGAJA dibatasi hanya ke bug yang dilaporkan:
modul "Pengingat" kalender hari besar tidak pernah ikut ter-bundle &
tidak pernah dipanggil. Isi `28-kalender-peringatan.js` sendiri **tidak
diubah sama sekali** — dilampirkan di sini hanya sebagai konteks, supaya
jelas fungsi apa saja yang sekarang mulai dipanggil.

## File yang berubah

### `build.js`
Tambah `'28-kalender-peringatan.js'` ke `MODULE_ORDER`, ditaruh tepat
setelah `'27-ai-insight.js'` — karena `renderKalenderKesadaranPanel()`
di dalamnya memanggil `renderInsightPanelHtml()` dari `27-ai-insight.js`,
jadi harus dimuat setelahnya. Modul ini sekarang ikut ter-bundle ke
`js/app.bundle.min.js`.

### `js/16-ui-helpers.js`
Tambah fungsi baru `reminderCardHtml(r)` — hasil ekstraksi markup kartu
`.reminder-card` (card-header/card-body/card-footer) yang sebelumnya
cuma inline di dalam `generateReminders()` (`07-dashboard.js`, TIDAK
diubah di sini). `generatePeringatanReminderCard()` di
`28-kalender-peringatan.js` sudah lama didesain mengembalikan objek
`{type, icon, title, count, items, action}` dengan asumsi ada fungsi
renderer seperti ini (lihat komentar aslinya di file itu, baris ~145)
— fungsi ini baru sekarang benar-benar dibuat.

### `js/12-jadwal-agenda-kas.js`
Di `renderAgenda()`:
- Panggil `ensureKalenderKesadaranInsight()` di awal fungsi (sama pola
  seperti `ensureLombaInsight()` di `renderLomba()`), supaya Insight AI
  "Pengingat" mulai di-generate di background.
- Di view `list` (bukan `tahunan`), render `generatePeringatanReminderCard()`
  (lewat `reminderCardHtml()`) dan `renderKalenderKesadaranPanel()` di
  atas `stat-grid` — posisi sama seperti `generateJadwalReminderCard()`
  di menu Jadwal Kegiatan.

### `README.md`
- Tabel "Peta Modul JS": tambah baris `28-kalender-peringatan.js`.
- Update catatan ⚠️ di bawah tabel: `28-kalender-peringatan.js` dipindah
  dari daftar "tidak aktif" ke catatan ✅ terpisah, `25-tour.js` (di luar
  lingkup perbaikan ini) tetap ditandai belum aktif.
- Update angka "34 di antaranya" → "35 di antaranya" di bagian Struktur
  Folder.

### `js/app.bundle.min.js`
Hasil `node build.js` setelah perubahan di atas — dicek jalan tanpa
error esbuild, dan `generatePeringatanReminderCard`, `reminderCardHtml`,
`renderKalenderKesadaranPanel`, `ensureKalenderKesadaranInsight` semua
sudah ikut masuk ke bundle.

## Sudah dicek
- `node --check` semua file `.js` yang diubah — lolos.
- `npm install && node build.js` — build sukses, tidak ada error.
- Fungsi-fungsi dari modul 28 terkonfirmasi ada di `app.bundle.min.js`
  hasil build.

## BELUM diperbaiki di tahap ini (dicatat di README, disengaja)
`db.aiInsightKalender` (cache ringkasan AI) belum di-preload dari tabel
`kt_kalender_insight` di `loadInitialData()` (`js/03-db-core.js`), beda
dengan `aiInsightLomba`/`aiInsightBelanjaHadiah` yang sudah di-preload.
Efeknya: kartu pengingat (`generatePeringatanReminderCard()`, yang murni
kalkulasi tanggal, tanpa AI) langsung tampil normal, tapi panel narasi
AI-nya (`renderKalenderKesadaranPanel()`) akan selalu generate ulang
tiap kali app dibuka alih-alih pakai cache tersimpan di server — boros
API call, meski tidak error/crash. Ini kandidat perbaikan tahap
berikutnya kalau memang mau dilanjutkan.
