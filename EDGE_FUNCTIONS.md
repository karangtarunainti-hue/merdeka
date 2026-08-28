# Dokumentasi Supabase Edge Functions — Merdeka-Main

Repo ini menggunakan **2 Edge Function**, keduanya bertindak sebagai proxy aman ke Gemini API (Google AI). Dipanggil dari `js/26-ai.js` lewat `sb.functions.invoke(...)`.

| Function | File | Dipanggil dari | Fungsi |
|---|---|---|---|
| `ai-generate` | `supabase/functions/ai-generate/index.ts` | `AI.tanya()` di `js/26-ai.js` | Proxy ke Gemini `generateContent` (chat/teks) |
| `ai-embed` | `supabase/functions/ai-embed/index.ts` | `AI.embed()` di `js/26-ai.js` | Proxy ke Gemini `embedContent` (vector 768 dim untuk second brain / pencarian semantik) |

Kedua function berbagi pola yang sama: verifikasi sesi custom app (bukan Supabase Auth) via RPC `rpc_session_user`, rate limit in-memory per sesi, dan fallback ke beberapa `GEMINI_API_KEY` cadangan jika key utama kena limit/gangguan.

---

## 1. `ai-generate`

**Tujuan:** Proxy chat/teks ke Gemini, dipakai untuk fitur tanya-jawab AI di aplikasi.

**Kenapa lewat Edge Function (bukan langsung dari browser):**
- `GEMINI_API_KEY` disimpan sebagai secret Supabase — tidak pernah terkirim ke klien.
- Memverifikasi sesi login custom app (tabel `kt_sessions` + RPC `rpc_session_user`) sebelum meneruskan ke Gemini.
- Rate limit per sesi (best-effort, in-memory) untuk mencegah abuse kasar. **Catatan:** karena Edge Function bisa jalan di banyak isolate paralel, limit ini bukan jaminan global yang ketat.

**Setup deploy:**
```bash
supabase functions deploy ai-generate
supabase secrets set GEMINI_API_KEY=xxxxx
# SUPABASE_URL & SUPABASE_ANON_KEY otomatis tersedia di env Edge Function
```

**Fallback multi-key (opsional):**
```bash
supabase secrets set GEMINI_API_KEY_2=yyyyy
supabase secrets set GEMINI_API_KEY_3=zzzzz
```
Buat dari akun Google berbeda-beda (satu akun = satu kuota free tier sendiri). Function mencoba `GEMINI_API_KEY` dulu; jika kena HTTP 429/500/503, otomatis lanjut ke key berikutnya. Error non-kuota (mis. 400) langsung dikembalikan tanpa mencoba key lain.

**Konstanta penting:**
| Konstanta | Nilai | Keterangan |
|---|---|---|
| `AI_RATE_LIMIT_MAX` | 12 | maksimum panggilan per sesi |
| `AI_RATE_LIMIT_WINDOW_MS` | 60.000 ms | jendela rate limit (1 menit) |
| `AI_MAX_PROMPT_CHARS` | 8.000 | batas panjang prompt |
| `AI_MAX_OUTPUT_TOKENS` | 2.048 | batas token output Gemini |
| `AI_DEFAULT_MODEL` | `gemini-3.5-flash` | model Gemini yang dipakai |
| `RETRYABLE_STATUS` | 429, 500, 503 | status yang memicu fallback ke key lain |

**Alur request:**
1. Tolak jika method bukan `POST` (kecuali `OPTIONS` untuk CORS preflight).
2. Kumpulkan semua `GEMINI_API_KEY*` yang tersedia dari env; tolak (503) jika kosong.
3. Verifikasi header `x-session-token` lewat RPC `rpc_session_user`; tolak (401) jika sesi tidak valid.
4. Cek rate limit per sesi; tolak (429) jika terlampaui.
5. Parse body JSON `{ prompt, system? }`; validasi wajib diisi dan panjang maksimum.
6. Kirim ke Gemini `generateContent` dengan fallback multi-key.
7. Ekstrak teks dari `candidates[0].content.parts`; jika kosong, kembalikan error dengan `finishReason`.
8. Balas `{ ok: true, text }`.

**Request body:**
```json
{ "prompt": "string (wajib, maks 8000 char)", "system": "string (opsional)" }
```

**Header wajib:** `x-session-token` (token sesi custom app)

**Response sukses:**
```json
{ "ok": true, "text": "jawaban dari Gemini" }
```

**Response error (contoh):**
```json
{ "ok": false, "error": "Sesi tidak valid, silakan login ulang" }
```

---

## 2. `ai-embed`

**Tujuan:** Proxy embedding teks ke Gemini `embedContent` (model `gemini-embedding-001`), menghasilkan vector 768 dimensi untuk disimpan di kolom `embedding vector(768)` (lihat `sql/39-second-brain-migration.sql`) — dipakai untuk fitur pencarian semantik/second brain.

Pola sama persis dengan `ai-generate` (auth sesi, rate limit, fallback multi-key), berbagi secret `GEMINI_API_KEY*` yang sama — tidak perlu setup ulang jika `ai-generate` sudah di-deploy.

**Setup deploy:**
```bash
supabase functions deploy ai-embed
```

**Konstanta penting:**
| Konstanta | Nilai | Keterangan |
|---|---|---|
| `EMBED_RATE_LIMIT_MAX` | 30 | lebih longgar dari `ai-generate` karena embedding lebih murah/cepat |
| `EMBED_RATE_LIMIT_WINDOW_MS` | 60.000 ms | jendela rate limit |
| `EMBED_MAX_TEXT_CHARS` | 12.000 | batas panjang teks input |
| `EMBED_MODEL` | `gemini-embedding-001` | model embedding |
| `EMBED_OUTPUT_DIM` | 768 | dimensi vector output |
| `VALID_TASK_TYPES` | `RETRIEVAL_DOCUMENT`, `RETRIEVAL_QUERY` | tipe task Gemini (asimetris: dokumen saat simpan, query saat cari) |

**Alur request:**
1. Tolak jika method bukan `POST` (kecuali `OPTIONS`).
2. Kumpulkan `GEMINI_API_KEY*`; tolak (503) jika kosong.
3. Verifikasi `x-session-token` lewat RPC yang sama (`rpc_session_user`); tolak (401) jika tidak valid.
4. Cek rate limit; tolak (429) jika terlampaui.
5. Parse body `{ text, taskType? }`; validasi wajib diisi dan panjang maksimum.
6. `taskType` default ke `RETRIEVAL_DOCUMENT` jika tidak valid/tidak diisi.
7. Kirim ke Gemini `embedContent` dengan fallback multi-key.
8. Balas `{ ok: true, embedding: number[] }`.

**Request body:**
```json
{ "text": "string (wajib, maks 12000 char)", "taskType": "RETRIEVAL_DOCUMENT | RETRIEVAL_QUERY (opsional)" }
```

**Header wajib:** `x-session-token`

**Response sukses:**
```json
{ "ok": true, "embedding": [0.123, -0.045, ...] }
```

**Response error (contoh):**
```json
{ "ok": false, "error": "text terlalu panjang (maks 12000 karakter)" }
```

---

## Hal yang sama di kedua function

- **CORS:** `Access-Control-Allow-Origin: *`, karena situs statis di-hosting di domain Cloudflare (beda origin dari Supabase). Ini beda dengan versi Cloudflare Worker (jika ada) yang same-origin dan tidak butuh CORS.
- **Autentikasi:** bukan Supabase Auth bawaan, melainkan sistem sesi custom app lewat tabel `kt_sessions` + RPC `rpc_session_user`, dikirim via header `x-session-token`.
- **Rate limiting:** in-memory `Map` per isolate — best-effort saja, bukan jaminan global yang ketat (isolate paralel = limit bisa "bocor").
- **Env variable yang dibutuhkan:**
  - `GEMINI_API_KEY` (wajib)
  - `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` (opsional, fallback)
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (otomatis tersedia di runtime Edge Function)
- **Dipanggil dari:** `js/26-ai.js` (fungsi `AI.tanya()` dan `AI.embed()`), juga muncul ter-bundle di `js/app.bundle.min.js`.

## Sumber di aplikasi (client-side)

```js
// js/26-ai.js
res = await sb.functions.invoke('ai-generate', { body: { prompt, system }, headers: { 'x-session-token': token } });
res = await sb.functions.invoke('ai-embed', { body: { text, taskType }, headers: { 'x-session-token': token } });
```
