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
      system: 'Kamu asisten keuangan untuk aplikasi kas Karang Taruna. Tulis ringkasan kondisi kas dalam Bahasa Indonesia sehari-hari yang hangat dan mudah dibaca warga biasa — BUKAN bahasa laporan resmi/LPJ. 3-5 kalimat, boleh pakai 1 kalimat penutup berupa saran praktis kalau memang relevan (tidak wajib dipaksakan tiap kali). Kalau datanya ada anggota belum bayar iuran atau agenda kegiatan dalam 7 hari ke depan, boleh disinggung singkat kalau relevan dengan kondisi kas (jangan sebut nama anggota, cukup jumlah). Jangan mengulang semua angka yang sudah tampil di layar — pilih yang paling penting untuk diberi konteks/makna. Jangan pakai heading, bullet, atau markdown, cukup paragraf biasa.',
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

// HTML panel — dipanggil dari renderDashboard(), ditaruh sebelum
// stat-grid-ringkasan (Total Pemasukan/Pengeluaran).
function renderBukuKegiatanInsightPanel(){
  const eventId = db.activeEventId;
  if(!eventId) return '';

  const cache = getAiInsightCache();
  const sedangProses = _aiInsightGenerating.has(eventId);
  const gagal = _aiInsightFailed.has(eventId);
  const loggedIn = !!getCurrentUser();

  let isi;
  if(cache && cache.ringkasan){
    isi = `<div class="ai-insight-text">${esc(cache.ringkasan)}</div>
      <div class="ai-insight-meta">
        <span>${sedangProses ? 'Memperbarui…' : `Diperbarui otomatis · ${fmtWaktuTerakhir(cache.generatedAt)}`}</span>
        ${gagal ? '<span class="ai-insight-warn">⚠️ Gagal memperbarui, menampilkan versi terakhir</span>' : ''}
        ${loggedIn && !sedangProses ? `<button class="icon-btn" ${da('retryBukuKegiatanInsight')} title="Buat ulang ringkasan"><i data-lucide="refresh-cw" class="inline-icon"></i></button>` : ''}
      </div>`;
  } else if(sedangProses){
    isi = `<div class="ai-insight-skeleton">
      <div class="ai-insight-skeleton-line" style="width:92%;"></div>
      <div class="ai-insight-skeleton-line" style="width:76%;"></div>
      <div class="ai-insight-skeleton-line" style="width:58%;"></div>
    </div>`;
  } else if(gagal){
    isi = `<div class="ai-insight-text ai-insight-warn">Ringkasan belum berhasil dibuat.</div>
      ${loggedIn ? `<div class="ai-insight-meta"><button class="btn secondary small" ${da('retryBukuKegiatanInsight')}>Coba lagi</button></div>` : ''}`;
  } else if(!loggedIn){
    isi = `<div class="ai-insight-text ai-insight-muted">Ringkasan otomatis akan muncul di sini setelah admin/pengurus membuka halaman ini.</div>`;
  } else {
    // Login tapi belum ada cache & belum sedangProses — jarang kejadian
    // (ensureBukuKegiatanInsight() harusnya sudah trigger generate barusan),
    // tapi tetap disiapkan fallback-nya.
    isi = `<div class="ai-insight-text ai-insight-muted">Menyiapkan ringkasan…</div>`;
  }

  return `<div class="panel ai-insight-panel">
    <div class="panel-body" style="display:flex;gap:10px;align-items:flex-start;">
      <i data-lucide="sparkles" class="inline-icon" style="flex-shrink:0;margin-top:2px;color:var(--ungu);"></i>
      <div style="flex:1;min-width:0;">${isi}</div>
    </div>
  </div>`;
}
