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
      sql/39-second-brain-migration.sql) — beda dari kebanyakan
      tabel lain yang guest boleh baca — jadi wajar diperlakukan
      sebagai jalur terpisah, bukan ikut alur umum yang guest juga
      lewati.
   ============================================================ */

let secondBrainNotes = []; // {id, judul, konten, kategori, tags, event_id, created_by, created_at, updated_at} — TANPA kolom embedding (sengaja tidak di-select ke browser, lihat loadSecondBrainData())
let secondBrainLoaded = false;
let secondBrainSearchQuery = '';
let secondBrainFilterKategori = '';
// Urutan daftar biasa (BUKAN mode pencarian makna, yang selalu diurutkan
// berdasar skor relevansi) — 'terbaru' (default, sama seperti urutan dari
// server) atau 'judul' (A-Z).
let secondBrainSortBy = 'terbaru';
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

// Jumlah catatan per kategori (dari SELURUH catatan yang sudah dimuat, TIDAK
// ikut terpengaruh filter kategori yang sedang aktif) — dipakai buat angka
// di tiap chip filter supaya orang bisa lihat sebaran tanpa klik satu-satu.
function secondBrainKategoriCounts(){
  const counts = {};
  secondBrainNotes.forEach(n => { counts[n.kategori] = (counts[n.kategori]||0) + 1; });
  return counts;
}

// Urutkan daftar biasa (bukan hasil pencarian makna, yang urutannya sudah
// ditentukan skor relevansi dari server). Immutable — kembalikan array baru
// supaya tidak mengubah urutan asli secondBrainNotes (yang urutan defaultnya
// dipakai fallback kalau load ulang).
function secondBrainSortList(list){
  const arr = list.slice();
  if (secondBrainSortBy === 'judul') {
    arr.sort((a,b) => (a.judul||'').localeCompare(b.judul||'', 'id', {sensitivity:'base'}));
  } else {
    arr.sort((a,b) => new Date(b.updated_at||0) - new Date(a.updated_at||0));
  }
  return arr;
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

  const modePencarianMakna = secondBrainSearchResults !== null;
  const totalSemua = secondBrainNotes.length;
  const counts = secondBrainKategoriCounts();

  let daftarUntukDitampilkan;
  if (modePencarianMakna) {
    daftarUntukDitampilkan = secondBrainSearchResults;
  } else {
    daftarUntukDitampilkan = secondBrainSortList(secondBrainNotes.filter(n => {
      if (secondBrainFilterKategori && n.kategori !== secondBrainFilterKategori) return false;
      if (!secondBrainSearchQuery) return true;
      const q = secondBrainSearchQuery.toLowerCase();
      return (n.judul||'').toLowerCase().includes(q) || (n.konten||'').toLowerCase().includes(q);
    }));
  }

  // Chip "Semua" + 1 chip per kategori, tiap chip kasih tahu jumlah
  // catatannya — pengganti <select> lama supaya bisa 1-klik ganti filter
  // (bukan buka dropdown dulu) & sekalian jadi ringkasan sebaran kategori.
  const kategoriChips = `
    <button class="sb-kat-chip ${!secondBrainFilterKategori?'active':''}" ${da('secondBrainSetKategoriFilter','')}>
      Semua <span class="sb-kat-count">${totalSemua}</span>
    </button>
    ${SECOND_BRAIN_KATEGORI.map(k => `
    <button class="sb-kat-chip accent-${k.warna} ${secondBrainFilterKategori===k.v?'active':''}" ${da('secondBrainSetKategoriFilter', k.v)}>
      ${k.l} <span class="sb-kat-count">${counts[k.v]||0}</span>
    </button>`).join('')}
  `;

  const cards = daftarUntukDitampilkan.map(n => {
    const kat = secondBrainKategoriInfo(n.kategori);
    const cuplikan = (n.konten||'').length > 220 ? n.konten.slice(0,220) + '…' : (n.konten||'');
    const skorHtml = (typeof n.similarity === 'number')
      ? `<span class="second-brain-score" title="Skor kemiripan makna">🎯 ${Math.round(n.similarity*100)}%</span>` : '';
    const tagsHtml = (n.tags||[]).length ? `<div class="second-brain-tags">${n.tags.map(t=>`<span class="second-brain-tag">#${esc(t)}</span>`).join('')}</div>` : '';
    // Badge event supaya kelihatan jelas catatan mana yang "Semua Event"
    // (event_id null, selalu ikut ditampilkan di ringkasan/Sekarta event
    // manapun — lihat dataCatatanKontekAiInsight() js/27-ai-insight.js) vs
    // yang terikat ke satu event tertentu.
    const eventTerkait = n.event_id ? db.events.find(e=>e.id===n.event_id) : null;
    const eventBadgeHtml = n.event_id
      ? `<span class="second-brain-tag" title="Cuma ikut ditampilkan untuk event ini">📌 ${eventTerkait ? esc(eventTerkait.nama) : 'Event terhapus'}</span>`
      : `<span class="second-brain-tag" title="Selalu ikut ditampilkan di ringkasan/Sekarta event manapun">🌐 Semua Event</span>`;
    const metaBits = [`🕒 ${fmtWaktuTerakhir(n.updated_at)}`];
    if (n.created_by) metaBits.push(`✍️ ${esc(n.created_by)}`);
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
      <div class="second-brain-tags">${eventBadgeHtml}</div>
      ${tagsHtml}
      <div class="second-brain-card-meta">${metaBits.join(' · ')}</div>
    </div>`;
  }).join('');

  const infoBaris = modePencarianMakna
    ? `<div class="second-brain-info-bar">🎯 Hasil pencarian makna untuk "${esc(secondBrainSearchQuery)}" — diurutkan dari yang paling relevan (${daftarUntukDitampilkan.length}).</div>`
    : (totalSemua > 0 ? `<div class="second-brain-info-bar">Menampilkan ${daftarUntukDitampilkan.length} dari ${totalSemua} catatan.</div>` : '');

  let kosongHtml;
  if (modePencarianMakna) {
    kosongHtml = `
    <div class="second-brain-empty">
      <div class="second-brain-empty-icon">🔍</div>
      <div class="second-brain-empty-title">Tidak ketemu</div>
      <div class="second-brain-empty-desc">Tidak ada catatan yang maknanya cukup dekat dengan "${esc(secondBrainSearchQuery)}".</div>
      <button class="btn secondary" ${da('resetSecondBrainSearch')}>Kembali ke semua catatan</button>
    </div>`;
  } else if (secondBrainSearchQuery || secondBrainFilterKategori) {
    kosongHtml = `
    <div class="second-brain-empty">
      <div class="second-brain-empty-icon">🗂️</div>
      <div class="second-brain-empty-title">Tidak ada yang cocok</div>
      <div class="second-brain-empty-desc">Tidak ada catatan yang cocok dengan filter/kata kunci ini.</div>
      <button class="btn secondary" ${da('secondBrainResetSemuaFilter')}>Bersihkan filter & pencarian</button>
    </div>`;
  } else {
    kosongHtml = `
    <div class="second-brain-empty">
      <div class="second-brain-empty-icon">🧠</div>
      <div class="second-brain-empty-title">Belum ada catatan</div>
      <div class="second-brain-empty-desc">Simpan catatan, ide, ringkasan dokumen, atau konteks apa pun di sini — Sekarta (🤖) ikut memakainya saat menjawab pertanyaan yang relevan.</div>
      <button class="btn" ${da('openSecondBrainModal')}>+ Tambah Catatan Pertama</button>
    </div>`;
  }

  return `
  <div class="panel second-brain-panel">
    <div class="panel-head">
      <div><h3>🧠 Second Brain</h3><div class="desc">Catatan/ide/dokumen/konteks — bisa dicari berdasarkan makna, ikut dipakai Sekarta</div></div>
      <button class="btn" ${da('openSecondBrainModal')}>+ Tambah Catatan</button>
    </div>
    <div class="panel-body">
      <div class="second-brain-kategori-row">${kategoriChips}</div>
      <div class="second-brain-toolbar">
        <div class="second-brain-search-wrap">
          <input type="text" id="second-brain-cari" placeholder="🔎 Cari judul/isi, atau tekan Enter untuk cari berdasarkan makna…"
            value="${esc(secondBrainSearchQuery)}" oninput="secondBrainOnInputCari()" onkeydown="if(event.key==='Enter'){cariSecondBrainSemantik();}">
          ${(secondBrainSearchQuery || modePencarianMakna) ? `<button class="icon-btn" ${da('resetSecondBrainSearch')} title="Bersihkan pencarian">✕</button>` : ''}
        </div>
        <div class="second-brain-toolbar-actions">
          <button class="btn secondary" ${da('cariSecondBrainSemantik')} ${secondBrainSearching?'disabled':''}>${secondBrainSearching?'⏳ Mencari…':'🧠 Cari Makna'}</button>
          ${!modePencarianMakna ? `
          <select id="second-brain-sort" onchange="secondBrainSetSort(this.value)">
            <option value="terbaru" ${secondBrainSortBy==='terbaru'?'selected':''}>Terbaru diubah</option>
            <option value="judul" ${secondBrainSortBy==='judul'?'selected':''}>Judul (A-Z)</option>
          </select>` : ''}
        </div>
      </div>
      ${infoBaris}
      ${daftarUntukDitampilkan.length ? `<div class="second-brain-grid">${cards}</div>` : kosongHtml}
    </div>
  </div>`;
}

// Dipakai tombol "Bersihkan filter & pencarian" di empty state — beda dari
// resetSecondBrainSearch() yang cuma bersihkan kolom cari (kategori aktif
// dibiarkan), di sini SEMUA disetel ulang sekaligus supaya user langsung
// balik lihat seluruh catatan tanpa perlu klik chip "Semua" secara terpisah.
function secondBrainResetSemuaFilter(){
  secondBrainSearchQuery = ''; secondBrainSearchResults = null; secondBrainFilterKategori = '';
  renderContent();
}

// Ngetik di kolom cari = filter LOKAL instan berdasar judul/isi (tanpa
// panggil AI sama sekali, lihat cabang non-modePencarianMakna di
// renderSecondBrain di atas) — beda dari cariSecondBrainSemantik() yang baru
// jalan kalau tombol "🧠 Cari Makna" diklik / Enter ditekan (baru itu yang
// mahal, panggil AI.embed() + RPC). Ngetik baru otomatis keluar dari mode
// pencarian makna (hasil lama sudah tidak relevan buat teks yang baru).
function secondBrainOnInputCari(){
  const input = document.getElementById('second-brain-cari');
  secondBrainSearchQuery = input ? input.value : '';
  secondBrainSearchResults = null;
  renderContent();
}
function secondBrainSetKategoriFilter(v){
  secondBrainFilterKategori = v;
  // Sama alasannya seperti di atas: ganti kategori butuh filter ulang dari
  // awal, bukan nyisa hasil pencarian makna yang sudah tidak sinkron.
  secondBrainSearchResults = null;
  renderContent();
}
function secondBrainSetSort(v){
  secondBrainSortBy = v;
  renderContent();
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
  // Event terkait catatan ini — default: event yang sedang diedit-nya (kalau
  // edit), atau event aktif sekarang (kalau catatan baru). "🌐 Semua Event"
  // (event_id null) sengaja SELALU ikut dikirim ke insight/Sekarta di event
  // manapun (lihat dataCatatanKontekAiInsight() di js/27-ai-insight.js) —
  // jadi kalau catatan ini sebenarnya cuma relevan untuk satu event tertentu
  // (mis. evaluasi event yang sudah lewat), pilih event itu di sini supaya
  // TIDAK terus "nyangkut" muncul di ringkasan event-event berikutnya.
  const currentEventId = editing ? (editing.event_id || '') : (eid() || '');
  const eventOptions = [`<option value="">🌐 Semua Event (umum, selalu ikut ditampilkan di event manapun)</option>`]
    .concat(db.events.slice().sort((a,b)=>(b.tahun||0)-(a.tahun||0)).map(e=>
      `<option value="${e.id}" ${currentEventId===e.id?'selected':''}>${esc(e.nama)}${e.tahun?' ('+esc(e.tahun)+')':''} — catatan khusus event ini</option>`
    )).join('');
  setModal(editing ? 'Edit Catatan' : 'Tambah Catatan', `
    <div class="field"><label>Judul</label><input id="f-sb-judul" value="${editing?esc(editing.judul):''}" placeholder="mis. Kesepakatan lokasi jalan santai 2027"></div>
    <div class="field"><label>Kategori</label><select id="f-sb-kategori">${kategoriOptions}</select></div>
    <div class="field"><label>Isi</label>
      <textarea id="f-sb-konten" rows="6" data-autoresize="true" placeholder="Tulis catatan, ide, ringkasan dokumen, atau konteks apa pun di sini...">${editing?esc(editing.konten||''):''}</textarea>
    </div>
    <div class="field"><label>Tags (pisah koma, opsional)</label><input id="f-sb-tags" value="${editing?esc((editing.tags||[]).join(', ')):''}" placeholder="mis. lomba, anggaran, 2027"></div>
    <div class="field"><label>Berlaku Untuk</label><select id="f-sb-event">${eventOptions}</select>
      <div class="hint">Pilih event tertentu kalau catatan ini isinya spesifik untuk event itu (mis. evaluasi/catatan event yang sudah lewat) — supaya tidak terus muncul di ringkasan event lain nantinya.</div>
    </div>
    <div class="desc" style="margin-top:2px;">Catatan ini juga ikut dipakai Sekarta (🤖) saat menjawab pertanyaan yang relevan.</div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label: editing ? 'Simpan' : 'Tambah', cls:'', onclick: () => simpanSecondBrainNote(editing)},
  ]);
}

// Inti simpan-ke-server (embed + upsert) — dipakai baik dari modal Tambah/Edit
// Catatan (simpanSecondBrainNote(), baca dari form) maupun dari tawaran
// Asisten AI (asistenSimpanCatatanUsul() di js/29-asisten-ai.js, baca dari
// blok [[CATAT]] yang di-parse dari jawaban AI) — supaya logic embed+upsert
// cuma ada SATU tempat, tidak dobel-duplikat & gampang beda perilaku kalau
// nanti salah satu jalur diubah tapi yang lain lupa diikutkan.
async function simpanCatatanKeServer({ id, judul, kategori, konten, tags = [], created_by, eventId }){
  const embedding = await AI.embed(`${judul}\n\n${konten}`, { taskType: 'RETRIEVAL_DOCUMENT' });
  // eventId eksplisit (dari dropdown "Berlaku Untuk" di modal, termasuk ''
  // sengaja untuk "Semua Event") menang atas event aktif — dipakai pemanggil
  // manual (simpanSecondBrainNote). Pemanggil lain (mis. tawaran simpan dari
  // Asisten AI) tidak mengirim eventId sama sekali → tetap fallback ke event
  // aktif seperti perilaku lama.
  const resolvedEventId = eventId !== undefined ? (eventId || null) : ((typeof eid === 'function' ? eid() : null) || null);
  const row = { id, judul, konten, kategori, tags, event_id: resolvedEventId, embedding, created_by };
  const { error } = await sb.from('kt_second_brain').upsert(row, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  await loadSecondBrainData();
  secondBrainSearchResults = null;
}

async function simpanSecondBrainNote(editing){
  const judul = document.getElementById('f-sb-judul').value.trim();
  const kategori = document.getElementById('f-sb-kategori').value;
  const konten = document.getElementById('f-sb-konten').value.trim();
  const tags = document.getElementById('f-sb-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const eventId = document.getElementById('f-sb-event').value; // '' = Semua Event (umum)
  if (!judul || !konten) { toast('⛔ Judul & isi wajib diisi'); return; }

  const btnSimpan = document.querySelector('#modal-foot .btn:not(.secondary)');
  if (btnSimpan) { btnSimpan.disabled = true; btnSimpan.textContent = 'Menyimpan…'; }

  try{
    // Embed DULU sebelum nyentuh Supabase — kalau gagal (mis. kuota AI
    // habis), catatan tidak jadi setengah tersimpan tanpa embedding
    // (yang bikin catatan itu tidak akan pernah muncul di hasil
    // pencarian semantik sampai diedit ulang).
    const user = getCurrentUser();
    await simpanCatatanKeServer({
      id: editing ? editing.id : uid(),
      judul, kategori, konten, tags, eventId,
      created_by: editing ? editing.created_by : (user ? user.name : ''),
    });
    closeModal();
    toast('✅ Catatan disimpan');
    renderContent();
  }catch(e){
    console.error('Gagal menyimpan catatan Second Brain:', e);
    toast('⛔ Gagal menyimpan: ' + (e.message || 'coba lagi'));
    if (btnSimpan) { btnSimpan.disabled = false; btnSimpan.textContent = editing ? 'Simpan' : 'Tambah'; }
  }
}

async function hapusSecondBrainNote(id){
  if (!secondBrainBolehKelola()) { toast('🔒 Login untuk mengelola Second Brain'); return; }
  if (!(await confirmModal('Hapus catatan ini? Sekarta tidak akan bisa memakainya lagi setelah dihapus.'))) return;
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

// Kata umum Bahasa Indonesia yang diabaikan saat keyword match di bawah —
// supaya tidak "ke-match" ke hampir semua catatan cuma gara-gara ada kata
// generik kayak "yang"/"apa"/"berapa" dsb, bukan kata yang benar-benar
// spesifik ke isi catatannya.
const SECOND_BRAIN_STOPWORDS = new Set([
  'yang','dan','atau','ini','itu','ke','di','dari','untuk','dengan','apa',
  'apa','apakah','siapa','berapa','bagaimana','kapan','dimana','kenapa',
  'mengapa','ada','saja','juga','sudah','belum','akan','bisa','tidak',
  'tolong','coba','minta','mau','saya','kita','kami','nya','pada','oleh',
  'soal','tentang','kalau','jika','adalah','lagi','masih','gimana','gmn',
]);

// Langkah CEPAT (murni lokal, 0ms network) di alur hybrid RAG di bawah:
// cari catatan Second Brain yang judul/isi/tags-nya mengandung kata kunci
// signifikan dari pertanyaan user. Cuma kata >=4 huruf & bukan stopword
// yang dihitung, biar tidak asal cocok ke kata umum.
function secondBrainCariKeyword(pertanyaan){
  const kataKunci = String(pertanyaan || '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 4 && !SECOND_BRAIN_STOPWORDS.has(k));
  if (!kataKunci.length) return [];
  return secondBrainNotes.filter(n => {
    const teks = `${n.judul||''} ${n.konten||''} ${(n.tags||[]).join(' ')}`.toLowerCase();
    return kataKunci.some(k => teks.includes(k));
  }).slice(0, 5);
}

/* ------------------------------------------------------------
   Dipakai js/29-asisten-ai.js untuk RAG: cari catatan Second Brain yang
   relevan dengan pertanyaan user, kembalikan sebagai teks ringkas
   siap-tempel ke prompt. Return string kosong kalau tidak ada yang
   relevan atau user belum login (Asisten AI sendiri sudah menggate
   ini, tapi dijaga dobel di sini juga).

   HYBRID (2 lapis), demi kecepatan:
   1) Keyword match dulu — instan, murni lokal, TANPA panggil Gemini
      sama sekali. Cukup buat pertanyaan yang kata-katanya memang mirip
      persis dengan judul/isi catatan (kasus paling umum).
   2) Kalau keyword match nihil (kata user beda tapi maknanya sama,
      mis. "kontak vendor katering" vs judul "Info WA Bu Siti -
      catering"), baru fallback ke semantic search lewat Gemini
      (lebih lambat, tapi lebih pintar soal makna).
   ------------------------------------------------------------ */
async function secondBrainCariUntukAsisten(pertanyaan){
  if (!secondBrainBolehKelola()) return '';
  // Optimisasi aman: kalau memang belum ada catatan Second Brain sama
  // sekali (sudah dimuat lebih dulu oleh loadSecondBrainData() saat app
  // init), tidak ada gunanya lanjut ke keyword match apalagi embed+RPC —
  // hasilnya pasti kosong juga.
  if (typeof secondBrainNotes === 'undefined' || !Array.isArray(secondBrainNotes) || secondBrainNotes.length === 0) {
    return '';
  }

  // Lapis 1: keyword match instan.
  const hasilKeyword = secondBrainCariKeyword(pertanyaan);
  if (hasilKeyword.length > 0) {
    return hasilKeyword.map(r => `[${secondBrainKategoriInfo(r.kategori).l}] ${r.judul}: ${r.konten}`).join('\n');
  }

  // Lapis 2: fallback semantic search (lewat Gemini) kalau keyword nihil.
  try{
    // Timeout lebih pendek (8 detik) khusus utk step RAG ini — ini cuma
    // konteks TAMBAHAN (opsional), bukan inti jawaban, jadi kalau lambat
    // lebih baik cepat menyerah & lanjut ke jawaban utama (lihat catch di
    // bawah, sudah gagal-diam sejak awal) daripada ikut menunggu sampai
    // batas AI_TIMEOUT_MS default (30 detik) sebelum chat sempat mulai
    // menjawab.
    const vec = await AI.embed(pertanyaan, { taskType: 'RETRIEVAL_QUERY', timeoutMs: 8000 });
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
