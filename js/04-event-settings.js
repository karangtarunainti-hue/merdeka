/* ============================================================
   TEMA WARNA PER EVENT
   ============================================================
   Warna utama aplikasi (sidebar, tombol, aksen) dikendalikan lewat 3 CSS
   variable: --merah, --merah-dark, --merah-tint (lihat :root di style.css).
   Tiap event bisa punya `warna_tema` sendiri (salah satu key di
   PRESET_TEMA) — begitu event di-switch, applyTemaWarna() menimpa 3
   variable itu di :root supaya tampilan langsung berubah tanpa reload.
   Default 'hijau' dipakai untuk event lama yang belum pernah pilih tema.
   ============================================================ */
const PRESET_TEMA = [
  {key:'hijau',  label:'Hijau (Default)', main:'#2F7D5A', dark:'#1D4B36', tint:'#E1EFE7'},
  {key:'merah',  label:'Merah Bata',      main:'#B5423E', dark:'#7A2A27', tint:'#F3E0DE'},
  {key:'biru',   label:'Biru Teal',       main:'#2E7D82', dark:'#1B4D50', tint:'#DCEDEC'},
  {key:'ungu',   label:'Ungu',            main:'#7B4C8C', dark:'#4E2F59', tint:'#EDE1F0'},
  {key:'oranye', label:'Oranye',          main:'#B8763A', dark:'#7A4E22', tint:'#F1E2D2'},
  {key:'pink',   label:'Pink',            main:'#C94C7C', dark:'#832F51', tint:'#F5E0E8'},
  {key:'emas',   label:'Emas',            main:'#C99A3C', dark:'#8A6A1E', tint:'#F6ECD3'},
];

function eventTema(ev){
  const key = (ev && ev.warna_tema) || 'hijau';
  return PRESET_TEMA.find(t=>t.key===key) || PRESET_TEMA[0];
}

function applyTemaWarna(key){
  const tema = PRESET_TEMA.find(t=>t.key===key) || PRESET_TEMA[0];
  const root = document.documentElement.style;
  root.setProperty('--merah', tema.main);
  root.setProperty('--merah-dark', tema.dark);
  root.setProperty('--merah-tint', tema.tint);
  // Samakan juga warna chrome browser/PWA (address bar di HP) dengan tema aktif.
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if(metaTheme) metaTheme.setAttribute('content', tema.dark);
}

function eid(){ return db.activeEventId; }
function getSettings(){
  if(!eid()) return {tarif:{sekolah:0,bekerja:0,perantauan:0,khusus:0}, hadiahBudget:{}, dokumen:{}};
  if(!db.settings[eid()]) db.settings[eid()] = {tarif:{sekolah:0,bekerja:0,perantauan:0,khusus:0}, hadiahBudget:{}, dokumen:{}};
  if(!db.settings[eid()].hadiahBudget) db.settings[eid()].hadiahBudget = {};
  if(!db.settings[eid()].dokumen) db.settings[eid()].dokumen = {};
  return db.settings[eid()];
}
// Surat & Dokumen tidak terikat event — satu set draft global untuk seluruh
// organisasi, sama seperti Gudang. Lihat syncDokumenGlobal()/kt_dokumen_global.
function getDokumenGlobal(){
  if(!db.dokumenGlobal) db.dokumenGlobal = {};
  if(!db.dokumenGlobal.undangan) db.dokumenGlobal.undangan = {};
  if(!db.dokumenGlobal.proposal) db.dokumenGlobal.proposal = {};
  if(!db.dokumenGlobal.absensi) db.dokumenGlobal.absensi = {};
  if(!db.dokumenGlobal.jadwal_sinoman) db.dokumenGlobal.jadwal_sinoman = {
    judul: '', tempat: '',
    rows: Array.from({length:5}, () => ({ pagi:'', siang:'', sore:'' })),
  };
  if(!Array.isArray(db.dokumenGlobal.jadwal_sinoman.rows) || !db.dokumenGlobal.jadwal_sinoman.rows.length){
    db.dokumenGlobal.jadwal_sinoman.rows = Array.from({length:5}, () => ({ pagi:'', siang:'', sore:'' }));
  }
  return db.dokumenGlobal;
}

// Budget hadiah diatur per kombinasi Kategori Peserta (anak/ibu/dst) x Juara (1/2/3/partisipasi).
// Dipakai sebagai acuan target belanja hadiah, dibandingkan dengan total belanja aktual per paket.
function getHadiahBudget(kategoriPeserta, juaraKe){
  const s = getSettings();
  return Number((s.hadiahBudget[kategoriPeserta] || {})[juaraKe] || 0);
}

/* ============================================================
   TELEGRAM NOTIFICATION
   ============================================================ */
function getTelegramSettings(){
  return db.telegram;
}

/* ============================================================
   PROFIL ORGANISASI
   ============================================================
   Satu-satunya sumber nama organisasi/logo/nama kas yang tampil di seluruh
   app (sidebar, kop surat, nota, pesan Telegram, dll). Diatur admin lewat
   Pengaturan > Profil Organisasi (lihat renderPengaturan() &
   simpanOrgProfile() di js/15-pengaturan-event.js). Kalau belum pernah
   diisi, otomatis fallback ke DEFAULT_ORG_PROFILE (lihat js/03-db-core.js)
   supaya tampilan tetap seperti sebelumnya sampai admin ganti sendiri.
   ============================================================ */
function getOrgProfil(){
  if(!db.orgProfile) db.orgProfile = { ...DEFAULT_ORG_PROFILE };
  return db.orgProfile;
}
function getOrgNama(){ return getOrgProfil().nama || DEFAULT_ORG_PROFILE.nama; }
function getOrgNamaKas(){ return getOrgProfil().namaKas || DEFAULT_ORG_PROFILE.namaKas; }
// Kembalikan logo custom (base64 data URI) kalau admin sudah upload sendiri,
// kalau belum, fallback ke file statis icons/logo-kop.png (logo bawaan app).
function getOrgLogo(){ return getOrgProfil().logo || 'icons/logo-kop.png'; }

// Dorong nama organisasi ke bagian-bagian statis di index.html yang dirender
// SEBELUM data ter-load (judul tab browser & nama di sidebar) — satu-satunya
// tempat "putih polos" yang tidak bisa dibaca langsung dari template string
// seperti panel/render lain, jadi perlu diisi manual di sini. Dipanggil sekali
// saat initApp() (js/19-init.js) dan lagi tiap kali Profil Organisasi disimpan.
function applyOrgBranding(){
  const nama = getOrgNama();
  const brandTitle = document.querySelector('.sidebar .brand h1');
  if(brandTitle) brandTitle.textContent = nama.toUpperCase();
  document.title = nama;
}

/* ============================================================
   AKSES GUEST (menu apa saja yang boleh dilihat tanpa login)
   ============================================================ */
function isGuestVisible(sectionKey){
  // Default: section boleh dilihat guest kecuali eksplisit diset false
  return !(db.guestMenu && db.guestMenu[sectionKey] === false);
}

function saveTelegramSettings(settings){
  db.telegram = settings;
  saveDB();
}

async function sendTelegramNotification(message, isTest = false){
  const settings = getTelegramSettings();
  if(!settings.enabled || !settings.botToken || !settings.chatId){
    if(isTest) toast('⚠️ Telegram belum dikonfigurasi. Atur di Pengaturan.');
    return false;
  }
  try{
    const url = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    const result = await response.json();
    if(result.ok){
      if(isTest) toast('✅ Notifikasi Telegram berhasil dikirim!');
      return true;
    }else{
      console.error('Telegram error:', result);
      if(isTest) toast('❌ Gagal kirim notifikasi. Cek token & chat ID.');
      return false;
    }
  }catch(e){
    console.error('Telegram send error:', e);
    if(isTest) toast('❌ Gagal kirim notifikasi. Periksa koneksi internet.');
    return false;
  }
}

// Telegram parse_mode 'HTML' hanya mengizinkan tag tertentu; karakter < > & pada teks dinamis
// (nama anggota/keterangan dsb, yang berasal dari input user) harus di-escape, kalau tidak
// Telegram akan menolak seluruh pesan (parse error) dan notifikasi gagal terkirim tanpa
// pemberitahuan ke user (hanya console.error).
function escTelegram(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Buang semua ikon/emoji dari teks notifikasi Telegram (dipakai baik untuk
// bagian statis pesan maupun `action`/`data` yang dikirim tiap pemanggil
// notifyTelegram() — jadi cukup diterapkan SEKALI di sini, tidak perlu ubah
// satu-satu di ~70 tempat pemanggilan yang tersebar di seluruh app). Rentang
// unicode di bawah ini mencakup emoji pictograph, dingbat, simbol misc, dan
// panah (↩️ ↓ dst) yang dipakai di action message app ini.
function stripEmoji(s){
  return String(s ?? '')
    .replace(/[\u{1F1E6}-\u{1FFFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function formatNotificationMessage(action, data, eventName){
  const timestamp = new Date().toLocaleString('id-ID');
  const user = getCurrentUser();
  const userName = user ? user.name : 'Guest (View Only)';
  const userRole = user ? user.role : 'guest';
  let msg = `<b>${escTelegram(getOrgNama())} - Buku Keuangan</b>\n\n`;
  msg += `<b>Event:</b> ${escTelegram(eventName)}\n`;
  msg += `<b>Waktu:</b> ${escTelegram(timestamp)}\n`;
  msg += `<b>User:</b> ${escTelegram(userName)} (${escTelegram(userRole)})\n\n`;
  msg += `<b>Aksi:</b> ${escTelegram(stripEmoji(action))}\n`;
  if(data) msg += `<b>Detail:</b>\n${escTelegram(stripEmoji(data))}\n`;
  
  if(activeEvent()){
    const {saldo, pemasukan, pengeluaran} = hitungBukuUtama();
    msg += `\n<b>Saldo Akhir:</b> ${fmtRp(saldo)}`;
    msg += `\n<b>Pemasukan:</b> ${fmtRp(pemasukan)}`;
    msg += `\n<b>Pengeluaran:</b> ${fmtRp(pengeluaran)}`;
  }
  return msg;
}

async function notifyTelegram(action, data = ''){
  const settings = getTelegramSettings();
  if(!settings.enabled) return;
  // Only notify if user is logged in (not guest)
  if(!getCurrentUser()) return;
  const eventName = activeEvent()?.nama || 'Tidak ada event aktif';
  const message = formatNotificationMessage(action, data, eventName);
  await sendTelegramNotification(message);
}

