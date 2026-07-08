/* ============================================================
   SERVICE WORKER — Buku Keuangan Karang Taruna
   Cuma nge-cache "app shell" (HTML/CSS/JS/ikon) supaya aplikasi
   tetap bisa dibuka walau sinyal jelek/offline. Data (Supabase)
   TIDAK di-cache di sini — selalu ambil langsung dari jaringan,
   supaya saldo/anggota/dll yang ditampilkan selalu data terbaru.

   NAIKKAN CACHE_VERSION setiap kali index.html/style.css/script.js
   diupdate, supaya HP pengguna otomatis ambil versi baru.
   ============================================================ */
const CACHE_VERSION = 'v13';
const CACHE_NAME = `kt-shell-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './vendor/supabase.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // {cache:'reload'} supaya fetch awal ini juga tidak diam-diam diambil dari
      // HTTP cache browser/CDN (lihat penjelasan lengkap di listener 'fetch' di bawah).
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n.startsWith('kt-shell-') && n !== CACHE_NAME)
             .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Cuma tangani GET same-origin. Request ke Supabase, font Google,
  // CDN supabase-js, dll dibiarkan lewat jaringan seperti biasa
  // (tidak di-cache) supaya data selalu fresh.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Network-first untuk app shell: kalau online, selalu pakai versi
  // terbaru dari server + update cache. Kalau offline, baru fallback
  // ke cache supaya aplikasi tetap bisa dibuka.
  //
  // CATATAN PENTING: `fetch(req)` biasa TETAP BISA diam-diam dijawab dari
  // HTTP cache bawaan browser/CDN (bukan Cache Storage kita), tergantung
  // header Cache-Control dari hosting — jadi walau kode di sini sudah
  // "network-first", device tertentu masih bisa dapat file lama beberapa
  // saat kalau layer cache HTTP itu belum kadaluarsa. `cache:'no-store'`
  // memaksa permintaan ini betul-betul ke jaringan, tidak boleh dijawab
  // dari cache manapun selain Cache Storage kita sendiri sebagai fallback.
  event.respondWith(
    fetch(req.url, { cache: 'no-store' })
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
