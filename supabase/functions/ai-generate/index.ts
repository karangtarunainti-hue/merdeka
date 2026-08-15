// supabase/functions/ai-generate/index.ts
// ============================================================
// MESIN AI — proxy ke Gemini API. INFRASTRUKTUR umum, belum terikat
// fitur tertentu. Dipanggil dari js/26-ai.js lewat sb.functions.invoke().
//
// Kenapa lewat Edge Function (bukan langsung dari browser ke Gemini)?
// - GEMINI_API_KEY dipegang sebagai secret Supabase, tidak pernah dikirim
//   ke klien (kalau API key ada di JS klien, siapa pun yang buka DevTools
//   bisa mencurinya dan memakai kuota kalian sendiri).
// - Function verifikasi sesi login app (bukan Supabase Auth — app ini
//   pakai sistem sesi custom lewat tabel kt_sessions + RPC
//   rpc_session_user, lihat CLAUDE.md) sebelum meneruskan ke Gemini,
//   supaya orang luar tidak bisa numpang pakai endpoint ini.
// - Rate limit per sesi (best-effort, in-memory) supaya satu user/bug
//   tidak memborong kuota. CATATAN: Edge Function bisa dijalankan di
//   banyak isolate paralel, jadi limit ini BUKAN jaminan global yang
//   ketat — cukup untuk mencegah abuse kasar, bukan pengganti kuota
//   resmi Gemini. Kalau butuh limit yang benar-benar akurat, pindahkan
//   ke tabel Supabase (hitung panggilan per sesi per menit di situ).
//
// SETUP SEKALI:
//   supabase functions deploy ai-generate
//   supabase secrets set GEMINI_API_KEY=xxxxx
//   (SUPABASE_URL & SUPABASE_ANON_KEY otomatis tersedia di env Edge
//   Function, tidak perlu di-set manual.)
//
// FALLBACK MULTI-KEY (opsional, jaga-jaga kalau kuota free tier habis):
//   supabase secrets set GEMINI_API_KEY_2=yyyyy
//   supabase secrets set GEMINI_API_KEY_3=zzzzz
//   Buat masing-masing dari akun Google berbeda (satu akun = satu kuota
//   free tier sendiri-sendiri, jadi key dari akun yang sama TIDAK
//   menambah kuota). Function ini coba GEMINI_API_KEY dulu; kalau key itu
//   kena limit kuota (HTTP 429) atau Gemini lagi bermasalah (500/503),
//   otomatis lanjut ke GEMINI_API_KEY_2, dst — bukan pengganti permanen,
//   cuma jaring pengaman saat key utama lagi mentok/gangguan. Kalau
//   error-nya BUKAN soal kuota (mis. prompt ditolak/400), tidak ada
//   gunanya coba key lain (errornya akan sama persis), jadi langsung
//   dikembalikan ke klien tanpa buang-buang percobaan.
//
// Ambil API key di https://aistudio.google.com/apikey — tier gratis
// cukup untuk pemakaian ringan komunitas.
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  // Situs statisnya di domain Cloudflare (beda origin dari Supabase),
  // jadi CORS wajib ada di sini — beda dengan versi Cloudflare Worker
  // yang same-origin dan tidak perlu CORS sama sekali.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token, cache-control',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_RATE_LIMIT_MAX = 12; // maksimum panggilan AI
const AI_RATE_LIMIT_WINDOW_MS = 60_000; // per 1 menit, per sesi (best-effort, lihat catatan di atas)
const AI_MAX_PROMPT_CHARS = 8000; // batas panjang prompt (jaga biaya & abuse)
const AI_MAX_OUTPUT_TOKENS = 2048;
const AI_DEFAULT_MODEL = 'gemini-3.5-flash';
// Status HTTP yang layak dicoba ulang dengan key lain: 429 = kuota/rate
// limit habis untuk key itu, 500/503 = Gemini lagi gangguan sementara
// (bukan salah key-nya, tapi tidak ada ruginya coba key lain juga).
const RETRYABLE_STATUS = new Set([429, 500, 503]);

// Best-effort, hidup selama isolate ini hangat saja — lihat catatan CORS di atas.
const rateBuckets = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < AI_RATE_LIMIT_WINDOW_MS);
  if (hits.length >= AI_RATE_LIMIT_MAX) {
    rateBuckets.set(key, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  if (rateBuckets.size > 1000) {
    for (const [k, v] of rateBuckets) {
      if (!v.length || now - v[v.length - 1] > AI_RATE_LIMIT_WINDOW_MS) rateBuckets.delete(k);
    }
  }
  return false;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// Verifikasi token sesi ke rpc_session_user — sama seperti Worker
// (src/worker.js verifySession()) dan sama seperti request Supabase
// lain dari klien (lihat js/00-config.js, header x-session-token).
async function verifySession(supabaseUrl: string, anonKey: string, token: string | null) {
  if (!token) return null;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_session_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
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

// Coba beberapa API key Gemini berurutan. Berhenti di percobaan pertama
// yang sukses, atau di percobaan pertama yang gagal karena alasan BUKAN
// kuota/gangguan sementara (mis. 400 prompt ditolak — key lain juga akan
// gagal dengan cara sama, jadi tidak ada gunanya lanjut coba).
async function callGeminiWithFallback(
  apiKeys: string[],
  model: string,
  geminiBody: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: any }> {
  let lastResult: { ok: boolean; status: number; data: any } | null = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const isLastKey = i === apiKeys.length - 1;
    try {
      const gm = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKeys[i] },
          body: JSON.stringify(geminiBody),
        }
      );
      const data = await gm.json();

      if (gm.ok) return { ok: true, status: gm.status, data };

      lastResult = { ok: false, status: gm.status, data };
      const bisaDicobaLagi = RETRYABLE_STATUS.has(gm.status);
      if (!bisaDicobaLagi || isLastKey) return lastResult;

      console.warn(`Gemini key #${i + 1} gagal (status ${gm.status}), coba key cadangan berikutnya...`);
    } catch (e) {
      lastResult = { ok: false, status: 502, data: { error: { message: (e as Error).message } } };
      if (isLastKey) return lastResult;
      console.warn(`Gemini key #${i + 1} gagal koneksi, coba key cadangan berikutnya...`, e);
    }
  }

  // Tidak akan sampai sini kalau apiKeys tidak kosong, tapi jaga-jaga.
  return lastResult || { ok: false, status: 503, data: { error: { message: 'Tidak ada API key yang tersedia' } } };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  // Kumpulkan semua key yang di-set (utama + cadangan), buang yang kosong.
  // Urutan dicoba = urutan di array ini: GEMINI_API_KEY dulu, baru _2, _3.
  const apiKeys = [
    Deno.env.get('GEMINI_API_KEY'),
    Deno.env.get('GEMINI_API_KEY_2'),
    Deno.env.get('GEMINI_API_KEY_3'),
  ].filter((k): k is string => !!k && k.trim().length > 0);
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  if (apiKeys.length === 0) {
    return json({ ok: false, error: 'GEMINI_API_KEY belum dikonfigurasi di server' }, 503);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ ok: false, error: 'Konfigurasi server tidak lengkap' }, 500);
  }

  const sessionToken = req.headers.get('x-session-token');
  const user = await verifySession(SUPABASE_URL, SUPABASE_ANON_KEY, sessionToken);
  if (!user) {
    return json({ ok: false, error: 'Sesi tidak valid, silakan login ulang' }, 401);
  }

  if (rateLimited(`ai:${sessionToken}`)) {
    return json({ ok: false, error: 'Terlalu banyak permintaan AI, coba sebentar lagi' }, 429);
  }

  let payload: { prompt?: string; system?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Body bukan JSON yang valid' }, 400);
  }

  const prompt = String(payload.prompt || '').trim();
  const system = payload.system ? String(payload.system).trim() : '';
  if (!prompt) return json({ ok: false, error: 'prompt wajib diisi' }, 400);
  if (prompt.length > AI_MAX_PROMPT_CHARS) {
    return json({ ok: false, error: `prompt terlalu panjang (maks ${AI_MAX_PROMPT_CHARS} karakter)` }, 400);
  }

  const geminiBody: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: AI_MAX_OUTPUT_TOKENS },
  };
  if (system) geminiBody.systemInstruction = { parts: [{ text: system }] };

  try {
    const { ok, status, data } = await callGeminiWithFallback(apiKeys, AI_DEFAULT_MODEL, geminiBody);

    if (!ok) {
      console.error('Gemini API error (semua key sudah dicoba):', data);
      const pesan =
        status === 429
          ? 'Semua kuota AI sedang habis, coba lagi nanti'
          : data?.error?.message || 'Gemini API error';
      return json({ ok: false, error: pesan }, status);
    }

    // Gemini bisa menolak jawab (safety filter dll) tanpa error HTTP — di
    // situ candidates ada tapi content/parts kosong, atau finishReason bukan
    // "STOP". Tangani eksplisit supaya klien tidak dapat text kosong tanpa
    // penjelasan.
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    if (!text) {
      const reason = candidate?.finishReason || 'UNKNOWN';
      return json({ ok: false, error: `AI tidak menghasilkan jawaban (${reason})` }, 502);
    }

    return json({ ok: true, text });
  } catch (e) {
    console.error('Gagal menghubungi Gemini:', e);
    return json({ ok: false, error: 'Gagal menghubungi layanan AI', message: (e as Error).message }, 502);
  }
});
