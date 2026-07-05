/* ============================================================
   SUPABASE CONFIG
   Ganti dengan Project URL dan anon public key dari
   Supabase Dashboard > Project Settings > API
   ============================================================ */
const SUPABASE_URL = 'https://tykahltxzlpctfqdylno.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2FobHR4emxwY3RmcWR5bG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTgxNzQsImV4cCI6MjA5NzY5NDE3NH0.QVu9Y6lPr42MITzPM5SvNczbQ8_X0usPH78e4Nj2Epc';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================================
   CURRENCY INPUT HELPER
   ============================================================ */
// Format angka dengan titik ribuan
function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(/,/g, '')) : value;
  if (isNaN(num) || num === 0) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Parse angka dari format titik ribuan
function parseCurrency(value) {
  if (typeof value === 'string') {
    // Hapus semua titik (ribuan) dan koma (desimal), lalu konversi ke float
    return parseFloat(value.replace(/\./g, '').replace(/,/g, '.'));
  }
  return value;
}

// Setup input dengan format ribuan
function setupCurrencyInput(inputEl) {
  if (!inputEl) return;
  
  // Pastikan input memiliki class currency-input
  inputEl.classList.add('currency-input');
  
  // Set initial value if present
  const rawValue = inputEl.value.trim();
  if (rawValue) {
    const parsed = parseCurrency(rawValue);
    if (!isNaN(parsed) && parsed > 0) {
      inputEl.value = formatCurrency(parsed);
    }
  }
  
  // Event listener untuk formatting saat mengetik
  inputEl.addEventListener('input', function(e) {
    // Simpan posisi kursor
    const cursorPos = this.selectionStart;
    const oldLength = this.value.length;
    
    // Hapus semua titik dari nilai saat ini
    let raw = this.value.replace(/\./g, '');
    // Hanya angka yang diperbolehkan
    raw = raw.replace(/[^0-9]/g, '');
    
    if (raw === '') {
      this.value = '';
      return;
    }
    
    // Format dengan titik
    const formatted = formatCurrency(parseInt(raw, 10));
    this.value = formatted;
    
    // Setel ulang posisi kursor
    const newLength = this.value.length;
    this.setSelectionRange(cursorPos + (newLength - oldLength), cursorPos + (newLength - oldLength));
  });
  
  // Saat blur, pastikan format benar
  inputEl.addEventListener('blur', function() {
    if (this.value === '') return;
    const raw = parseCurrency(this.value);
    if (!isNaN(raw) && raw > 0) {
      this.value = formatCurrency(raw);
    }
  });

  // Untuk nilai yang diset secara programatis
  const originalSetValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const setValue = function(value) {
    if (value !== undefined && value !== null && value !== '') {
      const num = typeof value === 'string' ? parseCurrency(value) : value;
      if (!isNaN(num) && num > 0) {
        originalSetValue.set.call(this, formatCurrency(num));
        return;
      }
    }
    originalSetValue.set.call(this, value);
  };
  // Override value setter
  Object.defineProperty(inputEl, 'value', {
    get: function() { return originalSetValue.get.call(this); },
    set: setValue,
    configurable: true
  });
}

// Setup semua input dengan class currency-input di modal
function setupAllCurrencyInputs() {
  document.querySelectorAll('#modal-body .currency-input').forEach(el => {
    setupCurrencyInput(el);
  });
  document.querySelectorAll('#modal-body input[data-currency="true"]').forEach(el => {
    setupCurrencyInput(el);
  });
  document.querySelectorAll('#content .currency-input').forEach(el => {
    setupCurrencyInput(el);
  });
}

// Helper untuk mendapatkan nilai numerik dari input format ribuan
function getCurrencyValue(inputEl) {
  if (!inputEl) return 0;
  const raw = inputEl.value.trim();
  if (!raw) return 0;
  const parsed = parseCurrency(raw);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper untuk mengisi nilai input dengan format ribuan
function setCurrencyValue(inputEl, value) {
  if (!inputEl) return;
  if (value === undefined || value === null) {
    inputEl.value = '';
    return;
  }
  const num = typeof value === 'string' ? parseCurrency(value) : value;
  if (isNaN(num) || num <= 0) {
    inputEl.value = '';
    return;
  }
  inputEl.value = formatCurrency(num);
}

/* ============================================================
   AUTH SYSTEM
   ============================================================ */
const AUTH_STORAGE_KEY = 'kt_auth_user';

// Fallback LOKAL kalau RPC gagal dihubungi (mis. belum jalankan supabase-rls-setup.sql).
// Tidak ada field password di sini sama sekali — login SELALU diverifikasi di server
// lewat rpc_login, browser tidak pernah menerima/menyimpan hash password.
const DEFAULT_USERS_FALLBACK = [
  { id: 'admin1', name: 'Admin Utama', username: 'admin', role: 'admin' },
  { id: 'user1', name: 'User 1', username: 'user', role: 'user' },
  { id: 'user2', name: 'User 2', username: 'user2', role: 'user' },
];

function getUsers() {
  if (db.users && db.users.length > 0) return db.users;
  return DEFAULT_USERS_FALLBACK;
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

function isUser() {
  const user = getCurrentUser();
  return user && (user.role === 'user' || user.role === 'admin');
}

function isPetugas() {
  const user = getCurrentUser();
  return user && user.role === 'petugas';
}

function userSections() {
  const user = getCurrentUser();
  return (user && user.allowed_sections) || [];
}

// Bisa akses (lihat) section ini? Admin & User: semua non-adminOnly.
// Petugas: cuma dashboard + section yang ditugaskan ke dia.
function canAccessSection(key) {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'user') return true;
  if (user.role === 'petugas') return key === 'dashboard' || userSections().includes(key);
  return false;
}

// Bisa edit data di section ini? Sama aturannya dengan akses,
// karena Petugas yang boleh masuk ke section-nya otomatis boleh kelola penuh di situ.
function canEditSection(key) {
  return canAccessSection(key);
}

function canEdit() {
  return isUser();
}

function canManageSettings() {
  return isAdmin();
}

// Login diverifikasi 100% di server lewat RPC rpc_login. Password mentah dikirim
// lewat HTTPS (sama seperti panggilan Supabase lain), di-hash & dibandingkan di
// Postgres — hash TIDAK PERNAH dikembalikan ke browser, dan kt_users tidak bisa
// dibaca langsung oleh anon key (lihat supabase-rls-setup.sql Bagian 2).
async function login(username, password) {
  const { data, error } = await sb.rpc('rpc_login', { p_username: username, p_password: password });
  if (error) { console.error('Login error:', error); return null; }
  if (!data || data.length === 0) return null;
  const user = data[0];
  setCurrentUser(user);
  return user;
}

function logout() {
  setCurrentUser(null);
  renderSidebar();
  renderTopbarSaldo();
  renderContent();
  toast('Anda telah logout');
}

/* ============================================================
   DATA LAYER
   ============================================================ */
function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : 'id-'+Date.now()+'-'+Math.random().toString(16).slice(2)); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtRp(n){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(Number(n)||0); }
function fmtDate(iso){ if(!iso) return '-'; const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
function fmtDateShort(iso){ if(!iso) return '-'; const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'2-digit'}); }
function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function defaultDB(){
  return {
    events: [],
    activeEventId: null,
    settings: {},
    anggota: [],
    donatur: [],
    transaksiLain: [],
    operasional: [],
    lomba: [],
    lombaKebutuhan: [],
    hadiahKategori: [],
    lombaHadiah: [],
    daftarBelanjaHadiah: [],
    daftarBelanjaPerlengkapan: [],
    hadiahJalanSantai: [],
    daftarBelanjaJalanSantai: [],
    jadwal: [],
    users: [...DEFAULT_USERS_FALLBACK],
    telegram: {
      botToken: '',
      chatId: '',
      enabled: false
    },
    // Menu yang TIDAK boleh dilihat guest (belum login). Section yang tidak
    // disebut di sini otomatis dianggap boleh dilihat guest (default true).
    // Diatur admin lewat halaman Pengaturan > Akses Guest.
    guestMenu: {
      'database-anggota': false,
      'jadwal': false
    }
  };
}

/* ============================================================
   SUPABASE SYNC LAYER
   Setiap array di objek `db` dipetakan ke satu tabel Supabase.
   Semua fungsi render/CRUD lain tetap memanipulasi `db.xxx`
   di memori seperti sebelumnya lalu memanggil saveDB() —
   tidak ada perubahan pada logika CRUD yang sudah ada.
   ============================================================ */
const ARRAY_TABLE_MAP = {
  events: 'kt_events',
  anggota: 'kt_anggota',
  donatur: 'kt_donatur',
  transaksiLain: 'kt_transaksi_lain',
  operasional: 'kt_operasional',
  lomba: 'kt_lomba',
  lombaKebutuhan: 'kt_lomba_kebutuhan',
  hadiahKategori: 'kt_hadiah_kategori',
  lombaHadiah: 'kt_lomba_hadiah',
  daftarBelanjaHadiah: 'kt_daftar_belanja_hadiah',
  daftarBelanjaPerlengkapan: 'kt_daftar_belanja_perlengkapan',
  hadiahJalanSantai: 'kt_hadiah_jalan_santai',
  daftarBelanjaJalanSantai: 'kt_daftar_belanja_jalan_santai',
  jadwal: 'kt_jadwal',
};

async function loadDB(){
  const result = defaultDB();
  try{
    const entries = Object.entries(ARRAY_TABLE_MAP);
    const [arrayResults, settingsRes, telegramRes, usersRes, guestMenuRes] = await Promise.all([
      Promise.all(entries.map(([, table]) => sb.from(table).select('*'))),
      sb.from('kt_settings').select('*'),
      sb.from('kt_telegram_settings').select('*').eq('id', 'main').maybeSingle(),
      sb.rpc('rpc_list_users'),
      sb.from('kt_guest_menu_settings').select('*').eq('id', 'main').maybeSingle(),
    ]);

    const failedTables = [];
    entries.forEach(([key, table], idx) => {
      const res = arrayResults[idx];
      if(res.error){ console.error(`Gagal memuat ${table}:`, res.error); failedTables.push(table); return; }
      result[key] = res.data || [];
      // Catat ID mana saja yang KITA tahu ada di server saat ini. Dipakai nanti oleh
      // syncArrayTable() supaya delete-diff tidak menghapus data yang ditambahkan
      // client lain setelah kita load (lihat penjelasan di syncArrayTable).
      _lastKnownIds[table] = new Set(result[key].map(r => r.id));
    });
    if(failedTables.length){
      toast(`⚠️ Gagal memuat data: ${failedTables.join(', ')} — cek koneksi lalu muat ulang halaman`);
    }

    if(usersRes.error){ console.error('Gagal memuat users:', usersRes.error); }
    result.users = (!usersRes.error && usersRes.data && usersRes.data.length) ? usersRes.data : [...DEFAULT_USERS_FALLBACK];

    if(!settingsRes.error){
      (settingsRes.data || []).forEach(s => { result.settings[s.event_id] = { tarif: s.tarif, hadiahBudget: s.hadiah_budget || {} }; });
      _lastKnownSettingsIds = new Set((settingsRes.data || []).map(s => s.event_id));
    }

    if(!telegramRes.error && telegramRes.data){
      result.telegram = {
        botToken: telegramRes.data.bot_token || '',
        chatId: telegramRes.data.chat_id || '',
        enabled: !!telegramRes.data.enabled,
      };
    }

    if(!guestMenuRes.error && guestMenuRes.data && guestMenuRes.data.hidden_sections){
      result.guestMenu = {};
      (guestMenuRes.data.hidden_sections || []).forEach(key => { result.guestMenu[key] = false; });
    }

    result.activeEventId = localStorage.getItem('kt_active_event') || (result.events[0] ? result.events[0].id : null);
  }catch(e){
    console.error('Gagal memuat data dari Supabase', e);
    toast('⚠️ Gagal terhubung ke Supabase. Cek konfigurasi & koneksi internet.');
  }
  return result;
}

// PENTING — soal keamanan data multi-device/multi-tab:
// `rows` adalah snapshot `db[key]` di memori tab ini, yang di-load SEKALI saat init.
// Kalau tab/device lain menambah baris baru ke tabel yang sama sesudah itu, baris itu
// akan muncul di `existing` (hasil select di bawah) tapi TIDAK ADA di `rows` milik kita —
// bukan karena kita menghapusnya, tapi karena kita belum pernah tahu baris itu ada.
// Dulu itu dianggap "harus dihapus" (existingIds - currentIds), jadi data yang baru
// ditambahkan device lain bisa ke-delete oleh sync device ini. Untuk mencegah itu,
// kita hanya boleh menghapus ID yang PERNAH kita kenal (ada di _lastKnownIds, artinya
// ID itu ada waktu kita load/sync terakhir) dan sekarang sudah tidak ada lagi di rows
// kita (berarti KITA yang menghapusnya). ID yang muncul di server tapi tidak pernah kita
// kenal sebelumnya dibiarkan saja — itu punya device lain, bukan urusan sync ini.
const _lastKnownIds = {};

async function syncArrayTable(table, rows){
  const { data: existing, error: selErr } = await sb.from(table).select('id');
  if(selErr){ console.error(`Gagal membaca ${table}:`, selErr); throw new Error(`Gagal membaca ${table}: ${selErr.message}`); }
  const existingIds = new Set((existing || []).map(r => r.id));
  const currentIds = new Set(rows.map(r => r.id));
  const knownIds = _lastKnownIds[table] || new Set();
  const toDelete = [...existingIds].filter(id => knownIds.has(id) && !currentIds.has(id));

  if(rows.length){
    const { error: upErr } = await sb.from(table).upsert(rows, { onConflict: 'id' });
    if(upErr){ console.error(`Gagal menyimpan ${table}:`, upErr); throw new Error(`Gagal menyimpan ${table}: ${upErr.message}`); }
  }
  if(toDelete.length){
    const { error: delErr } = await sb.from(table).delete().in('id', toDelete);
    if(delErr){ console.error(`Gagal menghapus data lama ${table}:`, delErr); throw new Error(`Gagal menghapus ${table}: ${delErr.message}`); }
  }

  // Update memori "ID yang kita kenal": gabungan ID milik kita sendiri (currentIds)
  // dan ID milik device lain yang masih hidup di server dan tidak kita sentuh.
  const survivedRemote = [...existingIds].filter(id => !toDelete.includes(id));
  _lastKnownIds[table] = new Set([...survivedRemote, ...currentIds]);
}

// Sama seperti _lastKnownIds di syncArrayTable — mencegah setting event milik device
// lain (yang belum sempat kita lihat) ikut terhapus saat kita sync.
let _lastKnownSettingsIds = new Set();

async function syncSettings(){
  const rows = Object.keys(db.settings).map(eventId => ({ event_id: eventId, tarif: db.settings[eventId].tarif, hadiah_budget: db.settings[eventId].hadiahBudget || {} }));
  const { data: existing, error: selErr } = await sb.from('kt_settings').select('event_id');
  if(selErr){ console.error('Gagal membaca kt_settings:', selErr); throw new Error(`Gagal membaca kt_settings: ${selErr.message}`); }
  const existingIds = new Set((existing || []).map(r => r.event_id));
  const currentIds = new Set(Object.keys(db.settings));
  const toDelete = [...existingIds].filter(id => _lastKnownSettingsIds.has(id) && !currentIds.has(id));

  if(rows.length){
    const { error } = await sb.from('kt_settings').upsert(rows, { onConflict: 'event_id' });
    if(error){ console.error('Gagal menyimpan kt_settings:', error); throw new Error(`Gagal menyimpan kt_settings: ${error.message}`); }
  }
  if(toDelete.length){
    const { error: delErr } = await sb.from('kt_settings').delete().in('event_id', toDelete);
    if(delErr){ console.error('Gagal menghapus kt_settings lama:', delErr); throw new Error(`Gagal menghapus kt_settings: ${delErr.message}`); }
  }

  const survivedRemote = [...existingIds].filter(id => !toDelete.includes(id));
  _lastKnownSettingsIds = new Set([...survivedRemote, ...currentIds]);
}

async function syncTelegram(){
  const { error } = await sb.from('kt_telegram_settings').upsert({
    id: 'main',
    bot_token: db.telegram.botToken,
    chat_id: db.telegram.chatId,
    enabled: db.telegram.enabled,
  }, { onConflict: 'id' });
  if(error){ console.error('Gagal menyimpan kt_telegram_settings:', error); throw new Error(`Gagal menyimpan pengaturan Telegram: ${error.message}`); }
}

async function syncGuestMenu(){
  const hiddenSections = Object.keys(db.guestMenu || {}).filter(k => db.guestMenu[k] === false);
  const { error } = await sb.from('kt_guest_menu_settings').upsert({
    id: 'main',
    hidden_sections: hiddenSections,
  }, { onConflict: 'id' });
  if(error){ console.error('Gagal menyimpan kt_guest_menu_settings:', error); throw new Error(`Gagal menyimpan pengaturan menu guest: ${error.message}`); }
}

// saveDB() dipanggil di puluhan tempat setiap ada perubahan kecil. Sebelumnya setiap panggilan
// langsung melakukan sync PENUH (select+upsert+delete-diff) ke 15+ tabel sekaligus, dan bisa
// berjalan paralel tanpa lock kalau dipanggil beruntun cepat (race condition antar sync).
// Sekarang di-debounce (nunggu 400ms jeda aktivitas) dan diberi lock supaya hanya 1 proses
// sync yang jalan pada satu waktu; kalau ada request baru saat masih sync, ditandai untuk
// dijalankan ulang setelah yang sedang berjalan selesai.
let _saveDBTimer = null;
let _saveDBRunning = false;
let _saveDBQueued = false;

function saveDB(){
  if(db.activeEventId) localStorage.setItem('kt_active_event', db.activeEventId);
  clearTimeout(_saveDBTimer);
  _saveDBTimer = setTimeout(_flushSaveDB, 400);
}

async function _flushSaveDB(){
  if(_saveDBRunning){ _saveDBQueued = true; return; }
  _saveDBRunning = true;
  try{
    await Promise.all([
      ...Object.entries(ARRAY_TABLE_MAP).map(([key, table]) => syncArrayTable(table, db[key])),
      syncSettings(),
      syncTelegram(),
      syncGuestMenu(),
    ]);
  }catch(e){
    console.error('Gagal menyimpan ke Supabase', e);
    toast(`⚠️ ${e.message || 'Gagal menyimpan ke Supabase'} — coba simpan ulang`);
  }finally{
    _saveDBRunning = false;
    if(_saveDBQueued){
      _saveDBQueued = false;
      _flushSaveDB();
    }
  }
}

// Best-effort: kalau tab ditutup saat masih ada perubahan yang belum sempat ke-sync
// (masih dalam jeda debounce), coba paksa flush segera.
window.addEventListener('beforeunload', ()=>{
  if(_saveDBTimer){ clearTimeout(_saveDBTimer); _flushSaveDB(); }
});

let db = defaultDB();

const KATEGORI_ANGGOTA = [
  {v:'sekolah', l:'Sekolah'},
  {v:'bekerja', l:'Bekerja'},
  {v:'perantauan', l:'Perantauan'},
  {v:'khusus', l:'Khusus'},
];
const RT_LIST = [
  {v:'rt1', l:'RT 1'},
  {v:'rt2', l:'RT 2'},
  {v:'rt3', l:'RT 3'},
];
const KATEGORI_PESERTA = [
  {v:'anak', l:'Anak'},
  {v:'remaja', l:'Remaja'},
  {v:'ibu', l:'Ibu'},
  {v:'bapak-ibu', l:'Bapak-Ibu'},
  {v:'bapak-bapak', l:'Bapak-Bapak'},
  {v:'umum', l:'Umum'},
];
const JUARA_LIST = [
  {v:'1', l:'Juara 1'},
  {v:'2', l:'Juara 2'},
  {v:'3', l:'Juara 3'},
  {v:'partisipasi', l:'Partisipasi'},
];
const KATEGORI_JALAN_SANTAI = [
  {v:'umum', l:'Hadiah Umum'},
  {v:'khusus', l:'Hadiah Khusus'},
  {v:'doorprize', l:'Doorprize'},
];
const KATEGORI_JADWAL = [
  {v:'belanja', l:'🛒 Belanja'},
  {v:'rapat', l:'📋 Rapat'},
  {v:'acara', l:'🎉 Acara'},
  {v:'tenggat', l:'⏰ Tenggat'},
  {v:'lainnya', l:'📌 Lainnya'},
];

function activeEvent(){ return db.events.find(e=>e.id===db.activeEventId) || null; }
function eid(){ return db.activeEventId; }
function getSettings(){
  if(!eid()) return {tarif:{sekolah:0,bekerja:0,perantauan:0,khusus:0}, hadiahBudget:{}};
  if(!db.settings[eid()]) db.settings[eid()] = {tarif:{sekolah:0,bekerja:0,perantauan:0,khusus:0}, hadiahBudget:{}};
  if(!db.settings[eid()].hadiahBudget) db.settings[eid()].hadiahBudget = {};
  return db.settings[eid()];
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

function formatNotificationMessage(action, data, eventName){
  const timestamp = new Date().toLocaleString('id-ID');
  const user = getCurrentUser();
  const userName = user ? user.name : 'Guest (View Only)';
  const userRole = user ? user.role : 'guest';
  let msg = `<b>📋 Karang Taruna - Buku Keuangan</b>\n\n`;
  msg += `<b>Event:</b> ${escTelegram(eventName)}\n`;
  msg += `<b>Waktu:</b> ${escTelegram(timestamp)}\n`;
  msg += `<b>👤 User:</b> ${escTelegram(userName)} (${escTelegram(userRole)})\n\n`;
  msg += `<b>📌 Aksi:</b> ${escTelegram(action)}\n`;
  if(data) msg += `<b>📝 Detail:</b>\n${escTelegram(data)}\n`;
  
  if(activeEvent()){
    const {saldo, pemasukan, pengeluaran} = hitungBukuUtama();
    msg += `\n<b>💰 Saldo Akhir:</b> ${fmtRp(saldo)}`;
    msg += `\n<b>📈 Pemasukan:</b> ${fmtRp(pemasukan)}`;
    msg += `\n<b>📉 Pengeluaran:</b> ${fmtRp(pengeluaran)}`;
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

/* ============================================================
   NAV / ROUTING
   ============================================================ */
const SECTIONS = [
  {key:'dashboard', label:'Buku Utama', sub:'Rekap & Reminder', icon:'grid', adminOnly: false},
  {key:'anggota', label:'Iuran Anggota', sub:'Kelola iuran anggota', icon:'users', adminOnly: false},
  {key:'database-anggota', label:'Database Anggota', sub:'Cek & filter semua anggota', icon:'database', adminOnly: false},
  {key:'donatur', label:'Donatur', sub:'Sumbangan tunai dari donatur', icon:'heart', adminOnly: false},
  {key:'transaksi', label:'Transaksi Lain', sub:'Pemasukan di luar iuran & donasi', icon:'swap', adminOnly: false},
  {key:'operasional', label:'Operasional Kegiatan', sub:'Biaya operasional umum event', icon:'briefcase', adminOnly: false},
  {key:'lomba', label:'Lomba & Kebutuhan', sub:'Kebutuhan barang per lomba', icon:'flag', adminOnly: false},
  {key:'belanja-perlengkapan', label:'Belanja Perlengkapan', sub:'Daftar belanja perlengkapan lomba', icon:'package', adminOnly: false},
  {key:'hadiah', label:'Kebutuhan Hadiah Lomba', sub:'Belanja hadiah per kategori peserta', icon:'gift', adminOnly: false},
  {key:'belanja-hadiah', label:'Belanja Hadiah', sub:'Daftar belanja hadiah lomba', icon:'shopping', adminOnly: false},
  {key:'hadiah-jalan', label:'Hadiah Jalan Santai', sub:'Kelola hadiah jalan santai', icon:'walk', adminOnly: false},
  {key:'belanja-jalan', label:'Belanja Jalan Santai', sub:'Daftar belanja hadiah jalan santai', icon:'shopping-bag', adminOnly: false},
  {key:'jadwal', label:'Jadwal & Reminder', sub:'Kelola jadwal dan pengingat', icon:'calendar', adminOnly: false},
  {key:'lpj', label:'Laporan (LPJ)', sub:'Cetak laporan pertanggungjawaban', icon:'report', adminOnly: false},
  {key:'pengaturan', label:'Pengaturan', sub:'Tarif iuran & event', icon:'gear', adminOnly: true},
  {key:'users', label:'Manajemen User', sub:'Kelola akun pengguna', icon:'users', adminOnly: true},
];
const ICONS = {
  grid:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" stroke-width="1.6" stroke="currentColor" fill="none" stroke-linejoin="round"/>',
  users:'<circle cx="8.5" cy="8" r="3" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M2.5 20c0-3.5 2.7-6 6-6s6 2.5 6 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="17" cy="8.5" r="2.4" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M15.5 13c2.6.3 4.5 2.3 4.9 5.3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  database:'<rect x="3" y="4" width="18" height="6" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 10v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 16v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/><circle cx="17" cy="7" r="1.2" fill="currentColor"/>',
  heart:'<path d="M12 20s-7.5-4.6-9.4-9.3C1.4 7.6 3 4.7 6.1 4.3c2-.3 3.6.8 5.9 3 2.3-2.2 3.9-3.3 5.9-3 3.1.4 4.7 3.3 3.5 6.4C19.5 15.4 12 20 12 20z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
  swap:'<path d="M4 8h14M14 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16H6M10 20l-4-4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  briefcase:'<rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 12h18" stroke="currentColor" stroke-width="1.6"/>',
  flag:'<path d="M5 3v18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 4c3-1.4 4.7.4 7.5-.9C15 2 17 2.3 19 3.3v9c-2-1-4-1.3-6.5 0-2.8 1.3-4.5-.5-7.5.9V4z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  gift:'<rect x="3" y="9" width="18" height="4" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="5" y="13" width="14" height="8" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M12 9v12M12 9c-1.8 0-4-1-4-3.2S9.6 3 11 3.8C12 4.5 12 7 12 9zM12 9c1.8 0 4-1 4-3.2S14.4 3 13 3.8C12 4.5 12 7 12 9z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  gear:'<path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  shopping:'<path d="M6 6h12l2 12H4L6 6z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><circle cx="9" cy="20" r="1.5" fill="currentColor"/><circle cx="15" cy="20" r="1.5" fill="currentColor"/><path d="M9 12h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  package:'<rect x="3" y="5" width="18" height="14" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 5v14M16 5v14M3 10h18" stroke="currentColor" stroke-width="1.6"/>',
  walk:'<path d="M13 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" fill="currentColor"/><path d="M8 21l3-7-2-4 3-3 3 4 1 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11l-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9 21v-4l3-3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M12 14l2 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  'shopping-bag':'<rect x="5" y="8" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 6c0-2.2 1.8-4 4-4s4 1.8 4 4v2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.6"/><path d="M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/><circle cx="16" cy="14" r="1.2" fill="currentColor"/><circle cx="8" cy="14" r="1.2" fill="currentColor"/>',
  pen:'<path d="M4 20l1-4L15 6l4 4L9 20l-4 1z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M13 8l3 3" stroke="currentColor" stroke-width="1.6"/>',
  pot:'<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2 8h3M19 8h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  food:'<path d="M7 2v8M5 2v5a2 2 0 0 0 2 2 2 2 0 0 0 2-2V2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M17 2c-1.5 0-2.5 1.6-2.5 4s1 4 2.5 4v12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  bath:'<path d="M12 3c3 4 5 6.6 5 9.5A5 5 0 0 1 7 12.5C7 9.6 9 7 12 3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  tag:'<path d="M12 3h6a2 2 0 0 1 2 2v6L11 20l-8-8L12 3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><circle cx="16" cy="7" r="1.3" fill="currentColor"/>',
  report:'<path d="M6 3h9l3 3v15H6V3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M15 3v3h3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M9 12h6M9 15h6M9 9h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
};
function icon(name){ return `<svg viewBox="0 0 24 24">${ICONS[name]||''}</svg>`; }

let currentSection = 'dashboard';

function renderSidebar(){
  const sel = document.getElementById('event-select');
  sel.innerHTML = db.events.length
    ? db.events.map(e=>`<option value="${e.id}" ${e.id===db.activeEventId?'selected':''}>${esc(e.nama)}</option>`).join('')
    : `<option value="">— Belum ada event —</option>`;

  const user = getCurrentUser();
  const isLoggedIn = !!user;
  const isAdminUser = user && user.role === 'admin';
  
  // Update user info
  const nameDisplay = document.getElementById('user-name-text');
  const userIcon = document.getElementById('user-icon');
  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  
  if (isLoggedIn) {
    nameDisplay.textContent = user.name;
    userIcon.textContent = user.role === 'admin' ? '⚡' : '👤';
    btnLogin.style.display = 'none';
    btnLogout.style.display = 'inline-block';
  } else {
    nameDisplay.textContent = 'Anggota';
    userIcon.textContent = '👤';
    btnLogin.style.display = 'inline-block';
    btnLogout.style.display = 'none';
  }

  const nav = document.getElementById('nav');
  const isPetugasUser = user && user.role === 'petugas';
  const visibleSections = SECTIONS
    .filter(s => !s.adminOnly || isAdminUser)
    .filter(s => {
      if (!isLoggedIn) return isGuestVisible(s.key);
      if (isPetugasUser) return s.key === 'dashboard' || userSections().includes(s.key);
      return true;
    });
  nav.innerHTML = visibleSections.map(s=>`
    <div class="nav-item ${s.key===currentSection?'active':''} ${!isLoggedIn && !s.adminOnly ? '' : ''}" data-nav="${s.key}">
      ${icon(s.icon)} <span>${s.label}</span>
      ${s.adminOnly && !isAdminUser ? `<span class="lock-icon">🔒</span>` : ''}
    </div>`).join('');

  // Buat event baru: khusus Administrator
  document.getElementById('btn-new-event').style.display = isAdminUser ? 'inline-block' : 'none';
}

function goSection(key){
  const user = getCurrentUser();
  const section = SECTIONS.find(s=>s.key===key);
  if (section && section.adminOnly && !(user && user.role === 'admin')) {
    toast('⛔ Hanya Admin yang bisa mengakses halaman ini');
    return;
  }
  if (section && !user && !isGuestVisible(key)) {
    toast('⛔ Halaman ini tidak tersedia untuk Guest. Silakan login.');
    return;
  }
  if (section && user && user.role === 'petugas' && key !== 'dashboard' && !userSections().includes(key)) {
    toast('⛔ Anda tidak memiliki akses ke halaman ini');
    return;
  }
  currentSection = key;
  const meta = SECTIONS.find(s=>s.key===key);
  document.getElementById('page-title').textContent = meta ? meta.label : 'Dashboard';
  document.getElementById('page-sub').textContent = meta ? (meta.desc || meta.sub) : '';
  renderSidebar();
  renderTopbarSaldo();
  renderContent();
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('show');
  window.scrollTo({top:0, behavior:'instant'});
}

function renderTopbarSaldo(){
  const chip = document.getElementById('saldo-chip');
  if(!activeEvent()){ chip.style.visibility='hidden'; return; }
  chip.style.visibility='visible';
  const {saldo} = hitungBukuUtama();
  chip.classList.toggle('negatif', saldo < 0);
  document.getElementById('saldo-val').textContent = fmtRp(saldo);
}

function renderContent(){
  const el = document.getElementById('content');
  const isLoggedIn = !!getCurrentUser();
  const isAdminUser = getCurrentUser()?.role === 'admin';

  // Simpan fokus & posisi kursor input aktif (mis. kolom pencarian) agar tidak hilang saat re-render
  const activeEl = document.activeElement;
  let focusInfo = null;
  if (activeEl && el.contains(activeEl) && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id) {
    focusInfo = { id: activeEl.id, selStart: activeEl.selectionStart, selEnd: activeEl.selectionEnd };
  }
  
  if(!activeEvent()){
    el.innerHTML = `<div class="empty-state"><h3>Belum ada event aktif</h3><p>${isLoggedIn ? 'Buat event tahunan dulu.' : 'Login untuk membuat atau mengelola event.'}</p>
      ${isLoggedIn ? `<button class="btn" onclick="openEventModal()">+ Buat Event Pertama</button>` : `<button class="btn" onclick="openLoginModal()">🔑 Login untuk Mengelola</button>`}
    </div>`;
    return;
  }
  
  // Check if current section is admin-only
  const section = SECTIONS.find(s=>s.key===currentSection);
  if (section && section.adminOnly && !isAdminUser) {
    el.innerHTML = `<div class="empty-state"><h3>⛔ Akses Ditolak</h3><p>Halaman ini hanya untuk Admin.</p><button class="btn" onclick="goSection('dashboard')">Kembali ke Dashboard</button></div>`;
    return;
  }

  // Check if current section is hidden for guest
  if (section && !isLoggedIn && !isGuestVisible(currentSection)) {
    el.innerHTML = `<div class="empty-state"><h3>⛔ Akses Ditolak</h3><p>Halaman ini tidak tersedia untuk Guest.</p><button class="btn" onclick="openLoginModal()">🔑 Login untuk Mengakses</button></div>`;
    return;
  }

  // Check if current section is outside Petugas' assigned bidang
  if (section && isPetugas() && currentSection !== 'dashboard' && !userSections().includes(currentSection)) {
    el.innerHTML = `<div class="empty-state"><h3>⛔ Akses Ditolak</h3><p>Anda tidak memiliki akses ke halaman ini.</p><button class="btn" onclick="goSection('dashboard')">Kembali ke Dashboard</button></div>`;
    return;
  }
  
  switch(currentSection){
    case 'dashboard': el.innerHTML = renderDashboard(); break;
    case 'anggota': el.innerHTML = renderAnggota(); break;
    case 'database-anggota': el.innerHTML = renderDatabaseAnggota(); break;
    case 'donatur': el.innerHTML = renderDonatur(); break;
    case 'transaksi': el.innerHTML = renderTransaksi(); break;
    case 'operasional': el.innerHTML = renderOperasional(); break;
    case 'lomba': el.innerHTML = renderLomba(); break;
    case 'hadiah': el.innerHTML = renderHadiah(); break;
    case 'belanja-hadiah': el.innerHTML = renderBelanjaHadiah(); break;
    case 'belanja-perlengkapan': el.innerHTML = renderBelanjaPerlengkapan(); break;
    case 'hadiah-jalan': el.innerHTML = renderHadiahJalanSantai(); break;
    case 'belanja-jalan': el.innerHTML = renderBelanjaJalanSantai(); break;
    case 'jadwal': el.innerHTML = renderJadwal(); break;
    case 'lpj': el.innerHTML = renderLPJ(); break;
    case 'pengaturan': el.innerHTML = renderPengaturan(); break;
    case 'users': el.innerHTML = renderUsers(); break;
    default: el.innerHTML = renderDashboard();
  }
  
  // Setup currency inputs after content rendered
  setTimeout(setupAllCurrencyInputs, 50);

  // Kembalikan fokus & posisi kursor ke input yang sama (jika masih ada di DOM baru)
  if (focusInfo) {
    const newEl = document.getElementById(focusInfo.id);
    if (newEl) {
      newEl.focus();
      if (typeof newEl.setSelectionRange === 'function' && focusInfo.selStart != null) {
        try { newEl.setSelectionRange(focusInfo.selStart, focusInfo.selEnd); } catch(e){}
      }
    }
  }
}

/* ============================================================
   LOGIN MODAL
   ============================================================ */
function openLoginModal() {
  setModal('🔑 Login', `
    <p style="color:var(--ink-soft); margin-bottom:16px;">Masuk dengan username & password akun Anda.</p>
    <div class="field-row">
      <div class="field"><label>Username</label><input id="login-username" placeholder="Username"></div>
      <div class="field"><label>Password</label><input id="login-password" type="password" placeholder="******"></div>
    </div>
    <div style="display:flex; gap:8px; margin-top:8px;">
      <button class="btn" onclick="manualLogin()">Login</button>
      <button class="btn secondary" onclick="closeModal()">Batal</button>
    </div>
  `, []);
  setTimeout(()=>{
    const pwEl = document.getElementById('login-password');
    if (pwEl) pwEl.addEventListener('keydown', e => { if (e.key === 'Enter') manualLogin(); });
    const userEl = document.getElementById('login-username');
    if (userEl) { userEl.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-password')?.focus(); }); userEl.focus(); }
  }, 0);
}

async function manualLogin() {
  const username = document.getElementById('login-username')?.value?.trim();
  const password = document.getElementById('login-password')?.value?.trim();
  if (!username || !password) {
    toast('⚠️ Isi username dan password');
    return;
  }
  const user = await login(username, password);
  if (user) {
    closeModal();
    renderSidebar();
    renderTopbarSaldo();
    renderContent();
    const roleLabel = {admin:'Admin', user:'User', petugas:'Petugas'}[user.role] || user.role;
    toast(`✅ Login sebagai ${user.name} (${roleLabel})`);
    notifyTelegram(`🔑 User login: ${user.name}`, `Role: ${roleLabel}`);
  } else {
    toast('❌ Login gagal');
  }
}

/* ============================================================
   USER MANAGEMENT (Admin Only)
   ============================================================ */
function renderUsers() {
  if (!isAdmin()) {
    return `<div class="empty-state"><h3>⛔ Akses Ditolak</h3><p>Halaman ini hanya untuk Admin.</p></div>`;
  }
  
  const users = getUsers();
  const roleLabel = {admin:'Admin', user:'User', petugas:'Petugas'};
  const bidangHtml = u => u.role === 'petugas'
    ? ((u.allowed_sections && u.allowed_sections.length) ? u.allowed_sections.map(k=>esc((SECTIONS.find(s=>s.key===k)||{}).label || k)).join(', ') : '<span style="color:var(--ink-soft);">Belum ada bidang</span>')
    : '<span style="color:var(--ink-soft);">Semua bidang</span>';
  const rows = users.map((u, idx) => `
    <tr>
      <td data-label="Nama">${esc(u.name)}</td>
      <td data-label="Role"><span class="badge ${u.role === 'admin' ? 'lunas' : (u.role === 'petugas' ? 'khusus' : 'dibeli')}">${roleLabel[u.role] || u.role}</span></td>
      <td data-label="Username">${esc(u.username)}</td>
      <td data-label="Bidang">${bidangHtml(u)}</td>
      <td data-label="Password">******</td>
      <td data-label="Aksi" class="users-actions">
        <button class="btn secondary small" onclick="openUserModal('${u.id}')">✎ Edit</button>
        <button class="icon-btn" onclick="hapusUser('${u.id}')" ${users.length <= 1 ? 'disabled' : ''}>🗑</button>
      </td>
    </tr>
  `).join('');

  return `
  <div class="panel">
    <div class="panel-head">
      <div><h3>👥 Manajemen User</h3>
        <div class="desc">Kelola akun pengguna yang dapat mengakses sistem</div>
      </div>
      <button class="btn" onclick="openUserModal()">+ Tambah User</button>
    </div>
    <div class="panel-body flush">
      <table class="users-table">
        <thead><tr><th>Nama</th><th>Role</th><th>Username</th><th>Bidang</th><th>Password</th><th></th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="6">Belum ada user.</td></tr>`}</tbody>
      </table>
    </div>
  </div>
  <div class="panel">
    <div class="panel-head"><h3>ℹ️ Tentang Role</h3></div>
    <div class="panel-body">
      <p><strong>👤 Guest (Tidak Login)</strong> — Hanya bisa melihat data (read-only). Tidak bisa menambah, mengedit, atau menghapus data.</p>
      <p><strong>🛠️ Petugas</strong> — Login khusus untuk satu atau beberapa bidang tertentu saja (mis. hanya Iuran Anggota, atau hanya Lomba & Hadiah). Di luar bidang yang ditugaskan, halaman lain tidak terlihat dan tidak bisa diakses.</p>
      <p><strong>👤 User</strong> — Bisa melihat dan mengedit semua data (anggota, donatur, transaksi, lomba, hadiah, dll). Tidak bisa mengakses Pengaturan.</p>
      <p><strong>⚡ Admin</strong> — Akses penuh termasuk Pengaturan dan Manajemen User.</p>
    </div>
  </div>`;
}

function openUserModal(id) {
  if (!isAdmin()) { toast('⛔ Hanya Admin'); return; }
  const users = getUsers();
  const editing = id ? users.find(u => u.id === id) : null;
  const editingSections = (editing && editing.allowed_sections) || [];
  
  setModal(editing ? '✏️ Edit User' : '➕ Tambah User', `
    <div class="field"><label>Nama Lengkap</label><input id="f-name" value="${editing ? esc(editing.name) : ''}" placeholder="Nama user"></div>
    <div class="field"><label>Username</label><input id="f-username" value="${editing ? esc(editing.username) : ''}" placeholder="username" ${editing ? 'disabled' : ''}></div>
    <div class="field"><label>Password</label><input id="f-password" type="text" value="${editing ? '******' : ''}" placeholder="${editing ? 'Kosongkan untuk tidak diubah' : 'Password baru'}"></div>
    <div class="field"><label>Role</label>
      <select id="f-role" onchange="updatePetugasSectionsVisibility()">
        <option value="user" ${editing && editing.role === 'user' ? 'selected' : ''}>User (Bisa edit semua data)</option>
        <option value="petugas" ${editing && editing.role === 'petugas' ? 'selected' : ''}>Petugas (Terbatas per bidang)</option>
        <option value="admin" ${editing && editing.role === 'admin' ? 'selected' : ''}>Admin (Akses penuh)</option>
      </select>
    </div>
    <div class="field" id="f-sections-field" style="${editing && editing.role === 'petugas' ? '' : 'display:none;'}">
      <label>Bidang yang Ditugaskan</label>
      <div class="hint" style="margin-bottom:8px;">Petugas hanya bisa melihat & mengelola bidang yang dicentang di bawah ini.</div>
      <div class="guest-menu-list" style="display:flex;flex-direction:column;gap:8px;">
        ${SECTIONS.filter(s=>!s.adminOnly && s.key!=='dashboard').map(s=>`
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--garis);border-radius:8px;">
            <input type="checkbox" class="f-section-check" value="${s.key}" ${editingSections.includes(s.key) ? 'checked' : ''}>
            <span>${icon(s.icon)}</span>
            <span>${esc(s.label)}</span>
          </label>`).join('')}
      </div>
    </div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label: editing ? 'Simpan' : 'Tambah', cls:'', onclick: async () => {
      const name = document.getElementById('f-name').value.trim();
      const username = document.getElementById('f-username').value.trim();
      const password = document.getElementById('f-password').value.trim();
      const role = document.getElementById('f-role').value;
      const sections = role === 'petugas'
        ? Array.from(document.querySelectorAll('.f-section-check:checked')).map(c => c.value)
        : [];
      
      if (!name || !username) { toast('Nama dan username wajib'); return; }
      if (!editing && !password) { toast('Password wajib untuk user baru'); return; }
      if (editing && password && password.length < 4) { toast('Password minimal 4 karakter'); return; }
      if (role === 'petugas' && sections.length === 0) { toast('Pilih minimal 1 bidang untuk Petugas'); return; }
      
      const usersList = getUsers();
      if (!editing && usersList.find(u => u.username === username)) {
        toast('Username sudah digunakan');
        return;
      }
      
      const targetId = editing ? id : uid();
      const passwordToSend = editing ? (password && password !== '******' ? password : null) : (password || 'user123');
      const { error } = await sb.rpc('rpc_upsert_user', {
        p_id: targetId,
        p_name: name,
        p_username: username,
        p_password: passwordToSend,
        p_role: role,
        p_sections: sections,
      });
      if (error) { console.error('Gagal menyimpan user:', error); toast('⚠️ Gagal menyimpan user ke Supabase'); return; }

      const { data: refreshed } = await sb.rpc('rpc_list_users');
      if (refreshed) db.users = refreshed;
      toast(editing ? '✅ User diupdate' : '✅ User ditambahkan');
      closeModal();
      if (currentSection === 'users') renderContent();
      renderSidebar();
    }}
  ]);
}
function updatePetugasSectionsVisibility() {
  const role = document.getElementById('f-role')?.value;
  const field = document.getElementById('f-sections-field');
  if (field) field.style.display = role === 'petugas' ? '' : 'none';
}

async function hapusUser(id) {
  if (!isAdmin()) { toast('⛔ Hanya Admin'); return; }
  const users = getUsers();
  if (users.length <= 1) { toast('⚠️ Minimal 1 user'); return; }
  const user = users.find(u => u.id === id);
  if (!confirm(`Hapus user "${user?.name}"?`)) return;

  const { error } = await sb.rpc('rpc_delete_user', { p_id: id });
  if (error) { console.error('Gagal menghapus user:', error); toast('⚠️ Gagal menghapus user'); return; }

  const { data: refreshed } = await sb.rpc('rpc_list_users');
  if (refreshed) db.users = refreshed;

  // If current user is deleted, logout
  const current = getCurrentUser();
  if (current && current.id === id) {
    logout();
  }
  toast('🗑️ User dihapus');
  if (currentSection === 'users') renderContent();
  renderSidebar();
}

/* ============================================================
   DASHBOARD
   ============================================================ */
let openBukuCards = new Set();
function toggleBukuCard(key){
  if(openBukuCards.has(key)) openBukuCards.delete(key); else openBukuCards.add(key);
  renderContent();
}
function bukuCardHtml(item){
  const isOpen = openBukuCards.has(item.key);
  return `<div class="stat-card buku-card ${isOpen?'open':''}" onclick="toggleBukuCard('${item.key}')" style="cursor:pointer;">
    <div class="lbl" style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
      <span>${item.label}</span><span style="font-size:10px;color:var(--ink-soft);">${isOpen?'▲':'▼'}</span>
    </div>
    <div class="val">${fmtRp(item.value)}</div>
    ${isOpen ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--garis);font-size:12.5px;color:var(--ink-soft);" onclick="event.stopPropagation();">
      <div style="margin-bottom:8px;">${item.info}</div>
      <button class="btn secondary small" onclick="goSection('${item.key}')">Lihat Selengkapnya →</button>
    </div>` : ''}
  </div>`;
}

function renderDashboard(){
  const b = hitungBukuUtama();
  const pemasukanItems = [
    {key:'anggota', label:'Total Iuran', value:b.iuran, info:`${b.jumlahIuranLunas} anggota sudah lunas`},
    {key:'donatur', label:'Total Donasi', value:b.donasi, info:`${b.jumlahDonatur} donatur tercatat`},
    {key:'transaksi', label:'Total Transaksi Lain', value:b.transaksiLain, info:`${b.jumlahTransaksiLain} transaksi tercatat`},
  ];
  const pengeluaranItems = [
    {key:'operasional', label:'Total Operasional Kegiatan', value:b.opsional, info:`${b.jumlahOperasional} biaya tercatat`},
    {key:'lomba', label:'Total Belanja Kebutuhan Lomba', value:b.kebutuhanLomba, info:`${b.jumlahKebutuhanLomba} item kebutuhan lomba`},
    {key:'hadiah', label:'Total Hadiah Lomba', value:b.hadiahLomba, info:`${b.jumlahItemHadiahLomba} item hadiah lomba`},
    {key:'hadiah-jalan', label:'Total Hadiah Jalan Santai', value:b.hadiahJalan, info:`${b.jumlahHadiahJalan} item hadiah jalan santai`},
  ];

  const reminderCards = generateReminders();
  const isLoggedIn = !!getCurrentUser();

  return `
  ${reminderCards}
  <div class="stat-grid-ringkasan">
    <div class="stat-card pemasukan"><div class="lbl">Total Pemasukan</div><div class="val">${fmtRp(b.pemasukan)}</div></div>
    <div class="stat-card pengeluaran"><div class="lbl">Total Pengeluaran</div><div class="val">${fmtRp(b.pengeluaran)}</div></div>
  </div>
  <div class="stat-grid stat-grid-saldo">
    <div class="stat-card saldo"><div class="lbl">Saldo Akhir</div><div class="val">${fmtRp(b.saldo)}</div><div style="font-size:11px; color:var(--abu); margin-top:4px; line-height:1.4;">Proyeksi anggaran — sudah termasuk kebutuhan &amp; hadiah yang direncanakan, belum tentu semuanya sudah dibelanjakan.</div></div>
  </div>
  <div class="panel">
    <div class="panel-head"><div><h3>Rincian Pemasukan</h3><div class="desc">Klik card untuk lihat rincian</div></div></div>
    <div class="panel-body">
      <div class="stat-grid" style="margin-bottom:0;">${pemasukanItems.map(bukuCardHtml).join('')}</div>
    </div>
  </div>
  <div class="panel">
    <div class="panel-head"><div><h3>Rincian Pengeluaran</h3><div class="desc">Klik card untuk lihat rincian</div></div></div>
    <div class="panel-body">
      <div class="stat-grid" style="margin-bottom:0;">${pengeluaranItems.map(bukuCardHtml).join('')}</div>
    </div>
  </div>`;
}

function generateReminders(){
  const reminders = [];
  const today = new Date();
  const isLoggedIn = !!getCurrentUser();

  const jadwalList = gJadwal().filter(j => j.status !== 'selesai');
  const upcomingJadwal = jadwalList.filter(j => {
    const jDate = new Date(j.tanggal + 'T00:00:00');
    const diffDays = Math.ceil((jDate - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));

  if (upcomingJadwal.length > 0) {
    const todayJadwal = upcomingJadwal.filter(j => {
      const jDate = new Date(j.tanggal + 'T00:00:00');
      return jDate.toDateString() === today.toDateString();
    });
    const soonJadwal = upcomingJadwal.filter(j => {
      const jDate = new Date(j.tanggal + 'T00:00:00');
      return jDate.toDateString() !== today.toDateString();
    });

    let items = [];
    if (todayJadwal.length > 0) {
      items.push({label: '📌 Hari ini:', value: todayJadwal.map(j => `${j.judul} (${labelKategoriJadwal(j.kategori)})`).join(', ')});
    }
    if (soonJadwal.length > 0) {
      const soonText = soonJadwal.map(j => {
        const jDate = new Date(j.tanggal + 'T00:00:00');
        const diffDays = Math.ceil((jDate - today) / (1000 * 60 * 60 * 24));
        const dayLabel = diffDays === 1 ? 'Besok' : `${diffDays} hari lagi`;
        return `${j.judul} (${dayLabel})`;
      }).join(', ');
      items.push({label: '📅 Mendatang:', value: soonText});
    }

    reminders.push({
      type: 'info',
      icon: '📅',
      title: 'Jadwal Mendatang',
      count: upcomingJadwal.length,
      items: items,
      action: {label: 'Lihat Semua →', link: 'jadwal'}
    });
  }

  const hadiahItems = [];
  gHadiahKategori().forEach(h => {
    h.items.forEach((item, idx) => {
      if (Number(item.qty_dibeli||0) <= 0) return;
      const belanja = db.daftarBelanjaHadiah.find(b => b.hadiah_kategori_id === h.id && b.item_index === idx && b.event_id === eid());
      if (!belanja || belanja.status !== 'dibeli') {
        hadiahItems.push({nama: item.nama, qty: item.qty_dibeli, kategori: labelPeserta(h.kategori_peserta)});
      }
    });
  });

  const perlengkapanItems = [];
  gLomba().forEach(l => {
    gKebutuhan(l.id).forEach(k => {
      const belanja = db.daftarBelanjaPerlengkapan.find(b => b.kebutuhan_id === k.id && b.event_id === eid());
      if (!belanja || belanja.status !== 'dibeli') {
        perlengkapanItems.push({nama: k.nama_item, qty: k.qty, lomba: l.nama});
      }
    });
  });

  const jalanItems = gHadiahJalanSantai().filter(h => {
    const belanja = db.daftarBelanjaJalanSantai.find(b => b.hadiah_jalan_id === h.id && b.event_id === eid());
    return !belanja || belanja.status !== 'dibeli';
  });

  const totalBelum = hadiahItems.length + perlengkapanItems.length + jalanItems.length;

  if (totalBelum > 0) {
    let items = [];
    if (hadiahItems.length > 0) {
      const labels = hadiahItems.slice(0, 3).map(i => `${i.nama} (${i.kategori})`).join(', ');
      items.push({label: '🎁 Hadiah Lomba:', value: hadiahItems.length > 3 ? `${labels} +${hadiahItems.length-3} lagi` : labels});
    }
    if (perlengkapanItems.length > 0) {
      const labels = perlengkapanItems.slice(0, 3).map(i => `${i.nama} (${i.lomba})`).join(', ');
      items.push({label: '📦 Perlengkapan:', value: perlengkapanItems.length > 3 ? `${labels} +${perlengkapanItems.length-3} lagi` : labels});
    }
    if (jalanItems.length > 0) {
      const labels = jalanItems.slice(0, 3).map(i => i.nama_hadiah).join(', ');
      items.push({label: '🏃 Jalan Santai:', value: jalanItems.length > 3 ? `${labels} +${jalanItems.length-3} lagi` : labels});
    }
    const type = totalBelum > 5 ? 'danger' : 'warning';
    reminders.push({
      type: type,
      icon: '🛒',
      title: 'Belanja Belum Dibeli',
      count: totalBelum,
      items: items,
      action: {label: `Lihat ${totalBelum} Item →`, link: 'belanja-hadiah'}
    });
  }

  const stokKurang = [];
  gHadiahKategori().forEach(h => {
    const kebutuhan = hitungKebutuhanHadiah(h.kategori_peserta, h.juara_ke);
    if (kebutuhan == null) return; // partisipasi: tidak dihitung otomatis
    h.items.forEach(item => {
      const target = hitungTargetQtyItem(item, kebutuhan);
      const dibeli = Number(item.qty_dibeli||0);
      if (dibeli < target) {
        stokKurang.push({nama: item.nama, kurang: target - dibeli, kategori: labelPeserta(h.kategori_peserta)});
      }
    });
  });

  if (stokKurang.length > 0) {
    const labels = stokKurang.slice(0, 3).map(i => `${i.nama} (kurang ${i.kurang})`).join(', ');
    reminders.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Stok Hadiah Belum Sesuai Kebutuhan',
      count: stokKurang.length,
      items: [{label: 'Item:', value: stokKurang.length > 3 ? `${labels} +${stokKurang.length-3} lagi` : labels}],
      action: {label: 'Cek Stok →', link: 'hadiah'}
    });
  }

  const belumBayar = gAnggota().filter(a => a.status === 'belum_lunas');
  if (belumBayar.length > 0) {
    const labels = belumBayar.slice(0, 3).map(a => a.nama).join(', ');
    const totalTunggakan = belumBayar.reduce((s,a) => s + Number(a.nominal_wajib||0), 0);
    reminders.push({
      type: 'danger',
      icon: '💰',
      title: 'Anggota Belum Bayar',
      count: belumBayar.length,
      items: [
        {label: 'Anggota:', value: belumBayar.length > 3 ? `${labels} +${belumBayar.length-3} lagi` : labels},
        {label: 'Total Tunggakan:', value: fmtRp(totalTunggakan), valueClass: 'danger'}
      ],
      action: {label: `Tagih ${belumBayar.length} Anggota →`, link: 'database-anggota'}
    });
  }

  const {saldo} = hitungBukuUtama();
  if (saldo < 0) {
    reminders.push({
      type: 'danger',
      icon: '🚨',
      title: '⚠️ Saldo Negatif!',
      count: fmtRp(saldo),
      items: [{label: 'Saldo saat ini:', value: fmtRp(saldo), valueClass: 'danger'}],
      action: {label: 'Cek Keuangan →', link: 'dashboard'}
    });
  }

  if (reminders.length === 0) {
    return `
    <div class="reminder-grid">
      <div class="reminder-card success">
        <div class="card-header">
          <div class="icon">✅</div>
          <div class="title">Semua Aman!</div>
          <div class="count">0</div>
        </div>
        <div class="card-body">
          <div class="reminder-empty">Tidak ada pengingat saat ini. Semua data dalam kondisi baik.</div>
        </div>
        <div class="card-footer">
          ${isLoggedIn ? `<button class="btn secondary small" onclick="openJadwalModal()">+ Tambah Jadwal</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  return `
  <div class="reminder-grid">
    ${reminders.map(r => `
      <div class="reminder-card ${r.type}">
        <div class="card-header">
          <div class="icon">${r.icon}</div>
          <div class="title">${r.title}</div>
          <div class="count">${r.count}</div>
        </div>
        <div class="card-body">
          ${r.items.map(item => `
            <div class="item">
              <span class="label">${item.label}</span>
              <span class="value ${item.valueClass || ''}">${item.value}</span>
            </div>
          `).join('')}
        </div>
        ${r.action ? `
        <div class="card-footer">
          <button class="btn ${r.type === 'danger' ? 'danger' : r.type === 'warning' ? 'orange' : r.type === 'success' ? 'success' : 'secondary'} small" onclick="goSection('${r.action.link}')">${r.action.label}</button>
        </div>` : ''}
      </div>
    `).join('')}
  </div>`;
}

function labelKategoriJadwal(v){ return (KATEGORI_JADWAL.find(k=>k.v===v)||{}).l || v; }

/* ============================================================
   ANGGOTA (dengan auth check)
   ============================================================ */
let filterKategoriAnggota = 'semua';
let filterStatusAnggota = 'semua';
let searchQueryAnggota = '';

function renderAnggota(){
  const list = gAnggota();
  const s = getSettings();

  let filtered = [...list];
  if (filterKategoriAnggota !== 'semua') filtered = filtered.filter(a => a.kategori === filterKategoriAnggota);
  if (filterStatusAnggota !== 'semua') filtered = filtered.filter(a => a.status === filterStatusAnggota);
  if (searchQueryAnggota.trim()) { const q = searchQueryAnggota.toLowerCase().trim(); filtered = filtered.filter(a => a.nama.toLowerCase().includes(q)); }

  filtered.sort((a,b)=>{
    const aBelum = a.status!=='lunas', bBelum = b.status!=='lunas';
    if (aBelum !== bBelum) return aBelum ? -1 : 1;
    return a.nama.localeCompare(b.nama, 'id', {sensitivity:'base'});
  });

  const totalTerkumpul = list.filter(a=>a.status==='lunas').reduce((sum,a)=>sum+Number(a.nominal_wajib||0),0);
  const totalPotensi = list.reduce((sum,a)=>sum+Number(a.nominal_wajib||0),0);
  const lunasCount = list.filter(a=>a.status==='lunas').length;
  const isLoggedIn = !!getCurrentUser();
  const isFiltering = filterKategoriAnggota !== 'semua' || filterStatusAnggota !== 'semua' || !!searchQueryAnggota.trim();

  const rows = filtered.map(a=> isLoggedIn ? `
    <tr>
      <td>${esc(a.nama)}</td>
      <td><span class="kategori-pill ${a.kategori==='khusus'?'khusus':''}">${labelKategori(a.kategori)}</span></td>
      <td class="num">${fmtRp(a.nominal_wajib)}</td>
      <td>${a.status==='lunas'?`<span class="badge lunas">Lunas</span> <span style="font-size:11px;color:var(--ink-soft)">${fmtDate(a.tanggal_bayar)}</span>`:`<span class="badge belum">Belum</span>`}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn secondary small" onclick="toggleLunas('${a.id}')">${a.status==='lunas'?'Batalkan':'Tandai Lunas'}</button>
        <button class="icon-btn" onclick="openAnggotaModal('${a.id}')" title="Edit">✎</button>
        <button class="icon-btn" onclick="hapusAnggota('${a.id}')" title="Hapus">🗑</button>
      </td>
    </tr>` : `
    <tr>
      <td>${esc(a.nama)}</td>
      <td class="num">${fmtRp(a.nominal_wajib)}</td>
      <td>${a.status==='lunas'?`<span class="badge lunas">Lunas</span>`:`<span class="badge belum">Belum</span>`}</td>
    </tr>`).join('');

  const filterHtml = `<div class="filter-row">
    <div class="field" style="margin-bottom:0;min-width:150px;"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Kategori</label>
      <select id="filter-kategori-anggota" onchange="applyFilterAnggota()"><option value="semua" ${filterKategoriAnggota==='semua'?'selected':''}>Semua</option>${KATEGORI_ANGGOTA.map(k=>`<option value="${k.v}" ${filterKategoriAnggota===k.v?'selected':''}>${k.l}</option>`).join('')}</select></div>
    <div class="field" style="margin-bottom:0;min-width:150px;"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Status</label>
      <select id="filter-status-anggota" onchange="applyFilterAnggota()"><option value="semua" ${filterStatusAnggota==='semua'?'selected':''}>Semua</option><option value="lunas" ${filterStatusAnggota==='lunas'?'selected':''}>Lunas</option><option value="belum_lunas" ${filterStatusAnggota==='belum_lunas'?'selected':''}>Belum Lunas</option></select></div>
    <div class="search-box" style="flex:1;min-width:200px;"><input type="text" id="search-input-anggota" placeholder="🔍 Cari nama..." value="${esc(searchQueryAnggota)}" oninput="applySearchAnggota()">${searchQueryAnggota?`<button class="btn secondary small" onclick="clearSearchAnggota()">✕</button>`:''}</div>
    ${isFiltering?`<button class="btn secondary small" onclick="resetFilterAnggota()">↺ Reset</button>`:''}
  </div>`;

  const tarifBelumDiisi = Number(s.tarif.sekolah||0)<=0 && Number(s.tarif.bekerja||0)<=0 && Number(s.tarif.perantauan||0)<=0;
  const tarifBanner = (tarifBelumDiisi && isLoggedIn) ? `
    <div class="panel" style="background:var(--orange-tint); border-left:3px solid var(--orange); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:14px 16px; margin-bottom:16px;">
      <div style="font-size:13.5px; color:var(--ink-soft);">⚠️ Tarif iuran (Sekolah/Bekerja/Perantauan) belum diisi — anggota yang ditambahkan sekarang akan tercatat <b>Rp 0</b>. Set tarif dulu di Pengaturan.</div>
      <button class="btn small" onclick="goSection('pengaturan')" style="white-space:nowrap;">⚙️ Buka Pengaturan</button>
    </div>` : '';

  return `
  ${tarifBanner}
  <div class="stat-grid-ringkasan" style="margin-bottom:26px;">
    <div class="stat-card"><div class="lbl">Total Anggota</div><div class="val">${list.length}</div></div>
    <div class="stat-card pemasukan"><div class="lbl">Terkumpul (Lunas)</div><div class="val">${fmtRp(totalTerkumpul)}</div></div>
    <div class="stat-card"><div class="lbl">Sudah Lunas</div><div class="val">${lunasCount} / ${list.length}</div></div>
    <div class="stat-card"><div class="lbl">Potensi Total</div><div class="val">${fmtRp(totalPotensi)}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <div><h3>Daftar Anggota</h3>
        <div class="desc">Tarif: Sekolah ${fmtRp(s.tarif.sekolah)} · Bekerja ${fmtRp(s.tarif.bekerja)} · Perantauan ${fmtRp(s.tarif.perantauan)} · Khusus (bebas)</div>
      </div>
      ${isLoggedIn ? `<button class="btn" onclick="openAnggotaModal()">+ Tambah Anggota</button>` : ''}
    </div>
    <div class="panel-body">
      ${filterHtml}
      <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
      <table class="anggota-table">
        <thead>${isLoggedIn ? `<tr><th>Nama</th><th>Kategori</th><th class="num">Nominal</th><th>Status</th><th></th></tr>` : `<tr><th>Nama</th><th class="num">Nominal</th><th>Status</th></tr>`}</thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="${isLoggedIn?5:3}">${isFiltering?'Tidak ditemukan.':'Belum ada anggota.'}</td></tr>`}</tbody>
      </table>
      </div>
    </div>
  </div>`;
}
function applyFilterAnggota(){ filterKategoriAnggota=document.getElementById('filter-kategori-anggota').value; filterStatusAnggota=document.getElementById('filter-status-anggota').value; renderContent(); }
function applySearchAnggota(){ searchQueryAnggota=document.getElementById('search-input-anggota').value; renderContent(); }
function clearSearchAnggota(){ searchQueryAnggota=''; renderContent(); }
function resetFilterAnggota(){ filterKategoriAnggota='semua'; filterStatusAnggota='semua'; searchQueryAnggota=''; renderContent(); }
function labelKategori(v){ return (KATEGORI_ANGGOTA.find(k=>k.v===v)||{}).l || v; }
function labelRT(v){ return (RT_LIST.find(k=>k.v===v)||{}).l || v || '-'; }

/* ============================================================
   PENEBAK JENIS KELAMIN DARI NAMA (heuristik, bukan data pasti)
   Menebak berdasarkan nama depan yang cocok dengan daftar nama umum
   di Indonesia, dengan fallback ke pola akhiran nama yang umum.
   Hasil bisa saja meleset untuk nama yang tidak umum/unisex.
   ============================================================ */
const NAMA_PRIA_UMUM = ['muhammad','mohammad','ahmad','achmad','budi','agus','dedi','deni','dedy','deny','dodi','doni','eko','fajar','hadi','hendra','hendro','iwan','joko','johan','yusuf','yusup','yudi','yudha','andi','andre','anton','aris','bagus','bayu','bima','danang','dani','dimas','edi','edo','erik','fadli','fahmi','fauzi','feri','ferry','gilang','guntur','hari','hasan','heri','herry','ilham','imam','indra','irfan','irwan','ivan','jaka','komang','ketut','made','wayan','nyoman','kurniawan','lukman','mahmud','marno','miftah','nanang','nur','oki','omar','panji','pratama','putra','ramadhan','rangga','reza','rian','ridho','rifki','rizal','rizky','robby','roni','rudi','ryan','saiful','samsul','sandi','sigit','slamet','sofyan','sugeng','sukarno','suryanto','tarno','taufik','teguh','tono','topan','trisno','umar','wahyu','wawan','wildan','yahya','yanto','yasin','zaenal','zainal','zaki','arief','ade','asep','bambang','dadang','darma','dwi','endro','faisal','gunawan','hardi','husein','ismail','kadek','kadir','madi','narto','rahmat','sutrisno','suparman','wisnu'];

const NAMA_WANITA_UMUM = ['siti','sri','dewi','ayu','putri','wulan','indah','rina','rini','ratna','ratih','ratu','ani','ana','anisa','annisa','anggi','arum','asri','citra','dian','diah','dina','eka','erna','fitri','fitria','gita','hana','ika','ina','indi','intan','ira','irma','kartika','kirana','laila','lestari','lia','lina','lisa','maya','melati','melinda','mira','nadia','nadya','nia','nina','novi','novita','nurul','oktavia','putu','rahayu','rahmawati','reni','riri','rizka','rosa','sari','septi','shinta','sinta','tania','tari','tia','tina','tuti','ulfa','ulfah','umi','vera','vina','wening','wida','wiwik','yani','yanti','yuli','yulia','yuniar','yustina','zahra','zulaikha','ambar','bella','desi','elin','endah','farah','ida','ima','juwita','kiki','lala','marlina','mega','nining','nurhayati','okta','rahma','rosita','salma','tata','titin','vika','wiwin','yeni'];

const AKHIRAN_PRIA_UMUM = ['yanto','anto','ansyah','uddin','udin','ullah','wan'];
const AKHIRAN_WANITA_UMUM = ['wati','ningsih','ningrum','yanti','nita','iyah','ita'];

function guessGender(nama){
  if(!nama) return null;
  const firstName = String(nama).trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z]/g,'');
  if(!firstName) return null;
  if(NAMA_PRIA_UMUM.includes(firstName)) return 'pria';
  if(NAMA_WANITA_UMUM.includes(firstName)) return 'wanita';
  for(const s of AKHIRAN_PRIA_UMUM){ if(firstName.endsWith(s)) return 'pria'; }
  for(const s of AKHIRAN_WANITA_UMUM){ if(firstName.endsWith(s)) return 'wanita'; }
  return null;
}
function labelGender(v){ return v==='pria' ? '♂ Pria' : v==='wanita' ? '♀ Wanita' : 'Tidak diketahui'; }

function openAnggotaModal(id){
  if (!canEditSection('anggota')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.anggota.find(a=>a.id===id) : null;
  const s = getSettings();
  setModal(editing?'Edit Anggota':'Tambah Anggota', `
    <div class="field"><label>Nama Anggota</label><input id="f-nama" value="${editing?esc(editing.nama):''}" placeholder="Nama lengkap"></div>
    <div class="field"><label>Kategori</label>
      <select id="f-kategori" onchange="updateNominalPreview()">
        ${KATEGORI_ANGGOTA.map(k=>`<option value="${k.v}" ${editing&&editing.kategori===k.v?'selected':''}>${k.l}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>RT</label>
      <select id="f-rt">
        ${RT_LIST.map(r=>`<option value="${r.v}" ${editing&&editing.rt===r.v?'selected':''}>${r.l}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label id="f-nominal-label">Nominal Wajib (otomatis)</label>
      <input id="f-nominal" class="currency-input" value="${editing?fmtRp(editing.nominal_wajib):''}" ${editing&&editing.kategori==='khusus'?'':'disabled'} style="${editing&&editing.kategori==='khusus'?'':'background:var(--cream);'}">
      <div class="hint" id="f-nominal-hint" style="${editing&&editing.kategori==='khusus'?'':'display:none;'}">Kategori Khusus: isi nominal iuran secara bebas sesuai kesepakatan.</div>
    </div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label: editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const nama = document.getElementById('f-nama').value.trim();
      const kategori = document.getElementById('f-kategori').value;
      const rt = document.getElementById('f-rt').value;
      if(!nama){ toast('Nama anggota wajib diisi'); return; }
      const nominal = kategori==='khusus' ? getCurrencyValue(document.getElementById('f-nominal')) : (getSettings().tarif[kategori] || 0);
      if(kategori==='khusus' && (!nominal || nominal<=0)){ toast('Isi nominal iuran untuk kategori khusus'); return; }
      let actionMsg = '';
      if(editing){
        actionMsg = `✏️ Edit anggota: ${editing.nama} → ${nama}`;
        editing.nama = nama; editing.kategori = kategori; editing.rt = rt; editing.nominal_wajib = nominal;
      } else {
        actionMsg = `➕ Tambah anggota: ${nama} (${labelKategori(kategori)})`;
        db.anggota.push({id:uid(), event_id:eid(), nama, kategori, rt, nominal_wajib:nominal, status:'belum_lunas', tanggal_bayar:null});
      }
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast('Data anggota disimpan');
      notifyTelegram(actionMsg, `Nama: ${nama}\nKategori: ${labelKategori(kategori)}\nRT: ${labelRT(rt)}\nNominal: ${fmtRp(nominal)}`);
    }}
  ]);
  setTimeout(updateNominalPreview, 0);
}
function updateNominalPreview(){
  const kEl = document.getElementById('f-kategori');
  if(!kEl) return;
  const nominalInput = document.getElementById('f-nominal');
  const labelEl = document.getElementById('f-nominal-label');
  const hintEl = document.getElementById('f-nominal-hint');
  if (!nominalInput) return;
  if (kEl.value === 'khusus') {
    nominalInput.disabled = false;
    nominalInput.style.background = '';
    if (labelEl) labelEl.textContent = 'Nominal Wajib (bebas)';
    if (hintEl) hintEl.style.display = '';
  } else {
    const s = getSettings();
    setCurrencyValue(nominalInput, s.tarif[kEl.value] || 0);
    nominalInput.disabled = true;
    nominalInput.style.background = 'var(--cream)';
    if (labelEl) labelEl.textContent = 'Nominal Wajib (otomatis)';
    if (hintEl) hintEl.style.display = 'none';
  }
}
function toggleLunas(id){
  if (!canEditSection('anggota')) { toast('⛔ Login untuk mengedit data'); return; }
  const a = db.anggota.find(x=>x.id===id); if(!a) return;
  const statusBaru = a.status==='lunas' ? 'belum_lunas' : 'lunas';
  a.status = statusBaru;
  a.tanggal_bayar = a.status==='lunas' ? todayISO() : null;
  saveDB(); renderContent(); renderTopbarSaldo();
  if(statusBaru === 'lunas'){
    notifyTelegram(`✅ Anggota LUNAS: ${a.nama}`, `Nama: ${a.nama}\nKategori: ${labelKategori(a.kategori)}\nNominal: ${fmtRp(a.nominal_wajib)}\nTanggal Bayar: ${fmtDate(a.tanggal_bayar)}`);
  }else{
    notifyTelegram(`↩️ Anggota dibatalkan lunas: ${a.nama}`, `Nama: ${a.nama}\nKategori: ${labelKategori(a.kategori)}`);
  }
}
function hapusAnggota(id){
  if (!canEditSection('anggota')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus anggota ini?')) return;
  const a = db.anggota.find(x=>x.id===id);
  db.anggota = db.anggota.filter(a=>a.id!==id); 
  saveDB(); renderContent(); renderTopbarSaldo();
  if(a) notifyTelegram(`🗑️ Hapus anggota: ${a.nama}`, `Nama: ${a.nama}\nKategori: ${labelKategori(a.kategori)}`);
}

/* ============================================================
   DATABASE ANGGOTA (dengan auth check untuk tombol aksi)
   ============================================================ */
let filterKategori = 'semua';
let filterStatus = 'semua';
let filterGender = 'semua';
let filterRT = 'semua';
let searchQuery = '';
let sortBy = 'nama';
let sortOrder = 'asc';

function renderDatabaseAnggota(){
  const list = gAnggota();
  let filtered = [...list];
  if (filterKategori !== 'semua') filtered = filtered.filter(a => a.kategori === filterKategori);
  if (filterStatus !== 'semua') filtered = filtered.filter(a => a.status === filterStatus);
  if (filterGender !== 'semua') filtered = filtered.filter(a => (guessGender(a.nama) || 'tidak_diketahui') === filterGender);
  if (filterRT !== 'semua') filtered = filtered.filter(a => a.rt === filterRT);
  if (searchQuery.trim()) { const q = searchQuery.toLowerCase().trim(); filtered = filtered.filter(a => a.nama.toLowerCase().includes(q)); }
  
  filtered.sort((a,b) => {
    let valA, valB;
    switch(sortBy){
      case 'nama': valA = a.nama; valB = b.nama; break;
      case 'kategori': valA = a.kategori; valB = b.kategori; break;
      case 'rt': valA = a.rt||''; valB = b.rt||''; break;
      case 'nominal': valA = Number(a.nominal_wajib||0); valB = Number(b.nominal_wajib||0); break;
      case 'status': valA = a.status; valB = b.status; break;
      case 'tanggal': valA = a.tanggal_bayar || ''; valB = b.tanggal_bayar || ''; break;
      default: valA = a.nama; valB = b.nama;
    }
    if (typeof valA === 'string') return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  const total = filtered.length, totalBelum = filtered.filter(a=>a.status==='belum_lunas').length, totalLunas = filtered.filter(a=>a.status==='lunas').length;
  const totalNominal = filtered.reduce((s,a)=>s+Number(a.nominal_wajib||0),0);
  const totalTerkumpul = filtered.filter(a=>a.status==='lunas').reduce((s,a)=>s+Number(a.nominal_wajib||0),0);
  const isLoggedIn = !!getCurrentUser();

  const totalPria = filtered.filter(a=>guessGender(a.nama)==='pria').length;
  const totalWanita = filtered.filter(a=>guessGender(a.nama)==='wanita').length;

  const statKategori = {};
  KATEGORI_ANGGOTA.forEach(k => {
    const items = filtered.filter(a=>a.kategori===k.v);
    statKategori[k.v] = {label: k.l, total: items.length, lunas: items.filter(a=>a.status==='lunas').length, nominal: items.reduce((s,a)=>s+Number(a.nominal_wajib||0),0), terkumpul: items.filter(a=>a.status==='lunas').reduce((s,a)=>s+Number(a.nominal_wajib||0),0)};
  });

  const rows = filtered.map(a=>`<tr class="${a.status==='belum_lunas'?'belum-bayar':''}">
    <td>${esc(a.nama)}</td>
    <td><span class="kategori-pill ${a.kategori==='khusus'?'khusus':''}">${labelKategori(a.kategori)}</span></td>
    <td>${labelRT(a.rt)}</td>
    <td class="num">${fmtRp(a.nominal_wajib)}</td>
    <td>${a.status==='lunas'?`<span class="badge lunas">Lunas</span>`:`<span class="badge belum">Belum Bayar</span>`}</td>
    <td style="font-size:12px;color:var(--ink-soft);">${a.status==='lunas'?fmtDate(a.tanggal_bayar):'-'}</td>
    <td style="text-align:right;white-space:nowrap;">
      <button class="btn secondary small" onclick="toggleLunas('${a.id}')" ${!isLoggedIn ? 'disabled' : ''}>${a.status==='lunas'?'Batalkan':'Bayar'}</button>
      <button class="icon-btn" onclick="openAnggotaModal('${a.id}')" ${!isLoggedIn ? 'disabled' : ''}>✎</button>
      <button class="icon-btn" onclick="hapusAnggota('${a.id}')" ${!isLoggedIn ? 'disabled' : ''}>🗑</button>
    </td>
  </tr>`).join('');

  const statCards = `<div class="stat-grid"><div class="stat-card info"><div class="lbl">Total Anggota</div><div class="val">${total}</div></div>
    <div class="stat-card pemasukan"><div class="lbl">Lunas</div><div class="val">${totalLunas}</div></div>
    <div class="stat-card warning"><div class="lbl">Belum Bayar</div><div class="val">${totalBelum}</div></div>
    <div class="stat-card"><div class="lbl">Total Iuran</div><div class="val">${fmtRp(totalNominal)}</div></div>
    <div class="stat-card pemasukan"><div class="lbl">Terkumpul</div><div class="val">${fmtRp(totalTerkumpul)}</div></div>
    <div class="stat-card warning"><div class="lbl">Tunggakan</div><div class="val">${fmtRp(totalNominal - totalTerkumpul)}</div></div>
    <div class="stat-card gender-card" title="Perkiraan berdasarkan nama, bukan data pasti">
      <div class="lbl">Pria &amp; Wanita</div>
      <div class="gender-stats">
        <div class="gender-stat"><span class="n">${totalPria}</span><span class="l">♂ Pria</span></div>
        <div class="gender-stat"><span class="n">${totalWanita}</span><span class="l">♀ Wanita</span></div>
      </div>
    </div></div>`;

  const statKategoriHtml = Object.entries(statKategori).map(([kv, k]) => {
    const belum = k.total - k.lunas;
    const pct = k.nominal > 0 ? Math.round((k.terkumpul / k.nominal) * 100) : 0;
    return `
    <div class="kategori-card k-${kv}">
      <div class="kc-title">${k.label}</div>
      <div class="kc-stats">
        <div class="kc-stat"><span class="n">${k.total}</span><span class="l">Anggota</span></div>
        <div class="kc-stat lunas"><span class="n">${k.lunas}</span><span class="l">Lunas</span></div>
        <div class="kc-stat belum"><span class="n">${belum}</span><span class="l">Belum</span></div>
      </div>
      <div class="kc-progress">
        <div class="kc-progress-bar"><div class="kc-progress-fill" style="width:${pct}%;"></div></div>
        <div class="kc-money"><span>Terkumpul <b>${fmtRp(k.terkumpul)}</b></span><span>dari <b>${fmtRp(k.nominal)}</b></span></div>
      </div>
    </div>`;
  }).join('');

  const filterHtml = `<div class="filter-row">
    <div class="field" style="margin-bottom:0;min-width:150px;"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Kategori</label>
      <select id="filter-kategori" onchange="applyFilter()"><option value="semua" ${filterKategori==='semua'?'selected':''}>Semua</option>${KATEGORI_ANGGOTA.map(k=>`<option value="${k.v}" ${filterKategori===k.v?'selected':''}>${k.l}</option>`).join('')}</select></div>
    <div class="field" style="margin-bottom:0;min-width:150px;"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Status</label>
      <select id="filter-status" onchange="applyFilter()"><option value="semua" ${filterStatus==='semua'?'selected':''}>Semua</option><option value="lunas" ${filterStatus==='lunas'?'selected':''}>Lunas</option><option value="belum_lunas" ${filterStatus==='belum_lunas'?'selected':''}>Belum Bayar</option></select></div>
    <div class="field" style="margin-bottom:0;min-width:150px;"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Jenis Kelamin</label>
      <select id="filter-gender" onchange="applyFilter()" title="Perkiraan berdasarkan nama, bukan data pasti"><option value="semua" ${filterGender==='semua'?'selected':''}>Semua</option><option value="pria" ${filterGender==='pria'?'selected':''}>♂ Pria</option><option value="wanita" ${filterGender==='wanita'?'selected':''}>♀ Wanita</option><option value="tidak_diketahui" ${filterGender==='tidak_diketahui'?'selected':''}>Tidak diketahui</option></select></div>
    <div class="field" style="margin-bottom:0;min-width:150px;"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">RT</label>
      <select id="filter-rt" onchange="applyFilter()"><option value="semua" ${filterRT==='semua'?'selected':''}>Semua</option>${RT_LIST.map(r=>`<option value="${r.v}" ${filterRT===r.v?'selected':''}>${r.l}</option>`).join('')}</select></div>
    <div class="search-box" style="flex:1;min-width:200px;"><input type="text" id="search-input" placeholder="🔍 Cari nama..." value="${esc(searchQuery)}" oninput="applySearch()">${searchQuery?`<button class="btn secondary small" onclick="clearSearch()">✕</button>`:''}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn small" onclick="exportAnggotaCSV()">⬇ Ekspor CSV</button><button class="btn secondary small" onclick="resetFilter()">↺ Reset</button></div>
  </div>`;

  const sortIndicator = (field) => { if (sortBy !== field) return '↕'; return sortOrder === 'asc' ? '↑' : '↓'; };

  return `${statCards}<div class="panel"><div class="panel-head"><div><h3>📋 Database Anggota</h3><div class="desc">${totalBelum} anggota belum bayar · total tunggakan ${fmtRp(totalNominal - totalTerkumpul)}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn success small" onclick="tandaiSemuaLunas()" ${!isLoggedIn ? 'disabled' : ''}>✓ Tandai Semua Lunas</button>
      ${isLoggedIn ? `<button class="btn" onclick="openAnggotaModal()">+ Tambah</button>` : ''}
    </div></div>
    <div class="panel-body">${filterHtml}${statKategoriHtml?`<div class="kategori-grid" style="margin-bottom:16px;">${statKategoriHtml}</div>`:''}
    <div style="overflow-x:auto;"><table class="database-table"><thead><tr><th class="sortable" onclick="sortTable('nama')">Nama ${sortIndicator('nama')}</th>
      <th class="sortable" onclick="sortTable('kategori')">Kategori ${sortIndicator('kategori')}</th>
      <th class="sortable" onclick="sortTable('rt')">RT ${sortIndicator('rt')}</th>
      <th class="num sortable" onclick="sortTable('nominal')">Nominal ${sortIndicator('nominal')}</th>
      <th class="sortable" onclick="sortTable('status')">Status ${sortIndicator('status')}</th>
      <th class="sortable" onclick="sortTable('tanggal')">Tgl Bayar ${sortIndicator('tanggal')}</th><th></th></tr></thead>
      <tbody>${rows||`<tr class="empty-row"><td colspan="7">${searchQuery?'Tidak ditemukan':'Belum ada anggota'}</td></tr>`}</tbody>
      ${filtered.length>0?`<tfoot><tr><td colspan="3">Total ${filtered.length} anggota</td><td class="num">${fmtRp(totalNominal)}</td><td colspan="3"></td></tr></tfoot>`:''}</table></div></div></div>`;
}

function applyFilter(){ filterKategori=document.getElementById('filter-kategori').value; filterStatus=document.getElementById('filter-status').value; filterGender=document.getElementById('filter-gender').value; filterRT=document.getElementById('filter-rt').value; renderContent(); }
function applySearch(){ searchQuery=document.getElementById('search-input').value; renderContent(); }
function clearSearch(){ searchQuery=''; document.getElementById('search-input').value=''; renderContent(); }
function resetFilter(){ filterKategori='semua'; filterStatus='semua'; filterGender='semua'; filterRT='semua'; searchQuery=''; sortBy='nama'; sortOrder='asc'; renderContent(); }
function sortTable(field){ if(sortBy===field){ sortOrder=sortOrder==='asc'?'desc':'asc'; }else{ sortBy=field; sortOrder='asc'; } renderContent(); }
function tandaiSemuaLunas(){ 
  if (!canEditSection('database-anggota')) { toast('⛔ Login untuk mengedit data'); return; }
  const list=gAnggota().filter(a=>a.status==='belum_lunas'); 
  if(list.length===0){ toast('Semua anggota sudah lunas'); return; } 
  if(!confirm(`Tandai ${list.length} anggota menjadi LUNAS?`)) return; 
  list.forEach(a=>{a.status='lunas'; a.tanggal_bayar=todayISO();}); 
  saveDB(); renderContent(); renderTopbarSaldo(); 
  toast(`✓ ${list.length} anggota ditandai lunas`);
  const detail = list.map(a => `${a.nama} (${labelKategori(a.kategori)}) - ${fmtRp(a.nominal_wajib)}`).join('\n');
  notifyTelegram(`✅ ${list.length} anggota ditandai LUNAS`, detail);
}
function exportAnggotaCSV(){ const list=gAnggota(); if(list.length===0){ toast('Tidak ada data'); return; } let csv='No,Nama,Kategori,RT,Nominal,Status,Tanggal Bayar\n'; list.forEach((a,i)=>{const status=a.status==='lunas'?'Lunas':'Belum Bayar'; const tgl=a.tanggal_bayar?fmtDate(a.tanggal_bayar):'-'; csv+=`${i+1},"${a.nama}",${labelKategori(a.kategori)},${labelRT(a.rt)},${a.nominal_wajib},${status},${tgl}\n`;}); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`database-anggota-${todayISO()}.csv`; link.click(); toast('CSV berhasil diekspor'); }

/* ============================================================
   DONATUR, TRANSAKSI, OPERASIONAL (dengan auth check)
   ============================================================ */
function renderDonatur(){
  const list = gDonatur().slice().sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||''));
  const total = list.reduce((s,d)=>s+Number(d.jumlah||0),0);
  const isLoggedIn = !!getCurrentUser();
  const rows = list.map(d=>`<tr${isLoggedIn ? ` class="row-clickable" onclick="openDonaturModal('${d.id}')"` : ''}><td>${fmtDateShort(d.tanggal)}</td><td>${esc(d.nama_donatur)}</td><td>${esc(d.keterangan||'-')}</td><td class="num">${fmtRp(d.jumlah)}</td>${isLoggedIn ? `<td style="text-align:right;">
    <button class="icon-btn" onclick="event.stopPropagation();hapusDonatur('${d.id}')">🗑</button>
  </td>` : ''}</tr>`).join('');
  return `<div class="stat-grid"><div class="stat-card pemasukan"><div class="lbl">Total Donasi</div><div class="val">${fmtRp(total)}</div></div></div>
  <div class="panel"><div class="panel-head"><h3>Daftar Donatur</h3>${isLoggedIn ? `<button class="btn" onclick="openDonaturModal()">+ Tambah</button>` : ''}</div>
  <div class="panel-body flush"><table class="general-table tanggal-nominal-table"><thead><tr><th>Tanggal</th><th>Nama</th><th>Keterangan</th><th class="num">Jumlah</th>${isLoggedIn ? '<th></th>' : ''}</tr></thead>
  <tbody>${rows||`<tr class="empty-row"><td colspan="${isLoggedIn?5:4}">Belum ada donasi.</td></tr>`}</tbody></table></div></div>`;
}
function openDonaturModal(id){
  if (!canEditSection('donatur')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.donatur.find(d=>d.id===id) : null;
  setModal(editing?'Edit Donasi':'Tambah Donasi', `
    <div class="field"><label>Nama Donatur</label><input id="f-nama" value="${editing?esc(editing.nama_donatur):''}"></div>
    <div class="field-row"><div class="field"><label>Jumlah (Rp)</label><input id="f-jumlah" class="currency-input" type="text" value="${editing?formatCurrency(editing.jumlah):''}"></div>
    <div class="field"><label>Tanggal</label><input id="f-tanggal" type="date" value="${editing?editing.tanggal:todayISO()}"></div></div>
    <div class="field"><label>Keterangan</label><input id="f-ket" value="${editing?esc(editing.keterangan||''):''}"></div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const nama = document.getElementById('f-nama').value.trim();
      const jumlah = getCurrencyValue(document.getElementById('f-jumlah'));
      const tanggal = document.getElementById('f-tanggal').value||todayISO();
      const ket = document.getElementById('f-ket').value.trim();
      if(!nama||jumlah<=0){ toast('Nama & jumlah wajib'); return; }
      let actionMsg = '';
      if(editing){ 
        actionMsg = `✏️ Edit donasi: ${editing.nama_donatur} → ${nama}`;
        Object.assign(editing,{nama_donatur:nama,jumlah,tanggal,keterangan:ket}); 
      }
      else{ 
        actionMsg = `➕ Donasi baru dari ${nama}`;
        db.donatur.push({id:uid(),event_id:eid(),nama_donatur:nama,jumlah,tanggal,keterangan:ket}); 
      }
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast('Disimpan');
      notifyTelegram(actionMsg, `Nama: ${nama}\nJumlah: ${fmtRp(jumlah)}\nTanggal: ${fmtDate(tanggal)}\nKeterangan: ${ket || '-'}`);
    }}
  ]);
  setTimeout(setupAllCurrencyInputs, 50);
}
function hapusDonatur(id){ 
  if (!canEditSection('donatur')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus?')) return; 
  const d = db.donatur.find(x=>x.id===id);
  db.donatur=db.donatur.filter(d=>d.id!==id); 
  saveDB(); renderContent(); renderTopbarSaldo();
  if(d) notifyTelegram(`🗑️ Hapus donasi dari ${d.nama_donatur}`, `Jumlah: ${fmtRp(d.jumlah)}`);
}

function renderTransaksi(){
  const list = gTransaksiLain().slice().sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||''));
  const total = list.reduce((s,t)=>s+Number(t.jumlah||0),0);
  const isLoggedIn = !!getCurrentUser();
  const rows = list.map(t=>`<tr${isLoggedIn ? ` class="row-clickable" onclick="openTransaksiModal('${t.id}')"` : ''}><td>${fmtDateShort(t.tanggal)}</td><td>${esc(t.jenis)}</td><td>${esc(t.keterangan||'-')}</td><td class="num">${fmtRp(t.jumlah)}</td>${isLoggedIn ? `<td style="text-align:right;">
    <button class="icon-btn" onclick="event.stopPropagation();hapusTransaksi('${t.id}')">🗑</button>
  </td>` : ''}</tr>`).join('');
  return `<div class="stat-grid"><div class="stat-card pemasukan"><div class="lbl">Total Transaksi Lain</div><div class="val">${fmtRp(total)}</div></div></div>
  <div class="panel"><div class="panel-head"><h3>Transaksi Lain</h3>${isLoggedIn ? `<button class="btn" onclick="openTransaksiModal()">+ Tambah</button>` : ''}</div>
  <div class="panel-body flush"><table class="general-table tanggal-nominal-table"><thead><tr><th>Tanggal</th><th>Nama</th><th>Keterangan</th><th class="num">Jumlah</th>${isLoggedIn ? '<th></th>' : ''}</tr></thead>
  <tbody>${rows||`<tr class="empty-row"><td colspan="${isLoggedIn?5:4}">Belum ada transaksi.</td></tr>`}</tbody></table></div></div>`;
}
function openTransaksiModal(id){
  if (!canEditSection('transaksi')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.transaksiLain.find(t=>t.id===id) : null;
  setModal(editing?'Edit Transaksi':'Tambah Transaksi', `
    <div class="field"><label>Nama</label><input id="f-jenis" value="${editing?esc(editing.jenis):''}"></div>
    <div class="field-row"><div class="field"><label>Jumlah (Rp)</label><input id="f-jumlah" class="currency-input" type="text" value="${editing?formatCurrency(editing.jumlah):''}"></div>
    <div class="field"><label>Tanggal</label><input id="f-tanggal" type="date" value="${editing?editing.tanggal:todayISO()}"></div></div>
    <div class="field"><label>Keterangan</label><input id="f-ket" value="${editing?esc(editing.keterangan||''):''}"></div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const jenis = document.getElementById('f-jenis').value.trim();
      const jumlah = getCurrencyValue(document.getElementById('f-jumlah'));
      const tanggal = document.getElementById('f-tanggal').value||todayISO();
      const ket = document.getElementById('f-ket').value.trim();
      if(!jenis||jumlah<=0){ toast('Nama & jumlah wajib'); return; }
      let actionMsg = '';
      if(editing){ actionMsg = `✏️ Edit transaksi: ${editing.jenis} → ${jenis}`; Object.assign(editing,{jenis,jumlah,tanggal,keterangan:ket}); }
      else{ actionMsg = `➕ Transaksi baru: ${jenis}`; db.transaksiLain.push({id:uid(),event_id:eid(),jenis,jumlah,tanggal,keterangan:ket}); }
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast('Disimpan');
      notifyTelegram(actionMsg, `Nama: ${jenis}\nJumlah: ${fmtRp(jumlah)}\nTanggal: ${fmtDate(tanggal)}\nKeterangan: ${ket || '-'}`);
    }}
  ]);
  setTimeout(setupAllCurrencyInputs, 50);
}
function hapusTransaksi(id){ 
  if (!canEditSection('transaksi')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus?')) return; 
  const t = db.transaksiLain.find(x=>x.id===id);
  db.transaksiLain=db.transaksiLain.filter(t=>t.id!==id); 
  saveDB(); renderContent(); renderTopbarSaldo();
  if(t) notifyTelegram(`🗑️ Hapus transaksi: ${t.jenis}`, `Jumlah: ${fmtRp(t.jumlah)}`);
}

function renderOperasional(){
  const list = gOperasional().slice().sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||''));
  const total = list.reduce((s,o)=>s+Number(o.jumlah||0),0);
  const isLoggedIn = !!getCurrentUser();
  const rows = list.map(o=>`<tr${isLoggedIn ? ` class="row-clickable" onclick="openOperasionalModal('${o.id}')"` : ''}><td>${fmtDateShort(o.tanggal)}</td><td>${esc(o.keterangan)}</td><td>${esc(o.catatan_bukti||'-')}</td><td class="num">${fmtRp(o.jumlah)}</td>${isLoggedIn ? `<td style="text-align:right;">
    <button class="icon-btn" onclick="event.stopPropagation();hapusOperasional('${o.id}')">🗑</button>
  </td>` : ''}</tr>`).join('');
  return `<div class="stat-grid"><div class="stat-card pengeluaran"><div class="lbl">Total Operasional</div><div class="val">${fmtRp(total)}</div></div></div>
  <div class="panel"><div class="panel-head"><h3>Biaya Operasional</h3>${isLoggedIn ? `<button class="btn" onclick="openOperasionalModal()">+ Tambah</button>` : ''}</div>
  <div class="panel-body flush"><table class="general-table tanggal-nominal-table"><thead><tr><th>Tanggal</th><th>Nama</th><th>Catatan</th><th class="num">Jumlah</th>${isLoggedIn ? '<th></th>' : ''}</tr></thead>
  <tbody>${rows||`<tr class="empty-row"><td colspan="${isLoggedIn?5:4}">Belum ada biaya.</td></tr>`}</tbody></table></div></div>`;
}
function openOperasionalModal(id){
  if (!canEditSection('operasional')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.operasional.find(o=>o.id===id) : null;
  setModal(editing?'Edit Biaya':'Tambah Biaya', `
    <div class="field"><label>Nama</label><input id="f-ket" value="${editing?esc(editing.keterangan):''}"></div>
    <div class="field-row"><div class="field"><label>Jumlah (Rp)</label><input id="f-jumlah" class="currency-input" type="text" value="${editing?formatCurrency(editing.jumlah):''}"></div>
    <div class="field"><label>Tanggal</label><input id="f-tanggal" type="date" value="${editing?editing.tanggal:todayISO()}"></div></div>
    <div class="field"><label>Catatan (opsional)</label><input id="f-bukti" value="${editing?esc(editing.catatan_bukti||''):''}"></div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const ket = document.getElementById('f-ket').value.trim();
      const jumlah = getCurrencyValue(document.getElementById('f-jumlah'));
      const tanggal = document.getElementById('f-tanggal').value||todayISO();
      const bukti = document.getElementById('f-bukti').value.trim();
      if(!ket||jumlah<=0){ toast('Nama & jumlah wajib'); return; }
      let actionMsg = '';
      if(editing){ actionMsg = `✏️ Edit biaya operasional: ${editing.keterangan} → ${ket}`; Object.assign(editing,{keterangan:ket,jumlah,tanggal,catatan_bukti:bukti}); }
      else{ actionMsg = `➕ Biaya operasional baru: ${ket}`; db.operasional.push({id:uid(),event_id:eid(),keterangan:ket,jumlah,tanggal,catatan_bukti:bukti}); }
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast('Disimpan');
      notifyTelegram(actionMsg, `Nama: ${ket}\nJumlah: ${fmtRp(jumlah)}\nTanggal: ${fmtDate(tanggal)}\nCatatan: ${bukti || '-'}`);
    }}
  ]);
  setTimeout(setupAllCurrencyInputs, 50);
}
function hapusOperasional(id){ 
  if (!canEditSection('operasional')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus?')) return; 
  const o = db.operasional.find(x=>x.id===id);
  db.operasional=db.operasional.filter(o=>o.id!==id); 
  saveDB(); renderContent(); renderTopbarSaldo();
  if(o) notifyTelegram(`🗑️ Hapus biaya operasional: ${o.keterangan}`, `Jumlah: ${fmtRp(o.jumlah)}`);
}

/* ============================================================
   LOMBA & KEBUTUHAN (dengan auth check)
   ============================================================ */
let openLombaIds = new Set();
let lombaActiveTab = {};
function getLombaTab(id){ return lombaActiveTab[id] || 'kebutuhan'; }
function setLombaTab(id, tab){ lombaActiveTab[id] = tab; renderContent(); }

function renderLomba(){
  const list = gLomba();
  const totalKebutuhan = db.lombaKebutuhan.filter(k=>list.some(l=>l.id===k.lomba_id))
    .reduce((s,k)=>s + (Number(k.harga_realisasi ?? k.harga_estimasi ?? 0)*Number(k.qty||0)), 0);
  const isLoggedIn = !!getCurrentUser();

  const cards = list.map((l, idx)=>{
    const items = gKebutuhan(l.id);
    const subtotal = items.reduce((s,k)=>s+(Number(k.harga_realisasi ?? k.harga_estimasi ?? 0)*Number(k.qty||0)),0);
    const isOpen = openLombaIds.has(l.id);
    const activeTab = getLombaTab(l.id);
    const juaraUtama = JUARA_LIST.filter(j=>j.v!=='partisipasi');
    const juaraTersedia = juaraUtama.filter(j=>gHadiahKategori().some(h=>h.kategori_peserta===l.kategori_peserta && h.juara_ke===j.v));
    const hadiahBadge = juaraTersedia.length===0
      ? `<span class="lomba-badge warn">Hadiah belum diatur</span>`
      : (juaraTersedia.length<juaraUtama.length ? `<span class="lomba-badge warn">Hadiah sebagian</span>` : '');
    return `
    <div class="lomba-card ${isOpen?'open':''}">
      <div class="lomba-card-head" onclick="toggleLombaCard('${l.id}')" style="cursor:pointer;">
        <div><span class="nomor-badge kategori-${l.kategori_peserta}">${idx+1}</span><span class="name">${esc(l.nama)}</span><span class="kategori-pill" style="margin-left:8px;">${labelPeserta(l.kategori_peserta)}</span>${Number(l.jumlah_anggota_regu||1)>1?`<span class="kategori-pill khusus" style="margin-left:6px;">👥 Beregu ×${l.jumlah_anggota_regu}</span>`:''}</div>
        <div style="display:flex;align-items:center;gap:14px;">
          <span class="lomba-badge">${items.length} item</span>
          ${hadiahBadge}
          <span class="mono" style="font-size:13px;">${fmtRp(subtotal)}</span>
          <button class="icon-btn" onclick="event.stopPropagation(); openLombaModal('${l.id}')" ${!isLoggedIn ? 'disabled' : ''}>✎</button>
          <button class="icon-btn" onclick="event.stopPropagation(); hapusLomba('${l.id}')" ${!isLoggedIn ? 'disabled' : ''}>🗑</button>
          <svg class="chevron" width="16" height="16" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
      <div class="lomba-card-body">
        <div class="lomba-tabs">
          <button type="button" class="lomba-tabbtn ${activeTab==='kebutuhan'?'active':''}" onclick="setLombaTab('${l.id}','kebutuhan')">Kebutuhan Barang</button>
          <button type="button" class="lomba-tabbtn ${activeTab==='hadiah'?'active':''}" onclick="setLombaTab('${l.id}','hadiah')">Hadiah${hadiahBadge?' •':''}</button>
        </div>
        <div style="display:${activeTab==='kebutuhan'?'block':'none'};">
        <div style="overflow-x:auto;">
        <table class="lomba-table"><thead><tr><th>Item</th><th class="num">Harga</th><th class="num">Qty</th><th class="num">Subtotal</th><th></th></tr></thead>
        <tbody>${items.map(k=>{
          const harga = Number(k.harga_realisasi ?? k.harga_estimasi ?? 0);
          const belanja = db.daftarBelanjaPerlengkapan.find(b=>b.kebutuhan_id===k.id && b.event_id===eid());
          const sudahDibeli = belanja && belanja.status === 'dibeli';
          const hargaCell = k.harga_realisasi!=null ? fmtRp(k.harga_realisasi) : `${fmtRp(k.harga_estimasi)}<span style="color:var(--abu); font-size:11px;"> (estimasi)</span>`;
          return `<tr class="${sudahDibeli?'dibeli':''}"><td>${esc(k.nama_item)} ${sudahDibeli?'✓':''}</td><td class="num">${hargaCell}</td><td class="num">${k.qty}</td><td class="num">${fmtRp(harga*k.qty)}</td><td style="text-align:right;white-space:nowrap;">
            <button class="btn secondary small" onclick="toggleBelanjaPerlengkapan('${k.id}')" ${!isLoggedIn ? 'disabled' : ''}>${sudahDibeli?'✓ Dibeli':'Belum'}</button>
            <button class="icon-btn" onclick="openKebutuhanModal('${l.id}','${k.id}')" ${!isLoggedIn ? 'disabled' : ''}>✎</button>
            <button class="icon-btn" onclick="hapusKebutuhan('${k.id}')" ${!isLoggedIn ? 'disabled' : ''}>🗑</button>
          </td></tr>`;
        }).join('')||`<tr class="empty-row"><td colspan="5">Belum ada kebutuhan.</td></tr>`}</tbody>
        ${items.length?`<tfoot><tr><td colspan="3">Subtotal</td><td class="num">${fmtRp(subtotal)}</td><td></td></tr></tfoot>`:''}</table></div>
        ${isLoggedIn ? `
        <div class="quick-add-row">
          <input id="qa-nama-${l.id}" type="text" placeholder="Nama item baru" onkeydown="if(event.key==='Enter'){event.preventDefault(); tambahKebutuhanCepat('${l.id}');}">
          <input id="qa-harga-${l.id}" type="text" class="currency-input" placeholder="Harga" onkeydown="if(event.key==='Enter'){event.preventDefault(); tambahKebutuhanCepat('${l.id}');}">
          <input id="qa-qty-${l.id}" type="number" min="1" value="1" placeholder="Qty" onkeydown="if(event.key==='Enter'){event.preventDefault(); tambahKebutuhanCepat('${l.id}');}">
          <button class="btn secondary small" onclick="tambahKebutuhanCepat('${l.id}')">+ Tambah</button>
        </div>` : ''}
        </div>
        <div style="display:${activeTab==='hadiah'?'block':'none'};">
        ${renderHadiahLombaBlock(l)}
        </div>
      </div>
    </div>`;
  }).join('');

  return `<div class="stat-grid"><div class="stat-card pengeluaran"><div class="lbl">Total Kebutuhan</div><div class="val">${fmtRp(totalKebutuhan)}</div></div></div>
  <div class="panel"><div class="panel-head"><div><h3>Daftar Lomba</h3><div class="desc">Klik kartu untuk buka rincian</div></div>${isLoggedIn ? `<button class="btn" onclick="openLombaModal()">+ Tambah Lomba</button>` : ''}</div>
  <div class="panel-body">${cards||`<div class="empty-row" style="padding:30px;text-align:center;">Belum ada lomba.</div>`}</div></div>`;
}
function labelPeserta(v){ return (KATEGORI_PESERTA.find(k=>k.v===v)||{}).l || v; }
function toggleLombaCard(id){ openLombaIds.has(id)?openLombaIds.delete(id):openLombaIds.add(id); renderContent(); }

function tambahKebutuhanCepat(lombaId){
  if (!canEditSection('lomba')) { toast('⛔ Login untuk mengedit data'); return; }
  const namaEl = document.getElementById(`qa-nama-${lombaId}`);
  const hargaEl = document.getElementById(`qa-harga-${lombaId}`);
  const qtyEl = document.getElementById(`qa-qty-${lombaId}`);
  const nama_item = namaEl.value.trim();
  const harga_estimasi = getCurrencyValue(hargaEl);
  const qty = Number(qtyEl.value || 1);
  if(!nama_item || qty<=0){ toast('Nama & qty wajib diisi'); return; }
  db.lombaKebutuhan.push({id:uid(), lomba_id:lombaId, nama_item, harga_estimasi, harga_realisasi:null, qty});
  saveDB(); openLombaIds.add(lombaId); lombaActiveTab[lombaId]='kebutuhan'; renderContent(); renderTopbarSaldo(); toast('Disimpan');
  const lomba = db.lomba.find(x=>x.id===lombaId);
  notifyTelegram(`➕ Item kebutuhan baru: ${nama_item}`, `Lomba: ${lomba?.nama || lombaId}\nQty: ${qty}\nEstimasi: ${fmtRp(harga_estimasi)}`);
}

// Paket hadiah tidak lagi dipilih manual per lomba — otomatis mengikuti kategori peserta lomba.
// Blok ini menampilkan (read-only) rincian item + qty dari paket yang otomatis berlaku untuk lomba ini.
function renderHadiahLombaBlock(lomba){
  const rows = JUARA_LIST.map(j=>{
    const opsi = gHadiahKategori().filter(h=> h.kategori_peserta===lomba.kategori_peserta && h.juara_ke===j.v);
    const isiPaket = opsi.length
      ? opsi.flatMap(h=>h.items.map(item=>`${esc(item.nama)} ${item.qty_per_paket||1} pcs`)).join(', ')
      : `<span class="hint">Belum ada paket</span>`;
    return `<div class="juara-row"><div class="juara-tag">${j.l}</div><div style="flex:1;padding:6px 0;">${isiPaket}</div></div>`;
  }).join('');
  const noStok = gHadiahKategori().filter(h=>h.kategori_peserta===lomba.kategori_peserta).length === 0;
  return `${rows}${noStok?`<div class="hint" style="margin-top:8px;">Belum ada paket hadiah untuk kategori ini. <a style="color:var(--merah);font-weight:600;cursor:pointer;" onclick="goSection('hadiah')">Tambah di sini</a></div>`:''}`;
}

function openLombaModal(id){
  if (!canEditSection('lomba')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.lomba.find(l=>l.id===id) : null;
  setModal(editing?'Edit Lomba':'Tambah Lomba', `<div class="field"><label>Nama Lomba</label><input id="f-nama" value="${editing?esc(editing.nama):''}"></div><div class="field"><label>Kategori Peserta</label><select id="f-kategori">${KATEGORI_PESERTA.map(k=>`<option value="${k.v}" ${editing&&editing.kategori_peserta===k.v?'selected':''}>${k.l}</option>`).join('')}</select></div><div class="field"><label>Jumlah Anggota per Regu</label><input id="f-anggota" type="number" min="1" value="${editing?(editing.jumlah_anggota_regu||1):1}"><div class="hint">Isi 1 jika lomba perorangan. Jika lomba beregu (misal 1 regu = 5 orang), isi 5 — kebutuhan hadiah untuk lomba ini otomatis dikalikan 5.</div></div>`, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const nama=document.getElementById('f-nama').value.trim(); const kategori_peserta=document.getElementById('f-kategori').value; 
      const jumlah_anggota_regu=Math.max(1, Number(document.getElementById('f-anggota').value||1));
      if(!nama){toast('Nama wajib');return;}
      let actionMsg = editing ? `✏️ Edit lomba: ${editing.nama} → ${nama}` : `➕ Lomba baru: ${nama}`;
      if(editing){ 
        editing.nama=nama; editing.kategori_peserta=kategori_peserta; editing.jumlah_anggota_regu=jumlah_anggota_regu; 
      }
      else{ db.lomba.push({id:uid(),event_id:eid(),nama,kategori_peserta,jumlah_anggota_regu}); }
      saveDB();
      // Lomba bertambah/berubah → kebutuhan paket hadiah berubah, sinkronkan stok yang harus dibeli.
      autoSyncHadiahStok(true);
      closeModal(); renderContent(); renderTopbarSaldo(); toast('Disimpan');
      notifyTelegram(actionMsg, `Kategori: ${labelPeserta(kategori_peserta)}\nAnggota/regu: ${jumlah_anggota_regu}`);
    }}
  ]);
}
function hapusLomba(id){ 
  if (!canEditSection('lomba')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus lomba ini?')) return; 
  const l = db.lomba.find(x=>x.id===id);
  db.lombaHadiah=db.lombaHadiah.filter(lh=>lh.lomba_id!==id); 
  db.lombaKebutuhan=db.lombaKebutuhan.filter(k=>k.lomba_id!==id); 
  // Catatan: menghapus lomba TIDAK menurunkan qty_dibeli hadiah secara otomatis —
  // stok yang sudah disiapkan/dibeli tetap ada, bisa dikurangi manual lewat menu Kebutuhan Hadiah kalau perlu.
  db.lomba=db.lomba.filter(l=>l.id!==id); 
  saveDB(); renderContent(); renderTopbarSaldo();
  if(l) notifyTelegram(`🗑️ Hapus lomba: ${l.nama}`, `Kategori: ${labelPeserta(l.kategori_peserta)}`);
}
function openKebutuhanModal(lombaId, kebutuhanId){ 
  if (!canEditSection('lomba')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing=kebutuhanId?db.lombaKebutuhan.find(k=>k.id===kebutuhanId):null; 
  const l = db.lomba.find(x=>x.id===lombaId);
  setModal(editing?'Edit Kebutuhan':'Tambah Kebutuhan', `
    <div class="field"><label>Nama Item</label><input id="f-nama" value="${editing?esc(editing.nama_item):''}"></div>
    <div class="field-row"><div class="field"><label>Harga Estimasi</label><input id="f-est" class="currency-input" type="text" value="${editing?formatCurrency(editing.harga_estimasi):''}"></div>
    <div class="field"><label>Harga Realisasi</label><input id="f-real" class="currency-input" type="text" value="${editing&&editing.harga_realisasi!=null?formatCurrency(editing.harga_realisasi):''}"></div></div>
    <div class="field"><label>Qty</label><input id="f-qty" type="number" min="1" value="${editing?editing.qty:1}"></div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const nama_item=document.getElementById('f-nama').value.trim(); 
      const harga_estimasi=getCurrencyValue(document.getElementById('f-est')); 
      const realVal=document.getElementById('f-real').value; 
      const harga_realisasi=realVal===''?null:getCurrencyValue(document.getElementById('f-real')); 
      const qty=Number(document.getElementById('f-qty').value||1); 
      if(!nama_item||qty<=0){toast('Nama & qty wajib');return;}
      let actionMsg = editing ? `✏️ Edit item kebutuhan: ${editing.nama_item} → ${nama_item}` : `➕ Item kebutuhan baru: ${nama_item}`;
      if(editing){Object.assign(editing,{nama_item,harga_estimasi,harga_realisasi,qty});}
      else{db.lombaKebutuhan.push({id:uid(),lomba_id:lombaId,nama_item,harga_estimasi,harga_realisasi,qty});}
      saveDB(); closeModal(); openLombaIds.add(lombaId); renderContent(); renderTopbarSaldo(); toast('Disimpan');
      const lomba = db.lomba.find(x=>x.id===lombaId);
      notifyTelegram(actionMsg, `Lomba: ${lomba?.nama || lombaId}\nItem: ${nama_item}\nQty: ${qty}\nEstimasi: ${fmtRp(harga_estimasi)}${harga_realisasi ? `\nRealisasi: ${fmtRp(harga_realisasi)}` : ''}`);
    }}
  ]);
  setTimeout(setupAllCurrencyInputs, 50);
}
function hapusKebutuhan(id){ 
  if (!canEditSection('lomba')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus item?')) return; 
  const k=db.lombaKebutuhan.find(x=>x.id===id); 
  db.lombaKebutuhan=db.lombaKebutuhan.filter(x=>x.id!==id); 
  saveDB(); if(k) openLombaIds.add(k.lomba_id); renderContent(); renderTopbarSaldo();
  if(k) notifyTelegram(`🗑️ Hapus item kebutuhan: ${k.nama_item}`, `Lomba: ${db.lomba.find(x=>x.id===k.lomba_id)?.nama || k.lomba_id}`);
}

/* ============================================================
   KEBUTUHAN HADIAH LOMBA (dengan auth check)
   ============================================================ */
function renderHadiah(){
  const list = gHadiahKategori();
  let total = 0;
  list.forEach(h => h.items.forEach(item => total += Number(item.harga_satuan||0) * Number(item.qty_dibeli||0)));
  const isLoggedIn = !!getCurrentUser();
  const semuaLomba = gLomba();

  const groups = KATEGORI_PESERTA.map(kp => {
    const items = list.filter(h => h.kategori_peserta === kp.v);
    if(!items.length) return '';
    const lombaKategoriList = semuaLomba.filter(l => l.kategori_peserta === kp.v);
    const jumlahLomba = lombaKategoriList.length;
    const totalKebutuhanPaket = lombaKategoriList.reduce((s,l)=>s+Math.max(1,Number(l.jumlah_anggota_regu||1)),0);
    const adaBeregu = lombaKategoriList.some(l => Number(l.jumlah_anggota_regu||1) > 1);
    const groupHtml = items.map(h => {
      const isPartisipasi = h.juara_ke === 'partisipasi';
      const kebutuhan = isPartisipasi ? null : totalKebutuhanPaket;
      const kurangItems = kebutuhan!=null ? h.items.filter(item => Number(item.qty_dibeli||0) < hitungTargetQtyItem(item, kebutuhan)) : [];
      const totalItem = h.items.reduce((s, item) => s + (Number(item.harga_satuan||0) * Number(item.qty_dibeli||0)), 0);
      // Harga SATU paket saja (isi paket × qty/paket) — dipakai untuk dibandingkan
      // dengan budget, karena budget diatur per paket/per pemenang, bukan akumulasi
      // seluruh lomba di kategori ini (yang jumlahnya beda-beda tiap kategori).
      const totalPerPaket = h.items.reduce((s, item) => s + (Number(item.harga_satuan||0) * Math.max(1,Number(item.qty_per_paket||1))), 0);
      const namaLombaTitle = esc(lombaKategoriList.map(l => Number(l.jumlah_anggota_regu||1)>1 ? `${l.nama} (beregu ×${l.jumlah_anggota_regu})` : l.nama).join(', '));
      const rincianLomba = adaBeregu ? ` = ${lombaKategoriList.map(l=>Number(l.jumlah_anggota_regu||1)).join('+')}` : '';
      const kebutuhanBadge = kebutuhan!=null
        ? (kurangItems.length
            ? `<span class="lomba-badge warn" style="margin-left:8px;" title="${namaLombaTitle}">⚠️ Kurang, butuh ${kebutuhan} pcs (dari ${jumlahLomba} lomba${rincianLomba})</span>`
            : `<span class="lomba-badge" style="margin-left:8px;" title="${namaLombaTitle}">✓ Kebutuhan untuk ${jumlahLomba} lomba terpenuhi</span>`)
        : '';
      const budget = getHadiahBudget(kp.v, h.juara_ke);
      let budgetBadge = '';
      if(budget > 0){
        const selisih = budget - totalPerPaket;
        budgetBadge = selisih < 0
          ? `<span class="lomba-badge warn" style="margin-left:8px;" title="Harga 1 paket: ${fmtRp(totalPerPaket)}">💸 Lebih ${fmtRp(Math.abs(selisih))} dari budget ${fmtRp(budget)}</span>`
          : `<span class="lomba-badge" style="margin-left:8px;" title="Harga 1 paket: ${fmtRp(totalPerPaket)}">🎯 Budget ${fmtRp(budget)} · Sisa ${fmtRp(selisih)}</span>`;
      }
      return `<div class="hadiah-group"><div class="hadiah-group-header" onclick="toggleHadiahGroup('${h.id}')"><div><span class="title">🏆 ${labelJuara(h.juara_ke)}</span><span style="font-size:12px;color:var(--ink-soft);margin-left:8px;">${h.items.length} item</span>${kebutuhanBadge}${budgetBadge}</div><div style="display:flex;align-items:center;gap:4px;"><span class="total">${fmtRp(totalItem)}</span>${isLoggedIn ? `<button class="icon-btn" onclick="event.stopPropagation();openHadiahModal('${h.id}')" title="Edit paket">✎</button><button class="icon-btn" onclick="event.stopPropagation();hapusHadiah('${h.id}')" title="Hapus paket">🗑</button>` : ''}</div></div>
        <div class="hadiah-group-body" id="hadiah-group-${h.id}" style="display:${openHadiahGroups.has(h.id)?'block':'none'};">
          ${kurangItems.length ? `<div class="hint" style="margin-bottom:10px;">Sebagian item belum sesuai kebutuhan (${jumlahLomba} lomba kategori ${labelPeserta(kp.v)}${adaBeregu?', termasuk lomba beregu':''} × qty/paket masing-masing item). Qty akan otomatis naik sendiri saat lomba berikutnya ditambahkan, atau edit manual di bawah.</div>` : ''}
          ${h.items.map((item, idx) => { const perPaket=Math.max(1,Number(item.qty_per_paket||1)); const target = hitungTargetQtyItem(item, kebutuhan); const kurang = target!=null && Number(item.qty_dibeli||0) < target; return `<div class="hadiah-item-row"><span class="item-name">${esc(item.nama)}${perPaket>1?` <span style="color:var(--ink-soft);font-size:11px;">${perPaket} buah per paket</span>`:''}${kurang?` <span style="color:var(--orange);font-size:11px;">(butuh ${target})</span>`:''}</span><span class="item-qty">Dibeli: ${item.qty_dibeli}</span><span class="item-price">${fmtRp(item.harga_satuan)} × ${item.qty_dibeli}</span>
            <button class="icon-btn" onclick="editHadiahItem('${h.id}',${idx})" ${!isLoggedIn ? 'disabled' : ''}>✎</button>
            <button class="icon-btn" onclick="hapusHadiahItem('${h.id}',${idx})" ${!isLoggedIn ? 'disabled' : ''}>🗑</button>
          </div>`;}).join('')}
          ${isLoggedIn ? `<div class="add-item-row"><input type="text" id="add-item-name-${h.id}" placeholder="Nama hadiah" style="flex:2;" onblur="autofillHargaHadiah(this)"><input type="text" id="add-item-price-${h.id}" class="currency-input" placeholder="Harga" style="flex:1;"><input type="number" id="add-item-perpaket-${h.id}" placeholder="Qty/paket" value="1" min="1" style="flex:0.7;" title="Berapa pcs item ini per 1 paket juara"><button class="btn secondary small" onclick="tambahItemHadiah('${h.id}', ${kebutuhan!=null?kebutuhan:'null'})">+ Tambah</button></div>` : `<div class="hint" style="padding:8px 0;">🔒 Login untuk menambah item</div>`}
        </div></div>`;
    }).join('');
    const kebutuhanInfo = jumlahLomba > 0 ? `<span style="font-size:11.5px;color:var(--ink-soft);font-weight:500;text-transform:none;letter-spacing:0;margin-left:8px;">(${jumlahLomba} lomba${adaBeregu?` · butuh ${totalKebutuhanPaket} pcs karena ada beregu`:''})</span>` : '';
    const daftarLombaInfo = lombaKategoriList.length ? `<div class="lomba-mini-list">${lombaKategoriList.map((l,i)=>{const anggota=Number(l.jumlah_anggota_regu||1); return `<span class="lomba-mini-chip">${anggota>1?`<span class="num beregu">${anggota}×</span>`:`<span class="num">${i+1}</span>`}${esc(l.nama)}${anggota>1?` <span class="beregu-tag">beregu</span>`:''}</span>`;}).join('')}</div>` : '';
    return `<div class="subgroup-title">${kp.l}${kebutuhanInfo}</div>${daftarLombaInfo}${groupHtml}`;
  }).join('');

  // Total budget SEHARUSNYA untuk seluruh event = budget per paket × jumlah paket yang
  // dibutuhkan di kategori itu (mengikuti jumlah lomba, sama seperti kebutuhan stok).
  // Untuk juara "partisipasi" (tidak ada target otomatis) budget dihitung apa adanya (×1),
  // supaya tidak dibandingkan dengan kesalahan skala seperti sebelumnya.
  const totalBudget = KATEGORI_PESERTA.reduce((s,kp)=>s+JUARA_LIST.reduce((s2,j)=>{
    const budgetPerPaket = getHadiahBudget(kp.v, j.v);
    if(budgetPerPaket<=0) return s2;
    const keb = hitungKebutuhanHadiah(kp.v, j.v);
    return s2 + budgetPerPaket * (keb!=null ? keb : 1);
  },0),0);

  return `<div class="stat-grid">
    <div class="stat-card pengeluaran"><div class="lbl">Total Belanja Hadiah</div><div class="val">${fmtRp(total)}</div></div>
    ${totalBudget>0 ? `<div class="stat-card ${total>totalBudget?'defisit':'saldo'}"><div class="lbl">Total Budget Hadiah</div><div class="val">${fmtRp(totalBudget)}</div><div style="font-size:11px; color:var(--abu); margin-top:4px;">${total>totalBudget?`⚠️ Sudah lebih ${fmtRp(total-totalBudget)}`:`Sisa ${fmtRp(totalBudget-total)}`}</div></div>` : ''}
  </div>
  <div class="panel"><div class="panel-head"><div><h3>Kebutuhan Hadiah Lomba</h3><div class="desc">Setiap paket bisa berisi multiple item · Kebutuhan Juara 1-3 mengikuti jumlah lomba per kategori</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${isLoggedIn ? `<button class="btn secondary" onclick="openHadiahBudgetModal()">🎯 Atur Budget</button>` : ''}
      ${isLoggedIn ? `<button class="btn secondary" onclick="sesuaikanSemuaKebutuhanHadiah()">⚡ Sesuaikan Semua Otomatis</button>` : ''}
      ${isLoggedIn ? `<button class="btn" onclick="openHadiahModal()">+ Tambah Paket</button>` : ''}
    </div></div>
  <div class="panel-body">${groups.trim()||`<div style="padding:30px;text-align:center;color:var(--abu);">Belum ada kebutuhan hadiah.</div>`}</div></div>`;
}

// Kebutuhan paket hadiah Juara 1/2/3 = jumlah lomba pada kategori peserta tsb, dikalikan jumlah anggota regu tiap lomba
// (lomba perorangan = x1, lomba beregu = x jumlah anggota regu). Partisipasi tidak dihitung otomatis.
function hitungKebutuhanHadiah(kategoriPeserta, juaraKe){
  if(juaraKe === 'partisipasi') return null;
  return gLomba().filter(l => l.kategori_peserta === kategoriPeserta).reduce((s,l)=> s + Math.max(1, Number(l.jumlah_anggota_regu||1)), 0);
}
// Target qty tiap item = kebutuhan (jumlah paket/lomba) dikalikan qty_per_paket item tsb
// (mis. pulpen 2/paket pada kategori yg butuh 3 paket => target 6, bukan 3)
function hitungTargetQtyItem(item, kebutuhan){
  if(kebutuhan==null) return null;
  return kebutuhan * Math.max(1, Number(item.qty_per_paket||1));
}
// Sinkronisasi otomatis: qty_dibeli tiap item paket hadiah (non-partisipasi) dinaikkan
// mengikuti kebutuhan (jumlah lomba x qty_per_paket) SETIAP KALI lomba atau paket berubah.
// Tidak pernah menurunkan otomatis, supaya buffer/qty manual yang sudah diisi user tidak hilang.
function autoSyncHadiahStok(silent){
  let totalDiubah = 0; const detail = [];
  gHadiahKategori().forEach(h => {
    const kebutuhan = hitungKebutuhanHadiah(h.kategori_peserta, h.juara_ke);
    if(kebutuhan==null) return; // partisipasi: tetap manual
    let diubah = 0; const detailItem = [];
    h.items.forEach(item => { const target = hitungTargetQtyItem(item, kebutuhan); if(Number(item.qty_dibeli||0) < target){ item.qty_dibeli = target; diubah++; detailItem.push(`${item.nama}→${target}`); } });
    if(diubah>0){ totalDiubah += diubah; detail.push(`${labelPeserta(h.kategori_peserta)} - ${labelJuara(h.juara_ke)}: ${detailItem.join(', ')}`); }
  });
  if(totalDiubah>0){
    saveDB();
    if(!silent) toast(`⚡ Stok hadiah disinkronkan (${totalDiubah} item)`);
    notifyTelegram(`⚡ Stok hadiah auto-sync`, detail.join('\n'));
  }
  return totalDiubah;
}
// Tombol manual "Sinkronkan Ulang" — jaring pengaman kalau ada data lama/impor yang belum sinkron.
// Pada alur normal ini jarang diperlukan karena autoSyncHadiahStok() otomatis jalan
// setiap kali lomba ditambah/diedit.
function sesuaikanSemuaKebutuhanHadiah(){
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const totalDiubah = autoSyncHadiahStok(true);
  if(totalDiubah===0){ toast('Semua qty sudah sesuai kebutuhan'); return; }
  renderContent(); renderTopbarSaldo();
  toast(`⚡ ${totalDiubah} item disesuaikan`);
}

let openHadiahGroups = new Set();
function toggleHadiahGroup(id){ const el=document.getElementById(`hadiah-group-${id}`); if(!el) return; if(openHadiahGroups.has(id)){ openHadiahGroups.delete(id); el.style.display='none'; }else{ openHadiahGroups.add(id); el.style.display='block'; } }
function labelJuara(v){ return (JUARA_LIST.find(j=>j.v===v)||{}).l || v; }

// Form pengaturan budget hadiah per Kategori Peserta (Anak/Ibu/dst) x Juara (1/2/3/Partisipasi).
// Contoh: Lomba Anak - Juara 1 budget 100rb, Juara 2 budget 75rb, Juara 3 budget 50rb, dst.
function openHadiahBudgetModal(){
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const s = getSettings();
  const bodyHtml = KATEGORI_PESERTA.map(kp => {
    const budgetKp = s.hadiahBudget[kp.v] || {};
    const inputs = JUARA_LIST.map(j => `
      <div class="field">
        <label>${j.l}</label>
        <input type="text" id="budget-${kp.v}-${j.v}" class="currency-input" placeholder="Rp 0" value="${formatCurrency(budgetKp[j.v]||0)}">
      </div>`).join('');
    return `<div style="margin-bottom:14px;padding:14px 16px;border-radius:10px;background:var(--cream);border:1px solid var(--garis);">
      <div style="font-weight:700;margin-bottom:10px;">${kp.l}</div>
      <div class="field-row" style="grid-template-columns:1fr 1fr;">${inputs}</div>
    </div>`;
  }).join('');
  setModal('Atur Budget Hadiah per Kategori', `
    <div class="hint" style="margin-bottom:12px;">Tentukan target budget hadiah untuk setiap kombinasi Kategori Peserta &amp; Juara. Contoh: Lomba Anak - Juara 1 Rp100.000, Juara 2 Rp75.000, Juara 3 Rp50.000, dst. Angka ini dipakai sebagai acuan (bukan pengurang saldo) dan dibandingkan dengan total belanja hadiah aktual per paket.</div>
    <div style="max-height:60vh;overflow-y:auto;padding-right:4px;">${bodyHtml}</div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:'Simpan Budget', cls:'', onclick:()=>simpanHadiahBudget()}
  ]);
  setTimeout(setupAllCurrencyInputs, 50);
}

function simpanHadiahBudget(){
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const s = getSettings();
  const newBudget = {};
  const detailLines = [];
  KATEGORI_PESERTA.forEach(kp => {
    newBudget[kp.v] = {};
    JUARA_LIST.forEach(j => {
      const el = document.getElementById(`budget-${kp.v}-${j.v}`);
      const val = el ? getCurrencyValue(el) : 0;
      newBudget[kp.v][j.v] = val;
      if(val > 0) detailLines.push(`${kp.l} - ${labelJuara(j.v)}: ${fmtRp(val)}`);
    });
  });
  s.hadiahBudget = newBudget;
  saveDB(); closeModal(); renderContent();
  toast('💾 Budget hadiah disimpan');
  notifyTelegram(`🎯 Update budget hadiah per kategori`, detailLines.length ? detailLines.join('\n') : 'Semua budget diset Rp0');
}

function openHadiahModal(id){
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.hadiahKategori.find(h=>h.id===id) : null;
  const itemsHtml = editing ? editing.items.map((item, idx) => `<div class="item-fields-row" style="border-bottom:1px solid var(--garis);padding-bottom:10px;margin-bottom:10px;"><div class="field"><label>Nama</label><input type="text" id="edit-item-name-${idx}" value="${esc(item.nama)}" placeholder="Nama hadiah" onblur="autofillHargaHadiah(this)"></div><div class="field"><label>Harga</label><input type="text" id="edit-item-price-${idx}" class="currency-input" value="${formatCurrency(item.harga_satuan)}" placeholder="Harga"></div><div class="field"><label>Qty/paket</label><input type="number" id="edit-item-perpaket-${idx}" value="${item.qty_per_paket||1}" min="1" placeholder="Qty/paket" title="Berapa pcs per 1 paket juara"></div><button class="btn danger-text small" onclick="removeItemRow(${idx})">✕</button></div>`).join('') : '';
  setModal(editing?'Edit Paket':'Tambah Paket', `<div class="field-row"><div class="field"><label>Kategori</label><select id="f-kp">${KATEGORI_PESERTA.map(k=>`<option value="${k.v}" ${editing&&editing.kategori_peserta===k.v?'selected':''}>${k.l}</option>`).join('')}</select></div><div class="field"><label>Juara</label><select id="f-juara">${JUARA_LIST.map(j=>`<option value="${j.v}" ${editing&&editing.juara_ke===j.v?'selected':''}>${j.l}</option>`).join('')}</select></div></div><div class="field"><label>Item Hadiah</label><div class="hint" style="margin-bottom:10px;">Isi "Qty/paket" saja (mis. 2 pulpen per paket). Paket ini otomatis berlaku untuk SEMUA lomba dengan kategori & juara yang sama. Total qty yang harus dibeli otomatis dihitung dari jumlah lomba sekarang, dan otomatis naik lagi kalau kamu menambah lomba baru di kategori ini.</div><div id="items-container">${itemsHtml}</div><button class="btn secondary small" onclick="addItemRow()" type="button">+ Tambah Item</button></div>`, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const kategori_peserta=document.getElementById('f-kp').value; const juara_ke=document.getElementById('f-juara').value;
      if(!editing && gHadiahKategori().some(h=>h.kategori_peserta===kategori_peserta && h.juara_ke===juara_ke)){
        if(!confirm(`Paket untuk ${labelPeserta(kategori_peserta)} - ${labelJuara(juara_ke)} sudah ada. Satu kategori+juara idealnya cukup 1 paket (isinya bisa lebih dari 1 item). Tetap buat paket baru (terpisah)?`)) return;
      }
      const kebutuhan=hitungKebutuhanHadiah(kategori_peserta, juara_ke); const existingItems=editing?(editing.items||[]):[]; const items=[]; const container=document.getElementById('items-container'); const rows=container.querySelectorAll('.item-fields-row'); rows.forEach((row,idx)=>{const nameInput=row.querySelector(`input[id^="edit-item-name-"]`); const priceInput=row.querySelector(`input[id^="edit-item-price-"]`); const perPaketInput=row.querySelector(`input[id^="edit-item-perpaket-"]`); if(nameInput&&priceInput){const nama=nameInput.value.trim(); const harga_satuan=getCurrencyValue(priceInput); const qty_per_paket=Math.max(1,Number((perPaketInput&&perPaketInput.value)||1)); if(!nama) return; const qty_dibeli = idx<existingItems.length ? Number(existingItems[idx].qty_dibeli||0) : (kebutuhan!=null ? kebutuhan*qty_per_paket : qty_per_paket); items.push({nama,harga_satuan,qty_dibeli,qty_per_paket});}}); if(items.length===0){toast('Minimal 1 item');return;}
      let actionMsg = editing ? `✏️ Edit paket hadiah ${labelPeserta(kategori_peserta)} - ${labelJuara(juara_ke)}` : `➕ Paket hadiah baru ${labelPeserta(kategori_peserta)} - ${labelJuara(juara_ke)}`;
      if(editing){ items.forEach((newItem,idx)=>{if(idx<existingItems.length) newItem.qty_terpakai=existingItems[idx].qty_terpakai||0;}); Object.assign(editing,{kategori_peserta,juara_ke,items});}
      else{ db.hadiahKategori.push({id:uid(),event_id:eid(),kategori_peserta,juara_ke,items}); }
      const currentHadiahId = editing ? editing.id : db.hadiahKategori[db.hadiahKategori.length-1].id;
      openHadiahGroups.add(currentHadiahId);
      let totalSama = 0;
      items.forEach((it,idx)=>{ totalSama += samakanHargaItemSejenis(it.nama, it.harga_satuan, currentHadiahId, idx); });
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast(totalSama>0?`Disimpan, harga disamakan ke ${totalSama} item lain`:'Disimpan');
      const detail = items.map(i => `${i.nama} (${i.qty_dibeli} × ${fmtRp(i.harga_satuan)})`).join('\n');
      notifyTelegram(actionMsg, detail);
    }}
  ]);
  if(editing) openHadiahGroups.add(id);
  setTimeout(setupAllCurrencyInputs, 50);
}
function addItemRow(){ const container=document.getElementById('items-container'); if(!container) return; const idx=Math.floor(Math.random()*10000); const row=document.createElement('div'); row.className='item-fields-row'; row.style.cssText='border-bottom:1px solid var(--garis);padding-bottom:10px;margin-bottom:10px;'; row.innerHTML=`<div class="field"><label>Nama</label><input type="text" id="edit-item-name-${idx}" placeholder="Nama hadiah" onblur="autofillHargaHadiah(this)"></div><div class="field"><label>Harga</label><input type="text" id="edit-item-price-${idx}" class="currency-input" placeholder="Harga"></div><div class="field"><label>Qty/paket</label><input type="number" id="edit-item-perpaket-${idx}" placeholder="Qty/paket" value="1" min="1" title="Berapa pcs per 1 paket juara"></div><button class="btn danger-text small" onclick="removeItemRow(this.closest('.item-fields-row'))">✕</button>`; container.appendChild(row);
  // Hanya setup input currency milik baris BARU ini — jangan panggil setupAllCurrencyInputs()
  // karena itu akan menempelkan listener kedua/ketiga/dst ke input yang sudah ada sebelumnya
  // (setiap listener dibuat sebagai fungsi anonim baru sehingga browser tidak men-dedupe-nya).
  row.querySelectorAll('.currency-input').forEach(setupCurrencyInput);
}
function removeItemRow(element){ if(typeof element==='number'){const rows=document.querySelectorAll('#items-container .item-fields-row'); if(rows.length>1) rows[element].remove(); else toast('Minimal 1 item'); return;} const rows=document.querySelectorAll('#items-container .item-fields-row'); if(rows.length>1) element.remove(); else toast('Minimal 1 item'); }
// Menyamakan harga_satuan semua item hadiah (lintas semua paket kategori+juara,
// dalam event yang sama) yang namanya SAMA (dibandingkan tanpa peduli besar/kecil
// huruf & spasi berlebih) dengan harga yang baru saja diisi/diedit user di satu
// tempat. Jadi cukup ketik harga sekali, item dengan nama sama di paket lain ikut
// terisi otomatis. excludeHadiahId+excludeIdx dipakai supaya item yang baru saja
// diedit manual tidak dihitung ulang sebagai "item lain yang ikut disamakan".
function samakanHargaItemSejenis(nama, harga, excludeHadiahId, excludeIdx){
  const key = String(nama||'').trim().toLowerCase();
  if(!key || !(Number(harga) > 0)) return 0;
  let count = 0;
  gHadiahKategori().forEach(h=>{
    (h.items||[]).forEach((it, idx)=>{
      if(h.id===excludeHadiahId && idx===excludeIdx) return;
      if(String(it.nama||'').trim().toLowerCase()===key && Number(it.harga_satuan||0)!==Number(harga)){
        it.harga_satuan = Number(harga)||0;
        count++;
      }
    });
  });
  return count;
}
// Cari harga yang sudah pernah diisi untuk item dengan nama yang sama (di paket
// manapun, event yang sama). Dipakai untuk auto-isi field harga saat nama diketik.
function cariHargaItemSejenis(nama){
  const key = String(nama||'').trim().toLowerCase();
  if(!key) return null;
  for(const h of gHadiahKategori()){
    for(const it of (h.items||[])){
      if(String(it.nama||'').trim().toLowerCase()===key && Number(it.harga_satuan||0)>0){
        return Number(it.harga_satuan);
      }
    }
  }
  return null;
}
// Dipanggil saat input nama item hadiah kehilangan fokus (onblur). Kalau nama yang
// diketik sudah pernah dipakai di paket lain dengan harga tertentu, dan field harga
// di baris ini masih kosong, otomatis isi harga itu — supaya tidak perlu ketik ulang.
function autofillHargaHadiah(nameInput){
  if(!nameInput) return;
  const priceInput = document.getElementById(nameInput.id.replace('name','price'));
  if(!priceInput || getCurrencyValue(priceInput) > 0) return;
  const harga = cariHargaItemSejenis(nameInput.value);
  if(harga!=null) setCurrencyValue(priceInput, harga);
}
function editHadiahItem(hadiahId,itemIdx){ 
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const h=db.hadiahKategori.find(x=>x.id===hadiahId); if(!h||!h.items[itemIdx]) return; const item=h.items[itemIdx]; const newNama=prompt('Nama:',item.nama); if(newNama===null) return; const newHarga=prompt('Harga:',item.harga_satuan); if(newHarga===null) return; const newPerPaket=prompt('Qty per paket (dasar hitung kebutuhan otomatis):',item.qty_per_paket||1); if(newPerPaket===null) return; const newQty=prompt('Qty total (dibeli) — boleh diisi lebih untuk cadangan:',item.qty_dibeli); if(newQty===null) return; if(!newNama.trim()||Number(newQty)<0){toast('Nama & qty wajib');return;} item.nama=newNama.trim(); item.harga_satuan=Number(newHarga)||0; item.qty_per_paket=Math.max(1,Number(newPerPaket)||1); item.qty_dibeli=Number(newQty)||0;
  const samaCount = samakanHargaItemSejenis(item.nama, item.harga_satuan, hadiahId, itemIdx);
  saveDB(); renderContent(); toast(samaCount>0?`Diupdate, harga disamakan ke ${samaCount} item "${item.nama}" lainnya`:'Diupdate'); 
  notifyTelegram(`✏️ Edit item hadiah: ${item.nama}`, `Paket: ${labelPeserta(h.kategori_peserta)} - ${labelJuara(h.juara_ke)}\nHarga: ${fmtRp(item.harga_satuan)}\nQty: ${item.qty_dibeli}${item.qty_per_paket>1?` (${item.qty_per_paket} buah per paket)`:''}`);
}
function hapusHadiahItem(hadiahId,itemIdx){ 
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const h=db.hadiahKategori.find(x=>x.id===hadiahId); if(!h||!h.items[itemIdx]) return; const itemName = h.items[itemIdx].nama; if(!confirm(`Hapus "${itemName}"?`)) return; h.items.splice(itemIdx,1); if(h.items.length===0) db.hadiahKategori=db.hadiahKategori.filter(x=>x.id!==hadiahId); saveDB(); renderContent(); toast('Dihapus'); 
  notifyTelegram(`🗑️ Hapus item hadiah: ${itemName}`, `Paket: ${labelPeserta(h.kategori_peserta)} - ${labelJuara(h.juara_ke)}`);
}
function tambahItemHadiah(hadiahId, kebutuhan){ 
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const h=db.hadiahKategori.find(x=>x.id===hadiahId); if(!h) return; const nama=document.getElementById(`add-item-name-${hadiahId}`).value.trim(); const harga=getCurrencyValue(document.getElementById(`add-item-price-${hadiahId}`)); const perPaketEl=document.getElementById(`add-item-perpaket-${hadiahId}`); const qtyPerPaket=Math.max(1,Number((perPaketEl&&perPaketEl.value)||1)); if(!nama){toast('Nama wajib diisi');return;} const qty = (kebutuhan!=null&&kebutuhan!=='null') ? Number(kebutuhan)*qtyPerPaket : qtyPerPaket; h.items.push({nama,harga_satuan:harga,qty_dibeli:qty,qty_per_paket:qtyPerPaket});
  const samaCount = samakanHargaItemSejenis(nama, harga, h.id, h.items.length-1);
  document.getElementById(`add-item-name-${hadiahId}`).value=''; document.getElementById(`add-item-price-${hadiahId}`).value=''; if(perPaketEl) perPaketEl.value='1'; saveDB(); renderContent(); toast(samaCount>0?`Item ditambahkan, harga disamakan ke ${samaCount} item "${nama}" lainnya`:'Item ditambahkan'); 
  notifyTelegram(`➕ Item hadiah baru: ${nama}`, `Paket: ${labelPeserta(h.kategori_peserta)} - ${labelJuara(h.juara_ke)}\nHarga: ${fmtRp(harga)}\nQty: ${qty}${qtyPerPaket>1?` (${qtyPerPaket} buah per paket)`:''}`);
}
function hapusHadiah(id){ 
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const h=db.hadiahKategori.find(x=>x.id===id); if(!h) return; if(!confirm('Hapus paket?')) return; db.hadiahKategori=db.hadiahKategori.filter(x=>x.id!==id); saveDB(); renderContent(); renderTopbarSaldo(); 
  notifyTelegram(`🗑️ Hapus paket hadiah`, `Kategori: ${labelPeserta(h.kategori_peserta)}\nJuara: ${labelJuara(h.juara_ke)}`);
}

/* ============================================================
   KATEGORI TOKO — pengelompokan otomatis daftar belanja hadiah
   berdasarkan nama item, supaya barang sejenis (alat tulis,
   kebutuhan dapur, makanan, kamar mandi) tidak campur dan bisa
   dibeli sekaligus di satu toko.
   ============================================================ */
const KATEGORI_TOKO_LIST = [
  {key:'alat_tulis', label:'Alat Tulis', icon:'pen'},
  {key:'dapur', label:'Kebutuhan Dapur', icon:'pot'},
  {key:'makanan', label:'Makanan & Jajanan', icon:'food'},
  {key:'kamar_mandi', label:'Kamar Mandi', icon:'bath'},
  {key:'lainnya', label:'Lainnya', icon:'tag'}
];
const KATEGORI_TOKO_KEYWORDS = {
  alat_tulis: ['pulpen','bolpoin','bolpen','pena','pensil','penghapus','penggaris','buku tulis','buku gambar','buku','spidol','crayon','krayon','lem','gunting','kertas hvs','kertas lipat','kertas origami','kertas manila','kertas warna','kertas buffalo','kertas asturo','kertas concord','map plastik',' map','stabilo','tipe-x','tipe x','tip-x','tip x','tipex','rautan','sampul','isolasi','selotip','staples','klip','tinta','stiker','origami','karton','pewarna','cat air','sketchbook'],
  dapur: ['piring','gelas','mangkok','mangkuk','panci','wajan','sendok','garpu','pisau dapur','pisau','termos','toples','ember','gayung','baskom','rantang','teflon','talenan','serbet','kompor','tupperware','kotak makan','nampan','cobek','teko','dispenser','centong','saringan'],
  makanan: ['snack','snek','biskuit','wafer','coklat','cokelat','permen','minyak goreng','minyak','gula pasir','gula','kopi','teh','susu','indomie','mie instan','mie','sarden','kecap','saus','roti','sirup','minuman','air mineral','aqua','beras','telur','kornet','sosis','keju','selai','madu','kacang','kerupuk','chiki','marimas','agar-agar','agar','jelly','jeli','jajan','oreo','tango','richeese','chitato','taro','better','gery','roma','pop mie'],
  kamar_mandi: ['sabun','shampo','sampo','sikat gigi','sikat','odol','pasta gigi','handuk','tissue','tisu','pewangi','pembersih lantai','pembersih','deterjen','detergen','pembalut','cotton bud','parfum','minyak wangi','sunlight','rinso','molto','downy','pengharum','kapas','sandal']
};
function kategoriTokoFromNama(nama){
  const n = ' ' + (nama||'').toLowerCase().trim() + ' ';
  for(const kat of ['alat_tulis','dapur','makanan','kamar_mandi']){
    if(KATEGORI_TOKO_KEYWORDS[kat].some(kw => n.includes(kw))) return kat;
  }
  return 'lainnya';
}
function infoKategoriToko(key){ return KATEGORI_TOKO_LIST.find(k=>k.key===key) || KATEGORI_TOKO_LIST[KATEGORI_TOKO_LIST.length-1]; }

/* ============================================================
   BELANJA HADIAH, BELANJA PERLENGKAPAN, BELANJA JALAN (dengan auth check)
   ============================================================ */
function renderBelanjaHadiah(){
  const semuaHadiah = gHadiahKategori();
  const daftar = gDaftarBelanjaHadiah();
  const statusMap = {};
  daftar.forEach(b => { const key = `${b.hadiah_kategori_id}_${b.item_index}`; statusMap[key] = b; });

  const items = [];
  semuaHadiah.forEach(h => {
    h.items.forEach((item, idx) => {
      if (Number(item.qty_dibeli||0) <= 0) return;
      const key = `${h.id}_${idx}`;
      const belanja = statusMap[key] || null;
      const status = belanja ? belanja.status : 'belum_dibeli';
      const tanggalBeli = belanja ? belanja.tanggal_beli : null;
      items.push({...h, itemIndex: idx, itemNama: item.nama, itemHarga: item.harga_satuan, itemQtyDibeli: item.qty_dibeli, isi_per_pack: item.isi_per_pack||1, status, tanggalBeli, sudahDibeli: status==='dibeli', key});
    });
  });

  items.sort((a,b) => {
    if(a.sudahDibeli !== b.sudahDibeli) return a.sudahDibeli ? 1 : -1;
    if(a.kategori_peserta !== b.kategori_peserta) return a.kategori_peserta.localeCompare(b.kategori_peserta);
    return a.juara_ke.localeCompare(b.juara_ke);
  });

  const totalItem = items.length;
  const totalBelum = items.filter(i=>!i.sudahDibeli).length;
  const totalEstimasi = items.reduce((s,i)=>s+(Number(i.itemHarga||0)*Number(i.itemQtyDibeli||0)),0);
  const totalBelumEstimasi = items.filter(i=>!i.sudahDibeli).reduce((s,i)=>s+(Number(i.itemHarga||0)*Number(i.itemQtyDibeli||0)),0);
  const isLoggedIn = !!getCurrentUser();

  if(!items.length) return `<div class="panel"><div class="panel-head"><h3>🎁 Belanja Hadiah</h3></div><div class="panel-body"><div class="empty-state"><h3>Belum ada hadiah</h3><button class="btn" onclick="goSection('hadiah')">+ Tambah Hadiah</button></div></div></div>`;

  // Kelompokkan per NAMA barang (gabungan lintas kategori peserta & juara) menjadi SATU checklist
  const nameMap = {};
  items.forEach(item => {
    const key = item.itemNama.trim().toLowerCase();
    if(!nameMap[key]) nameMap[key] = {nama: item.itemNama, list: []};
    nameMap[key].list.push(item);
  });

  // Lalu kelompokkan per KATEGORI TOKO (alat tulis / dapur / makanan / kamar mandi / lainnya)
  // supaya barang sejenis tidak campur dan bisa dibeli sekaligus di satu toko.
  const kategoriOrder = KATEGORI_TOKO_LIST.map(k=>k.key);
  const nameGroups = Object.values(nameMap).map(g => ({...g, kategoriToko: kategoriTokoFromNama(g.nama)})).sort((a,b) => {
    const ordA = kategoriOrder.indexOf(a.kategoriToko), ordB = kategoriOrder.indexOf(b.kategoriToko);
    if(ordA !== ordB) return ordA - ordB;
    const aBelum = a.list.some(i=>!i.sudahDibeli), bBelum = b.list.some(i=>!i.sudahDibeli);
    if(aBelum !== bBelum) return aBelum ? -1 : 1;
    return a.nama.localeCompare(b.nama);
  });

  window._belanjaHadiahGroups = {};
  let lastKategoriToko = null;
  const groups = nameGroups.map((g, gi) => {
    const list = g.list.slice().sort((a,b) => {
      if(a.kategori_peserta !== b.kategori_peserta) return a.kategori_peserta.localeCompare(b.kategori_peserta);
      return a.juara_ke.localeCompare(b.juara_ke);
    });
    window._belanjaHadiahGroups[gi] = {nama: g.nama, refs: list.map(i=>({hadiahId:i.id, itemIndex:i.itemIndex}))};

    const totalQty = list.reduce((s,i)=>s+Number(i.itemQtyDibeli||0),0);
    const totalHarga = list.reduce((s,i)=>s+(Number(i.itemHarga||0)*Number(i.itemQtyDibeli||0)),0);
    const semuaDibeli = list.every(i=>i.sudahDibeli);
    const belum = list.filter(i=>!i.sudahDibeli);
    const tglTerbaru = list.filter(i=>i.tanggalBeli).map(i=>i.tanggalBeli).sort().pop();
    const isiPerPack = Math.max(1, Number(list[0].isi_per_pack||1));
    const jumlahPack = isiPerPack > 1 ? Math.ceil(totalQty / isiPerPack) : null;

    const tagHtml = list.map(item => `<span class="tag">${labelPeserta(item.kategori_peserta)} · ${labelJuara(item.juara_ke)} · ${item.itemQtyDibeli} pcs</span>`).join('');
    const packTagHtml = jumlahPack ? `<span class="tag pack-tag">📦 Beli ${jumlahPack} pack (isi ${isiPerPack} → ${jumlahPack*isiPerPack} pcs)</span>` : '';

    // Header kategori toko, muncul setiap kali kategori berganti
    let headerHtml = '';
    if(g.kategoriToko !== lastKategoriToko){
      lastKategoriToko = g.kategoriToko;
      const info = infoKategoriToko(g.kategoriToko);
      const groupItemCount = nameGroups.filter(x=>x.kategoriToko===g.kategoriToko).length;
      headerHtml = `<div class="kategori-toko-header"><div class="kategori-toko-icon">${icon(info.icon)}</div><div class="kategori-toko-label">${esc(info.label)}</div><div class="kategori-toko-count">${groupItemCount} item</div></div>`;
    }

    return `${headerHtml}<div class="belanja-item ${semuaDibeli?'dibeli':''}">
      <div class="checkbox-wrapper ${semuaDibeli?'checked':''} ${!isLoggedIn ? 'disabled' : ''}" onclick="${isLoggedIn ? `toggleBelanjaHadiahGroup(${gi})` : 'toast(\'⛔ Login untuk mengedit\')'}"></div>
      <div class="info">
        <div class="nama">${esc(g.nama)} <span style="font-weight:600; color:var(--ink-soft); font-size:12px;">(Total: ${totalQty} pcs)</span></div>
        <div class="detail">${packTagHtml}${tagHtml}${semuaDibeli&&tglTerbaru?`<span>✓ Dibeli: ${fmtDate(tglTerbaru)}</span>`:(belum.length && belum.length<list.length ? `<span style="color:var(--orange);">Sebagian belum (${belum.length}/${list.length})</span>` : '')}</div>
      </div>
      <div class="harga" style="display:flex; align-items:center; gap:4px;">
        <span>${fmtRp(totalHarga)}</span>
        <button class="btn-small-icon" title="Update harga & kemasan" onclick="event.stopPropagation(); ${isLoggedIn ? `editHargaBelanjaHadiahGroup(${gi})` : `toast('⛔ Login untuk mengedit')`}" ${!isLoggedIn ? 'disabled' : ''}>${icon('pen')}</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="stat-grid"><div class="stat-card belanja-hadiah"><div class="lbl">Total Item</div><div class="val">${totalItem}</div></div><div class="stat-card pemasukan"><div class="lbl">Belum Dibeli</div><div class="val">${totalBelum}</div></div><div class="stat-card saldo"><div class="lbl">Estimasi Total</div><div class="val">${fmtRp(totalEstimasi)}</div></div></div>
  <div class="panel"><div class="panel-head"><div><h3>🎁 Daftar Belanja Hadiah</h3><div class="desc">Belum dibeli: <strong>${fmtRp(totalBelumEstimasi)}</strong></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn success small" onclick="tandaiSemuaBelanjaHadiah()" ${!isLoggedIn ? 'disabled' : ''}>✓ Semua Dibeli</button>
      <button class="btn secondary small" onclick="resetSemuaBelanjaHadiah()" ${!isLoggedIn ? 'disabled' : ''}>↺ Reset</button>
    </div></div>
  <div class="panel-body">${groups}</div></div>`;
}

function toggleBelanjaHadiah(hadiahId, itemIndex, belanjaId){
  if (!canEditSection('belanja-hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const h = db.hadiahKategori.find(x=>x.id===hadiahId);
  if(!h || !h.items[itemIndex]) { toast('Item tidak ditemukan'); return; }
  const item = h.items[itemIndex];
  let existing = db.daftarBelanjaHadiah.find(b => b.hadiah_kategori_id === hadiahId && b.item_index === itemIndex && b.event_id === eid());
  let actionMsg = '';
  if (existing) {
    if (existing.status === 'dibeli') { 
      existing.status = 'belum_dibeli'; existing.tanggal_beli = null; 
      actionMsg = `↩️ Belanja hadiah dibatalkan: ${item.nama}`;
      toast(`"${item.nama}" → belum dibeli`); 
    }
    else { 
      existing.status = 'dibeli'; existing.tanggal_beli = todayISO(); 
      actionMsg = `✅ Belanja hadiah DIBELI: ${item.nama}`;
      toast(`✓ "${item.nama}" dibeli`); 
    }
  } else {
    db.daftarBelanjaHadiah.push({id:uid(), event_id:eid(), hadiah_kategori_id:hadiahId, item_index:itemIndex, status:'dibeli', tanggal_beli:todayISO()});
    actionMsg = `✅ Belanja hadiah DIBELI: ${item.nama}`;
    toast(`✓ "${item.nama}" dibeli`);
  }
  saveDB(); renderContent(); renderTopbarSaldo();
  if(actionMsg) notifyTelegram(actionMsg, `Paket: ${labelPeserta(h.kategori_peserta)} - ${labelJuara(h.juara_ke)}\nQty: ${item.qty_dibeli}\nHarga: ${fmtRp(item.harga_satuan)}`);
}
function toggleBelanjaHadiahGroup(gi){
  if (!canEditSection('belanja-hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const group = (window._belanjaHadiahGroups||{})[gi];
  if(!group || !group.refs.length){ toast('Item tidak ditemukan'); return; }
  const semuaDibeli = group.refs.every(r => {
    const existing = db.daftarBelanjaHadiah.find(b=>b.hadiah_kategori_id===r.hadiahId && b.item_index===r.itemIndex && b.event_id===eid());
    return existing && existing.status === 'dibeli';
  });
  const newStatus = semuaDibeli ? 'belum_dibeli' : 'dibeli';
  const tgl = newStatus === 'dibeli' ? todayISO() : null;
  const detail = [];
  group.refs.forEach(r => {
    const h = db.hadiahKategori.find(x=>x.id===r.hadiahId);
    if(!h || !h.items[r.itemIndex]) return;
    let existing = db.daftarBelanjaHadiah.find(b=>b.hadiah_kategori_id===r.hadiahId && b.item_index===r.itemIndex && b.event_id===eid());
    if(existing){ existing.status = newStatus; existing.tanggal_beli = tgl; }
    else { db.daftarBelanjaHadiah.push({id:uid(), event_id:eid(), hadiah_kategori_id:r.hadiahId, item_index:r.itemIndex, status:newStatus, tanggal_beli:tgl}); }
    detail.push(`${labelPeserta(h.kategori_peserta)} - ${labelJuara(h.juara_ke)}`);
  });
  saveDB(); renderContent(); renderTopbarSaldo();
  if(newStatus==='dibeli'){
    toast(`✓ "${group.nama}" dibeli (semua juara)`);
    notifyTelegram(`✅ Belanja hadiah DIBELI: ${group.nama}`, detail.join('\n'));
  } else {
    toast(`"${group.nama}" → belum dibeli`);
    notifyTelegram(`↩️ Belanja hadiah dibatalkan: ${group.nama}`, detail.join('\n'));
  }
}
function editHargaBelanjaHadiahGroup(gi){
  if (!canEditSection('belanja-hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const group = (window._belanjaHadiahGroups||{})[gi];
  if(!group || !group.refs.length){ toast('Item tidak ditemukan'); return; }
  const firstRef = group.refs[0];
  const firstH = db.hadiahKategori.find(x=>x.id===firstRef.hadiahId);
  const firstItem = firstH ? firstH.items[firstRef.itemIndex] : null;
  if(!firstItem){ toast('Item tidak ditemukan'); return; }

  const isiSekarang = Math.max(1, Number(firstItem.isi_per_pack||1));
  const isiInput = prompt(`"${group.nama}" dijual isi berapa per pack?\n(Isi 1 kalau dijual satuan/bijian, isi 12 kalau 1 pack = 12 pcs, dst.)`, isiSekarang);
  if(isiInput===null) return;
  const isiPerPack = Math.max(1, Number(String(isiInput).replace(/[^0-9]/g,''))||1);

  const hargaSatuanSekarang = Number(firstItem.harga_satuan||0);
  const isPack = isiPerPack > 1;
  const labelHarga = isPack ? `Harga per PACK (isi ${isiPerPack} pcs)` : 'Harga per pcs (satuan)';
  const defaultHargaInput = isPack ? hargaSatuanSekarang * isiPerPack : hargaSatuanSekarang;
  const hargaInput = prompt(`${labelHarga} untuk "${group.nama}" (Rp):`, defaultHargaInput);
  if(hargaInput===null) return;
  const hargaMasuk = Number(String(hargaInput).replace(/[^0-9]/g,''));
  if(!(hargaMasuk >= 0)){ toast('Harga tidak valid'); return; }
  const hargaSatuanBaru = isPack ? Math.round(hargaMasuk / isiPerPack) : hargaMasuk;

  let count = 0, totalQty = 0;
  group.refs.forEach(r => {
    const h = db.hadiahKategori.find(x=>x.id===r.hadiahId);
    if(h && h.items[r.itemIndex]){
      h.items[r.itemIndex].harga_satuan = hargaSatuanBaru;
      h.items[r.itemIndex].isi_per_pack = isiPerPack;
      totalQty += Number(h.items[r.itemIndex].qty_dibeli||0);
      count++;
    }
  });
  saveDB(); renderContent(); renderTopbarSaldo();

  if(isPack){
    const jumlahPack = Math.ceil(totalQty / isiPerPack);
    toast(`✓ "${group.nama}": beli ${jumlahPack} pack (isi ${isiPerPack}) — Rp${fmtRp(hargaSatuanBaru)}/pcs`);
    notifyTelegram(`✏️ Update kemasan & harga belanja hadiah: ${group.nama}`, `Isi per pack: ${isiPerPack}\nHarga per pack: ${fmtRp(hargaMasuk)} (≈ ${fmtRp(hargaSatuanBaru)}/pcs)\nKebutuhan: ${totalQty} pcs → beli ${jumlahPack} pack`);
  } else {
    toast(`✓ Harga "${group.nama}" diupdate ke ${fmtRp(hargaSatuanBaru)}/pcs (${count} paket)`);
    notifyTelegram(`✏️ Update harga belanja hadiah: ${group.nama}`, `Harga satuan baru: ${fmtRp(hargaSatuanBaru)}\nDiterapkan ke ${count} paket`);
  }
}
function tandaiSemuaBelanjaHadiah(){ 
  if (!canEditSection('belanja-hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const hadiahList=gHadiahKategori(); let count=0; let detail = [];
  hadiahList.forEach(h=>{h.items.forEach((item,idx)=>{if(Number(item.qty_dibeli||0)<=0)return; const existing=db.daftarBelanjaHadiah.find(b=>b.hadiah_kategori_id===h.id&&b.item_index===idx&&b.event_id===eid()); if(!existing||existing.status!=='dibeli'){if(existing){existing.status='dibeli';existing.tanggal_beli=todayISO();}else{db.daftarBelanjaHadiah.push({id:uid(),event_id:eid(),hadiah_kategori_id:h.id,item_index:idx,status:'dibeli',tanggal_beli:todayISO()});}count++;detail.push(`${item.nama} (${labelPeserta(h.kategori_peserta)})`);}});}); 
  if(count===0){toast('Semua sudah dibeli');}else{saveDB();renderContent();renderTopbarSaldo();toast(`✓ ${count} item dibeli`);
  notifyTelegram(`✅ ${count} item hadiah lomba DIBELI`, detail.join('\n'));} }
function resetSemuaBelanjaHadiah(){ 
  if (!canEditSection('belanja-hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Reset semua status?')) return; 
  const list=gDaftarBelanjaHadiah(); 
  list.forEach(b=>{b.status='belum_dibeli';b.tanggal_beli=null;}); 
  saveDB(); renderContent(); toast('Reset'); 
  notifyTelegram(`↩️ Reset semua status belanja hadiah`, `Semua status dikembalikan ke "belum dibeli"`);
}
function editBelanjaHadiah(hadiahId,itemIndex){ 
  if (!canEditSection('belanja-hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const h=db.hadiahKategori.find(x=>x.id===hadiahId); if(!h||!h.items[itemIndex]) return; const item=h.items[itemIndex]; const newNama=prompt('Nama:',item.nama); if(newNama===null)return; const newHarga=prompt('Harga:',item.harga_satuan); if(newHarga===null)return; const newQty=prompt('Qty:',item.qty_dibeli); if(newQty===null)return; if(!newNama.trim()||Number(newQty)<0){toast('Nama & qty wajib');return;} item.nama=newNama.trim(); item.harga_satuan=Number(newHarga)||0; item.qty_dibeli=Number(newQty)||0;
  const samaCount = samakanHargaItemSejenis(item.nama, item.harga_satuan, hadiahId, itemIndex);
  saveDB(); renderContent(); toast(samaCount>0?`Diupdate, harga disamakan ke ${samaCount} item "${item.nama}" lainnya`:'Diupdate'); 
  notifyTelegram(`✏️ Edit item belanja hadiah: ${item.nama}`, `Paket: ${labelPeserta(h.kategori_peserta)} - ${labelJuara(h.juara_ke)}\nHarga: ${fmtRp(item.harga_satuan)}\nQty: ${item.qty_dibeli}`);
}

function renderBelanjaPerlengkapan(){
  const semuaKebutuhan = [];
  gLomba().forEach(l => { gKebutuhan(l.id).forEach(k => { semuaKebutuhan.push({...k, lombaNama: l.nama, lombaKategori: l.kategori_peserta}); }); });
  const daftar = gDaftarBelanjaPerlengkapan();
  const statusMap = {}; daftar.forEach(b => { statusMap[b.kebutuhan_id] = b; });

  const items = semuaKebutuhan.map(k => {
    const belanja = statusMap[k.id] || null;
    const status = belanja ? belanja.status : 'belum_dibeli';
    const harga = Number(k.harga_realisasi ?? k.harga_estimasi ?? 0);
    return {...k, status, tanggalBeli: belanja?.tanggal_beli, sudahDibeli: status==='dibeli', hargaTotal: harga * Number(k.qty||0)};
  });
  items.sort((a,b) => { if(a.sudahDibeli!==b.sudahDibeli) return a.sudahDibeli?1:-1; return a.lombaNama.localeCompare(b.lombaNama); });

  const totalItem = items.length, totalBelum = items.filter(i=>!i.sudahDibeli).length, totalEstimasi = items.reduce((s,i)=>s+i.hargaTotal,0), totalBelumEstimasi = items.filter(i=>!i.sudahDibeli).reduce((s,i)=>s+i.hargaTotal,0);
  const isLoggedIn = !!getCurrentUser();
  
  if(!items.length) return `<div class="panel"><div class="panel-head"><h3>📦 Belanja Perlengkapan</h3></div><div class="panel-body"><div class="empty-state"><h3>Belum ada perlengkapan</h3><button class="btn" onclick="goSection('lomba')">+ Tambah Kebutuhan</button></div></div></div>`;

  // Kelompokkan per NAMA barang (gabungan lintas lomba), total kebutuhan digabung, detail per lomba tetap ada
  const nameMap = {};
  items.forEach(item => {
    const key = item.nama_item.trim().toLowerCase();
    if(!nameMap[key]) nameMap[key] = {nama: item.nama_item, list: []};
    nameMap[key].list.push(item);
  });
  const nameGroups = Object.values(nameMap).sort((a,b) => {
    const aBelum = a.list.some(i=>!i.sudahDibeli), bBelum = b.list.some(i=>!i.sudahDibeli);
    if(aBelum !== bBelum) return aBelum ? -1 : 1;
    return a.nama.localeCompare(b.nama);
  });

  window._belanjaPerlengkapanGroups = {};
  const groupHtml = nameGroups.map((g, gi) => {
    const groupItems = g.list.slice().sort((a,b) => a.lombaNama.localeCompare(b.lombaNama));
    window._belanjaPerlengkapanGroups[gi] = {nama: g.nama, refs: groupItems.map(i=>i.id)};

    const totalQty = groupItems.reduce((s,i)=>s+Number(i.qty||0),0);
    const totalHarga = groupItems.reduce((s,i)=>s+i.hargaTotal,0);
    const semuaDibeli = groupItems.every(i=>i.sudahDibeli);
    const groupBelum = groupItems.filter(i=>!i.sudahDibeli);
    const tglTerbaru = groupItems.filter(i=>i.tanggalBeli).map(i=>i.tanggalBeli).sort().pop();

    const tagHtml = groupItems.map(item => `<span class="tag tag-orange">📋 ${esc(item.lombaNama)} · ${labelPeserta(item.lombaKategori)} · ${item.qty}</span>`).join('');

    return `<div class="belanja-item ${semuaDibeli?'dibeli':''}">
      <div class="checkbox-wrapper ${semuaDibeli?'checked':''} ${!isLoggedIn ? 'disabled' : ''}" onclick="${isLoggedIn ? `toggleBelanjaPerlengkapanGroup(${gi})` : 'toast(\'⛔ Login untuk mengedit\')'}"></div>
      <div class="info">
        <div class="nama">${esc(g.nama)} <span style="font-weight:600; color:var(--ink-soft); font-size:12px;">(Total: ${totalQty})</span></div>
        <div class="detail">${tagHtml}${semuaDibeli&&tglTerbaru?`<span>✓ Dibeli: ${fmtDate(tglTerbaru)}</span>`:(groupBelum.length && groupBelum.length<groupItems.length ? `<span style="color:var(--orange);">Sebagian belum (${groupBelum.length}/${groupItems.length})</span>` : '')}</div>
      </div>
      <div class="harga">${fmtRp(totalHarga)}</div>
    </div>`;
  }).join('');

  return `<div class="stat-grid"><div class="stat-card belanja-perlengkapan"><div class="lbl">Total Item</div><div class="val">${totalItem}</div></div><div class="stat-card pemasukan"><div class="lbl">Belum Dibeli</div><div class="val">${totalBelum}</div></div><div class="stat-card saldo"><div class="lbl">Estimasi Total</div><div class="val">${fmtRp(totalEstimasi)}</div></div></div>
  <div class="panel"><div class="panel-head"><div><h3>📦 Daftar Belanja Perlengkapan</h3><div class="desc">Belum dibeli: <strong>${fmtRp(totalBelumEstimasi)}</strong></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn success small" onclick="tandaiSemuaBelanjaPerlengkapan()" ${!isLoggedIn ? 'disabled' : ''}>✓ Semua Dibeli</button>
      <button class="btn secondary small" onclick="resetSemuaBelanjaPerlengkapan()" ${!isLoggedIn ? 'disabled' : ''}>↺ Reset</button>
    </div></div>
  <div class="panel-body">${groupHtml}</div></div>`;
}

function toggleBelanjaPerlengkapan(kebutuhanId, belanjaId){
  if (!canEditSection('belanja-perlengkapan')) { toast('⛔ Login untuk mengedit data'); return; }
  const k = db.lombaKebutuhan.find(x=>x.id===kebutuhanId);
  if(!k) { toast('Item tidak ditemukan'); return; }
  let existing = db.daftarBelanjaPerlengkapan.find(b => b.kebutuhan_id === kebutuhanId && b.event_id === eid());
  let actionMsg = '';
  if (existing) {
    if (existing.status === 'dibeli') { 
      existing.status = 'belum_dibeli'; existing.tanggal_beli = null; 
      actionMsg = `↩️ Belanja perlengkapan dibatalkan: ${k.nama_item}`;
      toast(`"${k.nama_item}" → belum dibeli`); 
    }
    else { 
      existing.status = 'dibeli'; existing.tanggal_beli = todayISO(); 
      actionMsg = `✅ Belanja perlengkapan DIBELI: ${k.nama_item}`;
      toast(`✓ "${k.nama_item}" dibeli`); 
    }
  } else {
    db.daftarBelanjaPerlengkapan.push({id:uid(), event_id:eid(), kebutuhan_id:kebutuhanId, status:'dibeli', tanggal_beli:todayISO()});
    actionMsg = `✅ Belanja perlengkapan DIBELI: ${k.nama_item}`;
    toast(`✓ "${k.nama_item}" dibeli`);
  }
  saveDB(); renderContent(); renderTopbarSaldo();
  if(actionMsg) notifyTelegram(actionMsg, `Item: ${k.nama_item}\nQty: ${k.qty}\nLomba: ${db.lomba.find(x=>x.id===k.lomba_id)?.nama || k.lomba_id}`);
}
function toggleBelanjaPerlengkapanGroup(gi){
  if (!canEditSection('belanja-perlengkapan')) { toast('⛔ Login untuk mengedit data'); return; }
  const group = (window._belanjaPerlengkapanGroups||{})[gi];
  if(!group || !group.refs.length){ toast('Item tidak ditemukan'); return; }
  const semuaDibeli = group.refs.every(kid => {
    const existing = db.daftarBelanjaPerlengkapan.find(b=>b.kebutuhan_id===kid && b.event_id===eid());
    return existing && existing.status === 'dibeli';
  });
  const newStatus = semuaDibeli ? 'belum_dibeli' : 'dibeli';
  const tgl = newStatus === 'dibeli' ? todayISO() : null;
  const detail = [];
  group.refs.forEach(kid => {
    const k = db.lombaKebutuhan.find(x=>x.id===kid);
    if(!k) return;
    let existing = db.daftarBelanjaPerlengkapan.find(b=>b.kebutuhan_id===kid && b.event_id===eid());
    if(existing){ existing.status = newStatus; existing.tanggal_beli = tgl; }
    else { db.daftarBelanjaPerlengkapan.push({id:uid(), event_id:eid(), kebutuhan_id:kid, status:newStatus, tanggal_beli:tgl}); }
    detail.push(`${db.lomba.find(x=>x.id===k.lomba_id)?.nama || k.lomba_id}`);
  });
  saveDB(); renderContent(); renderTopbarSaldo();
  if(newStatus==='dibeli'){
    toast(`✓ "${group.nama}" dibeli (semua lomba)`);
    notifyTelegram(`✅ Belanja perlengkapan DIBELI: ${group.nama}`, detail.join('\n'));
  } else {
    toast(`"${group.nama}" → belum dibeli`);
    notifyTelegram(`↩️ Belanja perlengkapan dibatalkan: ${group.nama}`, detail.join('\n'));
  }
}
function tandaiSemuaBelanjaPerlengkapan(){ 
  if (!canEditSection('belanja-perlengkapan')) { toast('⛔ Login untuk mengedit data'); return; }
  let count=0; let detail = [];
  gLomba().forEach(l=>{gKebutuhan(l.id).forEach(k=>{const existing=db.daftarBelanjaPerlengkapan.find(b=>b.kebutuhan_id===k.id&&b.event_id===eid()); if(!existing||existing.status!=='dibeli'){if(existing){existing.status='dibeli';existing.tanggal_beli=todayISO();}else{db.daftarBelanjaPerlengkapan.push({id:uid(),event_id:eid(),kebutuhan_id:k.id,status:'dibeli',tanggal_beli:todayISO()});}count++;detail.push(`${k.nama_item} (${l.nama})`);}});}); 
  if(count===0){toast('Semua sudah dibeli');}else{saveDB();renderContent();renderTopbarSaldo();toast(`✓ ${count} item dibeli`);
  notifyTelegram(`✅ ${count} item perlengkapan DIBELI`, detail.join('\n'));} }
function resetSemuaBelanjaPerlengkapan(){ 
  if (!canEditSection('belanja-perlengkapan')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Reset semua status?')) return; 
  const list=gDaftarBelanjaPerlengkapan(); 
  list.forEach(b=>{b.status='belum_dibeli';b.tanggal_beli=null;}); 
  saveDB(); renderContent(); toast('Reset');
  notifyTelegram(`↩️ Reset semua status belanja perlengkapan`, `Semua status dikembalikan ke "belum dibeli"`);
}
function editBelanjaPerlengkapan(kebutuhanId){ 
  if (!canEditSection('belanja-perlengkapan')) { toast('⛔ Login untuk mengedit data'); return; }
  const k=db.lombaKebutuhan.find(x=>x.id===kebutuhanId); if(!k) return; const newNama=prompt('Nama item:',k.nama_item); if(newNama===null)return; const newEst=prompt('Harga estimasi:',k.harga_estimasi); if(newEst===null)return; const newQty=prompt('Qty:',k.qty); if(newQty===null)return; if(!newNama.trim()||Number(newQty)<=0){toast('Nama & qty wajib');return;} k.nama_item=newNama.trim(); k.harga_estimasi=Number(newEst)||0; k.qty=Number(newQty)||0; saveDB(); renderContent(); toast('Diupdate'); 
  notifyTelegram(`✏️ Edit item perlengkapan: ${k.nama_item}`, `Lomba: ${db.lomba.find(x=>x.id===k.lomba_id)?.nama || k.lomba_id}\nQty: ${k.qty}\nEstimasi: ${fmtRp(k.harga_estimasi)}`);
}

/* ============================================================
   HADIAH JALAN SANTAI & BELANJA JALAN (dengan auth check)
   ============================================================ */
function renderHadiahJalanSantai(){
  const list = gHadiahJalanSantai();
  const total = list.reduce((s,h) => s + (Number(h.harga_satuan||0) * Number(h.qty||0)), 0);
  const totalItems = list.reduce((s,h) => s + Number(h.qty||0), 0);
  const isLoggedIn = !!getCurrentUser();

  const rows = list.map(h => {
    const belanja = db.daftarBelanjaJalanSantai.find(b => b.hadiah_jalan_id === h.id && b.event_id === eid());
    const sudahDibeli = belanja && belanja.status === 'dibeli';
    return `
    <tr class="${sudahDibeli?'dibeli':''}">
      <td>${esc(h.nama_hadiah)}</td>
      <td><span class="kategori-pill jalan-santai">${labelKategoriJalan(h.kategori)}</span></td>
      <td class="num">${fmtRp(h.harga_satuan)}</td>
      <td class="num">${h.qty}</td>
      <td class="num">${fmtRp(Number(h.harga_satuan||0) * Number(h.qty||0))}</td>
      <td>${esc(h.keterangan||'-')}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn secondary small" onclick="toggleBelanjaJalan('${h.id}')" ${!isLoggedIn ? 'disabled' : ''}>${sudahDibeli?'✓ Dibeli':'Belum'}</button>
        <button class="icon-btn" onclick="openHadiahJalanModal('${h.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Edit">✎</button>
        <button class="icon-btn" onclick="hapusHadiahJalan('${h.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Hapus">🗑</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="stat-grid">
    <div class="stat-card jalan-santai"><div class="lbl">Total Hadiah</div><div class="val">${list.length}</div></div>
    <div class="stat-card pengeluaran"><div class="lbl">Total Item</div><div class="val">${totalItems}</div></div>
    <div class="stat-card saldo"><div class="lbl">Total Biaya</div><div class="val">${fmtRp(total)}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <div><h3>🏃 Hadiah Jalan Santai</h3>
        <div class="desc">Kelola hadiah untuk acara jalan santai</div>
      </div>
      ${isLoggedIn ? `<button class="btn pink" onclick="openHadiahJalanModal()">+ Tambah Hadiah</button>` : ''}
    </div>
    <div class="panel-body flush">
      <table class="jalan-table">
        <thead><tr><th>Nama Hadiah</th><th>Kategori</th><th class="num">Harga Satuan</th><th class="num">Qty</th><th class="num">Total</th><th>Keterangan</th><th></th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="7">Belum ada hadiah jalan santai.</td></tr>`}</tbody>
        ${list.length > 0 ? `<tfoot><tr><td colspan="4">Total</td><td class="num">${fmtRp(total)}</td><td colspan="2"></td></tr></tfoot>` : ''}
      </table>
    </div>
  </div>`;
}

function labelKategoriJalan(v){ return (KATEGORI_JALAN_SANTAI.find(k=>k.v===v)||{}).l || v; }

function openHadiahJalanModal(id){
  if (!canEditSection('hadiah-jalan')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.hadiahJalanSantai.find(h=>h.id===id) : null;
  setModal(editing?'Edit Hadiah Jalan Santai':'Tambah Hadiah Jalan Santai', `
    <div class="field"><label>Nama Hadiah</label><input id="f-nama" value="${editing?esc(editing.nama_hadiah):''}" placeholder="mis. Baju, Topi, Snack Pack"></div>
    <div class="field-row">
      <div class="field"><label>Kategori</label>
        <select id="f-kategori">${KATEGORI_JALAN_SANTAI.map(k=>`<option value="${k.v}" ${editing&&editing.kategori===k.v?'selected':''}>${k.l}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Qty</label><input id="f-qty" type="number" min="1" value="${editing?editing.qty:1}"></div>
    </div>
    <div class="field"><label>Harga Satuan (Rp)</label><input id="f-harga" class="currency-input" type="text" value="${editing?formatCurrency(editing.harga_satuan):''}"></div>
    <div class="field"><label>Keterangan (opsional)</label><input id="f-ket" value="${editing?esc(editing.keterangan||''):''}" placeholder="mis. Sponsor dari Toko ABC"></div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'pink', onclick:()=>{
      const nama_hadiah = document.getElementById('f-nama').value.trim();
      const kategori = document.getElementById('f-kategori').value;
      const qty = Number(document.getElementById('f-qty').value||0);
      const harga_satuan = getCurrencyValue(document.getElementById('f-harga'));
      const keterangan = document.getElementById('f-ket').value.trim();
      if(!nama_hadiah || qty <= 0 || harga_satuan <= 0){ toast('Nama, qty & harga wajib diisi'); return; }
      let actionMsg = editing ? `✏️ Edit hadiah jalan santai: ${editing.nama_hadiah} → ${nama_hadiah}` : `➕ Hadiah jalan santai baru: ${nama_hadiah}`;
      if(editing){ Object.assign(editing, {nama_hadiah, kategori, qty, harga_satuan, keterangan}); }
      else{ db.hadiahJalanSantai.push({id:uid(), event_id:eid(), nama_hadiah, kategori, qty, harga_satuan, keterangan}); }
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast('Hadiah jalan santai disimpan');
      notifyTelegram(actionMsg, `Kategori: ${labelKategoriJalan(kategori)}\nQty: ${qty}\nHarga: ${fmtRp(harga_satuan)}\nTotal: ${fmtRp(harga_satuan * qty)}\nKeterangan: ${keterangan || '-'}`);
    }}
  ]);
  setTimeout(setupAllCurrencyInputs, 50);
}

function hapusHadiahJalan(id){
  if (!canEditSection('hadiah-jalan')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus hadiah ini?')) return;
  const h = db.hadiahJalanSantai.find(x=>x.id===id);
  db.hadiahJalanSantai = db.hadiahJalanSantai.filter(h=>h.id!==id);
  saveDB(); renderContent(); renderTopbarSaldo();
  if(h) notifyTelegram(`🗑️ Hapus hadiah jalan santai: ${h.nama_hadiah}`, `Kategori: ${labelKategoriJalan(h.kategori)}`);
}

function toggleBelanjaJalan(hadiahId){
  if (!canEditSection('hadiah-jalan') && !canEditSection('belanja-jalan')) { toast('⛔ Login untuk mengedit data'); return; }
  const h = db.hadiahJalanSantai.find(x=>x.id===hadiahId);
  if(!h) { toast('Hadiah tidak ditemukan'); return; }
  
  let existing = db.daftarBelanjaJalanSantai.find(b => b.hadiah_jalan_id === hadiahId && b.event_id === eid());
  let actionMsg = '';
  
  if (existing) {
    if (existing.status === 'dibeli') {
      existing.status = 'belum_dibeli';
      existing.tanggal_beli = null;
      actionMsg = `↩️ Belanja jalan santai dibatalkan: ${h.nama_hadiah}`;
      toast(`"${h.nama_hadiah}" → belum dibeli`);
    } else {
      existing.status = 'dibeli';
      existing.tanggal_beli = todayISO();
      actionMsg = `✅ Belanja jalan santai DIBELI: ${h.nama_hadiah}`;
      toast(`✓ "${h.nama_hadiah}" dibeli`);
    }
  } else {
    db.daftarBelanjaJalanSantai.push({
      id: uid(),
      event_id: eid(),
      hadiah_jalan_id: hadiahId,
      status: 'dibeli',
      tanggal_beli: todayISO()
    });
    actionMsg = `✅ Belanja jalan santai DIBELI: ${h.nama_hadiah}`;
    toast(`✓ "${h.nama_hadiah}" dibeli`);
  }
  saveDB(); renderContent(); renderTopbarSaldo();
  if(actionMsg) notifyTelegram(actionMsg, `Kategori: ${labelKategoriJalan(h.kategori)}\nQty: ${h.qty}\nHarga: ${fmtRp(h.harga_satuan)}`);
}
function toggleBelanjaJalanGroup(gi){
  if (!canEditSection('hadiah-jalan') && !canEditSection('belanja-jalan')) { toast('⛔ Login untuk mengedit data'); return; }
  const group = (window._belanjaJalanGroups||{})[gi];
  if(!group || !group.refs.length){ toast('Item tidak ditemukan'); return; }
  const semuaDibeli = group.refs.every(hid => {
    const existing = db.daftarBelanjaJalanSantai.find(b=>b.hadiah_jalan_id===hid && b.event_id===eid());
    return existing && existing.status === 'dibeli';
  });
  const newStatus = semuaDibeli ? 'belum_dibeli' : 'dibeli';
  const tgl = newStatus === 'dibeli' ? todayISO() : null;
  const detail = [];
  group.refs.forEach(hid => {
    const h = db.hadiahJalanSantai.find(x=>x.id===hid);
    if(!h) return;
    let existing = db.daftarBelanjaJalanSantai.find(b=>b.hadiah_jalan_id===hid && b.event_id===eid());
    if(existing){ existing.status = newStatus; existing.tanggal_beli = tgl; }
    else { db.daftarBelanjaJalanSantai.push({id:uid(), event_id:eid(), hadiah_jalan_id:hid, status:newStatus, tanggal_beli:tgl}); }
    detail.push(labelKategoriJalan(h.kategori));
  });
  saveDB(); renderContent(); renderTopbarSaldo();
  if(newStatus==='dibeli'){
    toast(`✓ "${group.nama}" dibeli (semua kategori)`);
    notifyTelegram(`✅ Belanja jalan santai DIBELI: ${group.nama}`, detail.join('\n'));
  } else {
    toast(`"${group.nama}" → belum dibeli`);
    notifyTelegram(`↩️ Belanja jalan santai dibatalkan: ${group.nama}`, detail.join('\n'));
  }
}

function renderBelanjaJalanSantai(){
  const list = gHadiahJalanSantai();
  const daftar = gDaftarBelanjaJalanSantai();
  const statusMap = {};
  daftar.forEach(b => { statusMap[b.hadiah_jalan_id] = b; });

  const items = list.map(h => {
    const belanja = statusMap[h.id] || null;
    const status = belanja ? belanja.status : 'belum_dibeli';
    const tanggalBeli = belanja ? belanja.tanggal_beli : null;
    const sudahDibeli = status === 'dibeli';
    return {
      ...h,
      status,
      tanggalBeli,
      sudahDibeli,
      belanjaId: belanja ? belanja.id : null,
      hargaTotal: Number(h.harga_satuan||0) * Number(h.qty||0)
    };
  });

  items.sort((a,b) => {
    if (a.sudahDibeli !== b.sudahDibeli) return a.sudahDibeli ? 1 : -1;
    return a.nama_hadiah.localeCompare(b.nama_hadiah);
  });

  const totalItem = items.length;
  const totalBelum = items.filter(i => !i.sudahDibeli).length;
  const totalSudah = items.filter(i => i.sudahDibeli).length;
  const totalEstimasi = items.reduce((s, i) => s + i.hargaTotal, 0);
  const totalBelumEstimasi = items.filter(i => !i.sudahDibeli).reduce((s, i) => s + i.hargaTotal, 0);
  const isLoggedIn = !!getCurrentUser();

  if (!items.length) {
    return `
    <div class="panel">
      <div class="panel-head"><h3>🛍️ Belanja Jalan Santai</h3></div>
      <div class="panel-body">
        <div class="empty-state"><h3>Belum ada hadiah</h3><p>Tambahkan hadiah jalan santai dulu.</p>
          ${isLoggedIn ? `<button class="btn pink" onclick="goSection('hadiah-jalan')">+ Tambah Hadiah</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  // Kelompokkan per NAMA hadiah (gabungan lintas kategori jalan santai), total kebutuhan digabung, detail per kategori tetap ada
  const nameMap = {};
  items.forEach(item => {
    const key = item.nama_hadiah.trim().toLowerCase();
    if(!nameMap[key]) nameMap[key] = {nama: item.nama_hadiah, list: []};
    nameMap[key].list.push(item);
  });
  const nameGroups = Object.values(nameMap).sort((a,b) => {
    const aBelum = a.list.some(i=>!i.sudahDibeli), bBelum = b.list.some(i=>!i.sudahDibeli);
    if(aBelum !== bBelum) return aBelum ? -1 : 1;
    return a.nama.localeCompare(b.nama);
  });

  window._belanjaJalanGroups = {};
  const groups = nameGroups.map((g, gi) => {
    const groupItems = g.list.slice().sort((a,b) => a.kategori.localeCompare(b.kategori));
    window._belanjaJalanGroups[gi] = {nama: g.nama, refs: groupItems.map(i=>i.id)};

    const totalQty = groupItems.reduce((s,i)=>s+Number(i.qty||0),0);
    const totalHarga = groupItems.reduce((s, i) => s + i.hargaTotal, 0);
    const semuaDibeli = groupItems.every(i=>i.sudahDibeli);
    const groupBelum = groupItems.filter(i => !i.sudahDibeli);
    const tglTerbaru = groupItems.filter(i=>i.tanggalBeli).map(i=>i.tanggalBeli).sort().pop();

    const tagHtml = groupItems.map(item => `<span class="tag tag-pink">${labelKategoriJalan(item.kategori)} · ${item.qty} @${fmtRp(item.harga_satuan)}${item.keterangan?` · ${esc(item.keterangan)}`:''}</span>`).join('');

    return `<div class="belanja-item ${semuaDibeli ? 'dibeli' : ''}">
      <div class="checkbox-wrapper ${semuaDibeli ? 'checked' : ''} ${!isLoggedIn ? 'disabled' : ''}" 
           onclick="${isLoggedIn ? `toggleBelanjaJalanGroup(${gi})` : 'toast(\'⛔ Login untuk mengedit\')'}">
      </div>
      <div class="info">
        <div class="nama">${esc(g.nama)} <span style="font-weight:600; color:var(--ink-soft); font-size:12px;">(Total: ${totalQty})</span></div>
        <div class="detail">${tagHtml}${semuaDibeli&&tglTerbaru?`<span>✓ Dibeli: ${fmtDate(tglTerbaru)}</span>`:(groupBelum.length && groupBelum.length<groupItems.length ? `<span style="color:var(--orange);">Sebagian belum (${groupBelum.length}/${groupItems.length})</span>` : '')}</div>
      </div>
      <div class="harga">${fmtRp(totalHarga)}</div>
    </div>`;
  }).join('');

  return `
  <div class="stat-grid">
    <div class="stat-card jalan-santai"><div class="lbl">Total Item</div><div class="val">${totalItem}</div></div>
    <div class="stat-card pemasukan"><div class="lbl">Belum Dibeli</div><div class="val">${totalBelum}</div></div>
    <div class="stat-card pengeluaran"><div class="lbl">Sudah Dibeli</div><div class="val">${totalSudah}</div></div>
    <div class="stat-card saldo"><div class="lbl">Estimasi Total</div><div class="val">${fmtRp(totalEstimasi)}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <div><h3>🛍️ Daftar Belanja Hadiah Jalan Santai</h3>
        <div class="desc">Belum dibeli: <strong>${fmtRp(totalBelumEstimasi)}</strong></div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn success small" onclick="tandaiSemuaBelanjaJalan()" ${!isLoggedIn ? 'disabled' : ''}>✓ Semua Dibeli</button>
        <button class="btn secondary small" onclick="resetSemuaBelanjaJalan()" ${!isLoggedIn ? 'disabled' : ''}>↺ Reset</button>
      </div>
    </div>
    <div class="panel-body">
      ${groups}
    </div>
  </div>`;
}

function tandaiSemuaBelanjaJalan(){
  if (!canEditSection('belanja-jalan')) { toast('⛔ Login untuk mengedit data'); return; }
  const list = gHadiahJalanSantai();
  let count = 0;
  let detail = [];
  list.forEach(h => {
    const existing = db.daftarBelanjaJalanSantai.find(b => b.hadiah_jalan_id === h.id && b.event_id === eid());
    if (!existing || existing.status !== 'dibeli') {
      if (existing) { existing.status = 'dibeli'; existing.tanggal_beli = todayISO(); }
      else { db.daftarBelanjaJalanSantai.push({id:uid(), event_id:eid(), hadiah_jalan_id:h.id, status:'dibeli', tanggal_beli:todayISO()}); }
      count++;
      detail.push(`${h.nama_hadiah} (${labelKategoriJalan(h.kategori)})`);
    }
  });
  if(count===0){ toast('Semua sudah dibeli'); }
  else { saveDB(); renderContent(); renderTopbarSaldo(); toast(`✓ ${count} item dibeli`);
  notifyTelegram(`✅ ${count} item jalan santai DIBELI`, detail.join('\n')); }
}

function resetSemuaBelanjaJalan(){
  if (!canEditSection('belanja-jalan')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Reset semua status belanja?')) return;
  const list = gDaftarBelanjaJalanSantai();
  list.forEach(b => { b.status = 'belum_dibeli'; b.tanggal_beli = null; });
  saveDB(); renderContent(); toast('Reset semua status');
  notifyTelegram(`↩️ Reset semua status belanja jalan santai`, `Semua status dikembalikan ke "belum dibeli"`);
}

/* ============================================================
   JADWAL (dengan auth check)
   ============================================================ */
function renderJadwal(){
  const list = gJadwal().slice().sort((a,b) => {
    return new Date(a.tanggal) - new Date(b.tanggal);
  });
  const isLoggedIn = !!getCurrentUser();

  const today = new Date();
  const rows = list.map(j => {
    const jDate = new Date(j.tanggal + 'T00:00:00');
    const diffDays = Math.ceil((jDate - today) / (1000 * 60 * 60 * 24));
    let statusLabel = '';
    let statusClass = '';
    if (j.status === 'selesai') {
      statusLabel = 'Selesai';
      statusClass = 'lunas';
    } else if (diffDays < 0) {
      statusLabel = 'Terlewat';
      statusClass = 'belum';
    } else if (diffDays === 0) {
      statusLabel = 'Hari Ini!';
      statusClass = 'dibeli';
    } else if (diffDays <= 3) {
      statusLabel = `${diffDays} hari lagi`;
      statusClass = 'dibeli';
    } else {
      statusLabel = `${diffDays} hari lagi`;
      statusClass = 'perlengkapan';
    }

    return `
    <tr class="${j.status === 'selesai' ? '' : (diffDays < 0 ? 'belum-bayar' : '')}">
      <td data-label="Tanggal">${fmtDate(j.tanggal)}</td>
      <td data-label="Status"><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td data-label="Kategori"><span class="kategori-pill">${labelKategoriJadwal(j.kategori)}</span></td>
      <td data-label="Judul">${esc(j.judul)}</td>
      <td data-label="Deskripsi">${esc(j.deskripsi||'-')}</td>
      <td data-label="Aksi" class="jadwal-actions" style="text-align:right; white-space:nowrap;">
        <button class="btn secondary small" onclick="toggleJadwalStatus('${j.id}')" ${!isLoggedIn ? 'disabled' : ''}>${j.status === 'selesai' ? 'Buka' : 'Selesai'}</button>
        <button class="icon-btn" onclick="openJadwalModal('${j.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Edit">✎</button>
        <button class="icon-btn" onclick="hapusJadwal('${j.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Hapus">🗑</button>
      </td>
    </tr>`;
  }).join('');

  const total = list.length;
  const totalSelesai = list.filter(j => j.status === 'selesai').length;
  const totalActive = total - totalSelesai;
  const totalHariIni = list.filter(j => {
    const jDate = new Date(j.tanggal + 'T00:00:00');
    return jDate.toDateString() === today.toDateString() && j.status !== 'selesai';
  }).length;

  return `
  <div class="stat-grid">
    <div class="stat-card info"><div class="lbl">Total Jadwal</div><div class="val">${total}</div></div>
    <div class="stat-card pemasukan"><div class="lbl">Aktif</div><div class="val">${totalActive}</div></div>
    <div class="stat-card warning"><div class="lbl">Hari Ini</div><div class="val">${totalHariIni}</div></div>
    <div class="stat-card"><div class="lbl">Selesai</div><div class="val">${totalSelesai}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <div><h3>📅 Jadwal & Reminder</h3>
        <div class="desc">Kelola jadwal kegiatan dan pengingat</div>
      </div>
      ${isLoggedIn ? `<button class="btn" onclick="openJadwalModal()">+ Tambah Jadwal</button>` : ''}
    </div>
    <div class="panel-body flush">
      <table class="general-table jadwal-table">
        <thead><tr><th>Tanggal</th><th>Status</th><th>Kategori</th><th>Judul</th><th>Deskripsi</th><th></th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="6">Belum ada jadwal. ${isLoggedIn ? 'Tambahkan jadwal untuk mendapatkan pengingat.' : 'Login untuk menambah jadwal.'}</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

function openJadwalModal(id){
  if (!canEditSection('jadwal')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.jadwal.find(j=>j.id===id) : null;
  setModal(editing?'Edit Jadwal':'Tambah Jadwal', `
    <div class="field"><label>Judul</label><input id="f-judul" value="${editing?esc(editing.judul):''}" placeholder="mis. Belanja Hadiah Lomba"></div>
    <div class="field-row">
      <div class="field"><label>Tanggal</label><input id="f-tanggal" type="date" value="${editing?editing.tanggal:todayISO()}"></div>
      <div class="field"><label>Kategori</label>
        <select id="f-kategori">${KATEGORI_JADWAL.map(k=>`<option value="${k.v}" ${editing&&editing.kategori===k.v?'selected':''}>${k.l}</option>`).join('')}</select>
      </div>
    </div>
    <div class="field"><label>Deskripsi (opsional)</label>
      <textarea id="f-deskripsi" rows="3" placeholder="Detail jadwal...">${editing?esc(editing.deskripsi||''):''}</textarea>
    </div>
    <div class="field"><label>Status</label>
      <select id="f-status">
        <option value="aktif" ${editing&&editing.status==='aktif'?'selected':''}>Aktif</option>
        <option value="selesai" ${editing&&editing.status==='selesai'?'selected':''}>Selesai</option>
      </select>
    </div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const judul = document.getElementById('f-judul').value.trim();
      const tanggal = document.getElementById('f-tanggal').value;
      const kategori = document.getElementById('f-kategori').value;
      const deskripsi = document.getElementById('f-deskripsi').value.trim();
      const status = document.getElementById('f-status').value;
      if(!judul || !tanggal){ toast('Judul & tanggal wajib diisi'); return; }
      let actionMsg = editing ? `✏️ Edit jadwal: ${editing.judul} → ${judul}` : `➕ Jadwal baru: ${judul}`;
      if(editing){ Object.assign(editing, {judul, tanggal, kategori, deskripsi, status}); }
      else{ db.jadwal.push({id:uid(), event_id:eid(), judul, tanggal, kategori, deskripsi, status}); }
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast('Jadwal disimpan');
      notifyTelegram(actionMsg, `Tanggal: ${fmtDate(tanggal)}\nKategori: ${labelKategoriJadwal(kategori)}\nDeskripsi: ${deskripsi || '-'}`);
    }}
  ]);
}

function toggleJadwalStatus(id){
  if (!canEditSection('jadwal')) { toast('⛔ Login untuk mengedit data'); return; }
  const j = db.jadwal.find(x=>x.id===id);
  if(!j) return;
  j.status = j.status === 'selesai' ? 'aktif' : 'selesai';
  saveDB(); renderContent(); 
  const action = j.status === 'selesai' ? '✅ Selesai' : '↩️ Dibuka kembali';
  toast(`Jadwal "${j.judul}" ${j.status === 'selesai' ? 'selesai' : 'diaktifkan kembali'}`);
  notifyTelegram(`${action}: ${j.judul}`, `Tanggal: ${fmtDate(j.tanggal)}`);
}

function hapusJadwal(id){
  if (!canEditSection('jadwal')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus jadwal ini?')) return;
  const j = db.jadwal.find(x=>x.id===id);
  db.jadwal = db.jadwal.filter(j=>j.id!==id);
  saveDB(); renderContent(); toast('Jadwal dihapus');
  if(j) notifyTelegram(`🗑️ Hapus jadwal: ${j.judul}`, `Tanggal: ${fmtDate(j.tanggal)}`);
}

/* ============================================================
   LAPORAN PERTANGGUNGJAWABAN (LPJ) - native, tanpa AI
   Merangkai data yang sudah ada di db jadi laporan siap cetak/PDF.
   ============================================================ */
function renderLPJ(){
  const ev = activeEvent();
  if (!ev) return `<div class="panel"><div class="panel-body" style="padding:24px;">Tidak ada event aktif.</div></div>`;

  const b = hitungBukuUtama();
  const anggotaList = gAnggota();
  const kategoriRekap = KATEGORI_ANGGOTA.map(k=>{
    const listK = anggotaList.filter(a=>a.kategori===k.v);
    const lunasK = listK.filter(a=>a.status==='lunas');
    return { label:k.l, total:listK.length, lunas:lunasK.length, nominal:lunasK.reduce((s,a)=>s+Number(a.nominal_wajib||0),0) };
  }).filter(r=>r.total>0);

  const donaturList = gDonatur().slice().sort((x,y)=>(x.tanggal||'').localeCompare(y.tanggal||''));
  const transaksiList = gTransaksiLain().slice().sort((x,y)=>(x.tanggal||'').localeCompare(y.tanggal||''));
  const operasionalList = gOperasional().slice().sort((x,y)=>(x.tanggal||'').localeCompare(y.tanggal||''));

  const kebutuhanRows = [];
  gLomba().forEach(l=>{
    gKebutuhan(l.id).forEach(k=>{
      const harga = Number(k.harga_realisasi ?? k.harga_estimasi ?? 0);
      kebutuhanRows.push({ lomba:l.nama, nama:k.nama_item, qty:k.qty, harga, subtotal: harga*Number(k.qty||0) });
    });
  });

  const hadiahRows = [];
  gHadiahKategori().forEach(h=>{
    (h.items||[]).forEach(item=>{
      hadiahRows.push({ kategori:labelPeserta(h.kategori_peserta), juara:labelJuara(h.juara_ke), nama:item.nama, qty:item.qty_dibeli, harga:item.harga_satuan, subtotal:Number(item.harga_satuan||0)*Number(item.qty_dibeli||0) });
    });
  });

  const hadiahJalanList = gHadiahJalanSantai();
  const isLoggedIn = !!getCurrentUser();

  const emptyRow = (n,text)=>`<tr class="empty-row"><td colspan="${n}">${text}</td></tr>`;

  return `
  <div class="lpj-print-area">
    <div class="lpj-header">
      <div class="lpj-eyebrow">Karang Taruna Inti</div>
      <h2>LAPORAN PERTANGGUNGJAWABAN (LPJ)</h2>
      <div class="lpj-sub">Kegiatan: ${esc(ev.nama)} — Tahun ${esc(String(ev.tahun))}</div>
      <div class="lpj-meta">Dicetak: ${fmtDate(todayISO())}</div>
    </div>

    <h3>1. Ringkasan Keuangan</h3>
    <table class="lpj-table">
      <tbody>
        <tr class="lpj-subtotal"><td>Total Pemasukan</td><td class="num">${fmtRp(b.pemasukan)}</td></tr>
        <tr><td class="indent">Iuran Anggota (${b.jumlahIuranLunas} lunas)</td><td class="num">${fmtRp(b.iuran)}</td></tr>
        <tr><td class="indent">Donatur (${b.jumlahDonatur} donasi)</td><td class="num">${fmtRp(b.donasi)}</td></tr>
        <tr><td class="indent">Transaksi Lain (${b.jumlahTransaksiLain})</td><td class="num">${fmtRp(b.transaksiLain)}</td></tr>
        <tr class="lpj-subtotal"><td>Total Pengeluaran</td><td class="num">${fmtRp(b.pengeluaran)}</td></tr>
        <tr><td class="indent">Operasional Kegiatan (${b.jumlahOperasional})</td><td class="num">${fmtRp(b.opsional)}</td></tr>
        <tr><td class="indent">Kebutuhan Lomba (${b.jumlahKebutuhanLomba})</td><td class="num">${fmtRp(b.kebutuhanLomba)}</td></tr>
        <tr><td class="indent">Hadiah Lomba (${b.jumlahItemHadiahLomba} item)</td><td class="num">${fmtRp(b.hadiahLomba)}</td></tr>
        <tr><td class="indent">Hadiah Jalan Santai (${b.jumlahHadiahJalan})</td><td class="num">${fmtRp(b.hadiahJalan)}</td></tr>
        <tr class="lpj-total"><td>Saldo Akhir</td><td class="num">${fmtRp(b.saldo)}</td></tr>
      </tbody>
    </table>

    <h3>2. Rincian Pemasukan</h3>
    <h4>2.1 Iuran Anggota</h4>
    <table class="lpj-table lpj-detail">
      <thead><tr><th>Kategori</th><th>Anggota</th><th>Lunas</th><th class="num">Total Terkumpul</th></tr></thead>
      <tbody>${kategoriRekap.map(r=>`<tr><td>${esc(r.label)}</td><td>${r.total}</td><td>${r.lunas}</td><td class="num">${fmtRp(r.nominal)}</td></tr>`).join('') || emptyRow(4,'Belum ada data anggota.')}</tbody>
    </table>

    <h4>2.2 Donatur</h4>
    <table class="lpj-table lpj-detail">
      <thead><tr><th>Tanggal</th><th>Nama</th><th>Keterangan</th><th class="num">Jumlah</th></tr></thead>
      <tbody>${donaturList.map(d=>`<tr><td>${fmtDate(d.tanggal)}</td><td>${esc(d.nama_donatur)}</td><td>${esc(d.keterangan||'-')}</td><td class="num">${fmtRp(d.jumlah)}</td></tr>`).join('') || emptyRow(4,'Belum ada donasi.')}</tbody>
    </table>

    <h4>2.3 Transaksi Lain</h4>
    <table class="lpj-table lpj-detail">
      <thead><tr><th>Tanggal</th><th>Nama</th><th>Keterangan</th><th class="num">Jumlah</th></tr></thead>
      <tbody>${transaksiList.map(t=>`<tr><td>${fmtDate(t.tanggal)}</td><td>${esc(t.jenis)}</td><td>${esc(t.keterangan||'-')}</td><td class="num">${fmtRp(t.jumlah)}</td></tr>`).join('') || emptyRow(4,'Belum ada transaksi.')}</tbody>
    </table>

    <h3>3. Rincian Pengeluaran</h3>
    <h4>3.1 Operasional Kegiatan</h4>
    <table class="lpj-table lpj-detail">
      <thead><tr><th>Tanggal</th><th>Nama</th><th>Catatan</th><th class="num">Jumlah</th></tr></thead>
      <tbody>${operasionalList.map(o=>`<tr><td>${fmtDate(o.tanggal)}</td><td>${esc(o.keterangan)}</td><td>${esc(o.catatan_bukti||'-')}</td><td class="num">${fmtRp(o.jumlah)}</td></tr>`).join('') || emptyRow(4,'Belum ada biaya operasional.')}</tbody>
    </table>

    <h4>3.2 Kebutuhan Lomba</h4>
    <table class="lpj-table lpj-detail lpj-kebutuhan-table">
      <thead><tr><th>Lomba</th><th>Nama Barang</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${kebutuhanRows.map(r=>`<tr><td>${esc(r.lomba)}</td><td>${esc(r.nama)}</td><td class="num">${r.qty}</td><td class="num">${fmtRp(r.harga)}</td><td class="num">${fmtRp(r.subtotal)}</td></tr>`).join('') || emptyRow(5,'Belum ada data kebutuhan lomba.')}</tbody>
    </table>

    <h4>3.3 Hadiah Lomba</h4>
    <table class="lpj-table lpj-detail lpj-hadiah-table">
      <thead><tr><th>Kategori</th><th>Juara</th><th>Nama Barang</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${hadiahRows.map(r=>`<tr><td>${esc(r.kategori)}</td><td>${esc(r.juara)}</td><td>${esc(r.nama)}</td><td class="num">${r.qty}</td><td class="num">${fmtRp(r.harga)}</td><td class="num">${fmtRp(r.subtotal)}</td></tr>`).join('') || emptyRow(6,'Belum ada data hadiah lomba.')}</tbody>
    </table>

    <h4>3.4 Hadiah Jalan Santai</h4>
    <table class="lpj-table lpj-detail lpj-jalan-santai-table">
      <thead><tr><th>Nama Barang</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${hadiahJalanList.map(h=>`<tr><td>${esc(h.nama_hadiah)}</td><td class="num">${h.qty}</td><td class="num">${fmtRp(h.harga_satuan)}</td><td class="num">${fmtRp(Number(h.harga_satuan||0)*Number(h.qty||0))}</td></tr>`).join('') || emptyRow(4,'Belum ada data hadiah jalan santai.')}</tbody>
    </table>

    <h3>4. Penutup</h3>
    <p class="lpj-penutup">Demikian Laporan Pertanggungjawaban kegiatan <strong>${esc(ev.nama)}</strong> ini kami susun berdasarkan data yang tercatat pada sistem, untuk dipergunakan sebagaimana mestinya.</p>
  </div>

  ${isLoggedIn ? `
  <div class="lpj-toolbar no-print">
    <button class="btn small" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button>
  </div>` : ''}`;
}


/* ============================================================
   PENGATURAN (Admin only)
   ============================================================ */
function renderPengaturan(){
  if (!isAdmin()) {
    return `<div class="empty-state"><h3>⛔ Akses Ditolak</h3><p>Halaman Pengaturan hanya untuk Admin.</p><button class="btn" onclick="goSection('dashboard')">Kembali ke Dashboard</button></div>`;
  }
  
  const s = getSettings();
  const telegram = getTelegramSettings();
  
  return `
  <div class="panel">
    <div class="panel-head"><h3>Tarif Iuran Anggota</h3></div>
    <div class="panel-body">
      <div class="field-row">
        <div class="field"><label>Sekolah (Rp)</label><input id="tarif-sekolah" class="currency-input" type="text" value="${formatCurrency(s.tarif.sekolah)}"></div>
        <div class="field"><label>Bekerja (Rp)</label><input id="tarif-bekerja" class="currency-input" type="text" value="${formatCurrency(s.tarif.bekerja)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Perantauan (Rp)</label><input id="tarif-perantauan" class="currency-input" type="text" value="${formatCurrency(s.tarif.perantauan)}"></div>
        <div class="field"><label style="color:var(--ungu);">Khusus</label>
          <div style="padding:10px 12px;background:var(--cream);border:1px solid var(--garis);border-radius:8px;font-size:13px;color:var(--ink-soft);">🔓 Nominal bebas — diisi manual per anggota saat ditambahkan</div>
          <div class="hint">Kategori khusus tidak punya tarif tetap, nominal iurannya diisi langsung saat menambah/mengedit anggota</div>
        </div>
      </div>
      <button class="btn" onclick="simpanTarif()">Simpan Tarif</button>
    </div>
  </div>
  
  <!-- TELEGRAM NOTIFICATION SETTINGS -->
  <div class="panel">
    <div class="panel-head"><h3>🤖 Telegram Notifikasi</h3></div>
    <div class="panel-body">
      <div class="field">
        <label>Bot Token</label>
        <input id="telegram-bot-token" type="text" value="${esc(telegram.botToken||'')}" placeholder="Masukkan token bot dari @BotFather">
        <div class="hint">Contoh: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz</div>
      </div>
      <div class="field">
        <label>Chat ID</label>
        <input id="telegram-chat-id" type="text" value="${esc(telegram.chatId||'')}" placeholder="Masukkan chat ID tujuan">
        <div class="hint">Bisa didapat dari @userinfobot atau @getidsbot</div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Status</label>
          <div class="status">
            <span class="dot ${telegram.enabled ? 'active' : 'inactive'}"></span>
            <span>${telegram.enabled ? '✅ Notifikasi Aktif' : '⛔ Notifikasi Nonaktif'}</span>
          </div>
        </div>
        <div class="field" style="display:flex; align-items:end; gap:8px;">
          <button class="btn ${telegram.enabled ? 'danger' : 'success'} small" onclick="toggleTelegram()" style="margin-bottom:0;">
            ${telegram.enabled ? '⛔ Nonaktifkan' : '✅ Aktifkan'}
          </button>
          <button class="btn telegram small" onclick="testTelegram()" style="margin-bottom:0;">📨 Test Kirim</button>
        </div>
      </div>
      <button class="btn telegram" onclick="simpanTelegram()">💾 Simpan Pengaturan Telegram</button>
    </div>
  </div>
  
  <!-- AKSES GUEST -->
  <div class="panel">
    <div class="panel-head"><h3>👁️ Akses Guest (Belum Login)</h3></div>
    <div class="panel-body">
      <div class="hint" style="margin-bottom:10px;">Pilih menu yang boleh dilihat pengunjung yang belum login. Menu yang tidak dicentang akan disembunyikan dari Guest dan langsung ditolak jika diakses.</div>
      <div class="guest-menu-list" style="display:flex;flex-direction:column;gap:8px;">
        ${SECTIONS.filter(s=>!s.adminOnly).map(s=>`
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--garis);border-radius:8px;">
            <input type="checkbox" class="guest-menu-check" data-key="${s.key}" ${isGuestVisible(s.key) ? 'checked' : ''}>
            <span>${icon(s.icon)}</span>
            <span>${esc(s.label)}</span>
          </label>`).join('')}
      </div>
      <button class="btn" style="margin-top:12px;" onclick="simpanGuestMenu()">💾 Simpan Akses Guest</button>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><h3>Manajemen Event</h3></div>
    <div class="panel-body flush">
      <table class="general-table"><thead><tr><th>Nama</th><th>Tahun</th><th></th></tr></thead>
      <tbody>${db.events.map(e=>`<tr><td>${esc(e.nama)}${e.id===db.activeEventId?' <span class="badge lunas">Aktif</span>':''}</td><td>${esc(e.tahun)}</td><td style="text-align:right;white-space:nowrap;">${e.id===db.activeEventId?'':`<button class="btn secondary small" onclick="setActiveEvent('${e.id}')">Aktifkan</button>`}<button class="icon-btn" onclick="openEventModal('${e.id}')" title="Ubah nama/tahun">✎</button><button class="icon-btn" onclick="hapusEvent('${e.id}')" title="Hapus event">🗑</button></td></tr>`).join('')||`<tr class="empty-row"><td colspan="3">Belum ada event.</td></tr>`}</tbody></table>
    </div>
    <div class="panel-body"><button class="btn gold" onclick="openEventModal()">+ Buat Event</button></div>
  </div>
  <div class="panel">
    <div class="panel-head"><h3>Cadangan Data</h3></div>
    <div class="panel-body">
      <div class="hint" style="margin-bottom:8px;">Backup penuh berisi SEMUA event sekaligus. Impor akan MENIMPA seluruh data.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn secondary" onclick="exportData()">⬇ Ekspor Semua Data</button>
        <label class="btn secondary" style="margin:0;">⬆ Impor (Timpa Semua)<input type="file" accept=".json" style="display:none;" onchange="importData(event)"></label>
      </div>
    </div>
    <div class="panel-body" style="border-top:1px solid var(--garis);">
      <div class="hint" style="margin-bottom:8px;">Backup khusus event aktif${activeEvent()?` (<b>${esc(activeEvent().nama)}</b>)`:''}. Aman untuk disimpan per-kegiatan; saat diimpor akan dibuat sebagai <b>event baru</b>, tidak menimpa data lain.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn secondary" onclick="exportDataEvent()" ${!activeEvent()?'disabled':''}>⬇ Ekspor Event Aktif</button>
        <label class="btn secondary" style="margin:0;${!activeEvent()?'opacity:.5;pointer-events:none;':''}">⬆ Impor sebagai Event Baru<input type="file" accept=".json" style="display:none;" onchange="importDataEvent(event)"></label>
      </div>
    </div>
  </div>`;
}

function simpanTarif(){
  if (!isAdmin()) { toast('⛔ Hanya Admin'); return; }
  const s = getSettings();
  s.tarif.sekolah = getCurrencyValue(document.getElementById('tarif-sekolah'));
  s.tarif.bekerja = getCurrencyValue(document.getElementById('tarif-bekerja'));
  s.tarif.perantauan = getCurrencyValue(document.getElementById('tarif-perantauan'));
  saveDB(); toast('Tarif iuran disimpan');
  notifyTelegram(`⚙️ Update tarif iuran`, `Sekolah: ${fmtRp(s.tarif.sekolah)}\nBekerja: ${fmtRp(s.tarif.bekerja)}\nPerantauan: ${fmtRp(s.tarif.perantauan)}\nKhusus: bebas (manual per anggota)`);
}

function simpanTelegram(){
  if (!isAdmin()) { toast('⛔ Hanya Admin'); return; }
  const botToken = document.getElementById('telegram-bot-token').value.trim();
  const chatId = document.getElementById('telegram-chat-id').value.trim();
  const settings = { botToken, chatId, enabled: db.telegram?.enabled || false };
  saveTelegramSettings(settings);
  toast('✅ Pengaturan Telegram disimpan');
  renderContent();
}

function simpanGuestMenu(){
  if (!isAdmin()) { toast('⛔ Hanya Admin'); return; }
  const checks = document.querySelectorAll('.guest-menu-check');
  const guestMenu = {};
  checks.forEach(c => { guestMenu[c.dataset.key] = c.checked; });
  db.guestMenu = guestMenu;
  saveDB();
  toast('✅ Akses Guest disimpan');
  renderSidebar();
}

function toggleTelegram(){
  if (!isAdmin()) { toast('⛔ Hanya Admin'); return; }
  const settings = getTelegramSettings();
  if(!settings.botToken || !settings.chatId){
    toast('⚠️ Isi Bot Token dan Chat ID terlebih dahulu');
    return;
  }
  settings.enabled = !settings.enabled;
  saveTelegramSettings(settings);
  toast(settings.enabled ? '✅ Notifikasi Telegram diaktifkan' : '⛔ Notifikasi Telegram dinonaktifkan');
  renderContent();
}

async function testTelegram(){
  if (!isAdmin()) { toast('⛔ Hanya Admin'); return; }
  const settings = getTelegramSettings();
  if(!settings.botToken || !settings.chatId){
    toast('⚠️ Isi Bot Token dan Chat ID terlebih dahulu');
    return;
  }
  if(!settings.enabled){
    if(!confirm('Notifikasi sedang nonaktif. Aktifkan sekarang?')) return;
    settings.enabled = true;
    saveTelegramSettings(settings);
  }
  await sendTelegramNotification(`🔔 <b>Test Notifikasi</b>\n\nHalo! Ini adalah pesan test dari Buku Keuangan Karang Taruna.\n\n✅ Notifikasi berhasil terkonfigurasi!\n\nWaktu: ${new Date().toLocaleString('id-ID')}`, true);
}

function setActiveEvent(id){ 
  if (!canEdit()) { toast('⛔ Login untuk mengelola event'); return; }
  db.activeEventId = id; 
  saveDB(); renderSidebar(); goSection(currentSection); 
  notifyTelegram(`📂 Buka event: ${db.events.find(e=>e.id===id)?.nama || id}`, '');
}

function hapusEvent(id){
  if (!isAdmin()) { toast('⛔ Hanya Admin'); return; }
  const e = db.events.find(x=>x.id===id); if(!e) return;
  if(!confirm(`Hapus event "${e.nama}" beserta semua data?`)) return;
  db.events = db.events.filter(x=>x.id!==id);
  delete db.settings[id];
  db.anggota = db.anggota.filter(x=>x.event_id!==id);
  db.donatur = db.donatur.filter(x=>x.event_id!==id);
  db.transaksiLain = db.transaksiLain.filter(x=>x.event_id!==id);
  db.operasional = db.operasional.filter(x=>x.event_id!==id);
  const lombaIds = db.lomba.filter(l=>l.event_id===id).map(l=>l.id);
  db.lombaKebutuhan = db.lombaKebutuhan.filter(k=>!lombaIds.includes(k.lomba_id));
  db.lombaHadiah = db.lombaHadiah.filter(lh=>!lombaIds.includes(lh.lomba_id));
  db.lomba = db.lomba.filter(l=>l.event_id!==id);
  db.hadiahKategori = db.hadiahKategori.filter(x=>x.event_id!==id);
  db.daftarBelanjaHadiah = db.daftarBelanjaHadiah.filter(x=>x.event_id!==id);
  db.daftarBelanjaPerlengkapan = db.daftarBelanjaPerlengkapan.filter(x=>x.event_id!==id);
  db.hadiahJalanSantai = db.hadiahJalanSantai.filter(x=>x.event_id!==id);
  db.daftarBelanjaJalanSantai = db.daftarBelanjaJalanSantai.filter(x=>x.event_id!==id);
  db.jadwal = db.jadwal.filter(x=>x.event_id!==id);
  if(db.activeEventId===id) db.activeEventId = db.events[0]?.id || null;
  saveDB(); renderSidebar(); goSection(db.activeEventId ? currentSection : 'dashboard');
  notifyTelegram(`🗑️ Hapus event: ${e.nama}`, '');
}

function exportData(){
  if (!canEdit()) { toast('⛔ Login untuk ekspor data'); return; }
  // Redaksi token Telegram — ini kredensial live, bukan "data", tidak perlu ikut ke file backup.
  const exportable = JSON.parse(JSON.stringify(db));
  if (exportable.telegram) exportable.telegram.botToken = '';
  const blob = new Blob([JSON.stringify(exportable, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `buku-keuangan-${todayISO()}.json`;
  a.click();
  toast('✅ Data diekspor (token Telegram tidak disertakan, atur ulang jika perlu)');
  notifyTelegram(`⬇️ Ekspor data`, `File: buku-keuangan-${todayISO()}.json`);
}

function importData(evt){
  if (!isAdmin()) { toast('⛔ Hanya Admin'); return; }
  const file = evt.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      if(!confirm('Impor akan MENIMPA data yang ada. Lanjutkan?')) return;
      db = Object.assign(defaultDB(), parsed);
      saveDB(); renderSidebar(); goSection('dashboard'); toast('Data diimpor');
      notifyTelegram(`⬆️ Impor data`, `File: ${file.name}\nUkuran: ${(file.size/1024).toFixed(1)} KB`);
    }catch(e){ toast('File tidak valid'); }
  };
  reader.readAsText(file);
}

/* ============================================================
   CADANGAN DATA PER EVENT AKTIF
   Ekspor hanya mengambil data yang event_id-nya = event aktif.
   Impor membuat EVENT BARU (id & seluruh id record di-generate ulang
   supaya tidak bentrok dengan data yang sudah ada), lalu diaktifkan.
   ============================================================ */
function exportDataEvent(){
  if (!canEdit()) { toast('⛔ Login untuk ekspor data'); return; }
  const ev = activeEvent();
  if(!ev){ toast('Tidak ada event aktif'); return; }
  const id = ev.id;
  const lombaIds = db.lomba.filter(x=>x.event_id===id).map(x=>x.id);

  const payload = {
    _type: 'kt-event-backup',
    _version: 1,
    exported_at: new Date().toISOString(),
    event: { nama: ev.nama, tahun: ev.tahun },
    settings: db.settings[id] ? { tarif: db.settings[id].tarif, hadiahBudget: db.settings[id].hadiahBudget || {} } : { tarif:{sekolah:0,bekerja:0,perantauan:0,khusus:0}, hadiahBudget:{} },
    anggota: db.anggota.filter(x=>x.event_id===id),
    donatur: db.donatur.filter(x=>x.event_id===id),
    transaksiLain: db.transaksiLain.filter(x=>x.event_id===id),
    operasional: db.operasional.filter(x=>x.event_id===id),
    lomba: db.lomba.filter(x=>x.event_id===id),
    lombaKebutuhan: db.lombaKebutuhan.filter(x=>lombaIds.includes(x.lomba_id)),
    lombaHadiah: db.lombaHadiah.filter(x=>lombaIds.includes(x.lomba_id)),
    hadiahKategori: db.hadiahKategori.filter(x=>x.event_id===id),
    daftarBelanjaHadiah: db.daftarBelanjaHadiah.filter(x=>x.event_id===id),
    daftarBelanjaPerlengkapan: db.daftarBelanjaPerlengkapan.filter(x=>x.event_id===id),
    hadiahJalanSantai: db.hadiahJalanSantai.filter(x=>x.event_id===id),
    daftarBelanjaJalanSantai: db.daftarBelanjaJalanSantai.filter(x=>x.event_id===id),
    jadwal: db.jadwal.filter(x=>x.event_id===id),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  const safeName = (ev.nama||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'event';
  a.href = URL.createObjectURL(blob);
  a.download = `backup-${safeName}-${todayISO()}.json`;
  a.click();
  toast(`✅ Data event "${ev.nama}" diekspor`);
  notifyTelegram(`⬇️ Ekspor data event`, `Event: ${ev.nama}\nFile: ${a.download}`);
}

function importDataEvent(evt){
  if (!canEdit()) { toast('⛔ Login untuk impor data'); return; }
  const file = evt.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed || parsed._type !== 'kt-event-backup' || !parsed.event){
        toast('File bukan backup event yang valid'); evt.target.value=''; return;
      }
      if(!confirm(`Impor akan membuat EVENT BARU "${parsed.event.nama}" berisi salinan data dari file backup ini. Data event lain tidak akan berubah. Lanjutkan?`)){
        evt.target.value=''; return;
      }

      const newEventId = uid();
      db.events.push({ id:newEventId, nama: parsed.event.nama || 'Event Impor', tahun: parsed.event.tahun || new Date().getFullYear(), created_at: new Date().toISOString() });
      db.settings[newEventId] = {
        tarif: (parsed.settings && parsed.settings.tarif) ? {...parsed.settings.tarif} : {sekolah:0,bekerja:0,perantauan:0,khusus:0},
        hadiahBudget: (parsed.settings && parsed.settings.hadiahBudget) ? JSON.parse(JSON.stringify(parsed.settings.hadiahBudget)) : {}
      };

      (parsed.anggota||[]).forEach(x=>{ db.anggota.push({...x, id:uid(), event_id:newEventId}); });
      (parsed.donatur||[]).forEach(x=>{ db.donatur.push({...x, id:uid(), event_id:newEventId}); });
      (parsed.transaksiLain||[]).forEach(x=>{ db.transaksiLain.push({...x, id:uid(), event_id:newEventId}); });
      (parsed.operasional||[]).forEach(x=>{ db.operasional.push({...x, id:uid(), event_id:newEventId}); });
      (parsed.jadwal||[]).forEach(x=>{ db.jadwal.push({...x, id:uid(), event_id:newEventId}); });

      const lombaIdMap = {};
      (parsed.lomba||[]).forEach(x=>{ const nid=uid(); lombaIdMap[x.id]=nid; db.lomba.push({...x, id:nid, event_id:newEventId}); });

      const kebutuhanIdMap = {};
      (parsed.lombaKebutuhan||[]).forEach(x=>{ const nid=uid(); kebutuhanIdMap[x.id]=nid; db.lombaKebutuhan.push({...x, id:nid, lomba_id: lombaIdMap[x.lomba_id] || x.lomba_id}); });

      const hadiahKategoriIdMap = {};
      (parsed.hadiahKategori||[]).forEach(x=>{ const nid=uid(); hadiahKategoriIdMap[x.id]=nid; db.hadiahKategori.push({...x, id:nid, event_id:newEventId}); });

      (parsed.lombaHadiah||[]).forEach(x=>{ db.lombaHadiah.push({...x, id:uid(),
        lomba_id: lombaIdMap[x.lomba_id] || x.lomba_id,
        hadiah_kategori_id: hadiahKategoriIdMap[x.hadiah_kategori_id] || x.hadiah_kategori_id }); });

      (parsed.daftarBelanjaHadiah||[]).forEach(x=>{ db.daftarBelanjaHadiah.push({...x, id:uid(), event_id:newEventId,
        hadiah_kategori_id: hadiahKategoriIdMap[x.hadiah_kategori_id] || x.hadiah_kategori_id }); });

      (parsed.daftarBelanjaPerlengkapan||[]).forEach(x=>{ db.daftarBelanjaPerlengkapan.push({...x, id:uid(), event_id:newEventId,
        kebutuhan_id: kebutuhanIdMap[x.kebutuhan_id] || x.kebutuhan_id }); });

      const hadiahJalanIdMap = {};
      (parsed.hadiahJalanSantai||[]).forEach(x=>{ const nid=uid(); hadiahJalanIdMap[x.id]=nid; db.hadiahJalanSantai.push({...x, id:nid, event_id:newEventId}); });

      (parsed.daftarBelanjaJalanSantai||[]).forEach(x=>{ db.daftarBelanjaJalanSantai.push({...x, id:uid(), event_id:newEventId,
        hadiah_jalan_id: hadiahJalanIdMap[x.hadiah_jalan_id] || x.hadiah_jalan_id }); });

      db.activeEventId = newEventId;
      saveDB(); renderSidebar(); goSection('dashboard');
      toast(`✅ Event "${parsed.event.nama}" berhasil diimpor & diaktifkan`);
      notifyTelegram(`⬆️ Impor data event`, `Event baru: ${parsed.event.nama}\nFile: ${file.name}\nUkuran: ${(file.size/1024).toFixed(1)} KB`);
    }catch(e){
      console.error(e);
      toast('File tidak valid');
    } finally {
      evt.target.value = '';
    }
  };
  reader.readAsText(file);
}

/* ============================================================
   EVENT MODAL
   ============================================================ */
function openEventModal(id){
  if (!canEdit()) { toast('⛔ Login untuk mengelola event'); return; }
  const editing = id ? db.events.find(e=>e.id===id) : null;
  setModal(editing?'Edit Event':'Buat Event', `
    <div class="field"><label>Nama Event</label><input id="f-nama" placeholder="HUT RI 82" value="${editing?esc(editing.nama):''}"></div>
    <div class="field"><label>Tahun</label><input id="f-tahun" type="number" value="${editing?esc(editing.tahun):new Date().getFullYear()}"></div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Buat', cls:'', onclick:()=>{
      const nama = document.getElementById('f-nama').value.trim();
      const tahun = document.getElementById('f-tahun').value.trim();
      if(!nama){ toast('Nama wajib'); return; }
      if(editing){
        const namaLama = editing.nama;
        editing.nama = nama; editing.tahun = tahun;
        saveDB(); closeModal(); renderSidebar(); renderContent(); toast('Event diperbarui');
        notifyTelegram(`✏️ Edit event: ${namaLama} → ${nama}`, `Tahun: ${tahun}`);
      } else {
        const newId = uid();
        db.events.push({id:newId, nama, tahun, created_at:new Date().toISOString()});
        db.settings[newId] = {tarif:{sekolah:0,bekerja:0,perantauan:0,khusus:0}, hadiahBudget:{}};
        db.activeEventId = newId;
        saveDB(); closeModal(); renderSidebar(); goSection('pengaturan'); toast('Event dibuat');
        notifyTelegram(`📂 Event baru: ${nama}`, `Tahun: ${tahun}`);
      }
    }}
  ]);
}

/* ============================================================
   MODAL / TOAST HELPERS
   ============================================================ */
function setModal(title, bodyHtml, buttons){
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-foot').innerHTML = '';
  const foot = document.getElementById('modal-foot');
  buttons.forEach(b=>{
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.cls||'');
    btn.textContent = b.label;
    btn.type = 'button';
    btn.onclick = b.onclick;
    foot.appendChild(btn);
  });
  document.getElementById('overlay').classList.add('show');
  
  // Setup currency inputs after modal body is rendered
  setTimeout(setupAllCurrencyInputs, 50);
}
function closeModal(){ document.getElementById('overlay').classList.remove('show'); }
document.getElementById('modal-close').onclick = closeModal;
document.getElementById('overlay').addEventListener('click', (e)=>{ if(e.target.id==='overlay') closeModal(); });

let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
}

/* ============================================================
   FUNGSI HITUNG BUKU UTAMA
   ============================================================ */
function hitungBukuUtama(){
  const anggotaLunas = gAnggota().filter(a=>a.status==='lunas');
  const iuran = anggotaLunas.reduce((s,a)=>s+Number(a.nominal_wajib||0),0);
  const donaturList = gDonatur();
  const donasi = donaturList.reduce((s,d)=>s+Number(d.jumlah||0),0);
  const transaksiLainList = gTransaksiLain();
  const transaksiLain = transaksiLainList.reduce((s,t)=>s+Number(t.jumlah||0),0);
  const pemasukan = iuran + donasi + transaksiLain;

  const operasionalList = gOperasional();
  const opsional = operasionalList.reduce((s,o)=>s+Number(o.jumlah||0),0);
  const lombaIds = gLomba().map(l=>l.id);
  const kebutuhanLombaList = db.lombaKebutuhan.filter(k=>lombaIds.includes(k.lomba_id));
  const kebutuhanLomba = kebutuhanLombaList
    .reduce((s,k)=> s + (Number(k.harga_realisasi ?? k.harga_estimasi ?? 0) * Number(k.qty||0)), 0);

  let hadiahLomba = 0; let jumlahItemHadiahLomba = 0;
  gHadiahKategori().forEach(h => {
    h.items.forEach(item => {
      hadiahLomba += Number(item.harga_satuan||0) * Number(item.qty_dibeli||0);
      jumlahItemHadiahLomba++;
    });
  });

  const hadiahJalanList = gHadiahJalanSantai();
  const hadiahJalan = hadiahJalanList.reduce((s,h) => s + (Number(h.harga_satuan||0) * Number(h.qty||0)), 0);

  const pengeluaran = opsional + kebutuhanLomba + hadiahLomba + hadiahJalan;
  return {
    iuran, donasi, transaksiLain, pemasukan, opsional, kebutuhanLomba, hadiahLomba, hadiahJalan, pengeluaran, saldo: pemasukan - pengeluaran,
    jumlahIuranLunas: anggotaLunas.length,
    jumlahDonatur: donaturList.length,
    jumlahTransaksiLain: transaksiLainList.length,
    jumlahOperasional: operasionalList.length,
    jumlahKebutuhanLomba: kebutuhanLombaList.length,
    jumlahItemHadiahLomba,
    jumlahHadiahJalan: hadiahJalanList.length,
  };
}

/* ============================================================
   HELPER FUNCTIONS
   ============================================================ */
function gAnggota(){ return db.anggota.filter(a=>a.event_id===eid()); }
function gDonatur(){ return db.donatur.filter(d=>d.event_id===eid()); }
function gTransaksiLain(){ return db.transaksiLain.filter(t=>t.event_id===eid()); }
function gOperasional(){ return db.operasional.filter(o=>o.event_id===eid()); }
function gLomba(){ return db.lomba.filter(l=>l.event_id===eid()); }
function gKebutuhan(lombaId){ return db.lombaKebutuhan.filter(k=>k.lomba_id===lombaId); }
function gHadiahKategori(){ return db.hadiahKategori.filter(h=>h.event_id===eid()); }
function gLombaHadiah(lombaId){ return db.lombaHadiah.filter(lh=>lh.lomba_id===lombaId); }
function gDaftarBelanjaHadiah(){ return db.daftarBelanjaHadiah.filter(b=>b.event_id===eid()); }
function gDaftarBelanjaPerlengkapan(){ return db.daftarBelanjaPerlengkapan.filter(b=>b.event_id===eid()); }
function gHadiahJalanSantai(){ return db.hadiahJalanSantai.filter(h=>h.event_id===eid()); }
function gDaftarBelanjaJalanSantai(){ return db.daftarBelanjaJalanSantai.filter(b=>b.event_id===eid()); }
function gJadwal(){ return db.jadwal.filter(j=>j.event_id===eid()); }

/* ============================================================
   INIT
   ============================================================ */
document.getElementById('event-select').addEventListener('change', (e)=>{ 
  if (canEdit()) setActiveEvent(e.target.value); 
  else toast('⛔ Login untuk mengubah event');
});
document.getElementById('btn-new-event').addEventListener('click', openEventModal);
document.getElementById('nav').addEventListener('click', (e)=>{
  const item = e.target.closest('[data-nav]');
  if(item) goSection(item.dataset.nav);
});
document.getElementById('menu-toggle').addEventListener('click', ()=>{
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-backdrop').classList.toggle('show');
});
document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('show');
}

(async function initApp(){
  toast('⏳ Mengunduh data dari pusat...');
  db = await loadDB();
  renderSidebar();
  renderTopbarSaldo();
  goSection('dashboard');
})();
