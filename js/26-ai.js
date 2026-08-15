/* ============================================================
   MESIN AI — klien generik untuk Edge Function `ai-generate`
   (supabase/functions/ai-generate/index.ts, proxy ke Gemini).
   Ini INFRASTRUKTUR, belum terikat fitur tertentu.

   Cara pakai dari modul manapun (nanti):
     const jawaban = await AI.tanya('Ringkas data ini: ...');
     const jawaban2 = await AI.tanya('...', { system: 'Kamu asisten X' });

   AI.tanya() melempar Error kalau gagal (network, sesi tidak valid,
   rate limit, dll) — pemanggil WAJIB bungkus try/catch dan tampilkan
   pesannya sendiri sesuai konteks fitur (mis. lewat toast() atau UI
   loading khusus), supaya pesan error terasa pas untuk fitur itu,
   bukan generik.
   ============================================================ */

const AI_TIMEOUT_MS = 30_000; // Gemini kadang lambat; jangan biarkan nge-hang selamanya

/**
 * Kirim prompt ke mesin AI (Gemini, lewat Edge Function ai-generate) dan
 * tunggu jawaban teks.
 * @param {string} prompt - pertanyaan/instruksi utama.
 * @param {{system?: string, timeoutMs?: number}} [opsi]
 *   system: instruksi peran/gaya (opsional, mis. "Kamu asisten LPJ Karang Taruna").
 * @returns {Promise<string>} teks jawaban dari AI.
 */
async function aiTanya(prompt, opsi = {}) {
  const teks = String(prompt || '').trim();
  if (!teks) throw new Error('Prompt tidak boleh kosong');

  // Header x-session-token dipakai Edge Function untuk verifikasi sesi
  // login app (bukan Supabase Auth — lihat rpc_session_user, sama seperti
  // pola header Supabase lain di js/00-config.js). Header apikey/Authorization
  // (anon key) sudah otomatis ditambahkan oleh sb.functions.invoke().
  const headers = {};
  try {
    const token = localStorage.getItem('kt_session_token');
    if (token) headers['x-session-token'] = token;
  } catch (e) {}

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opsi.timeoutMs || AI_TIMEOUT_MS);

  let res;
  try {
    res = await sb.functions.invoke('ai-generate', {
      body: { prompt: teks, system: opsi.system || undefined },
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('AI tidak merespons (timeout), coba lagi');
    throw new Error('Gagal menghubungi server: ' + (e.message || 'tidak diketahui'));
  } finally {
    clearTimeout(timeoutId);
  }

  const { data, error } = res;
  if (error) {
    // FunctionsHttpError dari supabase-js membawa body error di error.context
    // (Response), tapi paling gampang & konsisten: coba baca dulu, fallback
    // ke error.message bawaan supabase-js kalau body-nya tidak bisa dibaca.
    let pesan = error.message || 'Gagal memanggil AI';
    try {
      const body = await error.context.json();
      if (body && body.error) pesan = body.error;
    } catch (e) {}
    throw new Error(pesan);
  }

  if (!data || !data.ok) {
    throw new Error((data && data.error) || 'AI tidak memberi jawaban');
  }

  return data.text || '';
}

// Diekspos sebagai satu object global `AI` (bukan fungsi lepas) supaya jelas
// namespace-nya dan gampang ditambah method lain nanti (mis. AI.ringkas(),
// AI.buatDraf()) tanpa mengotori variabel global lain — konsisten dengan
// pola modul lain di app ini yang pakai object namespace untuk fitur baru.
const AI = {
  tanya: aiTanya,
};
