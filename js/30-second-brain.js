/* ============================================================
   SECOND BRAIN — memori operasional eksternal berbasis AI.
   Tempat simpan catatan/ide/dokumen/konteks bebas (bukan data
   transaksional seperti anggota/kas/dsb — itu semua sudah ada
   menunya sendiri) yang bisa dicari BERDASARKAN MAKNA (semantic
   search lewat embedding vector, bukan cuma cocok kata kunci
   persis) — bisa diakses manusia (menu ini) MAUPUN Asisten AI
   (js/29-asisten-ai.js melakukan RAG: embed pertanyaan user, cari
   catatan yang relevan di sini, sertakan ke prompt sebelum jawab).

   ARSITEKTUR — pola SAMA seperti Gudang (js/17a-gudang-core.js):
   variabel modul sendiri, fetch/tulis LANGSUNG ke tabel
   kt_second_brain, DI LUAR `db`/saveDB(). Kenapa bukan lewat pola
   db.xxx + ARRAY_TABLE_MAP biasa (lihat js/03-db-core.js)?
   1. Kolom `embedding` (vector 768 dimensi) tidak pernah diedit
      manual oleh user — dia dihitung ulang tiap kali judul/konten
      berubah (panggil AI.embed()), beda sifatnya dari kolom lain
      yang datang langsung dari form. Nyampur ke syncArrayTable()
      generik (yang mendiff SEMUA kolom apa adanya) berisiko field
      vector besar ikut kebanding-bandingkan / ke-upsert percuma.
   2. Catatan di sini sengaja TIDAK ikut backup "Backup Semua Data"
      (exportData()/importData() di 15-pengaturan-event.js) — sama
      seperti pengecualian Gudang yang didokumentasikan di CLAUDE.md.
      Kalau nanti perlu backup terpisah, tinggal bikin
      secondBrainExportJSON()/ImportJSON() sendiri (pola sama seperti
      gudangExportJSON()) — belum dibuat di versi ini.
   3. Akses tabelnya DIKUNCI untuk user login saja (lihat RLS di
      supabase-second-brain-migration.sql) — beda dari kebanyakan
      tabel lain yang guest boleh baca — jadi wajar diperlakukan
      sebagai jalur terpisah, bukan ikut alur umum yang guest juga
      lewati.
   ============================================================ */

let secondBrainNotes = []; // {id, judul, konten, kategori, tags, event_id, created_by, created_at, updated_at} — TANPA kolom embedding (sengaja tidak di-select ke browser, lihat loadSecondBrainData())
let secondBrainLoaded = false;
let secondBrainSearchQuery = '';
let secondBrainFilterKategori = '';
// Hasil pencarian semantik terakhir: null = belum pernah cari (tampilkan
// daftar biasa), array = hasil pencarian (tampilkan diurutkan skor makna).
let secondBrainSearchResults = null;
let secondBrainSearching = false;

const SECOND_BRAIN_KATEGORI = [
  { v: 'catatan', l: '📝 Catatan', warna: 'biru' },
  { v: 'ide', l: '💡 Ide', warna: 'gold' },
  { v: 'dokumen', l: '📄 Dokumen', warna: 'ungu' },
  { v: 'konteks', l: '🧩 Konteks', warna: 'hijau' },
];
function secondBrainKategoriInfo(v){
  return SECOND_BRAIN_KATEGORI.find(k => k.v === v) || SECOND_BRAIN_KATEGORI[0];
}

function secondBrainBolehKelola(){
  // Sama seperti Asisten AI: fitur ini digate untuk user login (bukan
  // guest) — lihat alasan lengkap di kepala file & migrasi SQL.
  return !!getCurrentUser();
}

/* ------------------------------------------------------------
   LOAD — fetch langsung dari Supabase, TIDAK termasuk kolom
   `embedding` (vector 768 angka per baris tidak perlu dikirim ke
   browser cuma buat ditampilkan; dia cuma dipakai server-side lewat
   RPC kt_second_brain_search). Kalau belum login, tidak usah fetch
   sama sekali (RLS akan menolaknya juga, tapi lebih baik tidak
   coba-coba supaya tidak ada toast error yang membingungkan).
   ------------------------------------------------------------ */
async function loadSecondBrainData(){
  if (!secondBrainBolehKelola()) { secondBrainNotes = []; secondBrainLoaded = false; return true; }
  try{
    const res = await sb.from('kt_second_brain')
      .select('id, judul, konten, kategori, tags, event_id, created_by, created_at, updated_at')
      .order('updated_at', {ascending:false});
    if (res.error) throw new Error(res.error.message);
    secondBrainNotes = res.data || [];
    secondBrainLoaded = true;
    return true;
  }catch(e){
    console.error('Gagal memuat data Second Brain:', e);
    toast('⛔ Gagal memuat Second Brain: ' + (e.message || 'periksa koneksi lalu coba lagi'));
    return false;
  }
}

async function secondBrainRefresh(){
  toast('⏳ Menyegarkan Second Brain...');
  const ok = await loadSecondBrainData();
  if (currentSection === 'second-brain') renderContent();
  if (ok) toast('✅ Second Brain diperbarui.');
}

/* ------------------------------------------------------------
   RENDER
   ------------------------------------------------------------ */
function renderSecondBrain(){
  if (!secondBrainBolehKelola()) {
    return `
    <div class="panel">
      <div class="panel-head"><div><h3>🧠 Second Brain</h3><div class="desc">Memori catatan/ide/dokumen yang bisa dicari berdasarkan makna</div></div></div>
      <div class="panel-body"><div class="empty-row" style="padding:30px;text-align:center;">🔒 Login untuk mengakses Second Brain.</div></div>
    </div>`;
  }

  const daftarUntukDitampilkan = secondBrainSearchResults !== null
    ? secondBrainSearchResults
    : secondBrainNotes.filter(n => {
        if (secondBrainFilterKategori && n.kategori !== secondBrainFilterKategori) return false;
        if (!secondBrainSearchQuery) return true;
        const q = secondBrainSearchQuery.toLowerCase();
        return (n.judul||'').toLowerCase().includes(q) || (n.konten||'').toLowerCase().includes(q);
      });

  const kategoriOptions = SECOND_BRAIN_KATEGORI.map(k => `<option value="${k.v}" ${secondBrainFilterKategori===k.v?'selected':''}>${k.l}</option>`).join('');

  const cards = daftarUntukDitampilkan.map(n => {
    const kat = secondBrainKategoriInfo(n.kategori);
    const cuplikan = (n.konten||'').length > 220 ? n.konten.slice(0,220) + '…' : (n.konten||'');
    const skorHtml = (typeof n.similarity === 'number')
      ? `<span class="second-brain-score" title="Skor kemiripan makna">🎯 ${Math.round(n.similarity*100)}%</span>` : '';
    const tagsHtml = (n.tags||[]).length ? `<div class="second-brain-tags">${n.tags.map(t=>`<span class="second-brain-tag">#${esc(t)}</span>`).join('')}</div>` : '';
    return `
    <div class="second-brain-card accent-${kat.warna}">
      <div class="second-brain-card-top">
        <span class="second-brain-kategori-badge">${kat.l}</span>
        ${skorHtml}
        <div class="second-brain-card-actions">
          <button class="icon-btn" ${da('openSecondBrainModal', n.id)} title="Edit">✎</button>
          <button class="icon-btn" ${da('hapusSecondBrainNote', n.id)} title="Hapus">🗑</button>
        </div>
      </div>
      <div class="second-brain-card-title">${esc(n.judul)}</div>
      <div class="second-brain-card-body">${esc(cuplikan)}</div>
      ${tagsHtml}
    </div>`;
  }).join('');

  const emptyMsg = secondBrainSearchResults !== null
    ? 'Tidak ada catatan yang maknanya cukup dekat dengan pencarian ini.'
    : (secondBrainSearchQuery || secondBrainFilterKategori ? 'Tidak ada catatan yang cocok dengan filter ini.' : 'Belum ada catatan. Tambahkan catatan/ide/dokumen pertama supaya Asisten AI juga bisa memakainya.');

  return `
  <div class="panel">
    <div class="panel-head">
      <div><h3>🧠 Second Brain</h3><div class="desc">Catatan/ide/dokumen/konteks — bisa dicari berdasarkan makna, ikut dipakai Asisten AI</div></div>
      <button class="btn" ${da('openSecondBrainModal')}>+ Tambah Catatan</button>
    </div>
    <div class="panel-body">
      <div class="second-brain-toolbar">
        <input type="text" id="second-brain-cari" placeholder="🔎 Cari berdasarkan makna… (mis. 'rencana kegiatan tahun depan')"
          value="${esc(secondBrainSearchQuery)}" onkeydown="if(event.key==='Enter'){cariSecondBrainSemantik();}">
        <button class="btn secondary" ${da('cariSecondBrainSemantik')} ${secondBrainSearching?'disabled':''}>${secondBrainSearching?'⏳ Mencari…':'Cari'}</button>
        <select id="second-brain-filter-kategori" onchange="secondBrainFilterKategori=this.value; secondBrainSearchResults=null; renderContent();">
          <option value="">Semua kategori</option>
          ${kategoriOptions}
        </select>
        ${secondBrainSearchResults !== null ? `<button class="icon-btn" ${da('resetSecondBrainSearch')} title="Kembali ke daftar biasa">✕</button>` : ''}
      </div>
      ${secondBrainSearchResults !== null ? `<div class="desc" style="margin:8px 2px 0;">Hasil pencarian makna untuk "${esc(secondBrainSearchQuery)}" — diurutkan dari yang paling relevan.</div>` : ''}
      ${daftarUntukDitampilkan.length ? `<div class="second-brain-grid" style="margin-top:14px;">${cards}</div>` : `<div class="empty-row" style="padding:30px;text-align:center;">${emptyMsg}</div>`}
    </div>
  </div>`;
}

/* ------------------------------------------------------------
   PENCARIAN SEMANTIK — embed query (taskType RETRIEVAL_QUERY, lihat
   catatan asimetri di ai-embed/index.ts), lalu panggil RPC
   kt_second_brain_search. Discope ke event aktif KALAU sedang ada
   event aktif (catatan global tetap ikut kecari, cuma catatan milik
   event LAIN yang disaring keluar) — lihat p_event_id di migrasi SQL.
   ------------------------------------------------------------ */
async function cariSecondBrainSemantik(){
  const input = document.getElementById('second-brain-cari');
  const q = (input ? input.value : secondBrainSearchQuery).trim();
  secondBrainSearchQuery = q;
  if (!q) { secondBrainSearchResults = null; renderContent(); return; }

  secondBrainSearching = true;
  renderContent();
  try{
    const vec = await AI.embed(q, { taskType: 'RETRIEVAL_QUERY' });
    const eventId = typeof eid === 'function' ? eid() : null;
    const { data, error } = await sb.rpc('kt_second_brain_search', {
      p_query_embedding: vec, p_match_count: 10, p_event_id: eventId || null,
    });
    if (error) throw new Error(error.message);
    secondBrainSearchResults = (data || []).filter(r => !secondBrainFilterKategori || r.kategori === secondBrainFilterKategori);
  }catch(e){
    console.error('Gagal mencari Second Brain:', e);
    toast('⛔ Gagal mencari: ' + (e.message || 'coba lagi'));
    secondBrainSearchResults = null;
  }finally{
    secondBrainSearching = false;
    renderContent();
  }
}
function resetSecondBrainSearch(){
  secondBrainSearchResults = null; secondBrainSearchQuery = '';
  renderContent();
}

/* ------------------------------------------------------------
   CRUD — embedding dihitung ulang tiap simpan (judul+konten
   digabung, RETRIEVAL_DOCUMENT — lihat catatan asimetri di atas)
   supaya pencarian makna selalu berbasis isi TERBARU, bukan embedding
   basi dari draf sebelumnya.
   ------------------------------------------------------------ */
function openSecondBrainModal(id){
  if (!secondBrainBolehKelola()) { toast('🔒 Login untuk mengelola Second Brain'); return; }
  const editing = id ? secondBrainNotes.find(n => n.id === id) : null;
  const kategoriOptions = SECOND_BRAIN_KATEGORI.map(k => `<option value="${k.v}" ${(editing?editing.kategori:'catatan')===k.v?'selected':''}>${k.l}</option>`).join('');
  setModal(editing ? 'Edit Catatan' : 'Tambah Catatan', `
    <div class="field"><label>Judul</label><input id="f-sb-judul" value="${editing?esc(editing.judul):''}" placeholder="mis. Kesepakatan lokasi jalan santai 2027"></div>
    <div class="field"><label>Kategori</label><select id="f-sb-kategori">${kategoriOptions}</select></div>
    <div class="field"><label>Isi</label>
      <textarea id="f-sb-konten" rows="6" data-autoresize="true" placeholder="Tulis catatan, ide, ringkasan dokumen, atau konteks apa pun di sini...">${editing?esc(editing.konten||''):''}</textarea>
    </div>
    <div class="field"><label>Tags (pisah koma, opsional)</label><input id="f-sb-tags" value="${editing?esc((editing.tags||[]).join(', ')):''}" placeholder="mis. lomba, anggaran, 2027"></div>
    <div class="desc" style="margin-top:2px;">Catatan ini juga ikut dipakai Asisten AI (🤖) saat menjawab pertanyaan yang relevan.</div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label: editing ? 'Simpan' : 'Tambah', cls:'', onclick: () => simpanSecondBrainNote(editing)},
  ]);
}

async function simpanSecondBrainNote(editing){
  const judul = document.getElementById('f-sb-judul').value.trim();
  const kategori = document.getElementById('f-sb-kategori').value;
  const konten = document.getElementById('f-sb-konten').value.trim();
  const tags = document.getElementById('f-sb-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  if (!judul || !konten) { toast('⛔ Judul & isi wajib diisi'); return; }

  const btnSimpan = document.querySelector('#modal-foot .btn:not(.secondary)');
  if (btnSimpan) { btnSimpan.disabled = true; btnSimpan.textContent = 'Menyimpan…'; }

  try{
    // Embed DULU sebelum nyentuh Supabase — kalau gagal (mis. kuota AI
    // habis), catatan tidak jadi setengah tersimpan tanpa embedding
    // (yang bikin catatan itu tidak akan pernah muncul di hasil
    // pencarian semantik sampai diedit ulang).
    const embedding = await AI.embed(`${judul}\n\n${konten}`, { taskType: 'RETRIEVAL_DOCUMENT' });
    const user = getCurrentUser();
    const eventId = typeof eid === 'function' ? eid() : null;
    const row = {
      id: editing ? editing.id : uid(),
      judul, konten, kategori, tags,
      event_id: eventId || null,
      embedding,
      created_by: editing ? editing.created_by : (user ? user.name : ''),
    };
    const { error } = await sb.from('kt_second_brain').upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);

    closeModal();
    toast('✅ Catatan disimpan');
    await loadSecondBrainData();
    secondBrainSearchResults = null;
    renderContent();
  }catch(e){
    console.error('Gagal menyimpan catatan Second Brain:', e);
    toast('⛔ Gagal menyimpan: ' + (e.message || 'coba lagi'));
    if (btnSimpan) { btnSimpan.disabled = false; btnSimpan.textContent = editing ? 'Simpan' : 'Tambah'; }
  }
}

async function hapusSecondBrainNote(id){
  if (!secondBrainBolehKelola()) { toast('🔒 Login untuk mengelola Second Brain'); return; }
  if (!(await confirmModal('Hapus catatan ini? Asisten AI tidak akan bisa memakainya lagi setelah dihapus.'))) return;
  try{
    const { error } = await sb.from('kt_second_brain').delete().eq('id', id);
    if (error) throw new Error(error.message);
    secondBrainNotes = secondBrainNotes.filter(n => n.id !== id);
    if (secondBrainSearchResults) secondBrainSearchResults = secondBrainSearchResults.filter(n => n.id !== id);
    renderContent();
    toast('🗑 Catatan dihapus');
  }catch(e){
    console.error('Gagal menghapus catatan Second Brain:', e);
    toast('⛔ Gagal menghapus: ' + (e.message || 'coba lagi'));
  }
}

/* ------------------------------------------------------------
   Dipakai js/29-asisten-ai.js untuk RAG: embed pertanyaan user
   (RETRIEVAL_QUERY), cari catatan relevan, kembalikan sebagai teks
   ringkas siap-tempel ke prompt. Return string kosong kalau tidak
   ada yang cukup relevan atau user belum login (Asisten AI sendiri
   sudah menggate ini, tapi dijaga dobel di sini juga).
   ------------------------------------------------------------ */
async function secondBrainCariUntukAsisten(pertanyaan){
  if (!secondBrainBolehKelola()) return '';
  try{
    const vec = await AI.embed(pertanyaan, { taskType: 'RETRIEVAL_QUERY' });
    const eventId = typeof eid === 'function' ? eid() : null;
    const { data, error } = await sb.rpc('kt_second_brain_search', {
      p_query_embedding: vec, p_match_count: 5, p_event_id: eventId || null,
    });
    if (error) throw new Error(error.message);
    // Ambang batas skor supaya catatan yang jauh maknanya tidak ikut
    // "dipaksakan" masuk prompt (bikin AI ngarang keterkaitan yang
    // sebenarnya tidak ada) — 0.5 dipilih longgar (bukan hasil tuning
    // ketat), cukup untuk buang hasil yang jelas-jelas tidak nyambung.
    const relevan = (data || []).filter(r => r.similarity >= 0.5);
    if (!relevan.length) return '';
    return relevan.map(r => `[${secondBrainKategoriInfo(r.kategori).l}] ${r.judul}: ${r.konten}`).join('\n');
  }catch(e){
    console.error('Gagal mencari Second Brain untuk Asisten AI:', e);
    return ''; // gagal diam-diam di sini — Asisten AI tetap bisa jawab pakai konteks lain, jangan sampai satu fitur gagal menjatuhkan seluruh chat
  }
}
