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

/* ------------------------------------------------------------
   DEBOUNCE GENERATE — dipakai bareng oleh ketiga insight (Dashboard/
   Lomba/Belanja Hadiah) di file ini.

   Tanpa ini, tiap perubahan data (mis. user input banyak transaksi/
   centang belanja berturut-turut) langsung mengubah data_hash →
   ensureXInsight() jalan lagi tiap renderContent() → generate AI baru
   dipicu tiap kali, padahal user masih di tengah-tengah mengetik/
   input berturut-turut. Dengan debounce, generate BARU dijadwalkan
   setelah data "diam" (tidak berubah lagi) selama AI_INSIGHT_DEBOUNCE_MS
   — kalau ada perubahan baru sebelum jadwal itu jalan, timer di-reset
   ulang, jadi AI cuma dipanggil sekali setelah user selesai beres-beres
   input, bukan di setiap langkah kecil.

   `key` = penanda unik per (event_id, jenis insight) — mis.
   `dashboard:<eventId>`, `lomba:<eventId>` — supaya debounce 1 jenis
   insight tidak ikut me-reset/membatalkan jadwal insight jenis lain.
   ------------------------------------------------------------ */
const AI_INSIGHT_DEBOUNCE_MS = 60000; // 1 menit tanpa perubahan data baru sebelum AI dipanggil

const _aiInsightDebounceTimers = new Map(); // key -> setTimeout id
const _aiInsightDebounceHash = new Map();   // key -> data_hash yang sedang ditunggu

function scheduleInsightGenerate(key, hash, fireFn){
  // Timer untuk hash yang SAMA sudah berjalan → biarkan saja, jangan di-reset
  // (kalau di-reset tiap ensure() dipanggil ulang untuk hash yang sama —
  // mis. renderContent() biasa tanpa perubahan data — debounce bisa "molor
  // selamanya" dan generate tidak pernah jalan).
  if(_aiInsightDebounceHash.get(key) === hash && _aiInsightDebounceTimers.has(key)) return;

  clearTimeout(_aiInsightDebounceTimers.get(key));
  _aiInsightDebounceHash.set(key, hash);
  _aiInsightDebounceTimers.set(key, setTimeout(() => {
    _aiInsightDebounceTimers.delete(key);
    _aiInsightDebounceHash.delete(key);
    fireFn();
  }, AI_INSIGHT_DEBOUNCE_MS));
}

// Batalkan jadwal debounce yang sedang jalan untuk key tertentu — dipakai
// waktu user klik tombol "Coba lagi" (retryXInsight), supaya generate-nya
// langsung jalan sekarang, bukan ikut nunggu jadwal debounce lama yang
// mungkin masih tersisa dari percobaan sebelumnya.
function cancelInsightDebounce(key){
  clearTimeout(_aiInsightDebounceTimers.get(key));
  _aiInsightDebounceTimers.delete(key);
  _aiInsightDebounceHash.delete(key);
}

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
const AI_INSIGHT_PROMPT_VERSION = 8;

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
  const belum = dataEstimasiBelumDibeli();
  const kupon = dataKuponJalanSantai();
  const catatan = dataCatatanKontekAiInsight();
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
    agenda.map(a => `${a.id}:${a.tanggal}:${a.status}:${a.diffDays}`).join(','),
    belum.kebutuhanItemBelum, belum.kebutuhanEstimasiBelum,
    belum.hadiahEstimasiBelum,
    belum.jalanItemBelum, belum.jalanEstimasiBelum,
    kupon ? `${kupon.harga}:${kupon.stok}:${kupon.terjual}` : '',
    // id+updated_at tiap catatan cukup untuk deteksi tambah/ubah/hapus,
    // tanpa perlu ikut hash isi konten lengkap (yang bisa panjang).
    catatan.map(c => `${c.id}:${c.updated_at}`).join(','),
  ];
  return bagian.join('|');
}

// Catatan Second Brain yang relevan untuk INSIGHT (bukan Asisten AI/chat) —
// dipakai supaya ringkasan otomatis di dashboard juga bisa "tahu" konteks
// yang dicatat manual oleh pengurus (mis. "tahun ini anggota bawa tikar
// sendiri pas tirakatan"), bukan cuma angka transaksi.
//
// BEDA dari secondBrainCariUntukAsisten() (js/30-second-brain.js): generate
// insight TIDAK punya "pertanyaan" untuk di-embed & dicari maknanya lewat
// RPC kt_second_brain_search — jadi di sini cukup ambil langsung dari
// secondBrainNotes yang sudah dimuat di memori (loadSecondBrainData()
// dipanggil di background saat init, lihat js/19-init.js; guest/belum
// login otomatis dapat array kosong, lihat secondBrainBolehKelola()).
//
// Filter: catatan milik event aktif ATAU catatan lintas-event (event_id
// null) — semantik sama seperti p_event_id di kt_second_brain_search
// (lihat sql/39-second-brain-migration.sql). Diurutkan terbaru dahulu &
// dibatasi 8 catatan + 300 karakter/catatan supaya prompt tetap ringkas
// dan tidak didominasi 1 catatan panjang.
function dataCatatanKontekAiInsight(){
  const eventId = db.activeEventId;
  if (typeof secondBrainNotes === 'undefined' || !secondBrainNotes.length) return [];
  return secondBrainNotes
    .filter(n => !n.event_id || n.event_id === eventId)
    .sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 8)
    .map(n => ({
      id: n.id,
      judul: n.judul,
      kategori: n.kategori,
      konten: (n.konten||'').length > 300 ? n.konten.slice(0,300) + '…' : (n.konten||''),
      updated_at: n.updated_at,
    }));
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
// bergantung urutan pemanggilan renderDashboard(). Tiap item dikasih
// diffDays eksplisit (0=hari ini, 1=besok, dst.) supaya AI tidak perlu
// (dan tidak boleh) menebak jaraknya sendiri dari label kategori "7 hari ke
// depan" — sebelumnya ini bikin AI asal ikut bilang "dalam tujuh hari ke
// depan" walau agendanya sebenarnya besok, karena cuma dikasih tanggal
// mentah tanpa jarak relatif yang eksplisit.
function dataAgendaMendatang(){
  const today = new Date();
  return gAgenda().filter(a => a.status !== 'selesai').map(a => {
    const aDate = new Date(a.tanggal + 'T00:00:00');
    const diffDays = Math.ceil((aDate - today) / (1000 * 60 * 60 * 24));
    return { ...a, diffDays };
  }).filter(a => a.diffDays >= 0 && a.diffDays <= 7)
    .sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
}

// Label jarak relatif yang eksplisit & tidak ambigu untuk 1 item agenda —
// dipakai di prompt supaya AI tinggal SALIN, bukan menghitung/menebak
// sendiri dari tanggal.
function labelJarakHari(diffDays){
  if(diffDays === 0) return 'HARI INI';
  if(diffDays === 1) return 'BESOK';
  if(diffDays === 2) return 'LUSA';
  return `${diffDays} hari lagi`;
}

// Estimasi belanja yang SUDAH DIRENCANAKAN (ada di daftar kebutuhan/hadiah)
// tapi BELUM direalisasikan (belum ditandai "dibeli") — ini "exposure" kas
// ke depan yang tidak kelihatan di b.kebutuhanLomba/b.hadiahLomba/b.hadiahJalan
// (yang cuma menghitung nominal yang SUDAH dibeli). Dulu AI cuma dikasih
// angka realisasi + jumlah SEMUA item (campur baur sudah/belum dibeli — lihat
// jumlahKebutuhanLomba dkk di hitungBukuUtama()), jadi insight-nya bisa
// terkesan "kas masih aman" padahal sebagian besar rencana belanja belum
// jalan dan berpotensi masih akan memotong saldo. Dihitung terpisah dari
// hitungBukuUtama() (bukan inject ke sana) supaya tidak mengubah rumus total
// pengeluaran yang sudah dipakai di banyak halaman (Dashboard/LPJ/dll).
function dataEstimasiBelumDibeli(){
  // Kebutuhan Lomba (perlengkapan) — bandingkan SEMUA item kebutuhan vs yang
  // statusnya "dibeli" di Daftar Belanja Perlengkapan.
  const lombaIds = gLomba().map(l => l.id);
  const semuaKebutuhan = db.lombaKebutuhan.filter(k => lombaIds.includes(k.lomba_id));
  const belanjaDibeli = new Map(gDaftarBelanjaPerlengkapan().filter(b => b.status === 'dibeli').map(b => [b.kebutuhan_id, b]));
  let kebutuhanItemBelum = 0, kebutuhanEstimasiBelum = 0;
  semuaKebutuhan.forEach(k => {
    if(belanjaDibeli.has(k.id)) return;
    kebutuhanItemBelum++;
    kebutuhanEstimasiBelum += Number(k.harga_realisasi ?? k.harga_estimasi ?? 0) * Number(k.qty||0);
  });

  // Hadiah Lomba — hitungHargaAktualHadiahLomba() sumber kebenaran tunggal
  // (lihat js/11-belanja.js): onlyPurchased:false = seluruh rencana (termasuk
  // yang belum dibeli), onlyPurchased:true = persis b.hadiahLomba di atas.
  const hadiahSemua = hitungHargaAktualHadiahLomba({onlyPurchased:false}).total;
  const hadiahEstimasiBelum = Math.max(0, hadiahSemua - hitungHargaAktualHadiahLomba({onlyPurchased:true}).total);

  // Hadiah Jalan Santai — sama polanya seperti Kebutuhan Lomba di atas.
  const belanjaJalanDibeli = new Map(gDaftarBelanjaJalanSantai().filter(b => b.status === 'dibeli').map(b => [b.hadiah_jalan_id, b]));
  let jalanItemBelum = 0, jalanEstimasiBelum = 0;
  gHadiahJalanSantai().forEach(h => {
    if(belanjaJalanDibeli.has(h.id)) return;
    jalanItemBelum++;
    jalanEstimasiBelum += Number(h.harga_satuan||0) * Number(h.qty||0);
  });

  return {
    kebutuhanItemBelum, kebutuhanEstimasiBelum,
    hadiahEstimasiBelum,
    jalanItemBelum, jalanEstimasiBelum,
    totalEstimasiBelum: kebutuhanEstimasiBelum + hadiahEstimasiBelum + jalanEstimasiBelum,
  };
}

// Kupon Jalan Santai — pendapatannya SUDAH ikut kehitung di b.transaksiLain
// (penjualan kupon dicatat sebagai baris di gTransaksiLain(), lihat
// totalKuponTerjual() di js/09-donatur-transaksi-operasional.js), tapi sisa
// STOK-nya (dari kt_settings.kuponJalanSantai.stok, sama seperti dipakai
// kuponJalanPanelHtml() di js/07-dashboard.js) belum pernah dikasih tahu ke
// AI sama sekali — padahal itu konteks penting: kalau stok hampir habis,
// potensi pendapatan tambahan dari kupon sudah mepet; kalau masih banyak,
// masih ada potensi pemasukan yang belum terealisasi. Cuma dikembalikan
// kalau fiturnya memang dipakai (sama seperti syarat tampil panelnya).
function dataKuponJalanSantai(){
  if(!isMenuAktif('transaksi') || !isFiturAktif('kupon')) return null;
  const s = getSettings();
  const kj = s.kuponJalanSantai || {harga:0, stok:0};
  const harga = Number(kj.harga||0);
  const stok = Number(kj.stok||0);
  if(harga<=0 && stok<=0) return null; // belum diatur admin, sama seperti panelnya

  const terjual = totalKuponTerjual();
  const sisa = stok>0 ? Math.max(0, stok - terjual) : null;
  const pendapatan = terjual * harga;
  const isLowStock = stok>0 && sisa!==null && sisa <= Math.ceil(stok*0.1);
  return { harga, stok, terjual, sisa, pendapatan, isLowStock };
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

  // Debounce dulu (lihat catatan di kepala file) — jangan langsung generate
  // begitu ada perubahan, tunggu data diam sejenak dulu.
  scheduleInsightGenerate(`dashboard:${eventId}`, hash, () => {
    // Data mungkin sudah berubah LAGI selagi menunggu debounce (mis. user
    // lanjut input transaksi lain) — hitung ulang dari kondisi TERBARU
    // (bukan pakai `b` snapshot lama) supaya insight yang jadi digenerate
    // benar-benar mencerminkan data paling akhir, bukan data basi pas awal
    // dijadwalkan.
    ensureBukuKegiatanInsightSekarang(eventId, hitungBukuUtama());
  });
}

// Dipanggil setelah jadwal debounce selesai (data sudah diam
// AI_INSIGHT_DEBOUNCE_MS) — cek ulang syaratnya dulu (siapa tahu di antara
// waktu dijadwalkan & sekarang data sempat balik sama seperti cache, atau
// keburu ada generate lain jalan, atau user logout/pindah event) baru
// betul-betul panggil AI.
function ensureBukuKegiatanInsightSekarang(eventId, b){
  const hash = hitungAiInsightDataHash(b);
  const cache = getAiInsightCache();
  const sudahUpToDate = cache && cache.dataHash === hash;
  const sedangProses = _aiInsightGenerating.has(eventId);

  if(sudahUpToDate || sedangProses) return;
  if(!getCurrentUser() || db.activeEventId !== eventId) return;

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
      system: 'Kamu asisten keuangan untuk aplikasi kas Karang Taruna. Tulis ringkasan kondisi kas dalam Bahasa Indonesia yang SINGKAT dan TIDAK BERTELE-TELE — kalimat pendek, langsung ke inti, tanpa basa-basi atau pengulangan. Tetap baku dan objektif (sudut pandang orang ketiga/institusional, mis. "Kas saat ini...", "Iuran lunas dari..."), tapi hindari gaya laporan resmi yang panjang; anggap ini ringkasan cepat untuk dibaca sekilas, bukan narasi LPJ. Hindari juga sapaan akrab ("teman-teman", "kita", "yuk") dan bahasa santai. Maksimal 3-4 kalimat pendek total (boleh dipecah jadi 2 paragraf pendek kalau lebih mudah dibaca), 1 kalimat penutup berupa rekomendasi/tindak lanjut kalau memang relevan (tidak wajib dipaksakan). Kalau datanya ada anggota belum bayar iuran atau agenda kegiatan dalam 7 hari ke depan, boleh disinggung singkat kalau relevan dengan kondisi kas (jangan sebut nama anggota, cukup jumlah). Kalau menyebut agenda, WAJIB pakai label jarak (HARI INI/BESOK/LUSA/"N hari lagi") yang sudah disediakan persis apa adanya — JANGAN pernah menulis frasa generik seperti "dalam tujuh hari ke depan" untuk agenda yang sebenarnya lebih dekat dari itu (mis. besok atau lusa); "7 hari ke depan" di data cuma batas atas rentang pencarian, bukan jarak agenda sesungguhnya. Kalau ada RENCANA BELANJA YANG BELUM DIREALISASIKAN dengan nominal cukup besar dibanding saldo akhir, WAJIB disinggung singkat — ini penting supaya pembaca tidak salah kira saldo sekarang itu "aman" padahal sebagian akan terpakai untuk belanja yang sudah direncanakan tapi belum jalan; kalau nominalnya kecil/tidak ada, tidak perlu dipaksakan disebut. Kalau ada data KUPON JALAN SANTAI dan stoknya HAMPIR HABIS, boleh disinggung singkat sebagai catatan potensi pemasukan tambahan yang mulai terbatas; kalau stok masih banyak/tidak relevan dengan kas, tidak perlu disebut. Kalau ada CATATAN KONTEKS TAMBAHAN DARI SECOND BRAIN, pakai isinya HANYA kalau benar-benar menambah makna pada kondisi kas/persiapan kegiatan (mis. mengubah perkiraan pengeluaran, atau relevan dengan agenda yang disinggung) — jangan didaftar ulang satu-satu, jangan dipaksakan kalau tidak nyambung dengan angka kas. Jangan mengulang semua angka yang sudah tampil di layar — pilih yang paling penting untuk diberi konteks/makna. Jangan pakai heading, bullet, atau markdown, cukup paragraf biasa pendek.',
    });

    const ringkasan = String(teks || '').trim();
    if(!ringkasan) throw new Error('AI tidak memberi ringkasan');

    db.aiInsight[eventId] = { ringkasan, dataHash: hash, generatedAt: new Date().toISOString() };
    // Tulis langsung ke kt_ai_insight (bukan lewat siklus saveDB() biasa —
    // lihat catatan di defaultDB()). last-write-wins sengaja dipilih di sini,
    // lihat catatan di sql/35-ai-insight-migration.sql.
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

  const belum = dataEstimasiBelumDibeli();
  if(belum.totalEstimasiBelum > 0){
    baris.push('RENCANA BELANJA YANG BELUM DIREALISASIKAN (masih akan mengurangi saldo di atas kalau nanti dibeli):');
    if(belum.kebutuhanEstimasiBelum > 0) baris.push(`- Kebutuhan lomba: ${belum.kebutuhanItemBelum} item belum dibeli, estimasi ${fmtRp(belum.kebutuhanEstimasiBelum)}`);
    if(belum.hadiahEstimasiBelum > 0) baris.push(`- Hadiah lomba: estimasi ${fmtRp(belum.hadiahEstimasiBelum)} belum dibeli`);
    if(belum.jalanEstimasiBelum > 0) baris.push(`- Hadiah jalan santai: ${belum.jalanItemBelum} item belum dibeli, estimasi ${fmtRp(belum.jalanEstimasiBelum)}`);
    baris.push(`Total estimasi belum direalisasikan: ${fmtRp(belum.totalEstimasiBelum)}. Kalau ini besar dibanding SALDO AKHIR, itu sinyal penting untuk disinggung (saldo yang terlihat sekarang bisa menyusut banyak begitu belanja ini jalan).`);
    baris.push('');
  }

  const kupon = dataKuponJalanSantai();
  if(kupon){
    baris.push(`KUPON JALAN SANTAI: ${kupon.terjual} lembar terjual (${fmtRp(kupon.pendapatan)}, sudah masuk hitungan Pemasukan Lain di atas)${kupon.stok>0 ? `, sisa stok ${kupon.sisa} dari ${kupon.stok} lembar dicetak${kupon.isLowStock ? ' — stok HAMPIR HABIS' : ''}` : ' (stok tidak dibatasi)'}.`);
    if(kupon.isLowStock) baris.push('Stok kupon yang hampir habis ini relevan untuk kondisi kas kalau penjualan kupon jadi sumber pemasukan yang cukup besar — boleh disinggung singkat.');
    baris.push('');
  }

  const anggotaBelum = dataAnggotaBelumBayar();
  if(anggotaBelum.jumlah > 0){
    baris.push(`ANGGOTA BELUM BAYAR IURAN: ${anggotaBelum.jumlah} anggota, estimasi ${fmtRp(anggotaBelum.totalNominal)} belum masuk kas kalau semua lunas. (Jangan sebut nama, cukup jumlah/nominal.)`);
    baris.push('');
  }

  const agenda = dataAgendaMendatang();
  if(agenda.length > 0){
    // Label jarak (HARI INI/BESOK/LUSA/"N hari lagi") dihitung eksplisit di
    // labelJarakHari() dan disisipkan per-item di sini — supaya kalau ditulis
    // di ringkasan, AI SALIN label yang sudah pasti benar ini, bukan
    // menyimpulkan sendiri dari kategori "7 hari ke depan" (yang cuma
    // menandai batas atas rentang, bukan jarak agenda yang sebenarnya).
    const daftarAgenda = agenda.map(a => `${a.judul} (${labelKategoriJadwal(a.kategori)}, ${fmtDateHari(a.tanggal)} — ${labelJarakHari(a.diffDays)})`).join('; ');
    baris.push(`AGENDA KEGIATAN DALAM 7 HARI KE DEPAN (label jarak tiap item SUDAH dihitung pasti, JANGAN dihitung ulang/ditebak): ${daftarAgenda}`);
    baris.push('');
  }

  const catatan = dataCatatanKontekAiInsight();
  if(catatan.length){
    baris.push('CATATAN KONTEKS TAMBAHAN DARI SECOND BRAIN (dicatat manual oleh pengurus — pakai HANYA kalau relevan dengan kondisi kas/persiapan kegiatan di atas, jangan dipaksakan disebut kalau tidak nyambung, dan jangan sekadar menyalin ulang semua catatan satu-satu):');
    catatan.forEach(c => baris.push(`- [${secondBrainKategoriInfo(c.kategori).l}] ${c.judul}: ${c.konten}`));
    baris.push('');
  }

  baris.push('Tulis ringkasan kondisi kas di atas untuk ditampilkan di dashboard aplikasi.');
  return baris.join('\n');
}

function retryBukuKegiatanInsight(){
  const eventId = db.activeEventId;
  if(!eventId) return;
  // User klik "Coba lagi" secara eksplisit — batalkan jadwal debounce yang
  // mungkin masih tersisa, generate SEKARANG juga tanpa nunggu.
  cancelInsightDebounce(`dashboard:${eventId}`);
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
function renderInsightPanelHtml({ cache, sedangProses, gagal, loggedIn, retryFnName, badgeLabel, badgeIcon, pesanKosong, disclaimer }){
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
      ${disclaimer ? `<div class="ai-insight-disclaimer">${disclaimer}</div>` : ''}
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
    disclaimer: 'Catatan: ringkasan ini hanya proyeksi otomatis dari data yang sudah diinput ke sistem, dan bisa saja meleset. Untuk data keuangan yang pasti/valid, silakan tanyakan langsung ke bendahara.',
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
const AI_INSIGHT_LOMBA_PROMPT_VERSION = 2; // naikkan tiap ganti system prompt di bawah

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

  scheduleInsightGenerate(`lomba:${eventId}`, hash, () => ensureLombaInsightSekarang(eventId));
}

// Sama pola & alasannya seperti ensureBukuKegiatanInsightSekarang() di atas.
function ensureLombaInsightSekarang(eventId){
  const hash = hitungAiInsightLombaHash();
  const cache = getAiInsightLombaCache();
  const sudahUpToDate = cache && cache.dataHash === hash;
  const sedangProses = _aiInsightLombaGenerating.has(eventId);

  if(sudahUpToDate || sedangProses) return;
  if(!getCurrentUser() || db.activeEventId !== eventId) return;

  generateLombaInsight(eventId, hash);
}

async function generateLombaInsight(eventId, hash){
  _aiInsightLombaGenerating.add(eventId);
  _aiInsightLombaFailed.delete(eventId);
  _aiInsightLombaFailedHash.delete(eventId);
  if(currentSection === 'lomba') renderContent();

  try{
    const teks = await aiTanya(buatPromptInsightLomba(), {
      system: 'Kamu asisten kepanitiaan untuk aplikasi lomba 17-an Karang Taruna. Tulis ringkasan kesiapan lomba dalam Bahasa Indonesia yang SINGKAT dan TIDAK BERTELE-TELE — kalimat pendek, langsung ke inti, tanpa basa-basi atau pengulangan. Tetap baku dan objektif (sudut pandang orang ketiga/institusional), tapi hindari gaya laporan resmi yang panjang. Fokus ke KESIAPAN (berapa lomba yang sudah lengkap kebutuhan/hadiah/koordinator, berapa yang belum, dan lomba mana yang jadwalnya paling dekat tapi belum lengkap — sebut nama lombanya, TANPA menyebut nama koordinator/anggota). Maksimal 3-4 kalimat pendek total, boleh diakhiri 1 kalimat rekomendasi/tindak lanjut jika relevan (tidak wajib dipaksakan tiap kali). Jangan mengulang semua angka yang sudah tampil di layar — pilih yang paling penting untuk diberi konteks/makna. Jangan pakai heading, bullet, atau markdown, cukup paragraf biasa pendek.',
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
  cancelInsightDebounce(`lomba:${eventId}`);
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
const AI_INSIGHT_BELANJA_HADIAH_PROMPT_VERSION = 2; // naikkan tiap ganti system prompt di bawah

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

  scheduleInsightGenerate(`belanja-hadiah:${eventId}`, hash, () => ensureBelanjaHadiahInsightSekarang(eventId));
}

// Sama pola & alasannya seperti ensureBukuKegiatanInsightSekarang() di atas.
function ensureBelanjaHadiahInsightSekarang(eventId){
  const hash = hitungAiInsightBelanjaHadiahHash();
  const cache = getAiInsightBelanjaHadiahCache();
  const sudahUpToDate = cache && cache.dataHash === hash;
  const sedangProses = _aiInsightBelanjaHadiahGenerating.has(eventId);

  if(sudahUpToDate || sedangProses) return;
  if(!getCurrentUser() || db.activeEventId !== eventId) return;

  generateBelanjaHadiahInsight(eventId, hash);
}

async function generateBelanjaHadiahInsight(eventId, hash){
  _aiInsightBelanjaHadiahGenerating.add(eventId);
  _aiInsightBelanjaHadiahFailed.delete(eventId);
  _aiInsightBelanjaHadiahFailedHash.delete(eventId);
  if(currentSection === 'belanja-hadiah') renderContent();

  try{
    const teks = await aiTanya(buatPromptInsightBelanjaHadiah(), {
      system: 'Kamu asisten kepanitiaan untuk aplikasi lomba 17-an Karang Taruna. Tulis ringkasan progress belanja hadiah dalam Bahasa Indonesia yang SINGKAT dan TIDAK BERTELE-TELE — kalimat pendek, langsung ke inti, tanpa basa-basi atau pengulangan. Tetap baku dan objektif (sudut pandang orang ketiga/institusional), tapi hindari gaya laporan resmi yang panjang. Fokus ke PROGRESS BELANJA (berapa jenis barang sudah/belum dibeli, sisa estimasi biaya yang perlu dikeluarkan, sebutkan singkat beberapa nama barang yang masih perlu dibeli kalau relevan — cukup 2-3 contoh, jangan daftar semua). Maksimal 3-4 kalimat pendek total, boleh diakhiri 1 kalimat rekomendasi/tindak lanjut jika relevan (tidak wajib dipaksakan tiap kali). Jangan mengulang semua angka yang sudah tampil di layar — pilih yang paling penting untuk diberi konteks/makna. Jangan pakai heading, bullet, atau markdown, cukup paragraf biasa pendek.',
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
  cancelInsightDebounce(`belanja-hadiah:${eventId}`);
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
