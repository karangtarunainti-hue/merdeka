/* ============================================================
   CLOUDFLARE WORKER — Merdeka / Taruna Inti
   ============================================================
   Sebelumnya situs ini murni static assets (tidak ada `main` di
   wrangler.jsonc). Worker ini ditambahkan untuk SATU alasan:
   mencabut bot token Telegram dari browser.

   Sebelum: js/04-event-settings.js memanggil
     https://api.telegram.org/bot${botToken}/sendMessage
   langsung dari klien, dengan botToken dibaca dari tabel
   kt_telegram_settings yang bisa dibaca anon. Siapa pun yang membuka
   DevTools bisa mengambil token dan mengambil alih bot.

   Sesudah: klien POST ke /api/telegram (same-origin, tanpa token).
   Worker memegang token sebagai secret, memverifikasi sesi login ke
   Supabase dulu, menerapkan rate limit, baru meneruskan ke Telegram.

   Semua request lain diteruskan ke static assets seperti biasa
   (env.ASSETS.fetch) — perilaku situs tidak berubah.

   SETUP SEKALI:
     npx wrangler secret put TELEGRAM_BOT_TOKEN
     npx wrangler secret put SUPABASE_URL
     npx wrangler secret put SUPABASE_ANON_KEY
   ============================================================ */

const RATE_LIMIT_MAX = 20;          // maksimum pesan
const RATE_LIMIT_WINDOW_MS = 60_000; // per 1 menit, per sesi

// Rate limit in-memory per isolate. Ini bukan penjaga yang sempurna
// (Cloudflare bisa punya banyak isolate), tapi cukup untuk mencegah
// satu klien yang bug/nakal membanjiri bot. Kalau nanti butuh yang
// benar-benar global, ganti dengan Durable Object atau KV.
const rateBuckets = new Map();

function rateLimited(key) {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(key, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  // Jaga Map tidak tumbuh tanpa batas di isolate yang berumur panjang.
  if (rateBuckets.size > 1000) {
    for (const [k, v] of rateBuckets) {
      if (!v.length || now - v[v.length - 1] > RATE_LIMIT_WINDOW_MS) rateBuckets.delete(k);
    }
  }
  return false;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* Verifikasi token sesi ke Supabase lewat rpc_session_user.
   Worker tidak memegang service key — dia memanggil RPC yang sama
   seperti klien, jadi kalau sesi tidak valid Supabase sendiri yang
   menolak. Mengembalikan objek user atau null. */
async function verifySession(env, token) {
  if (!token) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/rpc_session_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        'x-session-token': token,
      },
      body: '{}',
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (e) {
    console.error('verifySession gagal:', e);
    return null;
  }
}

async function handleTelegram(request, env) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  // Same-origin saja — tidak ada header CORS yang dikirim sama sekali,
  // jadi situs lain tidak bisa memakai endpoint ini sebagai relay.
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ ok: false, error: 'Origin tidak diizinkan' }, 403);
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: 'Bot token belum dikonfigurasi di server' }, 503);
  }

  const token = request.headers.get('x-session-token');
  const user = await verifySession(env, token);
  if (!user) {
    return json({ ok: false, error: 'Sesi tidak valid, silakan login ulang' }, 401);
  }

  if (rateLimited(token)) {
    return json({ ok: false, error: 'Terlalu banyak notifikasi, coba sebentar lagi' }, 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'Body bukan JSON yang valid' }, 400);
  }

  const chatId = String(payload.chat_id || '').trim();
  const text = String(payload.text || '');
  if (!chatId) return json({ ok: false, error: 'chat_id wajib diisi' }, 400);
  if (!text) return json({ ok: false, error: 'text wajib diisi' }, 400);
  // Batas Telegram sendiri 4096; potong di sini supaya tidak buang-buang
  // round-trip untuk pesan yang pasti ditolak.
  if (text.length > 4096) return json({ ok: false, error: 'Pesan terlalu panjang' }, 400);

  try {
    const tg = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      }
    );
    const result = await tg.json();
    // Teruskan apa adanya (termasuk error_code 429 + parameters.retry_after)
    // supaya logika retry/backoff yang sudah ada di klien tetap bekerja —
    // tapi tanpa pernah menyentuh bot token.
    return json(result, tg.ok ? 200 : tg.status);
  } catch (e) {
    return json({ ok: false, error: 'Gagal menghubungi Telegram', detail: e.message }, 502);
  }
}

/* ============================================================
   BOT WHATSAPP — command-based, memanfaatkan Service Window
   ============================================================
   Anggota chat duluan ke nomor bot -> Meta buka jendela servis
   24 jam -> balasan bot di dalam jendela itu gratis (tidak kena
   biaya per-pesan template Meta).

   SETUP SEKALI (selain TELEGRAM_BOT_TOKEN yang sudah ada):
     npx wrangler secret put WHATSAPP_TOKEN
     npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
     npx wrangler secret put WHATSAPP_VERIFY_TOKEN
   Lalu di Meta for Developers > WhatsApp > Configuration, isi
   Callback URL = https://<domain-kalian>/api/whatsapp/webhook
   dan Verify Token = nilai yang sama dengan WHATSAPP_VERIFY_TOKEN.

   Sebelum ini jalan, jalankan dulu sql/whatsapp_wa_rpc.sql di
   Supabase SQL Editor.
   ============================================================ */

const WA_HELP_TEXT =
  'Halo! Ketik salah satu perintah ini:\n\n' +
  '📅 *agenda* — jadwal 14 hari ke depan\n' +
  '💰 *keuangan* — ringkasan kas kegiatan\n' +
  '🏆 *hadiah juara <1/2/3/partisipasi> lomba <kategori>* — cek isi paket hadiah\n\n' +
  'Contoh: "hadiah juara 1 lomba anak-anak"';

function waFmtRp(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(
    Number(n) || 0
  );
}

function waFmtTanggal(iso) {
  if (!iso) return '-';
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Panggil RPC Supabase pakai anon key — sama seperti klien, tanpa
// perlu sesi login (RPC ini SECURITY DEFINER, read-only, agregat saja).
async function waCallRpc(env, fn, args = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`RPC ${fn} gagal: ${res.status}`);
  return res.json();
}

async function waBuildAgendaReply(env) {
  const rows = await waCallRpc(env, 'rpc_wa_agenda');
  if (!rows.length) return '📅 Tidak ada agenda dalam 14 hari ke depan.';
  const lines = rows.map(
    (j) => `• ${waFmtTanggal(j.tanggal)}${j.jam ? ' ' + j.jam : ''} — ${j.judul}`
  );
  return `📅 *Agenda 14 Hari ke Depan*\n\n${lines.join('\n')}`;
}

async function waBuildKeuanganReply(env) {
  const rows = await waCallRpc(env, 'rpc_wa_laporan_keuangan');
  if (!rows.length) return '💰 Belum ada data event.';
  const r = rows[0];
  return (
    `💰 *Ringkasan Kas — ${r.nama_event}*\n\n` +
    `Iuran (lunas): ${waFmtRp(r.total_iuran)}\n` +
    `Donasi: ${waFmtRp(r.total_donasi)}\n` +
    `Transaksi lain: ${waFmtRp(r.total_transaksi_lain)}\n` +
    `*Total Pemasukan: ${waFmtRp(r.total_pemasukan)}*\n\n` +
    `Operasional: ${waFmtRp(r.total_operasional)}\n\n` +
    `*Saldo: ${waFmtRp(r.saldo)}*\n\n` +
    `_Belum termasuk belanja hadiah/lomba — cek dashboard untuk rincian lengkap._`
  );
}

// Kata kunci -> nilai persis KATEGORI_PESERTA/JUARA_LIST (lihat js/00-config.js).
// Pencocokan sengaja bebas urutan & permisif (banyak alias) supaya pertanyaan
// natural seperti "hadiah juara pertama lomba anak-anak" tetap kena, tanpa
// perlu AI/NLP — murni keyword matching, jadi tetap gratis.
const WA_KATEGORI_ALIAS = [
  { v: 'anak', keys: ['anak-anak', 'anak', 'balita'] },
  { v: 'remaja', keys: ['remaja', 'pemuda', 'pemudi'] },
  { v: 'bapak-ibu', keys: ['bapak-ibu', 'bapak ibu', 'keluarga'] },
  { v: 'bapak-bapak', keys: ['bapak-bapak', 'bapak bapak', 'bapak'] },
  { v: 'ibu', keys: ['ibu-ibu', 'ibu'] },
  { v: 'umum', keys: ['umum'] },
];
const WA_JUARA_ALIAS = [
  { v: '1', keys: ['juara 1', 'juara pertama', 'juara i', 'pertama'] },
  { v: '2', keys: ['juara 2', 'juara kedua', 'juara ii', 'kedua'] },
  { v: '3', keys: ['juara 3', 'juara ketiga', 'juara iii', 'ketiga'] },
  { v: 'partisipasi', keys: ['partisipasi', 'peserta'] },
];

function waExtractKategoriJuara(text) {
  const t = (text || '').toLowerCase();
  const kategori = WA_KATEGORI_ALIAS.find((k) => k.keys.some((kw) => t.includes(kw)));
  const juara = WA_JUARA_ALIAS.find((j) => j.keys.some((kw) => t.includes(kw)));
  return { kategori: kategori ? kategori.v : null, juara: juara ? juara.v : null };
}

function waLabelKategori(v) {
  return { anak: 'Anak-Anak', remaja: 'Remaja', ibu: 'Ibu', 'bapak-ibu': 'Bapak-Ibu', 'bapak-bapak': 'Bapak-Bapak', umum: 'Umum' }[v] || v;
}
function waLabelJuara(v) {
  return { '1': 'Juara 1', '2': 'Juara 2', '3': 'Juara 3', partisipasi: 'Partisipasi' }[v] || v;
}

async function waBuildHadiahLombaReply(env, text) {
  const { kategori, juara } = waExtractKategoriJuara(text);
  if (!kategori || !juara) {
    return (
      '🏆 Mau cek hadiah lomba kategori & juara berapa?\n\n' +
      'Contoh: "hadiah juara 1 lomba anak-anak" atau "hadiah juara 2 remaja"\n\n' +
      'Kategori: anak-anak, remaja, ibu, bapak-bapak, bapak-ibu, umum\n' +
      'Juara: 1/pertama, 2/kedua, 3/ketiga, partisipasi'
    );
  }
  const rows = await waCallRpc(env, 'rpc_wa_hadiah_lomba', { p_kategori: kategori, p_juara: juara });
  const judul = `🏆 *Hadiah ${waLabelJuara(juara)} — ${waLabelKategori(kategori)}*`;
  if (!rows.length) return `${judul}\n\nBelum ada paket hadiah untuk kombinasi ini.`;
  const lines = rows.map((r) => `• ${r.nama_item} (${r.qty_dibeli}/${r.qty_per_paket} sudah dibeli)`);
  return `${judul}\n\n${lines.join('\n')}`;
}

async function waSendMessage(env, to, body) {
  await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
}

function waRouteCommand(text) {
  const t = (text || '').trim().toLowerCase();
  if (['hadiah', 'lomba'].some((k) => t.includes(k))) return 'hadiah';
  if (['agenda', 'jadwal'].some((k) => t.includes(k))) return 'agenda';
  if (['keuangan', 'kas', 'saldo', 'laporan'].some((k) => t.includes(k))) return 'keuangan';
  return 'help';
}

function handleWhatsAppVerify(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Verifikasi gagal', { status: 403 });
}

async function handleWhatsAppMessage(request, env, ctx) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Meta mengirim status delivery/read juga lewat webhook yang sama —
  // itu tidak punya field "messages", jadi cukup di-ack tanpa diproses.
  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || message.type !== 'text') {
    return json({ ok: true });
  }

  const from = message.from; // nomor pengirim, sudah termasuk kode negara
  const text = message.text?.body || '';
  const command = waRouteCommand(text);

  // Balas di background (waitUntil) supaya webhook langsung ack ke Meta
  // (Meta akan retry & bisa nge-flag endpoint kalau responnya lambat).
  const reply = (async () => {
    try {
      let body;
      if (command === 'agenda') body = await waBuildAgendaReply(env);
      else if (command === 'keuangan') body = await waBuildKeuanganReply(env);
      else if (command === 'hadiah') body = await waBuildHadiahLombaReply(env, text);
      else body = WA_HELP_TEXT;
      await waSendMessage(env, from, body);
    } catch (e) {
      console.error('Gagal proses pesan WA:', e);
      try {
        await waSendMessage(env, from, 'Maaf, terjadi kesalahan saat mengambil data. Coba lagi nanti.');
      } catch {}
    }
  })();

  if (ctx?.waitUntil) ctx.waitUntil(reply);
  else await reply;

  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/telegram') {
      return handleTelegram(request, env);
    }

    if (url.pathname === '/api/whatsapp/webhook') {
      if (request.method === 'GET') return handleWhatsAppVerify(request, env);
      if (request.method === 'POST') return handleWhatsAppMessage(request, env, ctx);
      return new Response('Method not allowed', { status: 405 });
    }

    // Endpoint kesehatan untuk uptime monitor (lihat §13 audit).
    if (url.pathname === '/api/health') {
      return json({ ok: true, ts: new Date().toISOString() });
    }

    return env.ASSETS.fetch(request);
  },
};
