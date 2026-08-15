/* ============================================================
   PENGINGAT — hari libur nasional & hari besar Islam
   ============================================================
   Latar belakang: menjelang Agustus biasanya ada rentetan persiapan HUT RI
   (bentuk panitia → proposal/RAB → buka lomba → belanja hadiah → gladi
   bersih) yang harus mulai disiapkan JAUH sebelum tanggal 17 Agustus itu
   sendiri, bukan mendadak H-3. Modul ini bikin aplikasi "sadar" kalender:
   mengenali hari besar (nasional & Islam) yang sedang mendekat, dan kalau
   ada template persiapannya, kasih tahu fase persiapan mana yang harusnya
   sedang berjalan SEKARANG — baik lewat kartu pengingat biasa (lihat
   generatePeringatanReminderCard(), dipanggil dari renderAgenda() di
   12-jadwal-agenda-kas.js) maupun lewat panel narasi AI (renderKalenderKesadaranPanel(),
   pola sama seperti Insight AI lain di js/27-ai-insight.js). Ditampilkan di
   menu Agenda Kegiatan dengan label "Pengingat".

   DATA KALENDER PERLU DIPERBARUI TIAP TAHUN (lihat KALENDER_PERINGATAN di
   bawah) — tanggal hari besar Islam mengikuti hisab-rukyat Kemenag (SKB 3
   Menteri), jadi TIDAK BISA dihitung otomatis dari rumus, harus diisi
   manual dari pengumuman resmi tiap tahun. Kalau tahun berjalan tidak ada
   datanya di sini, modul ini otomatis diam saja (tidak nampilkan apa-apa)
   — lebih aman daripada nampilkan tanggal yang salah/ngasal.
   ============================================================ */

// Sumber: SKB 3 Menteri (Menag/Menaker/MenPANRB) No. 1497/2/5 Tahun 2025
// tentang Hari Libur Nasional & Cuti Bersama 2026, ditetapkan 19 Sep 2025.
// `prep` = rentetan persiapan yang biasanya relevan buat Karang Taruna,
// diurutkan dari yang paling jauh harinya (hSebelum terbesar) ke yang
// paling dekat. Hari besar yang TIDAK ada `prep`-nya tetap dikenali &
// dikasih tau jaraknya, tapi tanpa daftar checklist (biar tidak maksa
// checklist yang tidak relevan buat organisasi ini).
const KALENDER_PERINGATAN = [
  { tanggal: '2026-01-01', nama: 'Tahun Baru Masehi', jenis: 'nasional' },
  { tanggal: '2026-01-16', nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'islam' },
  { tanggal: '2026-02-17', nama: 'Tahun Baru Imlek 2577 Kongzili', jenis: 'nasional' },
  { tanggal: '2026-03-19', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', jenis: 'nasional' },
  {
    tanggal: '2026-03-21', nama: 'Hari Raya Idulfitri 1447 H', jenis: 'islam',
    prep: [
      { hSebelum: 30, tugas: 'Mulai rencanakan agenda sosial Lebaran (mis. santunan/silaturahmi warga) & cek kondisi kas Dana Sosial' },
      { hSebelum: 14, tugas: 'Koordinasi jadwal kegiatan H-1/H+1 Lebaran (takbiran, halal bihalal) kalau organisasi ikut ambil bagian' },
      { hSebelum: 3, tugas: 'Pastikan jadwal piket/keamanan lingkungan selama libur panjang Lebaran sudah diatur' },
    ],
  },
  { tanggal: '2026-04-03', nama: 'Wafat Yesus Kristus', jenis: 'nasional' },
  { tanggal: '2026-04-05', nama: 'Kebangkitan Yesus Kristus (Paskah)', jenis: 'nasional' },
  { tanggal: '2026-05-01', nama: 'Hari Buruh Internasional', jenis: 'nasional' },
  { tanggal: '2026-05-14', nama: 'Kenaikan Yesus Kristus', jenis: 'nasional' },
  {
    tanggal: '2026-05-27', nama: 'Hari Raya Iduladha 1447 H', jenis: 'islam',
    prep: [
      { hSebelum: 21, tugas: 'Cek apakah organisasi ikut koordinasi kurban tahun ini (pendataan mustahik/penerima, kalau ada)' },
      { hSebelum: 7, tugas: 'Pastikan jadwal & pembagian tugas hari-H (distribusi daging kurban dll) sudah jelas kalau organisasi terlibat' },
    ],
  },
  { tanggal: '2026-05-31', nama: 'Hari Raya Waisak 2570 BE', jenis: 'nasional' },
  { tanggal: '2026-06-01', nama: 'Hari Lahir Pancasila', jenis: 'nasional' },
  { tanggal: '2026-06-16', nama: '1 Muharam — Tahun Baru Islam 1448 H', jenis: 'islam' },
  {
    tanggal: '2026-08-17', nama: 'HUT RI — Proklamasi Kemerdekaan (ke-81)', jenis: 'nasional',
    prep: [
      { hSebelum: 45, tugas: 'Bentuk/rapatkan ulang kepanitiaan, tentukan cabang lomba & susun proposal kegiatan' },
      { hSebelum: 30, tugas: 'Ajukan proposal & RAB (mis. RAB Lomba HUT RI) ke perangkat desa/sponsor, buka Dana Sosial/donatur' },
      { hSebelum: 21, tugas: 'Buka pendaftaran lomba, susun jadwal & kebutuhan perlengkapan tiap lomba di menu Lomba' },
      { hSebelum: 14, tugas: 'Mulai belanja kebutuhan perlengkapan lomba & atur budget/paket hadiah' },
      { hSebelum: 7, tugas: 'Selesaikan belanja hadiah lomba & hadiah jalan santai, cetak/siapkan kupon kalau ada' },
      { hSebelum: 3, tugas: 'Gladi bersih, cek ulang perlengkapan, siapkan Malam Tirakatan' },
      { hSebelum: 1, tugas: 'Briefing panitia H-1, pastikan semua penanggung jawab & lokasi siap' },
    ],
  },
  { tanggal: '2026-08-25', nama: 'Maulid Nabi Muhammad SAW', jenis: 'islam', prep: [
    { hSebelum: 10, tugas: 'Cek apakah organisasi mengadakan pengajian/santunan Maulid — kalau ya, siapkan tempat & undangan' },
  ]},
  { tanggal: '2026-12-25', nama: 'Hari Raya Natal', jenis: 'nasional' },
];

// Berapa hari ke depan yang dianggap "mendekat" & layak dimunculkan sebagai
// pengingat di dashboard. HUT RI sengaja butuh jendela lebar (45 hari)
// karena persiapannya memang panjang (lihat prep di atas) — jendela global
// dibuat cukup lebar (60 hari) supaya fase persiapan H-45 tetap kebagian
// tampil dari jauh-jauh hari, bukan cuma pas mepet.
const KALENDER_RENTANG_HARI = 60;

// Selisih hari dari HARI INI ke sebuah tanggal ISO (YYYY-MM-DD). Positif =
// belum lewat (di masa depan), 0 = hari ini, negatif = sudah lewat.
function _diffHariKalender(tanggalIso){
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(tanggalIso + 'T00:00:00');
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// Label jarak singkat & tidak ambigu — dipakai baik di kartu pengingat
// maupun dikirim ke AI (sama alasannya seperti labelJarakHari() di
// js/27-ai-insight.js: AI dilarang menebak sendiri dari tanggal mentah).
function labelJarakHariKalender(diffDays){
  if(diffDays === 0) return 'HARI INI';
  if(diffDays === 1) return 'BESOK';
  if(diffDays === 2) return 'LUSA';
  return `${diffDays} hari lagi`;
}

// Hari besar (nasional/Islam) yang jaraknya 0..KALENDER_RENTANG_HARI hari
// dari hari ini, diurutkan dari yang paling dekat. Tiap item dikasih
// diffDays eksplisit.
function hariPeringatanMendatang(){
  return KALENDER_PERINGATAN
    .map(p => ({ ...p, diffDays: _diffHariKalender(p.tanggal) }))
    .filter(p => p.diffDays >= 0 && p.diffDays <= KALENDER_RENTANG_HARI)
    .sort((a,b) => a.diffDays - b.diffDays);
}

// Untuk 1 hari besar + jaraknya sekarang (diffDays), tentukan fase
// persiapan yang SEDANG berjalan (current) & yang berikutnya (next).
// Fase "sedang berjalan" = milestone hSebelum terkecil yang masih >=
// diffDays (artinya milestone itu sudah "dibuka" tapi belum lewat H-nya).
// Kalau diffDays masih lebih besar dari milestone pertama (belum ada yang
// dibuka sama sekali), current tetap null & next = milestone pertama.
function getFasePersiapan(prep, diffDays){
  if(!prep || !prep.length) return { current: null, next: null };
  const urut = [...prep].sort((a,b) => b.hSebelum - a.hSebelum); // besar → kecil
  let current = null, next = null;
  for(let i = 0; i < urut.length; i++){
    if(diffDays <= urut[i].hSebelum){
      current = urut[i];
      next = urut[i+1] || null;
    }
  }
  if(!current) next = urut[0];
  return { current, next };
}

// Ambil 1 hari besar paling relevan untuk ditampilkan sebagai kartu
// pengingat di Dashboard: prioritaskan yang punya fase persiapan aktif
// (current tidak null), kalau tidak ada ambil yang jaraknya paling dekat.
function _pilihPeringatanUtama(){
  const daftar = hariPeringatanMendatang();
  if(!daftar.length) return null;
  const adaFase = daftar.map(p => ({ ...p, fase: getFasePersiapan(p.prep, p.diffDays) }));
  const punyaFaseAktif = adaFase.filter(p => p.fase.current);
  return punyaFaseAktif.length ? punyaFaseAktif[0] : adaFase[0];
}

// Kartu pengingat "Pengingat" — dipanggil dari renderAgenda() di
// js/12-jadwal-agenda-kas.js, format objeknya sama persis dengan kartu
// reminder lain di aplikasi (type/icon/title/count/items/action) supaya
// bisa dirender pakai reminderCardHtml() (js/16-ui-helpers.js) tanpa perlu
// CSS baru.
function generatePeringatanReminderCard(){
  const p = _pilihPeringatanUtama();
  if(!p) return null;

  const jenisIcon = p.jenis === 'islam' ? '🌙' : '🇮🇩';
  const items = [];
  items.push({ label: 'Tanggal:', value: `${fmtDateHari(p.tanggal)} · ${labelJarakHariKalender(p.diffDays)}` });

  if(p.fase.current){
    items.push({ label: `${jenisIcon} Sedang berjalan:`, value: p.fase.current.tugas });
  }
  if(p.fase.next){
    items.push({ label: '➡️ Berikutnya:', value: `${p.fase.next.tugas} (mulai H-${p.fase.next.hSebelum})` });
  }
  if(!p.fase.current && !p.fase.next){
    items.push({ label: jenisIcon, value: 'Belum ada checklist persiapan khusus untuk hari ini — cukup jadi pengingat tanggal.' });
  }

  const mendesak = p.fase.current && p.diffDays <= 7;
  return {
    type: mendesak ? 'warning' : 'info',
    icon: jenisIcon,
    title: `Mendekati: ${p.nama}`,
    count: p.diffDays,
    items,
    action: { label: 'Lihat Agenda →', link: 'agenda' },
  };
}

/* ============================================================
   PANEL NARASI AI — "Pengingat"
   Pola cache/generate sama persis seperti js/27-ai-insight.js, tapi
   GLOBAL (tidak per event_id) karena kalender ini milik organisasi,
   bukan milik 1 kegiatan. Cache di db.aiInsightKalender (objek langsung,
   bukan map), disimpan ke tabel kt_kalender_insight baris id='global'
   (lihat supabase-kalender-peringatan-migration.sql).
   ============================================================ */
const _KALENDER_INSIGHT_KEY = 'global';
const _aiInsightKalenderGenerating = new Set();
const _aiInsightKalenderFailed = new Set();
const _aiInsightKalenderFailedHash = new Map();

// Naikkan tiap kali system prompt di bawah diubah, sama alasannya seperti
// AI_INSIGHT_PROMPT_VERSION di js/27-ai-insight.js.
const AI_INSIGHT_KALENDER_PROMPT_VERSION = 1;

function hitungAiInsightKalenderHash(){
  const daftar = hariPeringatanMendatang();
  const bagian = [
    AI_INSIGHT_KALENDER_PROMPT_VERSION,
    daftar.map(p => `${p.tanggal}:${p.diffDays}`).join(','),
  ];
  return bagian.join('|');
}

function ensureKalenderKesadaranInsight(){
  // Tidak ada hari besar dalam rentang → tidak perlu insight sama sekali,
  // biarkan panel diam (renderKalenderKesadaranPanel() return '').
  if(!hariPeringatanMendatang().length) return;

  const hash = hitungAiInsightKalenderHash();
  const cache = db.aiInsightKalender;
  const sudahUpToDate = cache && cache.dataHash === hash;
  const sedangProses = _aiInsightKalenderGenerating.has(_KALENDER_INSIGHT_KEY);
  const baruSajaGagal = _aiInsightKalenderFailed.has(_KALENDER_INSIGHT_KEY) && _aiInsightKalenderFailedHash.get(_KALENDER_INSIGHT_KEY) === hash;

  if(sudahUpToDate || sedangProses || baruSajaGagal) return;
  if(!getCurrentUser()) return; // sama seperti insight lain: guest cuma baca cache

  generateKalenderKesadaranInsight(hash);
}

async function generateKalenderKesadaranInsight(hash){
  _aiInsightKalenderGenerating.add(_KALENDER_INSIGHT_KEY);
  _aiInsightKalenderFailed.delete(_KALENDER_INSIGHT_KEY);
  _aiInsightKalenderFailedHash.delete(_KALENDER_INSIGHT_KEY);
  if(currentSection === 'agenda') renderContent();

  try{
    const teks = await aiTanya(buatPromptInsightKalender(), {
      system: 'Kamu asisten organisasi Karang Taruna yang "sadar kalender" — tugasmu mengingatkan hari libur nasional & hari besar Islam yang mendekat, beserta persiapan yang biasanya perlu mulai disiapkan sekarang. Tulis dalam Bahasa Indonesia dengan gaya SANTAI TAPI FORMAL — hangat dan bersahabat seperti menyapa rekan-rekan pengurus, tapi tetap rapi, sopan, dan baku dari sisi tata bahasa (bukan bahasa gaul/singkatan kasual seperti "gaes", "nih", "yuk", "gimana"). Boleh pakai sapaan ringan ("Rekan-rekan") dan kata ganti "kita"/"kami" sesekali, dan boleh ditutup ajakan halus kalau pas — tapi tetap SINGKAT dan TIDAK BERTELE-TELE, kalimat pendek, langsung ke inti. Emoji boleh dipakai sesekali (maksimal 1, mis. 🙏 atau 📅) kalau pas, tidak wajib. WAJIB sebut nama hari besarnya dan pakai label jarak (HARI INI/BESOK/LUSA/"N hari lagi") persis seperti yang disediakan di data — JANGAN menghitung ulang atau menebak sendiri. Kalau data menyertakan FASE PERSIAPAN YANG SEDANG BERJALAN, WAJIB sebut itu secara konkret (apa yang harus mulai dikerjakan sekarang) — ini bagian paling penting dari ringkasan, supaya pembaca tidak kaget mepet waktu. Kalau ada FASE BERIKUTNYA, boleh disinggung singkat sebagai gambaran apa yang menyusul. Kalau hari besarnya tidak punya checklist persiapan (cuma pengingat tanggal biasa), cukup sebutkan sebagai info singkat tanpa mengarang-ngarang checklist. Maksimal 2-3 kalimat pendek total. Jangan pakai heading, bullet, atau markdown, cukup paragraf biasa pendek.',
    });

    const ringkasan = String(teks || '').trim();
    if(!ringkasan) throw new Error('AI tidak memberi ringkasan');

    db.aiInsightKalender = { ringkasan, dataHash: hash, generatedAt: new Date().toISOString() };
    const { error } = await sb.from('kt_kalender_insight').upsert({
      id: 'global',
      ringkasan,
      data_hash: hash,
      generated_at: db.aiInsightKalender.generatedAt,
    }, { onConflict: 'id' });
    if(error) console.error('Gagal menyimpan kt_kalender_insight (tetap tampil dari memori):', error);
  }catch(e){
    console.error('Gagal membuat Insight AI Pengingat:', e);
    _aiInsightKalenderFailed.add(_KALENDER_INSIGHT_KEY);
    _aiInsightKalenderFailedHash.set(_KALENDER_INSIGHT_KEY, hash);
  }finally{
    _aiInsightKalenderGenerating.delete(_KALENDER_INSIGHT_KEY);
    if(currentSection === 'agenda') renderContent();
  }
}

function buatPromptInsightKalender(){
  const org = getOrgProfil();
  const daftar = hariPeringatanMendatang();
  const baris = [];
  baris.push(`Organisasi: ${org.nama}`);
  baris.push('');
  daftar.forEach(p => {
    const fase = getFasePersiapan(p.prep, p.diffDays);
    baris.push(`HARI BESAR: ${p.nama} (${p.jenis === 'islam' ? 'hari besar Islam' : 'libur nasional'}) — ${labelJarakHariKalender(p.diffDays)}`);
    if(fase.current) baris.push(`  FASE PERSIAPAN YANG SEDANG BERJALAN: ${fase.current.tugas} (mulai H-${fase.current.hSebelum})`);
    if(fase.next) baris.push(`  FASE BERIKUTNYA: ${fase.next.tugas} (mulai H-${fase.next.hSebelum})`);
    if(!p.prep) baris.push('  (tidak ada checklist persiapan khusus untuk hari ini)');
    baris.push('');
  });
  baris.push('Tulis ringkasan "Pengingat" di atas untuk ditampilkan di menu Agenda Kegiatan. Fokus ke hari besar yang FASE PERSIAPANnya sedang berjalan kalau ada; kalau tidak ada yang sedang berjalan, cukup info hari besar terdekat.');
  return baris.join('\n');
}

function retryKalenderKesadaranInsight(){
  const hash = hitungAiInsightKalenderHash();
  generateKalenderKesadaranInsight(hash);
}

// Panel HTML — dipanggil dari renderAgenda() di js/12-jadwal-agenda-kas.js
// (menu Agenda Kegiatan), reuse renderInsightPanelHtml() yang sudah ada di
// js/27-ai-insight.js supaya styling identik dengan panel Insight lain.
// Return '' (tidak render apa-apa) kalau tidak ada hari besar dalam rentang
// KALENDER_RENTANG_HARI — halaman tidak perlu numpuk panel kosong kalau
// memang tidak ada yang perlu diingatkan saat ini.
function renderKalenderKesadaranPanel(){
  if(!hariPeringatanMendatang().length) return '';

  return renderInsightPanelHtml({
    cache: db.aiInsightKalender,
    sedangProses: _aiInsightKalenderGenerating.has(_KALENDER_INSIGHT_KEY),
    gagal: _aiInsightKalenderFailed.has(_KALENDER_INSIGHT_KEY),
    loggedIn: !!getCurrentUser(),
    retryFnName: 'retryKalenderKesadaranInsight',
    badgeLabel: 'Pengingat',
    badgeIcon: 'calendar-days', // dipilih dari set lokal yang sudah pasti ter-bundle (lihat icons/lucide-icons.local.js) — 'calendar-clock' TIDAK ada di sana
    pesanKosong: 'Ringkasan pengingat akan muncul di sini setelah admin/pengurus membuka halaman ini.',
  });
}
