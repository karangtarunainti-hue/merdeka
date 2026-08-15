// supabase/functions/ai-embed/index.ts
// ============================================================
// MESIN EMBEDDING — proxy ke Gemini embedContent (model
// gemini-embedding-001). Sepupu dari ai-generate/index.ts (auth sesi,
// rate limit, fallback multi-key — SAMA PERSIS polanya, lihat komentar
// lengkap di sana), tapi keluarannya vector angka (buat disimpan di
// kolom `embedding vector(768)`, lihat supabase-second-brain-migration.sql),
// BUKAN teks jawaban.
//
// Dipanggil dari js/26-ai.js lewat AI.embed(text, {taskType}).
//
// SETUP SEKALI (kalau ai-generate sudah pernah di-deploy & GEMINI_API_KEY
// sudah di-set, function ini otomatis ikut pakai secret yang sama —
// tidak perlu setup ulang):
//   supabase functions deploy ai-embed
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token, cache-control',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMBED_RATE_LIMIT_MAX = 30; // embedding jauh lebih murah/cepat dari generateContent, limit lebih longgar
const EMBED_RATE_LIMIT_WINDOW_MS = 60_000;
const EMBED_MAX_TEXT_CHARS = 12_000; // ~2048 token batas model, dilonggarkan di sisi karakter supaya tidak perlu tokenizer di edge
const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_OUTPUT_DIM = 768; // lihat catatan dimensi di supabase-second-brain-migration.sql
const RETRYABLE_STATUS = new Set([429, 500, 503]);
const VALID_TASK_TYPES = new Set(['RETRIEVAL_DOCUMENT', 'RETRIEVAL_QUERY']);

const rateBuckets = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < EMBED_RATE_LIMIT_WINDOW_MS);
  if (hits.length >= EMBED_RATE_LIMIT_MAX) {
    rateBuckets.set(key, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  if (rateBuckets.size > 1000) {
    for (const [k, v] of rateBuckets) {
      if (!v.length || now - v[v.length - 1] > EMBED_RATE_LIMIT_WINDOW_MS) rateBuckets.delete(k);
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

async function callGeminiEmbedWithFallback(
  apiKeys: string[],
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: any }> {
  let lastResult: { ok: boolean; status: number; data: any } | null = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const isLastKey = i === apiKeys.length - 1;
    try {
      const gm = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKeys[i] },
          body: JSON.stringify(body),
        }
      );
      const data = await gm.json();
      if (gm.ok) return { ok: true, status: gm.status, data };

      lastResult = { ok: false, status: gm.status, data };
      const bisaDicobaLagi = RETRYABLE_STATUS.has(gm.status);
      if (!bisaDicobaLagi || isLastKey) return lastResult;
      console.warn(`Gemini embed key #${i + 1} gagal (status ${gm.status}), coba key cadangan berikutnya...`);
    } catch (e) {
      lastResult = { ok: false, status: 502, data: { error: { message: (e as Error).message } } };
      if (isLastKey) return lastResult;
      console.warn(`Gemini embed key #${i + 1} gagal koneksi, coba key cadangan berikutnya...`, e);
    }
  }
  return lastResult || { ok: false, status: 503, data: { error: { message: 'Tidak ada API key yang tersedia' } } };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

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

  if (rateLimited(`embed:${sessionToken}`)) {
    return json({ ok: false, error: 'Terlalu banyak permintaan embedding, coba sebentar lagi' }, 429);
  }

  let payload: { text?: string; taskType?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'Body bukan JSON yang valid' }, 400);
  }

  const text = String(payload.text || '').trim();
  if (!text) return json({ ok: false, error: 'text wajib diisi' }, 400);
  if (text.length > EMBED_MAX_TEXT_CHARS) {
    return json({ ok: false, error: `text terlalu panjang (maks ${EMBED_MAX_TEXT_CHARS} karakter)` }, 400);
  }
  // RETRIEVAL_DOCUMENT dipakai saat menyimpan catatan (embedding "sisi
  // dokumen"), RETRIEVAL_QUERY saat mencari (embedding "sisi pertanyaan")
  // — dua task type ini dilatih Google secara asimetris supaya hasil
  // pencarian query->dokumen lebih akurat daripada kalau dua-duanya
  // di-embed dengan cara yang sama. Default ke RETRIEVAL_DOCUMENT kalau
  // klien tidak menyebutkan (lebih aman salah default daripada gagal).
  const taskType = VALID_TASK_TYPES.has(String(payload.taskType || '').toUpperCase())
    ? String(payload.taskType).toUpperCase()
    : 'RETRIEVAL_DOCUMENT';

  const geminiBody = {
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: EMBED_OUTPUT_DIM,
  };

  try {
    const { ok, status, data } = await callGeminiEmbedWithFallback(apiKeys, geminiBody);
    if (!ok) {
      console.error('Gemini embed API error (semua key sudah dicoba):', data);
      const pesan =
        status === 429
          ? 'Semua kuota AI sedang habis, coba lagi nanti'
          : data?.error?.message || 'Gemini API error';
      return json({ ok: false, error: pesan }, status);
    }

    const values = data?.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      return json({ ok: false, error: 'AI tidak menghasilkan embedding' }, 502);
    }

    return json({ ok: true, embedding: values });
  } catch (e) {
    console.error('Gagal menghubungi Gemini:', e);
    return json({ ok: false, error: 'Gagal menghubungi layanan AI', message: (e as Error).message }, 502);
  }
});
