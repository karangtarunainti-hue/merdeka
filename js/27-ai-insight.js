/* ============================================================
   INSIGHT AI — BUKU KEGIATAN (DASHBOARD)
   Panel narasi otomatis di atas 3 card ringkasan (Total Pemasukan/
   Pengeluaran/Saldo di renderDashboard(), js/07-dashboard.js).

   Alur:
   1. renderDashboard() panggil ensureBukuKegiatanInsight(b) tiap render,
      dikasih hasil hitungBukuUtama() yang sudah dihitung di sana (supaya
      tidak hitung 2x).
   2. Fungsi ini bikin "data_hash" dari angka-angka yang menyusun 3 card,
      DITAMBAH jumlah anggota belum bayar iuran & agenda kegiatan 7 hari ke
      depan (lihat dataAnggotaBelumBayar()/dataAgendaMendatang()) — kalau
      hash-nya SAMA dengan cache tersimpan (db.aiInsight[eventId]), berarti
      tidak ada perubahan sejak ringkasan terakhir dibuat → tidak perlu
      panggil AI lagi, langsung pakai cache.
   3. Kalau hash beda (atau belum pernah ada sama sekali) → generate baru
      di background (tidak blocking render pertama), simpan ke Supabase
      (kt_ai_insight, keyed per event_id) + db.aiInsight di memori, lalu
      renderContent() ulang begitu selesai supaya panel ke-update.
   4. Guest & user yang belum login TIDAK memicu generate (biar AI call
      dikontrol siapa yang login saja) — mereka cuma baca cache yang sudah
      ada. Kalau belum pernah ada sama sekali & yang buka guest, panel
      menampilkan pesan netral, bukan skeleton loading kosong.

   renderBukuKegiatanInsightPanel() dipanggil dari renderDashboard() untuk
   dapat HTML panel-nya (loading/narasi/error), taruh SEBELUM stat-grid-ringkasan.
   ============================================================ */

// Event_id yang sedang dalam proses generate — cegah AI.tanya() dobel kalau
// renderDashboard() ke-trigger berkali-kali sebelum generate pertama selesai
// (mis. user pindah tab lalu balik lagi, atau refreshFromServer() jalan).
const _aiInsightGenerating = new Set();
// Event_id yang generate-nya baru saja GAGAL — dipakai supaya panel bisa
// menampilkan tombol "Coba lagi" alih-alih diam-diam retry terus setiap render.
const _aiInsightFailed = new Set();
// Hash data yang gagal terakhir kali, per event_id — kalau data BERUBAH lagi
// setelah gagal (mis. ada transaksi baru), tetap boleh auto-retry karena ini
// percobaan baru untuk data baru, bukan retry buta untuk data yang sama.
const _aiInsightFailedHash = new Map();

// Naikkan angka ini SETIAP KALI system prompt (gaya bahasa/instruksi AI di
// bawah) diubah — supaya cache lama (kt_ai_insight) otomatis dianggap usang
// dan AI generate ulang dengan gaya baru, walau angka kas belum berubah.
// Tanpa ini, ganti prompt saja tidak akan terlihat efeknya sampai ada
// transaksi baru yang mengubah data_hash.
const AI_INSIGHT_PROMPT_VERSION = 3;

// Hash sederhana (bukan kriptografis, cuma penanda "data sumbernya sama atau
// tidak") dari angka-angka yang menyusun 3 card ringkasan + rincian di
// baliknya, DITAMBAH anggota belum bayar & agenda kegiatan mendatang (lihat
// dataAnggotaBelumBayar()/dataAgendaMendatang() di bawah) — supaya cache
// ikut invalid kalau salah satu dari itu berubah, bukan cuma angka kas.
// String short & deterministik: cukup sensitif kalau salah satu komponen
// berubah, tanpa perlu hash library tambahan.
function hitungAiInsightDataHash(b){
  const anggotaBelum = dataAnggotaBelumBayar();
  const agenda = dataAgendaMendatang();
  const bagian = [
    AI_INSIGHT_PROMPT_VERSION,
    b.iuran, b.jumlahIuranLunas,
    b.donasi, b.jumlahDonatur, b.jumlahDonaturBarang,
    b.transaksiLain, b.jumlahTransaksiLain,
    b.opsional, b.jumlahOperasional,
    b.kebutuhanLomba, b.jumlahKebutuhanLomba,
    b.hadiahLomba, b.jumlahItemHadiahLomba,
    b.hadiahJalan, b.jumlahHadiahJalan,
    b.saldo,
    anggotaBelum.jumlah, anggotaBelum.totalNominal,
    agenda.map(a => `${a.id}:${a.tanggal}:${a.status}`).join(','),
  ];
  return bagian.join('|');
}

// Anggota yang belum lunas iuran untuk event aktif — dipakai baik untuk
// hash (deteksi perubahan) maupun isi prompt AI. Cuma jumlah & total
// nominal yang belum masuk yang dikirim ke AI (bukan daftar nama satu-satu)
// supaya prompt tetap ringkas dan tidak menyebut individu di ringkasan
// dashboard yang bisa dilihat siapa saja yang login.
function dataAnggotaBelumBayar(){
  const list = gAnggota().filter(a => a.status !== 'lunas');
  const totalNominal = list.reduce((s,a) => s + Number(a.nominal_wajib||0), 0);
  return { jumlah: list.length, totalNominal };
}

// Agenda kegiatan (global, tidak terikat event — lihat gAgenda()) dalam 7
// hari ke depan, status belum selesai. Polanya sama seperti upcomingAgenda
// di generateReminders() (js/07-dashboard.js), sengaja dihitung ulang di sini
// (bukan pakai ulang variabel dari generateReminders) supaya modul ini tidak
// bergantung urutan pemanggilan renderDashboard().
function dataAgendaMendatang(){
  const today = new Date();
  return gAgenda().filter(a => a.status !== 'selesai').filter(a => {
    const aDate = new Date(a.tanggal + 'T00:00:00');
    const diffDays = Math.ceil((aDate - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
}

function getAiInsightCache(){
  const eventId = db.activeEventId;
  if(!eventId) return null;
  return db.aiInsight[eventId] || null;
}

// Dipanggil dari renderDashboard(). TIDAK mengembalikan apa-apa yang perlu
// di-await — kalau perlu generate baru, jalan di background lalu memicu
// renderContent() sendiri saat selesai. Render pertama tetap pakai cache
// lama (kalau ada) sambil generate baru jalan di belakang, supaya panel
// tidak "kedip" kosong tiap kali ada transaksi baru.
function ensureBukuKegiatanInsight(b){
  const eventId = db.activeEventId;
  if(!eventId) return;

  const hash = hitungAiInsightDataHash(b);
  const cache = getAiInsightCache();
  const sudahUpToDate = cache && cache.dataHash === hash;
  const sedangProses = _aiInsightGenerating.has(eventId);
  // Baru saja gagal UNTUK DATA YANG SAMA → JANGAN auto-retry tiap render
  // (renderContent() yang dipanggil generateBukuKegiatanInsight() sendiri
  // saat selesai/gagal akan memicu ensureBukuKegiatanInsight() lagi lewat
  // renderDashboard() — tanpa guard ini jadi loop generate-gagal-render-
  // generate tanpa henti, apalagi kalau penyebab gagalnya persisten seperti
  // error CORS/config server, bukan sekadar timeout sesaat). Tunggu user
  // klik tombol "Coba lagi" (retryBukuKegiatanInsight) — KECUALI datanya
  // sudah berubah lagi sejak percobaan gagal terakhir, itu dianggap
  // percobaan baru dan tetap boleh auto-retry.
  const baruSajaGagal = _aiInsightFailed.has(eventId) && _aiInsightFailedHash.get(eventId) === hash;

  if(sudahUpToDate || sedangProses || baruSajaGagal) return;

  // Guest/belum login tidak memicu generate — cukup baca cache yang ada
  // (lihat catatan di atas file). Kalau belum ada cache sama sekali,
  // renderBukuKegiatanInsightPanel() yang urus tampilkan pesan netralnya.
  if(!getCurrentUser()) return;

  generateBukuKegiatanInsight(eventId, b, hash);
}

async function generateBukuKegiatanInsight(eventId, b, hash){
  _aiInsightGenerating.add(eventId);
  _aiInsightFailed.delete(eventId);
  _aiInsightFailedHash.delete(eventId);
  // Render supaya skeleton loading langsung muncul (kalau belum ada cache
  // sebelumnya) tanpa nunggu AI selesai.
  if(currentSection === 'dashboard') renderContent();

  try{
    const teks = await aiTanya(buatPromptInsightBukuKegiatan(b), {
      system: 'Kamu asisten keuangan untuk aplikasi kas Karang Taruna. Tulis ringkasan kondisi kas dalam Bahasa Indonesia formal bergaya laporan pertanggungjawaban (LPJ) resmi — bahasa baku, lugas, dan objektif, sudut pandang orang ketiga/institusional (mis. "Kas organisasi per tanggal ini tercatat...", "Iuran anggota telah terealisasi sebesar..."). Hindari sapaan akrab ("teman-teman", "kita", "yuk") maupun bahasa sehari-hari/santai. 3-5 kalimat, boleh diakhiri 1 kalimat rekomendasi/catatan tindak lanjut jika relevan (tidak wajib dipaksakan tiap kali). Kalau datanya ada anggota belum bayar iuran atau agenda kegiatan dalam 7 hari ke depan, boleh disinggung singkat kalau relevan dengan kondisi kas (jangan sebut nama anggota, cukup jumlah). Jangan mengulang semua angka yang sudah tampil di layar — pilih yang paling penting untuk diberi konteks/makna. Jangan pakai heading, bullet, atau markdown, cukup paragraf biasa.',
    });

    const ringkasan = String(teks || '').trim();
    if(!ringkasan) throw new Error('AI tidak memberi ringkasan');

    db.aiInsight[eventId] = { ringkasan, dataHash: hash, generatedAt: new Date().toISOString() };
    // Tulis langsung ke kt_ai_insight (bukan lewat siklus saveDB() biasa —
    // lihat catatan di defaultDB()). last-write-wins sengaja dipilih di sini,
    // lihat catatan di supabase-ai-insight-migration.sql.
    const { error } = await sb.from('kt_ai_insight').upsert({
      event_id: eventId,
      ringkasan,
      data_hash: hash,
      generated_at: db.aiInsight[eventId].generatedAt,
    }, { onConflict: 'event_id' });
    if(error) console.error('Gagal menyimpan kt_ai_insight (tetap tampil dari memori):', error);
  }catch(e){
    console.error('Gagal membuat Insight AI Buku Kegiatan:', e);
    _aiInsightFailed.add(eventId);
    _aiInsightFailedHash.set(eventId, hash);
  }finally{
    _aiInsightGenerating.delete(eventId);
    if(currentSection === 'dashboard') renderContent();
  }
}

function buatPromptInsightBukuKegiatan(b){
  const org = getOrgProfil();
  const ev = activeEvent();
  const baris = [];
  baris.push(`Organisasi: ${org.nama}${ev ? ` — event aktif: ${ev.nama} ${ev.tahun||''}`.trim() : ''}`);
  baris.push('');
  baris.push('PEMASUKAN:');
  baris.push(`- Iuran anggota: ${fmtRp(b.iuran)} (${b.jumlahIuranLunas} anggota sudah lunas)`);
  baris.push(`- Donasi: ${fmtRp(b.donasi)} (${b.jumlahDonatur} donatur uang${b.jumlahDonaturBarang>0?`, ditambah ${b.jumlahDonaturBarang} donatur barang di luar hitungan kas`:''})`);
  baris.push(`- Pemasukan lain: ${fmtRp(b.transaksiLain)} (${b.jumlahTransaksiLain} transaksi)`);
  baris.push(`Total Pemasukan: ${fmtRp(b.pemasukan)}`);
  baris.push('');
  baris.push('PENGELUARAN:');
  baris.push(`- Operasional kegiatan: ${fmtRp(b.opsional)} (${b.jumlahOperasional} biaya tercatat)`);
  baris.push(`- Kebutuhan lomba: ${fmtRp(b.kebutuhanLomba)} (${b.jumlahKebutuhanLomba} item)`);
  baris.push(`- Hadiah lomba: ${fmtRp(b.hadiahLomba)} (${b.jumlahItemHadiahLomba} item sudah dibeli)`);
  baris.push(`- Hadiah jalan santai: ${fmtRp(b.hadiahJalan)} (${b.jumlahHadiahJalan} item)`);
  baris.push(`Total Pengeluaran: ${fmtRp(b.pengeluaran)}`);
  baris.push('');
  baris.push(`SALDO AKHIR: ${fmtRp(b.saldo)} (proyeksi anggaran, sudah termasuk kebutuhan & hadiah yang direncanakan meski belum tentu semuanya sudah dibelanjakan)`);
  baris.push('');

  const anggotaBelum = dataAnggotaBelumBayar();
  if(anggotaBelum.jumlah > 0){
    baris.push(`ANGGOTA BELUM BAYAR IURAN: ${anggotaBelum.jumlah} anggota, estimasi ${fmtRp(anggotaBelum.totalNominal)} belum masuk kas kalau semua lunas. (Jangan sebut nama, cukup jumlah/nominal.)`);
    baris.push('');
  }

  const agenda = dataAgendaMendatang();
  if(agenda.length > 0){
    const daftarAgenda = agenda.map(a => `${a.judul} (${labelKategoriJadwal(a.kategori)}, ${fmtDateHari(a.tanggal)})`).join('; ');
    baris.push(`AGENDA KEGIATAN 7 HARI KE DEPAN: ${daftarAgenda}`);
    baris.push('');
  }

  baris.push('Tulis ringkasan kondisi kas di atas untuk ditampilkan di dashboard aplikasi.');
  return baris.join('\n');
}

function retryBukuKegiatanInsight(){
  const eventId = db.activeEventId;
  if(!eventId) return;
  const b = hitungBukuUtama();
  const hash = hitungAiInsightDataHash(b);
  generateBukuKegiatanInsight(eventId, b, hash);
}

// Bold-kan nominal rupiah (mis. "Rp 2.610.000") di dalam teks ringkasan AI
// yang sudah di-escape, supaya angka penting lebih menonjol tanpa perlu AI
// mengirim markdown (yang memang dilarang lewat system prompt). Regex jalan
// SETELAH esc() jadi aman dari HTML injection — cuma menambah tag <strong>
// di sekitar pola "Rp ...." yang ditemukan.
function boldNominalRp(escapedText){
  return escapedText.replace(/Rp\s?[\d.,]+/g, (match) => `<strong>${match}</strong>`);
}

// HTML panel generik — dipakai baik oleh panel Dashboard maupun Lomba,
// supaya tampilan & perilaku (skeleton/gagal/guest) konsisten di semua
// insight tanpa duplikasi markup. retryFnName = nama fungsi global yang
// dipanggil tombol "Coba lagi"/refresh (lihat da()).
function renderInsightPanelHtml({ cache, sedangProses, gagal, loggedIn, retryFnName, badgeLabel, badgeIcon, pesanKosong }){
  let isi;
  if(cache && cache.ringkasan){
    isi = `<div class="ai-insight-text">${boldNominalRp(esc(cache.ringkasan))}</div>
      <div class="ai-insight-meta">
        <span>${sedangProses ? 'Memperbarui…' : `Diperbarui otomatis · ${fmtWaktuTerakhir(cache.generatedAt)}`}</span>
        ${gagal ? '<span class="ai-insight-warn">⚠️ Gagal memperbarui, menampilkan versi terakhir</span>' : ''}
        ${loggedIn && !sedangProses ? `<button class="icon-btn" ${da(retryFnName)} title="Buat ulang ringkasan"><i data-lucide="refresh-cw" class="inline-icon"></i></button>` : ''}
      </div>`;
  } else if(sedangProses){
    isi = `<div class="ai-insight-skeleton">
      <div class="ai-insight-skeleton-line" style="width:92%;"></div>
      <div class="ai-insight-skeleton-line" style="width:76%;"></div>
      <div class="ai-insight-skeleton-line" style="width:58%;"></div>
    </div>`;
  } else if(gagal){
    isi = `<div class="ai-insight-text ai-insight-warn">Ringkasan belum berhasil dibuat.</div>
      ${loggedIn ? `<div class="ai-insight-meta"><button class="btn secondary small" ${da(retryFnName)}>Coba lagi</button></div>` : ''}`;
  } else if(!loggedIn){
    isi = `<div class="ai-insight-text ai-insight-muted">${pesanKosong}</div>`;
  } else {
    isi = `<div class="ai-insight-text ai-insight-muted">Menyiapkan ringkasan…</div>`;
  }

  return `<div class="panel ai-insight-panel">
    <div class="panel-body">
      <div class="ai-insight-badge"><i data-lucide="${badgeIcon}" class="inline-icon"></i><span>${badgeLabel}</span></div>
      <div class="ai-insight-body">${isi}</div>
    </div>
  </div>`;
}

// HTML panel — dipanggil dari renderDashboard(), ditaruh sebelum
// stat-grid-ringkasan (Total Pemasukan/Pengeluaran).
function renderBukuKegiatanInsightPanel(){
  const eventId = db.activeEventId;
  if(!eventId) return '';

  return renderInsightPanelHtml({
    cache: getAiInsightCache(),
    sedangProses: _aiInsightGenerating.has(eventId),
    gagal: _aiInsightFailed.has(eventId),
    loggedIn: !!getCurrentUser(),
    retryFnName: 'retryBukuKegiatanInsight',
    badgeLabel: 'Haloo Inti!',
    badgeIcon: 'megaphone',
    pesanKosong: 'Ringkasan otomatis akan muncul di sini setelah admin/pengurus membuka halaman ini.',
  });
}

/* ============================================================
   INSIGHT AI — LOMBA
   Panel narasi otomatis di atas daftar lomba (js/10-lomba.js,
   renderLomba()), fokus ke kesiapan lomba (kebutuhan, hadiah,
   koordinator) & jadwal mendekat — BUKAN kondisi kas (itu sudah
   dicover panel Dashboard di atas).

   Pola & alasan caching/guard SAMA PERSIS seperti Insight Dashboard
   di atas (lihat komentar panjang di kepala file) — cuma state
   (_aiInsightLomba*) dan tabel Supabase (kt_ai_insight_lomba)-nya
   dipisah sendiri, supaya generate ulang salah satu insight tidak
   ikut men-invalidasi cache insight yang lain.
   ============================================================ */
const _aiInsightLombaGenerating = new Set();
const _aiInsightLombaFailed = new Set();
const _aiInsightLombaFailedHash = new Map();
const AI_INSIGHT_LOMBA_PROMPT_VERSION = 1; // naikkan tiap ganti system prompt di bawah

function getAiInsightLombaCache(){
  const eventId = db.activeEventId;
  if(!eventId) return null;
  return db.aiInsightLomba[eventId] || null;
}

// Ringkasan angka kesiapan semua lomba untuk event aktif — dipakai untuk
// hash maupun isi prompt. Sengaja hitung ulang di sini (bukan pakai ulang
// variabel dari renderLomba()) supaya modul ini tidak bergantung urutan
// render seperti hitungAiInsightDataHash() di atas.
function dataKesiapanLomba(){
  const list = gLomba();
  const juaraUtama = JUARA_LIST.filter(j => j.v !== 'partisipasi');
  const detail = list.map(l => {
    const punyaKebutuhan = gKebutuhan(l.id).length > 0;
    const juaraTersedia = juaraUtama.filter(j => gHadiahKategori().some(h => h.kategori_peserta===l.kategori_peserta && h.juara_ke===j.v));
    const punyaKoordinator = getKoordinatorIds(l).length > 0;
    const lengkap = punyaKebutuhan && juaraTersedia.length===juaraUtama.length && punyaKoordinator;
    return { l, lengkap, punyaKebutuhan, hadiahLengkap: juaraTersedia.length===juaraUtama.length, punyaKoordinator };
  });
  const belumLengkap = detail.filter(d => !d.lengkap);
  const totalKebutuhan = db.lombaKebutuhan.filter(k => list.some(l=>l.id===k.lomba_id))
    .reduce((s,k) => s + (Number(k.harga_realisasi ?? k.harga_estimasi ?? 0)*Number(k.qty||0)), 0);
  const today = new Date();
  const lombaMendekat = list.filter(l => l.tanggal).filter(l => {
    const d = new Date(l.tanggal + 'T00:00:00');
    const diffDays = Math.ceil((d - today) / (1000*60*60*24));
    return diffDays >= 0 && diffDays <= 7;
  }).sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
  return { total: list.length, lengkapCount: list.length - belumLengkap.length, belumLengkap, totalKebutuhan, lombaMendekat };
}

function hitungAiInsightLombaHash(){
  const k = dataKesiapanLomba();
  const bagian = [
    AI_INSIGHT_LOMBA_PROMPT_VERSION,
    k.total, k.lengkapCount, k.totalKebutuhan,
    k.belumLengkap.map(d => `${d.l.id}:${d.punyaKebutuhan?1:0}${d.hadiahLengkap?1:0}${d.punyaKoordinator?1:0}`).join(','),
    k.lombaMendekat.map(l => `${l.id}:${l.tanggal}`).join(','),
  ];
  return bagian.join('|');
}

// Dipanggil dari renderLomba(). Pola sama seperti ensureBukuKegiatanInsight().
function ensureLombaInsight(){
  const eventId = db.activeEventId;
  if(!eventId) return;

  const hash = hitungAiInsightLombaHash();
  const cache = getAiInsightLombaCache();
  const sudahUpToDate = cache && cache.dataHash === hash;
  const sedangProses = _aiInsightLombaGenerating.has(eventId);
  const baruSajaGagal = _aiInsightLombaFailed.has(eventId) && _aiInsightLombaFailedHash.get(eventId) === hash;

  if(sudahUpToDate || sedangProses || baruSajaGagal) return;
  if(!getCurrentUser()) return;

  generateLombaInsight(eventId, hash);
}

async function generateLombaInsight(eventId, hash){
  _aiInsightLombaGenerating.add(eventId);
  _aiInsightLombaFailed.delete(eventId);
  _aiInsightLombaFailedHash.delete(eventId);
  if(currentSection === 'lomba') renderContent();

  try{
    const teks = await aiTanya(buatPromptInsightLomba(), {
      system: 'Kamu asisten kepanitiaan untuk aplikasi lomba 17-an Karang Taruna. Tulis ringkasan kesiapan lomba dalam Bahasa Indonesia formal bergaya laporan pertanggungjawaban (LPJ) resmi — bahasa baku, lugas, objektif, sudut pandang orang ketiga/institusional. Fokus ke KESIAPAN (berapa lomba yang sudah lengkap kebutuhan/hadiah/koordinator, berapa yang belum, dan lomba mana yang jadwalnya paling dekat tapi belum lengkap — sebut nama lombanya, TANPA menyebut nama koordinator/anggota). 3-5 kalimat, boleh diakhiri 1 kalimat rekomendasi/tindak lanjut jika relevan (tidak wajib dipaksakan tiap kali). Jangan mengulang semua angka yang sudah tampil di layar — pilih yang paling penting untuk diberi konteks/makna. Jangan pakai heading, bullet, atau markdown, cukup paragraf biasa.',
    });

    const ringkasan = String(teks || '').trim();
    if(!ringkasan) throw new Error('AI tidak memberi ringkasan');

    db.aiInsightLomba[eventId] = { ringkasan, dataHash: hash, generatedAt: new Date().toISOString() };
    const { error } = await sb.from('kt_ai_insight_lomba').upsert({
      event_id: eventId,
      ringkasan,
      data_hash: hash,
      generated_at: db.aiInsightLomba[eventId].generatedAt,
    }, { onConflict: 'event_id' });
    if(error) console.error('Gagal menyimpan kt_ai_insight_lomba (tetap tampil dari memori):', error);
  }catch(e){
    console.error('Gagal membuat Insight AI Lomba:', e);
    _aiInsightLombaFailed.add(eventId);
    _aiInsightLombaFailedHash.set(eventId, hash);
  }finally{
    _aiInsightLombaGenerating.delete(eventId);
    if(currentSection === 'lomba') renderContent();
  }
}

function buatPromptInsightLomba(){
  const org = getOrgProfil();
  const ev = activeEvent();
  const k = dataKesiapanLomba();
  const baris = [];
  baris.push(`Organisasi: ${org.nama}${ev ? ` — event aktif: ${ev.nama} ${ev.tahun||''}`.trim() : ''}`);
  baris.push('');
  baris.push(`TOTAL LOMBA: ${k.total}`);
  baris.push(`LOMBA SIAP (kebutuhan barang + hadiah semua juara + koordinator lengkap): ${k.lengkapCount}/${k.total}`);
  baris.push(`TOTAL BIAYA KEBUTUHAN LOMBA TERCATAT: ${fmtRp(k.totalKebutuhan)}`);
  baris.push('');

  if(k.belumLengkap.length > 0){
    baris.push('LOMBA BELUM LENGKAP:');
    k.belumLengkap.forEach(d => {
      const kurang = [];
      if(!d.punyaKebutuhan) kurang.push('kebutuhan barang belum diisi');
      if(!d.hadiahLengkap) kurang.push('hadiah belum lengkap semua juara');
      if(!d.punyaKoordinator) kurang.push('koordinator belum ditunjuk');
      baris.push(`- ${d.l.nama}${d.l.tanggal ? ` (jadwal ${fmtDateHari(d.l.tanggal)})` : ' (belum dijadwalkan)'}: ${kurang.join(', ')}`);
    });
    baris.push('');
  }

  if(k.lombaMendekat.length > 0){
    const daftar = k.lombaMendekat.map(l => `${l.nama} (${fmtDateHari(l.tanggal)})`).join('; ');
    baris.push(`LOMBA DENGAN JADWAL 7 HARI KE DEPAN: ${daftar}`);
    baris.push('');
  }

  baris.push('Tulis ringkasan kesiapan lomba di atas untuk ditampilkan di halaman Lomba aplikasi.');
  return baris.join('\n');
}

function retryLombaInsight(){
  const eventId = db.activeEventId;
  if(!eventId) return;
  const hash = hitungAiInsightLombaHash();
  generateLombaInsight(eventId, hash);
}

// HTML panel — dipanggil dari renderLomba(), ditaruh sebelum stat-grid.
function renderLombaInsightPanel(){
  const eventId = db.activeEventId;
  if(!eventId) return '';

  return renderInsightPanelHtml({
    cache: getAiInsightLombaCache(),
    sedangProses: _aiInsightLombaGenerating.has(eventId),
    gagal: _aiInsightLombaFailed.has(eventId),
    loggedIn: !!getCurrentUser(),
    retryFnName: 'retryLombaInsight',
    badgeLabel: 'Haloo Inti!',
    badgeIcon: 'megaphone',
    pesanKosong: 'Ringkasan kesiapan lomba akan muncul di sini setelah admin/pengurus membuka halaman ini.',
  });
}

/* ============================================================
   INSIGHT AI — BELANJA HADIAH
   Panel narasi otomatis di atas stat-grid di halaman Belanja Hadiah
   (js/11-belanja.js, renderBelanjaHadiah()), fokus ke PROGRESS belanja
   (berapa barang sudah/belum dibeli, sisa estimasi biaya) — bukan kas
   atau kesiapan lomba (itu sudah dicover 2 panel Insight di atas).

   Pola caching/guard SAMA seperti Insight Dashboard & Lomba di atas.
   State (_aiInsightBelanjaHadiah*) & tabel Supabase
   (kt_ai_insight_belanja_hadiah) dipisah sendiri.
   ============================================================ */
const _aiInsightBelanjaHadiahGenerating = new Set();
const _aiInsightBelanjaHadiahFailed = new Set();
const _aiInsightBelanjaHadiahFailedHash = new Map();
const AI_INSIGHT_BELANJA_HADIAH_PROMPT_VERSION = 1; // naikkan tiap ganti system prompt di bawah

function getAiInsightBelanjaHadiahCache(){
  const eventId = db.activeEventId;
  if(!eventId) return null;
  return db.aiInsightBelanjaHadiah[eventId] || null;
}

// Ringkasan progress belanja hadiah untuk event aktif — dihitung ulang di
// sini (bukan pakai ulang variabel dari renderBelanjaHadiah()) dengan
// logika grouping-per-nama-barang yang SAMA (lihat renderBelanjaHadiah,
// js/11-belanja.js) supaya angka yang masuk ke prompt konsisten dengan
// yang tampil di layar, tanpa modul ini bergantung urutan render.
function dataBelanjaHadiahRingkas(){
  const semuaHadiah = gHadiahKategori();
  const daftar = gDaftarBelanjaHadiah();
  const statusMap = {};
  daftar.forEach(b => { const key = `${b.hadiah_kategori_id}_${b.item_id}`; statusMap[key] = b; });

  const items = [];
  semuaHadiah.forEach(h => {
    h.items.forEach(item => {
      if(Number(item.qty_dibeli||0) <= 0) return;
      const key = `${h.id}_${item.id}`;
      const belanja = statusMap[key] || null;
      const status = belanja ? belanja.status : 'belum_dibeli';
      items.push({ nama: item.nama, sudahDibeli: status==='dibeli' });
    });
  });

  const nameMap = {};
  items.forEach(item => {
    const key = normNamaBarang(item.nama);
    if(!nameMap[key]) nameMap[key] = { nama: item.nama, key, list: [] };
    nameMap[key].list.push(item);
  });
  const groups = Object.values(nameMap);
  const belumGroups = groups.filter(g => g.list.some(i => !i.sudahDibeli));

  const hadiahAktual = hitungHargaAktualHadiahLomba();
  const totalEstimasi = hadiahAktual.total;
  // Sisa estimasi = jumlah totalHarga grup yang BELUM lengkap dibeli semua —
  // pendekatan per-grup (bukan per-item alokasi) supaya cukup untuk konteks
  // AI tanpa perlu presisi rupiah seperti di renderBelanjaHadiah().
  const belumEstimasi = belumGroups.reduce((s,g) => s + (hadiahAktual.perGroup[g.key]?.totalHarga || 0), 0);

  return {
    totalGroup: groups.length,
    belumGroup: belumGroups.length,
    totalEstimasi,
    belumEstimasi,
    namaBelum: belumGroups.map(g => g.nama).sort(),
  };
}

function hitungAiInsightBelanjaHadiahHash(){
  const d = dataBelanjaHadiahRingkas();
  const bagian = [
    AI_INSIGHT_BELANJA_HADIAH_PROMPT_VERSION,
    d.totalGroup, d.belumGroup, d.totalEstimasi, d.belumEstimasi,
    d.namaBelum.join(','),
  ];
  return bagian.join('|');
}

function ensureBelanjaHadiahInsight(){
  const eventId = db.activeEventId;
  if(!eventId) return;

  const hash = hitungAiInsightBelanjaHadiahHash();
  const cache = getAiInsightBelanjaHadiahCache();
  const sudahUpToDate = cache && cache.dataHash === hash;
  const sedangProses = _aiInsightBelanjaHadiahGenerating.has(eventId);
  const baruSajaGagal = _aiInsightBelanjaHadiahFailed.has(eventId) && _aiInsightBelanjaHadiahFailedHash.get(eventId) === hash;

  if(sudahUpToDate || sedangProses || baruSajaGagal) return;
  if(!getCurrentUser()) return;

  generateBelanjaHadiahInsight(eventId, hash);
}

async function generateBelanjaHadiahInsight(eventId, hash){
  _aiInsightBelanjaHadiahGenerating.add(eventId);
  _aiInsightBelanjaHadiahFailed.delete(eventId);
  _aiInsightBelanjaHadiahFailedHash.delete(eventId);
  if(currentSection === 'belanja-hadiah') renderContent();

  try{
    const teks = await aiTanya(buatPromptInsightBelanjaHadiah(), {
      system: 'Kamu asisten kepanitiaan untuk aplikasi lomba 17-an Karang Taruna. Tulis ringkasan progress belanja hadiah dalam Bahasa Indonesia formal bergaya laporan pertanggungjawaban (LPJ) resmi — bahasa baku, lugas, objektif, sudut pandang orang ketiga/institusional. Fokus ke PROGRESS BELANJA (berapa jenis barang sudah/belum dibeli, sisa estimasi biaya yang perlu dikeluarkan, sebutkan singkat beberapa nama barang yang masih perlu dibeli kalau relevan — cukup 2-3 contoh, jangan daftar semua). 3-5 kalimat, boleh diakhiri 1 kalimat rekomendasi/tindak lanjut jika relevan (tidak wajib dipaksakan tiap kali). Jangan mengulang semua angka yang sudah tampil di layar — pilih yang paling penting untuk diberi konteks/makna. Jangan pakai heading, bullet, atau markdown, cukup paragraf biasa.',
    });

    const ringkasan = String(teks || '').trim();
    if(!ringkasan) throw new Error('AI tidak memberi ringkasan');

    db.aiInsightBelanjaHadiah[eventId] = { ringkasan, dataHash: hash, generatedAt: new Date().toISOString() };
    const { error } = await sb.from('kt_ai_insight_belanja_hadiah').upsert({
      event_id: eventId,
      ringkasan,
      data_hash: hash,
      generated_at: db.aiInsightBelanjaHadiah[eventId].generatedAt,
    }, { onConflict: 'event_id' });
    if(error) console.error('Gagal menyimpan kt_ai_insight_belanja_hadiah (tetap tampil dari memori):', error);
  }catch(e){
    console.error('Gagal membuat Insight AI Belanja Hadiah:', e);
    _aiInsightBelanjaHadiahFailed.add(eventId);
    _aiInsightBelanjaHadiahFailedHash.set(eventId, hash);
  }finally{
    _aiInsightBelanjaHadiahGenerating.delete(eventId);
    if(currentSection === 'belanja-hadiah') renderContent();
  }
}

function buatPromptInsightBelanjaHadiah(){
  const org = getOrgProfil();
  const ev = activeEvent();
  const d = dataBelanjaHadiahRingkas();
  const baris = [];
  baris.push(`Organisasi: ${org.nama}${ev ? ` — event aktif: ${ev.nama} ${ev.tahun||''}`.trim() : ''}`);
  baris.push('');
  baris.push(`TOTAL JENIS BARANG HADIAH: ${d.totalGroup}`);
  baris.push(`SUDAH DIBELI LENGKAP: ${d.totalGroup - d.belumGroup}/${d.totalGroup}`);
  baris.push(`ESTIMASI TOTAL BIAYA HADIAH: ${fmtRp(d.totalEstimasi)}`);
  baris.push(`SISA ESTIMASI (barang yang belum dibeli lengkap): ${fmtRp(d.belumEstimasi)}`);
  baris.push('');
  if(d.namaBelum.length > 0){
    baris.push(`BARANG YANG MASIH PERLU DIBELI: ${d.namaBelum.join(', ')}`);
    baris.push('');
  }
  baris.push('Tulis ringkasan progress belanja hadiah di atas untuk ditampilkan di halaman Belanja Hadiah aplikasi.');
  return baris.join('\n');
}

function retryBelanjaHadiahInsight(){
  const eventId = db.activeEventId;
  if(!eventId) return;
  const hash = hitungAiInsightBelanjaHadiahHash();
  generateBelanjaHadiahInsight(eventId, hash);
}

// HTML panel — dipanggil dari renderBelanjaHadiah(), ditaruh sebelum stat-grid.
function renderBelanjaHadiahInsightPanel(){
  const eventId = db.activeEventId;
  if(!eventId) return '';

  return renderInsightPanelHtml({
    cache: getAiInsightBelanjaHadiahCache(),
    sedangProses: _aiInsightBelanjaHadiahGenerating.has(eventId),
    gagal: _aiInsightBelanjaHadiahFailed.has(eventId),
    loggedIn: !!getCurrentUser(),
    retryFnName: 'retryBelanjaHadiahInsight',
    badgeLabel: 'Haloo Inti!',
    badgeIcon: 'megaphone',
    pesanKosong: 'Ringkasan progress belanja akan muncul di sini setelah admin/pengurus membuka halaman ini.',
  });
}
