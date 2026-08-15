/* ============================================================
   MESIN AI — klien generik untuk /api/ai (proxy Gemini di
   src/worker.js). Ini INFRASTRUKTUR, belum terikat fitur tertentu.

   Cara pakai dari modul manapun (nanti):
     const jawaban = await AI.tanya('Ringkas data ini: ...');
     const jawaban2 = await AI.tanya('...', { system: 'Kamu asisten X' });

   AI.tanya() melempar Error kalau gagal (network, sesi tidak valid,
   rate limit, dll) — pemanggil WAJIB bungkus try/catch dan tampilkan
   pesannya sendiri sesuai konteks fitur (mis. lewat toast() atau UI
   loading khusus), supaya pesan error terasa pas untuk fitur itu,
   bukan generik.
   ============================================================ */

const AI_ENDPOINT = '/api/ai';
const AI_TIMEOUT_MS = 30_000; // Gemini kadang lambat; jangan biarkan nge-hang selamanya

/**
 * Kirim prompt ke mesin AI (Gemini, lewat Worker) dan tunggu jawaban teks.
 * @param {string} prompt - pertanyaan/instruksi utama.
 * @param {{system?: string, timeoutMs?: number}} [opsi]
 *   system: instruksi peran/gaya (opsional, mis. "Kamu asisten LPJ Karang Taruna").
 * @returns {Promise<string>} teks jawaban dari AI.
 */
async function aiTanya(prompt, opsi = {}) {
  const teks = String(prompt || '').trim();
  if (!teks) throw new Error('Prompt tidak boleh kosong');

  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('kt_session_token');
    if (token) headers['x-session-token'] = token;
  } catch (e) {}

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opsi.timeoutMs || AI_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: teks, system: opsi.system || undefined }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('AI tidak merespons (timeout), coba lagi');
    throw new Error('Gagal menghubungi server: ' + (e.message || 'tidak diketahui'));
  } finally {
    clearTimeout(timeoutId);
  }

  let result;
  try {
    result = await response.json();
  } catch (e) {
    throw new Error('Respons server tidak valid');
  }

  if (!response.ok || !result.ok) {
    throw new Error(result.error || `Gagal memanggil AI (status ${response.status})`);
  }

  return result.text || '';
}

// Diekspos sebagai satu object global `AI` (bukan fungsi lepas) supaya jelas
// namespace-nya dan gampang ditambah method lain nanti (mis. AI.ringkas(),
// AI.buatDraf()) tanpa mengotori variabel global lain — konsisten dengan
// pola modul lain di app ini yang pakai object namespace untuk fitur baru.
const AI = {
  tanya: aiTanya,
};
