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
    panitiaSinoman: [],
    // Agenda Kegiatan — TIDAK terikat event sama sekali (beda dari
    // `jadwal` yang per event_id). Untuk agenda umum organisasi yang
    // tetap mau muncul sebagai reminder di Buku Kegiatan walau belum
    // ada event 17-an yang aktif/dibuat. Disimpan di tabel kt_agenda
    // (tanpa kolom event_id) — lihat supabase-agenda-migration.sql.
    agenda: [],
    // Kas Karang Taruna — buku kas umum organisasi, TIDAK terikat event
    // (sama seperti Agenda/Gudang/Dokumen). Setiap baris punya debit/kredit,
    // saldo dihitung berjalan (running balance) saat render, tidak disimpan
    // di DB. Disimpan di tabel kt_kas (lihat supabase-kas-migration.sql).
    kas: [],
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
    },
    // Draft Surat & Dokumen (Undangan, Proposal, Absensi) — TIDAK terikat
    // event, sama seperti Gudang. Disimpan satu set global di tabel
    // kt_dokumen_global (lihat supabase-dokumen-global-migration.sql),
    // bukan lagi per event_id di kt_settings.dokumen.
    dokumenGlobal: { undangan:{}, proposal:{}, absensi:{} }
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
  panitiaSinoman: 'kt_panitia_sinoman',
  agenda: 'kt_agenda',
  kas: 'kt_kas',
};

// Migrasi satu-kali: dulu status "dibeli" di daftarBelanjaHadiah dilacak pakai
// `item_index` (posisi item dalam array `items` milik satu paket hadiah). Itu rapuh
// karena kalau item dihapus/direorder, index bergeser dan status "dibeli" nyasar ke
// item lain. Sekarang tiap item hadiah punya `id` sendiri (lihat tambahItemHadiah,
// openHadiahModal, addItemRow). Fungsi ini menjalankan migrasi SEKALI saat load:
// untuk tiap item lama yang belum punya `id`, generate id baru, lalu cocokkan ke
// record daftarBelanjaHadiah yang match hadiah_kategori_id+item_index PADA SAAT INI
// (sebelum ada hapus/reorder lagi) dan tempelkan `item_id` itu ke record tsb supaya
// status "dibeli" yang sudah ada tidak hilang/salah sasaran. Item yang sudah punya
// id (dibuat setelah fitur ini ada) dilewati.
function migrasiItemIdHadiah(result){
  let changed = false;
  (result.hadiahKategori||[]).forEach(h=>{
    (h.items||[]).forEach((item, idx)=>{
      if(item.id) return;
      item.id = uid();
      changed = true;
      (result.daftarBelanjaHadiah||[]).forEach(b=>{
        if(b.hadiah_kategori_id===h.id && b.item_index===idx && !b.item_id){
          b.item_id = item.id;
        }
      });
    });
  });
  return changed;
}

async function loadDB(){
  const result = defaultDB();
  try{
    const entries = Object.entries(ARRAY_TABLE_MAP);
    const [arrayResults, settingsRes, telegramRes, usersRes, guestMenuRes, dokumenGlobalRes] = await Promise.all([
      Promise.all(entries.map(([, table]) => sb.from(table).select('*'))),
      sb.from('kt_settings').select('*'),
      sb.from('kt_telegram_settings').select('*').eq('id', 'main').maybeSingle(),
      sb.rpc('rpc_list_users'),
      sb.from('kt_guest_menu_settings').select('*').eq('id', 'main').maybeSingle(),
      sb.from('kt_dokumen_global').select('*').eq('id', 'main').maybeSingle(),
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
      (settingsRes.data || []).forEach(s => { result.settings[s.event_id] = { tarif: s.tarif, hadiahBudget: s.hadiah_budget || {}, dokumen: s.dokumen || {} }; });
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

    if(dokumenGlobalRes.error){ console.error('Gagal memuat kt_dokumen_global:', dokumenGlobalRes.error); }
    else if(dokumenGlobalRes.data && dokumenGlobalRes.data.dokumen){
      result.dokumenGlobal = {
        undangan: dokumenGlobalRes.data.dokumen.undangan || {},
        proposal: dokumenGlobalRes.data.dokumen.proposal || {},
        absensi: dokumenGlobalRes.data.dokumen.absensi || {},
      };
    }

    result.activeEventId = localStorage.getItem('kt_active_event') || (result.events[0] ? result.events[0].id : null);
  }catch(e){
    console.error('Gagal memuat data dari Supabase', e);
    toast('⚠️ Gagal terhubung ke Supabase. Cek konfigurasi & koneksi internet.');
  }
  if(migrasiItemIdHadiah(result)){
    // Ada item hadiah lama yang baru saja diberi `id` + record belanja yang baru
    // ditautkan via `item_id` — simpan sekarang juga supaya migrasi ini benar-benar
    // jalan sekali dan tidak hilang kalau user langsung hapus/reorder item sebelum
    // ada perubahan lain yang memicu saveDB().
    db = result;
    saveDB();
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
  const rows = Object.keys(db.settings).map(eventId => ({ event_id: eventId, tarif: db.settings[eventId].tarif, hadiah_budget: db.settings[eventId].hadiahBudget || {}, dokumen: db.settings[eventId].dokumen || {} }));
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

// Surat & Dokumen — satu set draft global, tidak terikat event_id (lihat
// catatan di defaultDB()). Disimpan di tabel kt_dokumen_global (1 baris, id='main').
async function syncDokumenGlobal(){
  const { error } = await sb.from('kt_dokumen_global').upsert({
    id: 'main',
    dokumen: db.dokumenGlobal || { undangan:{}, proposal:{}, absensi:{} },
  }, { onConflict: 'id' });
  if(error){ console.error('Gagal menyimpan kt_dokumen_global:', error); throw new Error(`Gagal menyimpan Surat & Dokumen: ${error.message}`); }
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
  // Perbaikan mandiri: dokumen Panitia/Sinoman yang sempat dibuat sebelum
  // fix tanggal-null bisa masih menyimpan tanggal:'' di memori. Kolom
  // `tanggal` di Supabase bertipe date, jadi '' harus jadi null dulu
  // sebelum dikirim, kalau tidak Postgres akan menolak (22007).
  db.panitiaSinoman.forEach(d => { if(d.tanggal === '') d.tanggal = null; });
  try{
    await Promise.all([
      ...Object.entries(ARRAY_TABLE_MAP).map(([key, table]) => syncArrayTable(table, db[key])),
      syncSettings(),
      syncTelegram(),
      syncGuestMenu(),
      syncDokumenGlobal(),
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
const GENDER_LIST = [
  {v:'pria', l:'Laki-Laki'},
  {v:'wanita', l:'Perempuan'},
  {v:'tidak_diketahui', l:'Tidak diketahui'},
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
  {key:'dashboard', label:'Buku Kegiatan', sub:'Rekap & Reminder', icon:'grid', adminOnly: false},
  {key:'anggota', label:'Iuran Anggota', sub:'Kelola iuran anggota', icon:'users', adminOnly: false},
  {key:'donatur', label:'Donatur', sub:'Sumbangan tunai dari donatur', icon:'heart', adminOnly: false},
  {key:'transaksi', label:'Transaksi Lain', sub:'Pemasukan di luar iuran & donasi', icon:'swap', adminOnly: false},
  {key:'operasional', label:'Operasional Kegiatan', sub:'Biaya operasional umum event', icon:'briefcase', adminOnly: false},
  {key:'lomba', label:'Lomba & Perlengkapan', sub:'Kebutuhan barang per lomba', icon:'flag', adminOnly: false},
  {key:'hadiah', label:'Kebutuhan Hadiah', sub:'Belanja hadiah per kategori peserta', icon:'gift', adminOnly: false},
  {key:'hadiah-jalan', label:'Hadiah Jalan Santai', sub:'Kelola hadiah jalan santai', icon:'walk', adminOnly: false},
  {key:'belanja-perlengkapan', label:'Belanja Perlengkapan', sub:'Daftar belanja perlengkapan lomba', icon:'package', adminOnly: false},
  {key:'belanja-jalan', label:'Belanja Jalan Santai', sub:'Daftar belanja hadiah jalan santai', icon:'shopping-bag', adminOnly: false},
  {key:'belanja-hadiah', label:'Belanja Hadiah', sub:'Daftar belanja hadiah lomba', icon:'shopping', adminOnly: false},
  {key:'lpj', label:'Laporan (LPJ)', sub:'Cetak laporan pertanggungjawaban', icon:'report', adminOnly: false},
  {key:'pengaturan', label:'Pengaturan', sub:'Tarif iuran & event', icon:'gear', adminOnly: true},
  {key:'database-anggota', label:'Database Anggota', sub:'Cek & filter semua anggota', icon:'database', adminOnly: false},
  {key:'users', label:'Manajemen User', sub:'Kelola akun pengguna', icon:'users', adminOnly: true},
  {key:'jadwal', label:'Jadwal & Reminder', sub:'Kelola jadwal dan pengingat', icon:'calendar', adminOnly: false},
  {key:'agenda', label:'Agenda Kegiatan', sub:'Agenda umum, tidak terikat event', icon:'calendar', adminOnly: true},
  {key:'gudang', label:'Gudang Aset', sub:'Inventaris & pinjam aset desa', icon:'package', adminOnly: false},
  {key:'dokumen', label:'Surat & Dokumen', sub:'Undangan, proposal & absensi', icon:'clipboard', adminOnly: false},
  {key:'kas', label:'Kas Karang Taruna', sub:'Buku kas umum organisasi, tidak terikat event', icon:'wallet', adminOnly: false},
];

// Menu yang tidak terikat event tertentu (datanya global, bukan per-event).
// Menu ini ditampilkan terpisah di atas, antara info login dan dropdown
// Kegiatan Aktif, supaya jelas tidak berubah walau event aktif diganti.
const GLOBAL_MENU_KEYS = ['kas', 'agenda', 'dokumen', 'database-anggota', 'gudang', 'users', 'pengaturan'];

/* ============================================================
   FITUR OPSIONAL PER EVENT
   Beberapa event (mis. sekadar iuran rutin) tidak butuh semua modul.
   Fitur di bawah ini bisa dimatikan per-event lewat modal Buat/Edit
   Event. Menu inti (Buku Kegiatan, Iuran, Database Anggota, LPJ,
   Pengaturan, Manajemen User) selalu aktif dan tidak bisa dimatikan.
   ============================================================ */
const FITUR_OPSIONAL = [
  {key:'donatur', label:'Donatur', menus:['donatur']},
  {key:'transaksi', label:'Transaksi Lain', menus:['transaksi']},
  {key:'operasional', label:'Operasional Kegiatan', menus:['operasional']},
  {key:'lomba', label:'Lomba & Perlengkapan', menus:['lomba','belanja-perlengkapan']},
  {key:'hadiah', label:'Hadiah Lomba', menus:['hadiah','belanja-hadiah']},
  {key:'jalan_santai', label:'Hadiah Jalan Santai', menus:['hadiah-jalan','belanja-jalan']},
  {key:'jadwal', label:'Jadwal & Reminder', menus:['jadwal']},
];
// Preset dipakai di modal event supaya tidak perlu centang satu-satu tiap bikin event baru.
// Catatan: "dokumen" (Surat & Dokumen) sengaja TIDAK ada di sini lagi — sejak
// menu ini berdiri sendiri seperti Gudang, tidak bisa dimatikan per event.
const FITUR_PRESET_SEDERHANA = {donatur:false, transaksi:false, operasional:false, lomba:false, hadiah:false, jalan_santai:false, jadwal:false};
const FITUR_PRESET_LENGKAP = {donatur:true, transaksi:true, operasional:true, lomba:true, hadiah:true, jalan_santai:true, jadwal:true};

// Default: fitur dianggap aktif kalau belum pernah diset (backward-compat utk event lama).
function eventFitur(ev){
  const f = (ev && ev.fitur) || {};
  const out = {};
  FITUR_OPSIONAL.forEach(x => out[x.key] = f[x.key] !== false);
  return out;
}
// Cek apakah sebuah menu/section aktif untuk event yang sedang dibuka.
// Menu yang tidak terdaftar di FITUR_OPSIONAL (menu inti) selalu true.
function isMenuAktif(menuKey){
  const ev = activeEvent();
  if (!ev) return true;
  const fitur = eventFitur(ev);
  const item = FITUR_OPSIONAL.find(x => x.menus.includes(menuKey));
  if (!item) return true;
  return !!fitur[item.key];
}
const ICONS = {
  grid:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" stroke-width="1.6" stroke="currentColor" fill="none" stroke-linejoin="round"/>',
  users:'<circle cx="8.5" cy="8" r="3" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M2.5 20c0-3.5 2.7-6 6-6s6 2.5 6 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="17" cy="8.5" r="2.4" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M15.5 13c2.6.3 4.5 2.3 4.9 5.3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  database:'<rect x="3" y="4" width="18" height="6" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 10v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 16v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/><circle cx="17" cy="7" r="1.2" fill="currentColor"/>',
  heart:'<path d="M12 20s-7.5-4.6-9.4-9.3C1.4 7.6 3 4.7 6.1 4.3c2-.3 3.6.8 5.9 3 2.3-2.2 3.9-3.3 5.9-3 3.1.4 4.7 3.3 3.5 6.4C19.5 15.4 12 20 12 20z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
  swap:'<path d="M4 8h14M14 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16H6M10 20l-4-4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  briefcase:'<rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 12h18" stroke="currentColor" stroke-width="1.6"/>',
  flag:'<path d="M5 3v18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 4c3-1.4 4.7.4 7.5-.9C15 2 17 2.3 19 3.3v9c-2-1-4-1.3-6.5 0-2.8 1.3-4.5-.5-7.5.9V4z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  gift:'<polyline points="20 12 20 22 4 22 4 12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><rect x="2" y="7" width="20" height="5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><line x1="12" y1="22" x2="12" y2="7" stroke="currentColor" stroke-width="1.6"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  gear:'<path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  shopping:'<path d="M6 6h12l2 12H4L6 6z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><circle cx="9" cy="20" r="1.5" fill="currentColor"/><circle cx="15" cy="20" r="1.5" fill="currentColor"/><path d="M9 12h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  package:'<rect x="3" y="5" width="18" height="14" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 5v14M16 5v14M3 10h18" stroke="currentColor" stroke-width="1.6"/>',
  walk:'<ellipse cx="8.5" cy="9" rx="2" ry="3" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="6.6" cy="4.3" r="0.9" fill="currentColor"/><circle cx="8.5" cy="3.6" r="0.9" fill="currentColor"/><circle cx="10.4" cy="4.3" r="0.9" fill="currentColor"/><ellipse cx="15.5" cy="16" rx="2" ry="3" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="13.6" cy="11.3" r="0.9" fill="currentColor"/><circle cx="15.5" cy="10.6" r="0.9" fill="currentColor"/><circle cx="17.4" cy="11.3" r="0.9" fill="currentColor"/>',
  'shopping-bag':'<rect x="5" y="8" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 6c0-2.2 1.8-4 4-4s4 1.8 4 4v2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.6"/><path d="M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/><circle cx="16" cy="14" r="1.2" fill="currentColor"/><circle cx="8" cy="14" r="1.2" fill="currentColor"/>',
  pen:'<path d="M4 20l1-4L15 6l4 4L9 20l-4 1z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M13 8l3 3" stroke="currentColor" stroke-width="1.6"/>',
  pot:'<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2 8h3M19 8h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  food:'<path d="M7 2v8M5 2v5a2 2 0 0 0 2 2 2 2 0 0 0 2-2V2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M17 2c-1.5 0-2.5 1.6-2.5 4s1 4 2.5 4v12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  bath:'<path d="M12 3c3 4 5 6.6 5 9.5A5 5 0 0 1 7 12.5C7 9.6 9 7 12 3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  tag:'<path d="M12 3h6a2 2 0 0 1 2 2v6L11 20l-8-8L12 3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><circle cx="16" cy="7" r="1.3" fill="currentColor"/>',
  report:'<path d="M6 3h9l3 3v15H6V3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M15 3v3h3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M9 12h6M9 15h6M9 9h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  clipboard:'<rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="8.5" y="2.5" width="7" height="3.5" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  wallet:'<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3H5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H4a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><circle cx="16.5" cy="14" r="1.4" fill="currentColor"/>'
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
  const navGlobal = document.getElementById('nav-global');
  const isPetugasUser = user && user.role === 'petugas';
  const visibleSections = SECTIONS
    .filter(s => !s.adminOnly || isAdminUser)
    .filter(s => isMenuAktif(s.key))
    .filter(s => {
      if (!isLoggedIn) return isGuestVisible(s.key);
      if (isPetugasUser) return s.key === 'dashboard' || userSections().includes(s.key);
      return true;
    });

  const renderNavItem = s => `
    <div class="nav-item ${s.key===currentSection?'active':''} ${!isLoggedIn && !s.adminOnly ? '' : ''}" data-nav="${s.key}">
      ${icon(s.icon)} <span>${s.label}</span>
      ${s.adminOnly && !isAdminUser ? `<span class="lock-icon">🔒</span>` : ''}
    </div>`;

  navGlobal.innerHTML = visibleSections
    .filter(s => GLOBAL_MENU_KEYS.includes(s.key))
    .sort((a, b) => GLOBAL_MENU_KEYS.indexOf(a.key) - GLOBAL_MENU_KEYS.indexOf(b.key))
    .map(renderNavItem).join('');
  nav.innerHTML = visibleSections.filter(s => !GLOBAL_MENU_KEYS.includes(s.key)).map(renderNavItem).join('');

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
  if (section && !isMenuAktif(key)) {
    toast('⛔ Fitur ini tidak diaktifkan untuk event ini');
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
  
  // Menu yang tidak terikat event tetap bisa diakses walau belum ada
  // event 17-an yang dibuat/dipilih. Dashboard ikut dimasukkan supaya
  // Agenda Kegiatan (yang juga tidak terikat event) tetap tampil sebagai
  // reminder di layar utama walau organisasi belum punya event sama sekali.
  const EVENTLESS_SECTIONS = ['gudang', 'dokumen', 'agenda', 'kas', 'dashboard'];
  if(!activeEvent() && !EVENTLESS_SECTIONS.includes(currentSection)){
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

  // Check if current section's feature is turned off for this event
  if (section && !isMenuAktif(currentSection)) {
    el.innerHTML = `<div class="empty-state"><h3>Fitur tidak aktif</h3><p>Fitur ini dimatikan untuk event "${esc(activeEvent().nama)}". Aktifkan lagi lewat tombol ✎ di daftar event pada halaman Pengaturan kalau dibutuhkan.</p><button class="btn" onclick="goSection('dashboard')">Kembali ke Dashboard</button></div>`;
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
    case 'agenda': el.innerHTML = renderAgenda(); break;
    case 'gudang': el.innerHTML = renderGudang(); break;
    case 'dokumen': el.innerHTML = renderDokumen(); break;
    case 'kas': el.innerHTML = renderKas(); break;
    case 'lpj': el.innerHTML = renderLPJ(); break;
    case 'pengaturan': el.innerHTML = renderPengaturan(); break;
    case 'users': el.innerHTML = renderUsers(); break;
    default: el.innerHTML = renderDashboard();
  }
  
  // Setup currency inputs after content rendered
  setTimeout(setupAllCurrencyInputs, 50);

  if (currentSection === 'lpj' || currentSection === 'dokumen') {
    requestAnimationFrame(applyLpjMobileScale);
  }

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
  const guestBlocked = !getCurrentUser() && !isGuestVisible(item.key);
  return `<div class="stat-card buku-card ${isOpen?'open':''}" onclick="toggleBukuCard('${item.key}')" style="cursor:pointer;">
    <div class="lbl" style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
      <span>${item.label}</span><span style="font-size:10px;color:var(--ink-soft);">${isOpen?'▲':'▼'}</span>
    </div>
    <div class="val">${fmtRp(item.value)}</div>
    ${isOpen ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--garis);font-size:12.5px;color:var(--ink-soft);" onclick="event.stopPropagation();">
      <div style="margin-bottom:8px;">${item.info}</div>
      ${guestBlocked
        ? `<button class="btn secondary small" disabled title="Hanya bisa dilihat setelah login">🔒 Lihat Selengkapnya</button>`
        : `<button class="btn secondary small" onclick="goSection('${item.key}')">Lihat Selengkapnya →</button>`}
    </div>` : ''}
  </div>`;
}

function renderDashboard(){
  const b = hitungBukuUtama();
  const pemasukanItems = [
    {key:'anggota', label:'Total Iuran', value:b.iuran, info:`${b.jumlahIuranLunas} anggota sudah lunas`},
    {key:'donatur', label:'Total Donasi', value:b.donasi, info:`${b.jumlahDonatur} donatur tercatat`},
    {key:'transaksi', label:'Total Transaksi Lain', value:b.transaksiLain, info:`${b.jumlahTransaksiLain} transaksi tercatat`},
  ].filter(item => isMenuAktif(item.key));
  const pengeluaranItems = [
    {key:'operasional', label:'Total Operasional Kegiatan', value:b.opsional, info:`${b.jumlahOperasional} biaya tercatat`},
    {key:'lomba', label:'Total Belanja Kebutuhan Lomba', value:b.kebutuhanLomba, info:`${b.jumlahKebutuhanLomba} item kebutuhan lomba`},
    {key:'hadiah', label:'Total Hadiah Lomba', value:b.hadiahLomba, info:`${b.jumlahItemHadiahLomba} item hadiah lomba`},
    {key:'hadiah-jalan', label:'Total Hadiah Jalan Santai', value:b.hadiahJalan, info:`${b.jumlahHadiahJalan} item hadiah jalan santai`},
  ].filter(item => isMenuAktif(item.key));

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

  // Agenda Kegiatan — tidak terikat event, jadi selalu dicek terlepas
  // dari ada/tidaknya event aktif.
  const agendaList = gAgenda().filter(a => a.status !== 'selesai');
  const upcomingAgenda = agendaList.filter(a => {
    const aDate = new Date(a.tanggal + 'T00:00:00');
    const diffDays = Math.ceil((aDate - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));

  if (upcomingAgenda.length > 0) {
    const todayAgenda = upcomingAgenda.filter(a => {
      const aDate = new Date(a.tanggal + 'T00:00:00');
      return aDate.toDateString() === today.toDateString();
    });
    const soonAgenda = upcomingAgenda.filter(a => {
      const aDate = new Date(a.tanggal + 'T00:00:00');
      return aDate.toDateString() !== today.toDateString();
    });

    let items = [];
    if (todayAgenda.length > 0) {
      items.push({label: '📌 Hari ini:', value: todayAgenda.map(a => `${a.judul} (${labelKategoriJadwal(a.kategori)})`).join(', ')});
    }
    if (soonAgenda.length > 0) {
      const soonText = soonAgenda.map(a => {
        const aDate = new Date(a.tanggal + 'T00:00:00');
        const diffDays = Math.ceil((aDate - today) / (1000 * 60 * 60 * 24));
        const dayLabel = diffDays === 1 ? 'Besok' : `${diffDays} hari lagi`;
        return `${a.judul} (${dayLabel})`;
      }).join(', ');
      items.push({label: '📅 Mendatang:', value: soonText});
    }

    reminders.push({
      type: 'info',
      icon: '📌',
      title: 'Agenda Kegiatan',
      count: upcomingAgenda.length,
      items: items,
      action: {label: 'Lihat Semua →', link: 'agenda'}
    });
  }

  const jadwalList = isMenuAktif('jadwal') ? gJadwal().filter(j => j.status !== 'selesai') : [];
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
  if (isMenuAktif('hadiah')) gHadiahKategori().forEach(h => {
    h.items.forEach((item) => {
      if (Number(item.qty_dibeli||0) <= 0) return;
      const belanja = db.daftarBelanjaHadiah.find(b => b.hadiah_kategori_id === h.id && b.item_id === item.id && b.event_id === eid());
      if (!belanja || belanja.status !== 'dibeli') {
        hadiahItems.push({nama: item.nama, qty: item.qty_dibeli, kategori: labelPeserta(h.kategori_peserta)});
      }
    });
  });

  const perlengkapanItems = [];
  if (isMenuAktif('lomba')) gLomba().forEach(l => {
    gKebutuhan(l.id).forEach(k => {
      const belanja = db.daftarBelanjaPerlengkapan.find(b => b.kebutuhan_id === k.id && b.event_id === eid());
      if (!belanja || belanja.status !== 'dibeli') {
        perlengkapanItems.push({nama: k.nama_item, qty: k.qty, lomba: l.nama});
      }
    });
  });

  const jalanItems = isMenuAktif('jalan_santai') ? gHadiahJalanSantai().filter(h => {
    const belanja = db.daftarBelanjaJalanSantai.find(b => b.hadiah_jalan_id === h.id && b.event_id === eid());
    return !belanja || belanja.status !== 'dibeli';
  }) : [];

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
              <span class="value ${item.valueClass || ''}">${esc(item.value)}</span>
            </div>
          `).join('')}
        </div>
        ${r.action ? `
        <div class="card-footer">
          ${(!getCurrentUser() && !isGuestVisible(r.action.link))
            ? `<button class="btn secondary small" disabled title="Hanya bisa dilihat setelah login">🔒 ${r.action.label.replace(/\s*→\s*$/, '')}</button>`
            : `<button class="btn ${r.type === 'danger' ? 'danger' : r.type === 'warning' ? 'orange' : r.type === 'success' ? 'success' : 'secondary'} small" onclick="goSection('${r.action.link}')">${r.action.label}</button>`}
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

/* RT belum tentu terisi untuk data lama (a.rt kosong/undefined). Dropdown-nya
   otomatis menampilkan opsi pertama (RT 1) sebagai default visual browser,
   tapi itu cuma tampilan — datanya sendiri tetap kosong kalau tidak dibaca
   lewat helper ini. Dulu filter/sort/CSV membaca a.rt langsung sehingga baris
   yang "kelihatan" RT 1 tidak ikut ketemu saat difilter/disortir per RT 1.
   getRT() menyamakan nilai yang dipakai untuk tampilan dan untuk pencarian. */
function getRT(a){ return (a && a.rt) || RT_LIST[0].v; }

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
function labelGender(v){ return v==='pria' ? 'Laki-Laki' : v==='wanita' ? 'Perempuan' : 'Tidak diketahui'; }

/* Jenis kelamin sekarang adalah data asli (a.gender) yang bisa dikoreksi manual.
   Untuk data lama yang belum pernah dikoreksi (a.gender belum ada), gunakan
   tebakan otomatis dari nama sebagai fallback tampilan saja. */
function getGender(a){
  if(a && a.gender) return a.gender;
  return guessGender(a && a.nama) || 'tidak_diketahui';
}

function openAnggotaModal(id){
  if (!canEditSection('anggota')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.anggota.find(a=>a.id===id) : null;
  const s = getSettings();
  setModal(editing?'Edit Anggota':'Tambah Anggota', `
    <div class="field"><label>Nama Anggota</label><input id="f-nama" value="${editing?esc(editing.nama):''}" placeholder="Nama lengkap" oninput="autoGuessGenderFromNama()"></div>
    <div class="field"><label>Kategori</label>
      <select id="f-kategori" onchange="updateNominalPreview()">
        ${KATEGORI_ANGGOTA.map(k=>`<option value="${k.v}" ${editing&&editing.kategori===k.v?'selected':''}>${k.l}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>RT</label>
      <select id="f-rt">
        ${RT_LIST.map(r=>`<option value="${r.v}" ${editing&&getRT(editing)===r.v?'selected':''}>${r.l}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Jenis Kelamin</label>
      <select id="f-gender" onchange="this.dataset.userEdited='1'">
        ${GENDER_LIST.map(g=>`<option value="${g.v}" ${getGender(editing||{nama:''})===g.v?'selected':''}>${g.l}</option>`).join('')}
      </select>
      <div class="hint">Terisi otomatis dari nama, tapi bisa dikoreksi kapan saja.</div>
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
      const gender = document.getElementById('f-gender').value;
      if(!nama){ toast('Nama anggota wajib diisi'); return; }
      const nominal = kategori==='khusus' ? getCurrencyValue(document.getElementById('f-nominal')) : (getSettings().tarif[kategori] || 0);
      if(kategori==='khusus' && (!nominal || nominal<=0)){ toast('Isi nominal iuran untuk kategori khusus'); return; }
      let actionMsg = '';
      if(editing){
        actionMsg = `✏️ Edit anggota: ${editing.nama} → ${nama}`;
        editing.nama = nama; editing.kategori = kategori; editing.rt = rt; editing.gender = gender; editing.nominal_wajib = nominal;
      } else {
        actionMsg = `➕ Tambah anggota: ${nama} (${labelKategori(kategori)})`;
        db.anggota.push({id:uid(), event_id:eid(), nama, kategori, rt, gender, nominal_wajib:nominal, status:'belum_lunas', tanggal_bayar:null});
      }
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast('Data anggota disimpan');
      notifyTelegram(actionMsg, `Nama: ${nama}\nKategori: ${labelKategori(kategori)}\nRT: ${labelRT(rt)}\nJenis Kelamin: ${labelGender(gender)}\nNominal: ${fmtRp(nominal)}`);
    }}
  ]);
  setTimeout(updateNominalPreview, 0);
}
function autoGuessGenderFromNama(){
  const genderEl = document.getElementById('f-gender');
  const namaEl = document.getElementById('f-nama');
  if(!genderEl || !namaEl) return;
  if(genderEl.dataset.userEdited==='1') return; // jangan timpa koreksi manual
  genderEl.value = guessGender(namaEl.value) || 'tidak_diketahui';
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
function updateAnggotaField(id, field, value){
  if (!canEditSection('anggota')) { toast('⛔ Login untuk mengedit data'); renderContent(); return; }
  const a = db.anggota.find(x=>x.id===id); if(!a) return;
  if(field==='rt'){
    a.rt = value;
    saveDB(); renderContent();
    toast(`RT ${a.nama} diubah ke ${labelRT(value)}`);
  } else if(field==='gender'){
    a.gender = value;
    saveDB(); renderContent();
    toast(`Jenis kelamin ${a.nama} diubah ke ${labelGender(value)}`);
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
  if (filterGender !== 'semua') filtered = filtered.filter(a => getGender(a) === filterGender);
  if (filterRT !== 'semua') filtered = filtered.filter(a => getRT(a) === filterRT);
  if (searchQuery.trim()) { const q = searchQuery.toLowerCase().trim(); filtered = filtered.filter(a => a.nama.toLowerCase().includes(q)); }
  
  filtered.sort((a,b) => {
    let valA, valB;
    switch(sortBy){
      case 'nama': valA = a.nama; valB = b.nama; break;
      case 'kategori': valA = a.kategori; valB = b.kategori; break;
      case 'rt': valA = getRT(a); valB = getRT(b); break;
      case 'gender': valA = labelGender(getGender(a)); valB = labelGender(getGender(b)); break;
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

  const statKategori = {};
  KATEGORI_ANGGOTA.forEach(k => {
    const items = filtered.filter(a=>a.kategori===k.v);
    statKategori[k.v] = {label: k.l, total: items.length, lunas: items.filter(a=>a.status==='lunas').length, nominal: items.reduce((s,a)=>s+Number(a.nominal_wajib||0),0), terkumpul: items.filter(a=>a.status==='lunas').reduce((s,a)=>s+Number(a.nominal_wajib||0),0)};
  });

  const statRT = {};
  RT_LIST.forEach(r => {
    const items = filtered.filter(a=>getRT(a)===r.v);
    statRT[r.v] = {label: r.l, total: items.length, lunas: items.filter(a=>a.status==='lunas').length, nominal: items.reduce((s,a)=>s+Number(a.nominal_wajib||0),0), terkumpul: items.filter(a=>a.status==='lunas').reduce((s,a)=>s+Number(a.nominal_wajib||0),0)};
  });

  const statGender = {};
  [{v:'pria', l:'Laki-Laki'}, {v:'wanita', l:'Perempuan'}].forEach(g => {
    const items = filtered.filter(a=>getGender(a)===g.v);
    statGender[g.v] = {label: g.l, total: items.length, lunas: items.filter(a=>a.status==='lunas').length, nominal: items.reduce((s,a)=>s+Number(a.nominal_wajib||0),0), terkumpul: items.filter(a=>a.status==='lunas').reduce((s,a)=>s+Number(a.nominal_wajib||0),0)};
  });

  const rows = filtered.map(a=>`<tr class="${a.status==='belum_lunas'?'belum-bayar':''}">
    <td>${esc(a.nama)}</td>
    <td><span class="kategori-pill ${a.kategori==='khusus'?'khusus':''}">${labelKategori(a.kategori)}</span></td>
    <td><select class="inline-edit-select" onchange="updateAnggotaField('${a.id}','rt',this.value)" ${!isLoggedIn?'disabled':''}>
      ${RT_LIST.map(r=>`<option value="${r.v}" ${getRT(a)===r.v?'selected':''}>${r.l}</option>`).join('')}
    </select></td>
    <td><select class="inline-edit-select" onchange="updateAnggotaField('${a.id}','gender',this.value)" ${!isLoggedIn?'disabled':''}>
      ${GENDER_LIST.map(g=>`<option value="${g.v}" ${getGender(a)===g.v?'selected':''}>${g.l}</option>`).join('')}
    </select></td>
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
    <div class="stat-card warning"><div class="lbl">Tunggakan</div><div class="val">${fmtRp(totalNominal - totalTerkumpul)}</div></div></div>`;

  const renderCountCard = (key, s) => {
    const belum = s.total - s.lunas;
    const pct = s.nominal > 0 ? Math.round((s.terkumpul / s.nominal) * 100) : 0;
    return `
    <div class="kategori-card k-${key}">
      <div class="kc-title">${s.label}</div>
      <div class="kc-stats">
        <div class="kc-stat"><span class="n">${s.total}</span><span class="l">Anggota</span></div>
        <div class="kc-stat lunas"><span class="n">${s.lunas}</span><span class="l">Lunas</span></div>
        <div class="kc-stat belum"><span class="n">${belum}</span><span class="l">Belum</span></div>
      </div>
      <div class="kc-progress">
        <div class="kc-progress-bar"><div class="kc-progress-fill" style="width:${pct}%;"></div></div>
        <div class="kc-money"><span>Terkumpul <b>${fmtRp(s.terkumpul)}</b></span><span>dari <b>${fmtRp(s.nominal)}</b></span></div>
      </div>
    </div>`;
  };

  const statKategoriHtml = Object.entries(statKategori).map(([kv, k]) => renderCountCard(kv, k)).join('');
  const statRTHtml = Object.entries(statRT).map(([rv, r]) => renderCountCard(rv, r)).join('');
  const statGenderHtml = Object.entries(statGender).map(([gv, g]) => renderCountCard(gv, g)).join('');

  const filterHtml = `<div class="filter-row">
    <div class="field" style="margin-bottom:0;min-width:150px;"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Kategori</label>
      <select id="filter-kategori" onchange="applyFilter()"><option value="semua" ${filterKategori==='semua'?'selected':''}>Semua</option>${KATEGORI_ANGGOTA.map(k=>`<option value="${k.v}" ${filterKategori===k.v?'selected':''}>${k.l}</option>`).join('')}</select></div>
    <div class="field" style="margin-bottom:0;min-width:150px;"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Status</label>
      <select id="filter-status" onchange="applyFilter()"><option value="semua" ${filterStatus==='semua'?'selected':''}>Semua</option><option value="lunas" ${filterStatus==='lunas'?'selected':''}>Lunas</option><option value="belum_lunas" ${filterStatus==='belum_lunas'?'selected':''}>Belum Bayar</option></select></div>
    <div class="field" style="margin-bottom:0;min-width:150px;"><label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Jenis Kelamin</label>
      <select id="filter-gender" onchange="applyFilter()"><option value="semua" ${filterGender==='semua'?'selected':''}>Semua</option><option value="pria" ${filterGender==='pria'?'selected':''}>Laki-Laki</option><option value="wanita" ${filterGender==='wanita'?'selected':''}>Perempuan</option><option value="tidak_diketahui" ${filterGender==='tidak_diketahui'?'selected':''}>Tidak diketahui</option></select></div>
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
    ${(statRTHtml||statGenderHtml)?`<div class="stat-section-label">Jumlah Anggota per RT &amp; Jenis Kelamin</div><div class="kategori-grid" style="margin-bottom:16px;">${statRTHtml}${statGenderHtml}</div>`:''}
    <div style="overflow-x:auto;"><table class="database-table"><thead><tr><th class="sortable" onclick="sortTable('nama')">Nama ${sortIndicator('nama')}</th>
      <th class="sortable" onclick="sortTable('kategori')">Kategori ${sortIndicator('kategori')}</th>
      <th class="sortable" onclick="sortTable('rt')">RT ${sortIndicator('rt')}</th>
      <th class="sortable" onclick="sortTable('gender')">Jenis Kelamin ${sortIndicator('gender')}</th>
      <th class="num sortable" onclick="sortTable('nominal')">Nominal ${sortIndicator('nominal')}</th>
      <th class="sortable" onclick="sortTable('status')">Status ${sortIndicator('status')}</th>
      <th class="sortable" onclick="sortTable('tanggal')">Tgl Bayar ${sortIndicator('tanggal')}</th><th></th></tr></thead>
      <tbody>${rows||`<tr class="empty-row"><td colspan="8">${searchQuery?'Tidak ditemukan':'Belum ada anggota'}</td></tr>`}</tbody>
      ${filtered.length>0?`<tfoot><tr><td colspan="4">Total ${filtered.length} anggota</td><td class="num">${fmtRp(totalNominal)}</td><td colspan="3"></td></tr></tfoot>`:''}</table></div></div></div>`;
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
function exportAnggotaCSV(){ const list=gAnggota(); if(list.length===0){ toast('Tidak ada data'); return; } let csv='No,Nama,Kategori,RT,Jenis Kelamin,Nominal,Status,Tanggal Bayar\n'; list.forEach((a,i)=>{const status=a.status==='lunas'?'Lunas':'Belum Bayar'; const tgl=a.tanggal_bayar?fmtDate(a.tanggal_bayar):'-'; csv+=`${i+1},"${a.nama}",${labelKategori(a.kategori)},${labelRT(getRT(a))},${labelGender(getGender(a))},${a.nominal_wajib},${status},${tgl}\n`;}); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`database-anggota-${todayISO()}.csv`; link.click(); toast('CSV berhasil diekspor'); }

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

  // Card anggaran per kategori peserta — bandingkan harga PAKET (bukan akumulasi total
  // belanja) dengan budget per paket yang sudah diatur lewat tombol "Atur Budget".
  // Ini sengaja tidak dikalikan jumlah kebutuhan paket, karena budget memang dipatok
  // per satu paket/pemenang, bukan untuk seluruh kebutuhan lomba di kategori itu.
  const budgetKategoriCards = KATEGORI_PESERTA.map(kp => {
    const rincianJuara = JUARA_LIST.map(j => {
      const budgetPerPaket = getHadiahBudget(kp.v, j.v);
      if(budgetPerPaket<=0) return null;
      // Normalnya cuma ada 1 paket per kombinasi kategori+juara, tapi sistem tetap
      // mengizinkan lebih dari 1 (dengan konfirmasi peringatan saat dibuat). Kalau
      // itu terjadi, jumlahkan SEMUA paket yang cocok (bukan cuma yang pertama
      // ketemu) dan kalikan budget acuan dengan jumlah paketnya juga, supaya
      // perbandingan tetap adil (mis. 2 paket @ budget 100rb = acuan 200rb).
      const hs = list.filter(x => x.kategori_peserta === kp.v && x.juara_ke === j.v);
      const totalPerPaket = hs.reduce((s,h)=> s + h.items.reduce((s2,item)=> s2 + (Number(item.harga_satuan||0) * Math.max(1,Number(item.qty_per_paket||1))), 0), 0);
      const budgetAcuan = budgetPerPaket * Math.max(1, hs.length);
      return {label: j.l, budgetPerPaket: budgetAcuan, totalPerPaket};
    }).filter(Boolean);
    if(!rincianJuara.length) return '';
    const budgetTotal = rincianJuara.reduce((s,r)=>s+r.budgetPerPaket,0);
    const paketTotal = rincianJuara.reduce((s,r)=>s+r.totalPerPaket,0);
    const adaLebih = rincianJuara.some(r => r.totalPerPaket > r.budgetPerPaket);
    const pct = budgetTotal>0 ? Math.min(100, Math.round((paketTotal / budgetTotal) * 100)) : 0;
    const rincianHtml = rincianJuara.map(r => {
      const lebih = r.totalPerPaket > r.budgetPerPaket;
      return `<div style="display:flex;justify-content:space-between;gap:6px;font-size:11px;color:${lebih?'var(--merah)':'var(--ink-soft)'};"><span>${r.label}</span><span>${fmtRp(r.totalPerPaket)} / ${fmtRp(r.budgetPerPaket)}${lebih?' ⚠️':''}</span></div>`;
    }).join('');
    return `<div class="kategori-card k-${kp.v}">
      <div class="kc-title">${kp.l}</div>
      <div class="kc-progress">
        <div class="kc-progress-bar"><div class="kc-progress-fill" style="width:${pct}%;${adaLebih?'background:var(--merah);':''}"></div></div>
        <div class="kc-money"><span>Harga paket <b>${fmtRp(paketTotal)}</b></span><span>dari <b>${fmtRp(budgetTotal)}</b></span></div>
      </div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:3px;">${rincianHtml}</div>
    </div>`;
  }).join('');

  return `<div class="stat-grid">
    <div class="stat-card pengeluaran"><div class="lbl">Total Belanja Hadiah</div><div class="val">${fmtRp(total)}</div></div>
    ${totalBudget>0 ? `<div class="stat-card ${total>totalBudget?'defisit':'saldo'}"><div class="lbl">Total Budget Hadiah</div><div class="val">${fmtRp(totalBudget)}</div><div style="font-size:11px; color:var(--abu); margin-top:4px;">${total>totalBudget?`⚠️ Sudah lebih ${fmtRp(total-totalBudget)}`:`Sisa ${fmtRp(totalBudget-total)}`}</div></div>` : ''}
  </div>
  ${budgetKategoriCards ? `<div class="panel"><div class="panel-head"><div><h3>Anggaran Hadiah per Kategori</h3><div class="desc">Harga 1 paket dibandingkan budget per paket (bukan akumulasi total belanja), dirinci per juara</div></div></div>
  <div class="panel-body"><div class="kategori-grid">${budgetKategoriCards}</div></div></div>` : ''}
  <div class="panel"><div class="panel-head"><div><h3>Kebutuhan Hadiah</h3><div class="desc">Setiap paket bisa berisi multiple item · Kebutuhan Juara 1-3 mengikuti jumlah lomba per kategori</div></div>
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
  const itemsHtml = editing ? editing.items.map((item, idx) => { if(!item.id) item.id = uid(); return `<div class="item-fields-row" data-item-id="${item.id}" style="border-bottom:1px solid var(--garis);padding-bottom:10px;margin-bottom:10px;"><div class="field"><label>Nama</label><input type="text" id="edit-item-name-${idx}" value="${esc(item.nama)}" placeholder="Nama hadiah" onblur="autofillHargaHadiah(this)"></div><div class="field"><label>Harga</label><input type="text" id="edit-item-price-${idx}" class="currency-input" value="${formatCurrency(item.harga_satuan)}" placeholder="Harga"></div><div class="field"><label>Qty/paket</label><input type="number" id="edit-item-perpaket-${idx}" value="${item.qty_per_paket||1}" min="1" placeholder="Qty/paket" title="Berapa pcs per 1 paket juara"></div><button class="btn danger-text small" onclick="removeItemRow(${idx})">✕</button></div>`; }).join('') : '';
  setModal(editing?'Edit Paket':'Tambah Paket', `<div class="field-row"><div class="field"><label>Kategori</label><select id="f-kp">${KATEGORI_PESERTA.map(k=>`<option value="${k.v}" ${editing&&editing.kategori_peserta===k.v?'selected':''}>${k.l}</option>`).join('')}</select></div><div class="field"><label>Juara</label><select id="f-juara">${JUARA_LIST.map(j=>`<option value="${j.v}" ${editing&&editing.juara_ke===j.v?'selected':''}>${j.l}</option>`).join('')}</select></div></div><div class="field"><label>Item Hadiah</label><div class="hint" style="margin-bottom:10px;">Isi "Qty/paket" saja (mis. 2 pulpen per paket). Paket ini otomatis berlaku untuk SEMUA lomba dengan kategori & juara yang sama. Total qty yang harus dibeli otomatis dihitung dari jumlah lomba sekarang, dan otomatis naik lagi kalau kamu menambah lomba baru di kategori ini.</div><div id="items-container">${itemsHtml}</div><button class="btn secondary small" onclick="addItemRow()" type="button">+ Tambah Item</button></div>`, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const kategori_peserta=document.getElementById('f-kp').value; const juara_ke=document.getElementById('f-juara').value;
      if(!editing && gHadiahKategori().some(h=>h.kategori_peserta===kategori_peserta && h.juara_ke===juara_ke)){
        if(!confirm(`Paket untuk ${labelPeserta(kategori_peserta)} - ${labelJuara(juara_ke)} sudah ada. Satu kategori+juara idealnya cukup 1 paket (isinya bisa lebih dari 1 item). Tetap buat paket baru (terpisah)?`)) return;
      }
      const kebutuhan=hitungKebutuhanHadiah(kategori_peserta, juara_ke); const existingItems=editing?(editing.items||[]):[]; const items=[]; const container=document.getElementById('items-container'); const rows=container.querySelectorAll('.item-fields-row'); rows.forEach((row)=>{const nameInput=row.querySelector(`input[id^="edit-item-name-"]`); const priceInput=row.querySelector(`input[id^="edit-item-price-"]`); const perPaketInput=row.querySelector(`input[id^="edit-item-perpaket-"]`); if(nameInput&&priceInput){const nama=nameInput.value.trim(); const harga_satuan=getCurrencyValue(priceInput); const qty_per_paket=Math.max(1,Number((perPaketInput&&perPaketInput.value)||1)); if(!nama) return;
        // Cocokkan baris form dengan item lama via data-item-id (BUKAN index urutan baris),
        // karena urutan bisa berubah (item dihapus/ditambah di tengah). Baris hasil render
        // item lama selalu punya data-item-id (lihat itemsHtml di atas). Baris baru dari
        // addItemRow() sengaja TIDAK diberi data-item-id -> dataset.itemId undefined ->
        // dianggap item baru, id barunya baru di-generate di sini (uid()).
        const existingId = row.dataset.itemId || null;
        const matched = existingId ? existingItems.find(x=>x.id===existingId) : null;
        const qty_dibeli = matched ? Number(matched.qty_dibeli||0) : (kebutuhan!=null ? kebutuhan*qty_per_paket : qty_per_paket);
        const qty_terpakai = matched ? (matched.qty_terpakai||0) : 0;
        const id = matched ? matched.id : uid();
        items.push({id,nama,harga_satuan,qty_dibeli,qty_per_paket,qty_terpakai});}}); if(items.length===0){toast('Minimal 1 item');return;}
      let actionMsg = editing ? `✏️ Edit paket hadiah ${labelPeserta(kategori_peserta)} - ${labelJuara(juara_ke)}` : `➕ Paket hadiah baru ${labelPeserta(kategori_peserta)} - ${labelJuara(juara_ke)}`;
      if(editing){ Object.assign(editing,{kategori_peserta,juara_ke,items});}
      else{ db.hadiahKategori.push({id:uid(),event_id:eid(),kategori_peserta,juara_ke,items}); }
      const currentHadiahId = editing ? editing.id : db.hadiahKategori[db.hadiahKategori.length-1].id;
      openHadiahGroups.add(currentHadiahId);
      let totalSama = 0;
      items.forEach((it)=>{ totalSama += samakanHargaItemSejenis(it.nama, it.harga_satuan, it.id); });
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast(totalSama>0?`Disimpan, harga disamakan ke ${totalSama} item lain`:'Disimpan');
      const detail = items.map(i => `${i.nama} (${i.qty_dibeli} × ${fmtRp(i.harga_satuan)})`).join('\n');
      notifyTelegram(actionMsg, detail);
    }}
  ]);
  if(editing) openHadiahGroups.add(id);
  setTimeout(setupAllCurrencyInputs, 50);
}
function addItemRow(){ const container=document.getElementById('items-container'); if(!container) return; const idx=Math.floor(Math.random()*10000); const row=document.createElement('div'); row.className='item-fields-row'; /* sengaja TIDAK diberi data-item-id: baris baru = item baru, id di-generate saat submit */ row.style.cssText='border-bottom:1px solid var(--garis);padding-bottom:10px;margin-bottom:10px;'; row.innerHTML=`<div class="field"><label>Nama</label><input type="text" id="edit-item-name-${idx}" placeholder="Nama hadiah" onblur="autofillHargaHadiah(this)"></div><div class="field"><label>Harga</label><input type="text" id="edit-item-price-${idx}" class="currency-input" placeholder="Harga"></div><div class="field"><label>Qty/paket</label><input type="number" id="edit-item-perpaket-${idx}" placeholder="Qty/paket" value="1" min="1" title="Berapa pcs per 1 paket juara"></div><button class="btn danger-text small" onclick="removeItemRow(this.closest('.item-fields-row'))">✕</button>`; container.appendChild(row);
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
// terisi otomatis. excludeItemId dipakai supaya item yang baru saja diedit
// manual tidak dihitung ulang sebagai "item lain yang ikut disamakan". Exclude
// by item.id (bukan hadiahId+idx) karena id tidak berubah walau urutan/array
// bergeser, sedangkan index bisa nyasar ke item lain kalau ada penghapusan
// atau reorder di antaranya.
function samakanHargaItemSejenis(nama, harga, excludeItemId){
  const key = String(nama||'').trim().toLowerCase();
  if(!key || !(Number(harga) > 0)) return 0;
  let count = 0;
  gHadiahKategori().forEach(h=>{
    (h.items||[]).forEach(it=>{
      if(it.id===excludeItemId) return;
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
  const samaCount = samakanHargaItemSejenis(item.nama, item.harga_satuan, item.id);
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
  const h=db.hadiahKategori.find(x=>x.id===hadiahId); if(!h) return; const nama=document.getElementById(`add-item-name-${hadiahId}`).value.trim(); const harga=getCurrencyValue(document.getElementById(`add-item-price-${hadiahId}`)); const perPaketEl=document.getElementById(`add-item-perpaket-${hadiahId}`); const qtyPerPaket=Math.max(1,Number((perPaketEl&&perPaketEl.value)||1)); if(!nama){toast('Nama wajib diisi');return;} const qty = (kebutuhan!=null&&kebutuhan!=='null') ? Number(kebutuhan)*qtyPerPaket : qtyPerPaket; const newItem = {id:uid(),nama,harga_satuan:harga,qty_dibeli:qty,qty_per_paket:qtyPerPaket}; h.items.push(newItem);
  const samaCount = samakanHargaItemSejenis(nama, harga, newItem.id);
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
  daftar.forEach(b => { const key = `${b.hadiah_kategori_id}_${b.item_id}`; statusMap[key] = b; });

  const items = [];
  semuaHadiah.forEach(h => {
    h.items.forEach((item, idx) => {
      if (Number(item.qty_dibeli||0) <= 0) return;
      const key = `${h.id}_${item.id}`;
      const belanja = statusMap[key] || null;
      const status = belanja ? belanja.status : 'belum_dibeli';
      const tanggalBeli = belanja ? belanja.tanggal_beli : null;
      items.push({...h, itemIndex: idx, itemId: item.id, itemNama: item.nama, itemHarga: item.harga_satuan, itemQtyDibeli: item.qty_dibeli, isi_per_pack: item.isi_per_pack||1, status, tanggalBeli, sudahDibeli: status==='dibeli', key});
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

  if(!items.length) return `<div class="belanja-hadiah-page"><div class="panel"><div class="panel-head"><h3>🎁 Belanja Hadiah</h3></div><div class="panel-body"><div class="empty-state"><h3>Belum ada hadiah</h3>${isLoggedIn ? `<button class="btn" onclick="goSection('hadiah')">+ Tambah Hadiah</button>` : ''}</div></div></div></div>`;

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
    window._belanjaHadiahGroups[gi] = {nama: g.nama, refs: list.map(i=>({hadiahId:i.id, itemId:i.itemId}))};

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
        <div class="nama"><span class="nama-text">${esc(g.nama)}</span><span class="qty-total">(Total: ${totalQty} pcs)</span></div>
        <div class="detail">${packTagHtml}${tagHtml}${semuaDibeli&&tglTerbaru?`<span>✓ Dibeli: ${fmtDate(tglTerbaru)}</span>`:(belum.length && belum.length<list.length ? `<span style="color:var(--orange);">Sebagian belum (${belum.length}/${list.length})</span>` : '')}</div>
      </div>
      <div class="harga" style="display:flex; align-items:center; gap:4px;">
        <span>${fmtRp(totalHarga)}</span>
        <button class="btn-small-icon" title="Update harga & kemasan" onclick="event.stopPropagation(); ${isLoggedIn ? `editHargaBelanjaHadiahGroup(${gi})` : `toast('⛔ Login untuk mengedit')`}" ${!isLoggedIn ? 'disabled' : ''}>${icon('pen')}</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="belanja-hadiah-page"><div class="stat-grid"><div class="stat-card belanja-hadiah"><div class="lbl">Total Item</div><div class="val">${totalItem}</div></div><div class="stat-card pemasukan"><div class="lbl">Belum Dibeli</div><div class="val">${totalBelum}</div></div><div class="stat-card saldo"><div class="lbl">Estimasi Total</div><div class="val">${fmtRp(totalEstimasi)}</div></div></div>
  <div class="panel"><div class="panel-head"><div><h3>🎁 Daftar Belanja Hadiah</h3><div class="desc">Belum dibeli: <strong>${fmtRp(totalBelumEstimasi)}</strong></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn success small" onclick="tandaiSemuaBelanjaHadiah()" ${!isLoggedIn ? 'disabled' : ''}>✓ Semua Dibeli</button>
      <button class="btn secondary small" onclick="resetSemuaBelanjaHadiah()" ${!isLoggedIn ? 'disabled' : ''}>↺ Reset</button>
    </div></div>
  <div class="panel-body">${groups}</div></div></div>`;
}

function toggleBelanjaHadiah(hadiahId, itemId){
  if (!canEditSection('belanja-hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const h = db.hadiahKategori.find(x=>x.id===hadiahId);
  const item = h && h.items.find(it=>it.id===itemId);
  if(!item) { toast('Item tidak ditemukan'); return; }
  let existing = db.daftarBelanjaHadiah.find(b => b.hadiah_kategori_id === hadiahId && b.item_id === itemId && b.event_id === eid());
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
    db.daftarBelanjaHadiah.push({id:uid(), event_id:eid(), hadiah_kategori_id:hadiahId, item_id:itemId, status:'dibeli', tanggal_beli:todayISO()});
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
    const existing = db.daftarBelanjaHadiah.find(b=>b.hadiah_kategori_id===r.hadiahId && b.item_id===r.itemId && b.event_id===eid());
    return existing && existing.status === 'dibeli';
  });
  const newStatus = semuaDibeli ? 'belum_dibeli' : 'dibeli';
  const tgl = newStatus === 'dibeli' ? todayISO() : null;
  const detail = [];
  group.refs.forEach(r => {
    const h = db.hadiahKategori.find(x=>x.id===r.hadiahId);
    if(!h || !h.items.find(it=>it.id===r.itemId)) return;
    let existing = db.daftarBelanjaHadiah.find(b=>b.hadiah_kategori_id===r.hadiahId && b.item_id===r.itemId && b.event_id===eid());
    if(existing){ existing.status = newStatus; existing.tanggal_beli = tgl; }
    else { db.daftarBelanjaHadiah.push({id:uid(), event_id:eid(), hadiah_kategori_id:r.hadiahId, item_id:r.itemId, status:newStatus, tanggal_beli:tgl}); }
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
  const firstItem = firstH ? firstH.items.find(it=>it.id===firstRef.itemId) : null;
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
    const item = h && h.items.find(it=>it.id===r.itemId);
    if(item){
      item.harga_satuan = hargaSatuanBaru;
      item.isi_per_pack = isiPerPack;
      totalQty += Number(item.qty_dibeli||0);
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
  hadiahList.forEach(h=>{h.items.forEach((item)=>{if(Number(item.qty_dibeli||0)<=0)return; const existing=db.daftarBelanjaHadiah.find(b=>b.hadiah_kategori_id===h.id&&b.item_id===item.id&&b.event_id===eid()); if(!existing||existing.status!=='dibeli'){if(existing){existing.status='dibeli';existing.tanggal_beli=todayISO();}else{db.daftarBelanjaHadiah.push({id:uid(),event_id:eid(),hadiah_kategori_id:h.id,item_id:item.id,status:'dibeli',tanggal_beli:todayISO()});}count++;detail.push(`${item.nama} (${labelPeserta(h.kategori_peserta)})`);}});}); 
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
  const samaCount = samakanHargaItemSejenis(item.nama, item.harga_satuan, item.id);
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
  
  if(!items.length) return `<div class="panel"><div class="panel-head"><h3>📦 Belanja Perlengkapan</h3></div><div class="panel-body"><div class="empty-state"><h3>Belum ada perlengkapan</h3>${isLoggedIn ? `<button class="btn" onclick="goSection('lomba')">+ Tambah Kebutuhan</button>` : ''}</div></div></div>`;

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
   AGENDA KEGIATAN
   Sama seperti Jadwal & Reminder, tapi TIDAK terikat event sama
   sekali (tidak ada event_id) — untuk agenda umum organisasi yang
   tetap harus muncul jadi reminder di Buku Kegiatan walau belum ada
   event 17-an yang dibuat/aktif. Lihat gAgenda()/generateReminders().
   ============================================================ */
function gAgenda(){ return db.agenda; }

function renderAgenda(){
  const list = gAgenda().slice().sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
  const isLoggedIn = !!getCurrentUser();

  const today = new Date();
  const rows = list.map(a => {
    const aDate = new Date(a.tanggal + 'T00:00:00');
    const diffDays = Math.ceil((aDate - today) / (1000 * 60 * 60 * 24));
    let statusLabel = '';
    let statusClass = '';
    if (a.status === 'selesai') {
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
    <tr class="${a.status === 'selesai' ? '' : (diffDays < 0 ? 'belum-bayar' : '')}">
      <td data-label="Tanggal">${fmtDate(a.tanggal)}</td>
      <td data-label="Status"><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td data-label="Kategori"><span class="kategori-pill">${labelKategoriJadwal(a.kategori)}</span></td>
      <td data-label="Judul">${esc(a.judul)}</td>
      <td data-label="Deskripsi">${esc(a.deskripsi||'-')}</td>
      <td data-label="Aksi" class="jadwal-actions" style="text-align:right; white-space:nowrap;">
        <button class="btn secondary small" onclick="toggleAgendaStatus('${a.id}')" ${!isLoggedIn ? 'disabled' : ''}>${a.status === 'selesai' ? 'Buka' : 'Selesai'}</button>
        <button class="icon-btn" onclick="openAgendaModal('${a.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Edit">✎</button>
        <button class="icon-btn" onclick="hapusAgenda('${a.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Hapus">🗑</button>
      </td>
    </tr>`;
  }).join('');

  const total = list.length;
  const totalSelesai = list.filter(a => a.status === 'selesai').length;
  const totalActive = total - totalSelesai;
  const totalHariIni = list.filter(a => {
    const aDate = new Date(a.tanggal + 'T00:00:00');
    return aDate.toDateString() === today.toDateString() && a.status !== 'selesai';
  }).length;

  return `
  <div class="stat-grid">
    <div class="stat-card info"><div class="lbl">Total Agenda</div><div class="val">${total}</div></div>
    <div class="stat-card pemasukan"><div class="lbl">Aktif</div><div class="val">${totalActive}</div></div>
    <div class="stat-card warning"><div class="lbl">Hari Ini</div><div class="val">${totalHariIni}</div></div>
    <div class="stat-card"><div class="lbl">Selesai</div><div class="val">${totalSelesai}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <div><h3>📌 Agenda Kegiatan</h3>
        <div class="desc">Agenda umum organisasi — tidak terikat event 17-an tertentu</div>
      </div>
      ${isLoggedIn ? `<button class="btn" onclick="openAgendaModal()">+ Tambah Agenda</button>` : ''}
    </div>
    <div class="panel-body flush">
      <table class="general-table jadwal-table">
        <thead><tr><th>Tanggal</th><th>Status</th><th>Kategori</th><th>Judul</th><th>Deskripsi</th><th></th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="6">Belum ada agenda. ${isLoggedIn ? 'Tambahkan agenda untuk mendapatkan pengingat.' : 'Login untuk menambah agenda.'}</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

function openAgendaModal(id){
  if (!canEditSection('agenda')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.agenda.find(a=>a.id===id) : null;
  setModal(editing?'Edit Agenda':'Tambah Agenda', `
    <div class="field"><label>Judul</label><input id="f-agenda-judul" value="${editing?esc(editing.judul):''}" placeholder="mis. Rapat Rutin Bulanan"></div>
    <div class="field-row">
      <div class="field"><label>Tanggal</label><input id="f-agenda-tanggal" type="date" value="${editing?editing.tanggal:todayISO()}"></div>
      <div class="field"><label>Kategori</label>
        <select id="f-agenda-kategori">${KATEGORI_JADWAL.map(k=>`<option value="${k.v}" ${editing&&editing.kategori===k.v?'selected':''}>${k.l}</option>`).join('')}</select>
      </div>
    </div>
    <div class="field"><label>Deskripsi (opsional)</label>
      <textarea id="f-agenda-deskripsi" rows="3" placeholder="Detail agenda...">${editing?esc(editing.deskripsi||''):''}</textarea>
    </div>
    <div class="field"><label>Status</label>
      <select id="f-agenda-status">
        <option value="aktif" ${editing&&editing.status==='aktif'?'selected':''}>Aktif</option>
        <option value="selesai" ${editing&&editing.status==='selesai'?'selected':''}>Selesai</option>
      </select>
    </div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const judul = document.getElementById('f-agenda-judul').value.trim();
      const tanggal = document.getElementById('f-agenda-tanggal').value;
      const kategori = document.getElementById('f-agenda-kategori').value;
      const deskripsi = document.getElementById('f-agenda-deskripsi').value.trim();
      const status = document.getElementById('f-agenda-status').value;
      if(!judul || !tanggal){ toast('Judul & tanggal wajib diisi'); return; }
      let actionMsg = editing ? `✏️ Edit agenda: ${editing.judul} → ${judul}` : `➕ Agenda baru: ${judul}`;
      if(editing){ Object.assign(editing, {judul, tanggal, kategori, deskripsi, status}); }
      else{ db.agenda.push({id:uid(), judul, tanggal, kategori, deskripsi, status}); }
      saveDB(); closeModal(); renderContent(); toast('Agenda disimpan');
      notifyTelegram(actionMsg, `Tanggal: ${fmtDate(tanggal)}\nKategori: ${labelKategoriJadwal(kategori)}\nDeskripsi: ${deskripsi || '-'}`);
    }}
  ]);
}

function toggleAgendaStatus(id){
  if (!canEditSection('agenda')) { toast('⛔ Login untuk mengedit data'); return; }
  const a = db.agenda.find(x=>x.id===id);
  if(!a) return;
  a.status = a.status === 'selesai' ? 'aktif' : 'selesai';
  saveDB(); renderContent();
  const action = a.status === 'selesai' ? '✅ Selesai' : '↩️ Dibuka kembali';
  toast(`Agenda "${a.judul}" ${a.status === 'selesai' ? 'selesai' : 'diaktifkan kembali'}`);
  notifyTelegram(`${action}: ${a.judul}`, `Tanggal: ${fmtDate(a.tanggal)}`);
}

function hapusAgenda(id){
  if (!canEditSection('agenda')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus agenda ini?')) return;
  const a = db.agenda.find(x=>x.id===id);
  db.agenda = db.agenda.filter(x=>x.id!==id);
  saveDB(); renderContent(); toast('Agenda dihapus');
  if(a) notifyTelegram(`🗑️ Hapus agenda: ${a.judul}`, `Tanggal: ${fmtDate(a.tanggal)}`);
}

/* ============================================================
   KAS KARANG TARUNA
   Buku kas umum organisasi — TIDAK terikat event 17-an tertentu,
   sama seperti Agenda/Gudang/Dokumen. Semua orang (termasuk guest)
   bisa melihat, tapi hanya role yang diizinkan (Admin, User, atau
   Petugas yang ditugaskan ke bidang "Kas Karang Taruna" lewat
   Manajemen User) yang bisa menambah/mengedit/menghapus baris.
   Saldo dihitung berjalan (running balance) saat render:
   saldo = saldo sebelumnya + debit - kredit.
   ============================================================ */
function gKas(){ return db.kas; }

function renderKas(){
  const list = gKas().slice().sort((a,b) => (a.tanggal||'').localeCompare(b.tanggal||'') || (a.created_at||'').localeCompare(b.created_at||''));
  const canKelola = canEditSection('kas');
  const totalDebit = list.reduce((s,k)=>s+Number(k.debit||0),0);
  const totalKredit = list.reduce((s,k)=>s+Number(k.kredit||0),0);

  // Hitung saldo berjalan urut kronologis (lama -> baru) dulu,
  // baru ditampilkan terbalik (baru -> lama) supaya transaksi
  // terakhir tetap muncul paling atas tapi saldo tetap benar.
  let saldo = 0;
  const withSaldo = list.map(k => {
    saldo += Number(k.debit||0) - Number(k.kredit||0);
    return {...k, _saldo: saldo};
  });
  const displayList = withSaldo.slice().reverse();

  const rows = displayList.map((k, idx) => `
    <tr>
      <td data-label="No">${idx + 1}</td>
      <td data-label="Tanggal">${fmtDateShort(k.tanggal)}</td>
      <td data-label="Keterangan">${esc(k.keterangan||'-')}</td>
      <td data-label="Debit" class="num">${Number(k.debit||0)>0 ? fmtRp(k.debit) : '-'}</td>
      <td data-label="Kredit" class="num">${Number(k.kredit||0)>0 ? fmtRp(k.kredit) : '-'}</td>
      <td data-label="Saldo" class="num">${fmtRp(k._saldo)}</td>
      ${canKelola ? `<td class="kas-actions" style="text-align:right;white-space:nowrap;">
        <button class="icon-btn" onclick="openKasModal('${k.id}')" title="Edit">✎</button>
        <button class="icon-btn" onclick="hapusKas('${k.id}')" title="Hapus">🗑</button>
      </td>` : ''}
    </tr>`).join('');

  // Kartu khusus HP — bukan tabel yang "dipaksa" jadi kartu, tapi layout
  // sendiri (tanggal + aksi di atas, keterangan tebal, lalu satu baris
  // jumlah bertanda +/- dengan saldo di sampingnya) supaya ringkas dan
  // tidak ada teks yang kepotong/wrap aneh seperti sebelumnya.
  const cards = displayList.map(k => {
    const isMasuk = Number(k.debit||0) > 0;
    const jumlah = isMasuk ? k.debit : k.kredit;
    return `
    <div class="kas-card">
      <div class="kas-card-top">
        <span class="kas-card-date">${fmtDateShort(k.tanggal)}</span>
        ${canKelola ? `<span class="kas-card-actions">
          <button class="icon-btn" onclick="openKasModal('${k.id}')" title="Edit">✎</button>
          <button class="icon-btn" onclick="hapusKas('${k.id}')" title="Hapus">🗑</button>
        </span>` : ''}
      </div>
      <div class="kas-card-ket">${esc(k.keterangan||'-')}</div>
      <div class="kas-card-bottom">
        <span class="kas-card-jumlah ${isMasuk?'pemasukan':'pengeluaran'}">${isMasuk?'+':'−'} ${fmtRp(jumlah)}</span>
        <span class="kas-card-saldo">Saldo ${fmtRp(k._saldo)}</span>
      </div>
    </div>`;
  }).join('');

  const empty = `<div class="empty-state" style="padding:28px;"><p>Belum ada transaksi kas. ${canKelola ? '' : 'Hanya role tertentu yang bisa menambah transaksi.'}</p></div>`;

  return `
  <div class="stat-grid">
    <div class="stat-card pemasukan"><div class="lbl">Total Debit</div><div class="val">${fmtRp(totalDebit)}</div></div>
    <div class="stat-card pengeluaran"><div class="lbl">Total Kredit</div><div class="val">${fmtRp(totalKredit)}</div></div>
    <div class="stat-card ${saldo<0?'defisit':'saldo'}"><div class="lbl">Saldo Kas</div><div class="val">${fmtRp(saldo)}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <div><h3>💰 Kas Karang Taruna</h3>
        <div class="desc">Buku kas umum organisasi — tidak terikat event tertentu</div>
      </div>
      ${canKelola ? `<button class="btn" onclick="openKasModal()">+ Tambah Transaksi</button>` : ''}
    </div>
    <div class="panel-body flush kas-table-wrap">
      <table class="general-table kas-table">
        <thead><tr><th>No</th><th>Tanggal</th><th>Keterangan</th><th class="num">Debit</th><th class="num">Kredit</th><th class="num">Saldo</th>${canKelola?'<th></th>':''}</tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="${canKelola?7:6}">Belum ada transaksi kas. ${canKelola ? '' : 'Hanya role tertentu yang bisa menambah transaksi.'}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="panel-body kas-card-list">
      ${cards || empty}
    </div>
  </div>`;
}

function openKasModal(id){
  if (!canEditSection('kas')) { toast('⛔ Anda tidak memiliki akses untuk mengedit Kas Karang Taruna'); return; }
  const editing = id ? db.kas.find(k=>k.id===id) : null;
  const editingJenis = editing ? (Number(editing.kredit||0) > 0 ? 'keluar' : 'masuk') : 'masuk';
  const editingJumlah = editing ? (editingJenis === 'masuk' ? editing.debit : editing.kredit) : 0;
  setModal(editing?'Edit Transaksi Kas':'Tambah Transaksi Kas', `
    <div class="field"><label>Keterangan</label><input id="f-kas-ket" value="${editing?esc(editing.keterangan||''):''}" placeholder="mis. Iuran bulanan anggota"></div>
    <div class="field"><label>Jenis Transaksi</label>
      <select id="f-kas-jenis">
        <option value="masuk" ${editingJenis==='masuk'?'selected':''}>💰 Pemasukan (uang masuk)</option>
        <option value="keluar" ${editingJenis==='keluar'?'selected':''}>📤 Pengeluaran (uang keluar)</option>
      </select>
    </div>
    <div class="field-row">
      <div class="field"><label>Jumlah (Rp)</label><input id="f-kas-jumlah" class="currency-input" type="text" value="${editing?formatCurrency(editingJumlah||0):''}"></div>
      <div class="field"><label>Tanggal</label><input id="f-kas-tanggal" type="date" value="${editing?editing.tanggal:todayISO()}"></div>
    </div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label: editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const keterangan = document.getElementById('f-kas-ket').value.trim();
      const jenis = document.getElementById('f-kas-jenis').value;
      const jumlah = getCurrencyValue(document.getElementById('f-kas-jumlah'));
      const tanggal = document.getElementById('f-kas-tanggal').value || todayISO();
      if(!keterangan){ toast('Keterangan wajib diisi'); return; }
      if(jumlah<=0){ toast('Jumlah wajib diisi'); return; }
      const debit = jenis === 'masuk' ? jumlah : 0;
      const kredit = jenis === 'keluar' ? jumlah : 0;
      let actionMsg = '';
      if(editing){
        actionMsg = `✏️ Edit kas: ${keterangan}`;
        Object.assign(editing, {keterangan, debit, kredit, tanggal});
      } else {
        actionMsg = `➕ Kas baru: ${keterangan}`;
        db.kas.push({id:uid(), keterangan, debit, kredit, tanggal, created_at:new Date().toISOString()});
      }
      saveDB(); closeModal(); renderContent(); toast('Disimpan');
      notifyTelegram(actionMsg, `${jenis==='masuk'?'Pemasukan':'Pengeluaran'}: ${fmtRp(jumlah)}\nTanggal: ${fmtDate(tanggal)}`);
    }}
  ]);
  setTimeout(setupAllCurrencyInputs, 50);
}

function hapusKas(id){
  if (!canEditSection('kas')) { toast('⛔ Anda tidak memiliki akses untuk mengedit Kas Karang Taruna'); return; }
  if(!confirm('Hapus transaksi kas ini?')) return;
  const k = db.kas.find(x=>x.id===id);
  db.kas = db.kas.filter(x=>x.id!==id);
  saveDB(); renderContent();
  if(k) notifyTelegram(`🗑️ Hapus kas: ${k.keterangan}`);
}

/* ============================================================
   LPJ - scale tampilan di layar kecil (HP) supaya identik dengan
   tampilan desktop, hanya diperkecil proporsional (bukan reflow/
   ubah layout). Menggunakan CSS zoom, dihitung ulang tiap resize.
   ============================================================ */
const LPJ_DESIGN_WIDTH = 820;
function applyLpjMobileScale(){
  const wrap = document.getElementById('lpj-scale-wrap');
  const area = document.getElementById('lpj-print-area');
  if (!wrap || !area) return;
  if (window.innerWidth > LPJ_DESIGN_WIDTH){
    area.style.zoom = '';
    return;
  }
  const available = wrap.clientWidth;
  if (!available) return;
  const scale = Math.min(1, available / LPJ_DESIGN_WIDTH);
  area.style.zoom = scale;
}
window.addEventListener('resize', ()=>{
  if (currentSection === 'lpj' || currentSection === 'dokumen') applyLpjMobileScale();
});

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

  const showDonatur = isMenuAktif('donatur');
  const showTransaksi = isMenuAktif('transaksi');
  const showOperasional = isMenuAktif('operasional');
  const showLomba = isMenuAktif('lomba');
  const showHadiah = isMenuAktif('hadiah');
  const showJalan = isMenuAktif('jalan_santai');

  // 2. Rincian Pemasukan — Iuran Anggota selalu ada, sisanya menyesuaikan fitur event
  const pemasukanSubs = [
    { title:'Iuran Anggota', html:`
    <div class="lpj-table-scroll"><table class="lpj-table lpj-detail">
      <thead><tr><th>Kategori</th><th>Anggota</th><th>Lunas</th><th class="num">Total Terkumpul</th></tr></thead>
      <tbody>${kategoriRekap.map(r=>`<tr><td>${esc(r.label)}</td><td>${r.total}</td><td>${r.lunas}</td><td class="num">${fmtRp(r.nominal)}</td></tr>`).join('') || emptyRow(4,'Belum ada data anggota.')}</tbody>
    </table></div>` },
  ];
  if (showDonatur) pemasukanSubs.push({ title:'Donatur', html:`
    <div class="lpj-table-scroll"><table class="lpj-table lpj-detail">
      <thead><tr><th>Tanggal</th><th>Nama</th><th>Keterangan</th><th class="num">Jumlah</th></tr></thead>
      <tbody>${donaturList.map(d=>`<tr><td>${fmtDate(d.tanggal)}</td><td>${esc(d.nama_donatur)}</td><td>${esc(d.keterangan||'-')}</td><td class="num">${fmtRp(d.jumlah)}</td></tr>`).join('') || emptyRow(4,'Belum ada donasi.')}</tbody>
    </table></div>` });
  if (showTransaksi) pemasukanSubs.push({ title:'Transaksi Lain', html:`
    <div class="lpj-table-scroll"><table class="lpj-table lpj-detail">
      <thead><tr><th>Tanggal</th><th>Nama</th><th>Keterangan</th><th class="num">Jumlah</th></tr></thead>
      <tbody>${transaksiList.map(t=>`<tr><td>${fmtDate(t.tanggal)}</td><td>${esc(t.jenis)}</td><td>${esc(t.keterangan||'-')}</td><td class="num">${fmtRp(t.jumlah)}</td></tr>`).join('') || emptyRow(4,'Belum ada transaksi.')}</tbody>
    </table></div>` });

  // 3. Rincian Pengeluaran — semua sub-bagian opsional, tergantung fitur event
  const pengeluaranSubs = [];
  if (showOperasional) pengeluaranSubs.push({ title:'Operasional Kegiatan', html:`
    <div class="lpj-table-scroll"><table class="lpj-table lpj-detail">
      <thead><tr><th>Tanggal</th><th>Nama</th><th>Catatan</th><th class="num">Jumlah</th></tr></thead>
      <tbody>${operasionalList.map(o=>`<tr><td>${fmtDate(o.tanggal)}</td><td>${esc(o.keterangan)}</td><td>${esc(o.catatan_bukti||'-')}</td><td class="num">${fmtRp(o.jumlah)}</td></tr>`).join('') || emptyRow(4,'Belum ada biaya operasional.')}</tbody>
    </table></div>` });
  if (showLomba) pengeluaranSubs.push({ title:'Kebutuhan Lomba', html:`
    <div class="lpj-table-scroll"><table class="lpj-table lpj-detail lpj-kebutuhan-table">
      <thead><tr><th>Lomba</th><th>Nama Barang</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${kebutuhanRows.map(r=>`<tr><td>${esc(r.lomba)}</td><td>${esc(r.nama)}</td><td class="num">${r.qty}</td><td class="num">${fmtRp(r.harga)}</td><td class="num">${fmtRp(r.subtotal)}</td></tr>`).join('') || emptyRow(5,'Belum ada data kebutuhan lomba.')}</tbody>
    </table></div>` });
  if (showHadiah) pengeluaranSubs.push({ title:'Hadiah Lomba', html:`
    <div class="lpj-table-scroll"><table class="lpj-table lpj-detail lpj-hadiah-table">
      <thead><tr><th>Kategori</th><th>Juara</th><th>Nama Barang</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${hadiahRows.map(r=>`<tr><td>${esc(r.kategori)}</td><td>${esc(r.juara)}</td><td>${esc(r.nama)}</td><td class="num">${r.qty}</td><td class="num">${fmtRp(r.harga)}</td><td class="num">${fmtRp(r.subtotal)}</td></tr>`).join('') || emptyRow(6,'Belum ada data hadiah lomba.')}</tbody>
    </table></div>` });
  if (showJalan) pengeluaranSubs.push({ title:'Hadiah Jalan Santai', html:`
    <div class="lpj-table-scroll"><table class="lpj-table lpj-detail lpj-jalan-santai-table">
      <thead><tr><th>Nama Barang</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${hadiahJalanList.map(h=>`<tr><td>${esc(h.nama_hadiah)}</td><td class="num">${h.qty}</td><td class="num">${fmtRp(h.harga_satuan)}</td><td class="num">${fmtRp(Number(h.harga_satuan||0)*Number(h.qty||0))}</td></tr>`).join('') || emptyRow(4,'Belum ada data hadiah jalan santai.')}</tbody>
    </table></div>` });

  const pemasukanHtml = pemasukanSubs.map((s,i)=>`<h4>2.${i+1} ${esc(s.title)}</h4>${s.html}`).join('');
  const pengeluaranHtml = pengeluaranSubs.length
    ? pengeluaranSubs.map((s,i)=>`<h4>3.${i+1} ${esc(s.title)}</h4>${s.html}`).join('')
    : `<p style="font-size:13px; color:var(--ink-soft); margin:8px 0 20px;">Tidak ada modul pengeluaran yang diaktifkan untuk event ini.</p>`;

  return `
  <div class="lpj-scale-wrap" id="lpj-scale-wrap">
  <div class="lpj-print-area" id="lpj-print-area">
    <div class="lpj-header">
      <div class="lpj-header-inner">
        <img src="icons/logo-kop.png" alt="Logo Karang Taruna Inti" class="lpj-logo">
        <div class="lpj-header-text">
          <div class="lpj-eyebrow">Karang Taruna Inti</div>
          <h2>LAPORAN PERTANGGUNGJAWABAN (LPJ)</h2>
          <div class="lpj-sub">Kegiatan: ${esc(ev.nama)} — Tahun ${esc(String(ev.tahun))}</div>
          <div class="lpj-meta">Dicetak: ${fmtDate(todayISO())}</div>
        </div>
        <div class="lpj-header-spacer" aria-hidden="true"></div>
      </div>
    </div>

    <h3>1. Ringkasan Keuangan</h3>
    <table class="lpj-table">
      <tbody>
        <tr class="lpj-subtotal"><td>Total Pemasukan</td><td class="num">${fmtRp(b.pemasukan)}</td></tr>
        <tr><td class="indent">Iuran Anggota (${b.jumlahIuranLunas} lunas)</td><td class="num">${fmtRp(b.iuran)}</td></tr>
        ${showDonatur ? `<tr><td class="indent">Donatur (${b.jumlahDonatur} donasi)</td><td class="num">${fmtRp(b.donasi)}</td></tr>` : ''}
        ${showTransaksi ? `<tr><td class="indent">Transaksi Lain (${b.jumlahTransaksiLain})</td><td class="num">${fmtRp(b.transaksiLain)}</td></tr>` : ''}
        <tr class="lpj-subtotal"><td>Total Pengeluaran</td><td class="num">${fmtRp(b.pengeluaran)}</td></tr>
        ${showOperasional ? `<tr><td class="indent">Operasional Kegiatan (${b.jumlahOperasional})</td><td class="num">${fmtRp(b.opsional)}</td></tr>` : ''}
        ${showLomba ? `<tr><td class="indent">Kebutuhan Lomba (${b.jumlahKebutuhanLomba})</td><td class="num">${fmtRp(b.kebutuhanLomba)}</td></tr>` : ''}
        ${showHadiah ? `<tr><td class="indent">Hadiah Lomba (${b.jumlahItemHadiahLomba} item)</td><td class="num">${fmtRp(b.hadiahLomba)}</td></tr>` : ''}
        ${showJalan ? `<tr><td class="indent">Hadiah Jalan Santai (${b.jumlahHadiahJalan})</td><td class="num">${fmtRp(b.hadiahJalan)}</td></tr>` : ''}
        <tr class="lpj-total"><td>Saldo Akhir</td><td class="num">${fmtRp(b.saldo)}</td></tr>
      </tbody>
    </table>

    <h3>2. Rincian Pemasukan</h3>
    ${pemasukanHtml}

    <h3>3. Rincian Pengeluaran</h3>
    ${pengeluaranHtml}

    <h3>4. Penutup</h3>
    <p class="lpj-penutup">Demikian Laporan Pertanggungjawaban kegiatan <strong>${esc(ev.nama)}</strong> ini kami susun berdasarkan data yang tercatat pada sistem, untuk dipergunakan sebagaimana mestinya.</p>
  </div>
  </div>

  ${isLoggedIn ? `
  <div class="lpj-toolbar no-print">
    <button class="btn small" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button>
  </div>` : ''}`;
}


/* ============================================================
   SURAT & DOKUMEN
   Kumpulan dokumen siap cetak: Surat Undangan Kegiatan, Proposal
   Kegiatan, dan Form Absensi (berdasar Database Anggota). Draft
   teksnya disimpan di db.settings[event].dokumen (kolom jsonb
   `dokumen` di tabel kt_settings — lihat
   supabase-dokumen-migration.sql). Pola cetaknya sama seperti LPJ:
   render di layar, lalu tombol "Cetak / Simpan sebagai PDF" yang
   memanggil window.print().
   ============================================================ */
function nl2br(s){ return esc(s).replace(/\n/g, '<br>'); }

let _dokumenTab = 'undangan';
function gotoDokumenTab(tab){ _dokumenTab = tab; renderContent(); }

function renderDokumen(){
  // Berdiri sendiri seperti Gudang — tetap bisa dibuka walau belum ada
  // event aktif. `ev` di bawah cuma dipakai sebagai bantuan pra-isi teks
  // (nama kegiatan, rincian anggaran) kalau kebetulan ada event aktif.
  const ev = activeEvent();
  const tabs = [
    {key:'undangan', label:'📨 Surat Undangan'},
    {key:'proposal', label:'📋 Proposal Kegiatan'},
    {key:'absensi', label:'📝 Form Absensi'},
  ];
  const tabNav = `<div class="dokumen-tabs no-print">${tabs.map(t=>`<button type="button" class="dokumen-tab ${_dokumenTab===t.key?'active':''}" onclick="gotoDokumenTab('${t.key}')">${t.label}</button>`).join('')}</div>`;
  let body = '';
  if(_dokumenTab==='proposal') body = renderProposalKegiatan(ev);
  else if(_dokumenTab==='absensi') body = renderFormAbsensi(ev);
  else body = renderSuratUndangan(ev);
  return tabNav + body;
}

/* ---------- 1. Surat Undangan Kegiatan ---------- */
function renderSuratUndangan(ev){
  const isLoggedIn = !!getCurrentUser();
  const d = getDokumenGlobal().undangan || {};
  const namaKegiatanDefault = d.nama_kegiatan || (ev ? ev.nama : '');
  const editForm = isLoggedIn ? `
  <div class="panel no-print">
    <div class="panel-head"><h3>✏️ Isi Data Surat Undangan</h3></div>
    <div class="panel-body">
      <div class="field-row">
        <div class="field"><label>Nomor Surat</label><input id="doc-und-nomor" value="${esc(d.nomor_surat||'')}" placeholder="001/KT-Inti/VII/2026"></div>
        <div class="field"><label>Perihal</label><input id="doc-und-perihal" value="${esc(d.perihal||'')}" placeholder="Undangan Rapat Persiapan"></div>
      </div>
      <div class="field"><label>Nama Kegiatan</label><input id="doc-und-nama-kegiatan" value="${esc(namaKegiatanDefault)}" placeholder="Contoh: 17-an Tahun 2026"></div>
      <div class="field"><label>Kepada Yth.</label><input id="doc-und-kepada" value="${esc(d.kepada||'')}" placeholder="Seluruh Warga RT 01-03 / Pengurus Karang Taruna"></div>
      <div class="field-row">
        <div class="field"><label>Hari, Tanggal</label><input id="doc-und-hari-tanggal" value="${esc(d.hari_tanggal||'')}" placeholder="Minggu, 17 Agustus 2026"></div>
        <div class="field"><label>Waktu</label><input id="doc-und-waktu" value="${esc(d.waktu||'')}" placeholder="19.30 WIB - selesai"></div>
      </div>
      <div class="field"><label>Tempat</label><input id="doc-und-tempat" value="${esc(d.tempat||'')}" placeholder="Balai Desa / Rumah Bapak RT 02"></div>
      <div class="field"><label>Acara</label><input id="doc-und-acara" value="${esc(d.acara||'')}" placeholder="Rapat persiapan ${esc(namaKegiatanDefault||'kegiatan')}"></div>
      <div class="field"><label>Catatan Tambahan (opsional)</label><textarea id="doc-und-catatan" rows="3" placeholder="Mohon hadir tepat waktu...">${esc(d.catatan||'')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Jabatan Penandatangan 1</label><input id="doc-und-jab1" value="${esc(d.jabatan1||'Ketua Panitia')}"></div>
        <div class="field"><label>Nama Penandatangan 1</label><input id="doc-und-nama1" value="${esc(d.nama1||'')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Jabatan Penandatangan 2</label><input id="doc-und-jab2" value="${esc(d.jabatan2||'Sekretaris')}"></div>
        <div class="field"><label>Nama Penandatangan 2</label><input id="doc-und-nama2" value="${esc(d.nama2||'')}"></div>
      </div>
      <button class="btn" onclick="simpanUndangan()">💾 Simpan &amp; Perbarui Pratinjau</button>
    </div>
  </div>` : '';

  return editForm + `
  <div class="lpj-scale-wrap" id="lpj-scale-wrap">
  <div class="lpj-print-area" id="lpj-print-area">
    <div class="lpj-header">
      <div class="lpj-header-inner">
        <img src="icons/logo-kop.png" alt="Logo Karang Taruna Inti" class="lpj-logo">
        <div class="lpj-header-text">
          <div class="lpj-eyebrow">Karang Taruna Inti</div>
          <h2>SURAT UNDANGAN</h2>
          <div class="lpj-sub">${d.nomor_surat ? `Nomor: ${esc(d.nomor_surat)}` : 'Nomor: -'}</div>
        </div>
        <div class="lpj-header-spacer" aria-hidden="true"></div>
      </div>
    </div>

    <p class="surat-body">Perihal: <strong>${esc(d.perihal||'-')}</strong></p>
    <p class="surat-body">Kepada Yth.<br><strong>${esc(d.kepada||'-')}</strong><br>di Tempat</p>
    <p class="surat-body">Dengan hormat,</p>
    <p class="surat-body">Sehubungan dengan pelaksanaan kegiatan <strong>${esc(d.nama_kegiatan||'-')}</strong>, kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada:</p>
    <table class="lpj-table surat-detail-table">
      <tbody>
        <tr><td class="surat-detail-label">Hari, Tanggal</td><td>: ${esc(d.hari_tanggal||'-')}</td></tr>
        <tr><td class="surat-detail-label">Waktu</td><td>: ${esc(d.waktu||'-')}</td></tr>
        <tr><td class="surat-detail-label">Tempat</td><td>: ${esc(d.tempat||'-')}</td></tr>
        <tr><td class="surat-detail-label">Acara</td><td>: ${esc(d.acara||'-')}</td></tr>
      </tbody>
    </table>
    ${d.catatan ? `<p class="surat-body">${nl2br(d.catatan)}</p>` : ''}
    <p class="surat-body">Demikian undangan ini kami sampaikan. Atas perhatian dan kehadirannya kami ucapkan terima kasih.</p>

    <div class="lpj-signature">
      <div class="surat-ttd"><div>${esc(d.jabatan1||'Ketua Panitia')}</div><div class="surat-ttd-space"></div><div><strong>${esc(d.nama1||'(.....................)')}</strong></div></div>
      <div class="surat-ttd"><div>${esc(d.jabatan2||'Sekretaris')}</div><div class="surat-ttd-space"></div><div><strong>${esc(d.nama2||'(.....................)')}</strong></div></div>
    </div>
  </div>
  </div>
  ${isLoggedIn ? `<div class="lpj-toolbar no-print"><button class="btn small" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button></div>` : ''}`;
}

function simpanUndangan(){
  const s = getDokumenGlobal();
  s.undangan = {
    nomor_surat: document.getElementById('doc-und-nomor').value.trim(),
    perihal: document.getElementById('doc-und-perihal').value.trim(),
    nama_kegiatan: document.getElementById('doc-und-nama-kegiatan').value.trim(),
    kepada: document.getElementById('doc-und-kepada').value.trim(),
    hari_tanggal: document.getElementById('doc-und-hari-tanggal').value.trim(),
    waktu: document.getElementById('doc-und-waktu').value.trim(),
    tempat: document.getElementById('doc-und-tempat').value.trim(),
    acara: document.getElementById('doc-und-acara').value.trim(),
    catatan: document.getElementById('doc-und-catatan').value.trim(),
    jabatan1: document.getElementById('doc-und-jab1').value.trim(),
    nama1: document.getElementById('doc-und-nama1').value.trim(),
    jabatan2: document.getElementById('doc-und-jab2').value.trim(),
    nama2: document.getElementById('doc-und-nama2').value.trim(),
  };
  saveDB(); renderContent(); toast('💾 Surat undangan disimpan');
}

/* ---------- 2. Proposal Kegiatan ---------- */
function renderProposalKegiatan(ev){
  const isLoggedIn = !!getCurrentUser();
  const d = getDokumenGlobal().proposal || {};
  const b = hitungBukuUtama();
  const temaDefault = d.tema || (ev ? ev.nama : '');
  const showDonatur = isMenuAktif('donatur');
  const showTransaksi = isMenuAktif('transaksi');
  const showOperasional = isMenuAktif('operasional');
  const showLomba = isMenuAktif('lomba');
  const showHadiah = isMenuAktif('hadiah');
  const showJalan = isMenuAktif('jalan_santai');

  const editForm = isLoggedIn ? `
  <div class="panel no-print">
    <div class="panel-head"><h3>✏️ Isi Data Proposal</h3></div>
    <div class="panel-body">
      <div class="field"><label>Tema/Judul Kegiatan</label><input id="doc-prop-tema" value="${esc(temaDefault)}" placeholder="Contoh: 17-an Tahun 2026"></div>
      <div class="field"><label>Latar Belakang</label><textarea id="doc-prop-latar" rows="4" placeholder="Uraikan alasan/konteks kegiatan ini diadakan...">${esc(d.latar_belakang||'')}</textarea></div>
      <div class="field"><label>Maksud &amp; Tujuan</label><textarea id="doc-prop-tujuan" rows="3" placeholder="Satu tujuan per baris">${esc(d.tujuan||'')}</textarea></div>
      <div class="field"><label>Susunan Acara</label><textarea id="doc-prop-susunan" rows="4" placeholder="Satu kegiatan per baris, mis: 19.30 - Pembukaan">${esc(d.susunan_acara||'')}</textarea></div>
      <div class="field"><label>Penutup (opsional)</label><textarea id="doc-prop-penutup" rows="2" placeholder="Paragraf penutup, kosongkan untuk pakai kalimat baku">${esc(d.penutup||'')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Jabatan Penandatangan 1</label><input id="doc-prop-jab1" value="${esc(d.jabatan1||'Ketua Panitia')}"></div>
        <div class="field"><label>Nama Penandatangan 1</label><input id="doc-prop-nama1" value="${esc(d.nama1||'')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Jabatan Penandatangan 2</label><input id="doc-prop-jab2" value="${esc(d.jabatan2||'Ketua Karang Taruna')}"></div>
        <div class="field"><label>Nama Penandatangan 2</label><input id="doc-prop-nama2" value="${esc(d.nama2||'')}"></div>
      </div>
      <button class="btn" onclick="simpanProposal()">💾 Simpan &amp; Perbarui Pratinjau</button>
    </div>
  </div>` : '';

  const tujuanItems = (d.tujuan||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const susunanItems = (d.susunan_acara||'').split('\n').map(s=>s.trim()).filter(Boolean);

  return editForm + `
  <div class="lpj-scale-wrap" id="lpj-scale-wrap">
  <div class="lpj-print-area" id="lpj-print-area">
    <div class="lpj-header">
      <div class="lpj-header-inner">
        <img src="icons/logo-kop.png" alt="Logo Karang Taruna Inti" class="lpj-logo">
        <div class="lpj-header-text">
          <div class="lpj-eyebrow">Karang Taruna Inti</div>
          <h2>PROPOSAL KEGIATAN</h2>
          <div class="lpj-sub">${esc(temaDefault||'-')}${ev ? ` — Tahun ${esc(String(ev.tahun))}` : ''}</div>
        </div>
        <div class="lpj-header-spacer" aria-hidden="true"></div>
      </div>
    </div>

    <h3>1. Latar Belakang</h3>
    <p class="surat-body">${d.latar_belakang ? nl2br(d.latar_belakang) : '<span class="hint">Belum diisi.</span>'}</p>

    <h3>2. Maksud &amp; Tujuan</h3>
    ${tujuanItems.length ? `<ul class="proposal-list">${tujuanItems.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="surat-body"><span class="hint">Belum diisi.</span></p>'}

    <h3>3. Susunan Acara</h3>
    ${susunanItems.length ? `<ul class="proposal-list">${susunanItems.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="surat-body"><span class="hint">Belum diisi.</span></p>'}

    <h3>4. Rencana Anggaran</h3>
    <p class="field-hint" style="color:var(--ink-soft); font-size:12.5px; margin:-4px 0 10px;">${ev ? 'Diambil otomatis dari data yang sudah tercatat di sistem saat ini — sesuaikan lewat menu terkait sebelum dicetak bila perlu.' : 'Belum ada event aktif dipilih di sidebar, jadi rincian di bawah masih menunjukkan Rp 0. Pilih event aktif dulu kalau ingin rincian anggaran terisi otomatis.'}</p>
    <table class="lpj-table">
      <tbody>
        <tr class="lpj-subtotal"><td>Rencana Pemasukan</td><td class="num">${fmtRp(b.pemasukan)}</td></tr>
        <tr><td class="indent">Iuran Anggota</td><td class="num">${fmtRp(b.iuran)}</td></tr>
        ${showDonatur ? `<tr><td class="indent">Donatur</td><td class="num">${fmtRp(b.donasi)}</td></tr>` : ''}
        ${showTransaksi ? `<tr><td class="indent">Transaksi Lain</td><td class="num">${fmtRp(b.transaksiLain)}</td></tr>` : ''}
        <tr class="lpj-subtotal"><td>Rencana Pengeluaran</td><td class="num">${fmtRp(b.pengeluaran)}</td></tr>
        ${showOperasional ? `<tr><td class="indent">Operasional Kegiatan</td><td class="num">${fmtRp(b.opsional)}</td></tr>` : ''}
        ${showLomba ? `<tr><td class="indent">Kebutuhan Lomba</td><td class="num">${fmtRp(b.kebutuhanLomba)}</td></tr>` : ''}
        ${showHadiah ? `<tr><td class="indent">Hadiah Lomba</td><td class="num">${fmtRp(b.hadiahLomba)}</td></tr>` : ''}
        ${showJalan ? `<tr><td class="indent">Hadiah Jalan Santai</td><td class="num">${fmtRp(b.hadiahJalan)}</td></tr>` : ''}
        <tr class="lpj-total"><td>Selisih (Saldo)</td><td class="num">${fmtRp(b.saldo)}</td></tr>
      </tbody>
    </table>

    <h3>5. Penutup</h3>
    <p class="surat-body">${d.penutup ? nl2br(d.penutup) : `Demikian proposal kegiatan <strong>${esc(temaDefault||'ini')}</strong> ini kami susun. Besar harapan kami atas dukungan dan partisipasi semua pihak demi kelancaran acara ini.`}</p>

    <div class="lpj-signature">
      <div class="surat-ttd"><div>${esc(d.jabatan1||'Ketua Panitia')}</div><div class="surat-ttd-space"></div><div><strong>${esc(d.nama1||'(.....................)')}</strong></div></div>
      <div class="surat-ttd"><div>${esc(d.jabatan2||'Ketua Karang Taruna')}</div><div class="surat-ttd-space"></div><div><strong>${esc(d.nama2||'(.....................)')}</strong></div></div>
    </div>
  </div>
  </div>
  ${isLoggedIn ? `<div class="lpj-toolbar no-print"><button class="btn small" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button></div>` : ''}`;
}

function simpanProposal(){
  const s = getDokumenGlobal();
  s.proposal = {
    tema: document.getElementById('doc-prop-tema').value.trim(),
    latar_belakang: document.getElementById('doc-prop-latar').value.trim(),
    tujuan: document.getElementById('doc-prop-tujuan').value,
    susunan_acara: document.getElementById('doc-prop-susunan').value,
    penutup: document.getElementById('doc-prop-penutup').value.trim(),
    jabatan1: document.getElementById('doc-prop-jab1').value.trim(),
    nama1: document.getElementById('doc-prop-nama1').value.trim(),
    jabatan2: document.getElementById('doc-prop-jab2').value.trim(),
    nama2: document.getElementById('doc-prop-nama2').value.trim(),
  };
  saveDB(); renderContent(); toast('💾 Proposal disimpan');
}

/* ---------- 3. Form Absensi (dari Database Anggota) ---------- */
function renderFormAbsensi(ev){
  const isLoggedIn = !!getCurrentUser();
  const d = getDokumenGlobal().absensi || {};
  const judulDefault = d.judul || (ev ? ev.nama : '');
  const filterKategori = d.filter_kategori || '';
  const filterRT = d.filter_rt || '';
  // Kalau ada event aktif, tampilkan anggota event itu saja (roster tahunan).
  // Kalau tidak ada event aktif (menu ini kini berdiri sendiri), tampilkan
  // seluruh anggota dari semua event supaya form absensi tetap bisa dipakai.
  let list = (ev ? gAnggota() : db.anggota).slice().sort((a,b)=>a.nama.localeCompare(b.nama));
  if(filterKategori) list = list.filter(a=>a.kategori===filterKategori);
  if(filterRT) list = list.filter(a=>getRT(a)===filterRT);

  const editForm = isLoggedIn ? `
  <div class="panel no-print">
    <div class="panel-head"><h3>✏️ Pengaturan Form Absensi</h3></div>
    <div class="panel-body">
      ${!ev ? `<div class="field-hint" style="color:var(--ink-soft); font-size:12.5px; margin:-2px 0 8px;">Belum ada event aktif dipilih di sidebar, jadi daftar di bawah menampilkan anggota dari semua event. Pilih event aktif dulu kalau ingin daftar dipersempit ke roster tahun itu saja.</div>` : ''}
      <div class="field-row">
        <div class="field"><label>Judul Acara</label><input id="doc-abs-judul" value="${esc(judulDefault)}" placeholder="Contoh: 17-an Tahun 2026"></div>
        <div class="field"><label>Tanggal</label><input id="doc-abs-tanggal" type="date" value="${esc(d.tanggal||todayISO())}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Filter Kategori</label>
          <select id="doc-abs-kategori" onchange="filterAbsensi()">
            <option value="">Semua Kategori</option>
            ${KATEGORI_ANGGOTA.map(k=>`<option value="${k.v}" ${filterKategori===k.v?'selected':''}>${esc(k.l)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Filter RT</label>
          <select id="doc-abs-rt" onchange="filterAbsensi()">
            <option value="">Semua RT</option>
            ${RT_LIST.map(r=>`<option value="${r.v}" ${filterRT===r.v?'selected':''}>${esc(r.l)}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn" onclick="simpanAbsensi()">💾 Simpan Judul &amp; Tanggal</button>
    </div>
  </div>` : '';

  return editForm + `
  <div class="lpj-scale-wrap" id="lpj-scale-wrap">
  <div class="lpj-print-area" id="lpj-print-area">
    <div class="lpj-header">
      <div class="lpj-header-inner">
        <img src="icons/logo-kop.png" alt="Logo Karang Taruna Inti" class="lpj-logo">
        <div class="lpj-header-text">
          <div class="lpj-eyebrow">Karang Taruna Inti</div>
          <h2>DAFTAR HADIR</h2>
          <div class="lpj-sub">${esc(judulDefault||'-')}</div>
          <div class="lpj-meta">Tanggal: ${fmtDate(d.tanggal||todayISO())}${filterKategori?` · Kategori: ${esc(labelKategori(filterKategori))}`:''}${filterRT?` · ${esc(labelRT(filterRT))}`:''}</div>
        </div>
        <div class="lpj-header-spacer" aria-hidden="true"></div>
      </div>
    </div>

    <table class="lpj-table absensi-table">
      <thead><tr><th style="width:36px;">No</th><th>Nama</th><th>Kategori</th><th>RT</th><th>Tanda Tangan</th></tr></thead>
      <tbody>
        ${list.length ? list.map((a,i)=>`<tr><td class="num">${i+1}</td><td>${esc(a.nama)}</td><td>${esc(labelKategori(a.kategori))}</td><td>${esc(labelRT(a.rt))}</td><td class="absensi-ttd-cell"></td></tr>`).join('') : `<tr class="empty-row"><td colspan="5">Belum ada data anggota${filterKategori||filterRT?' yang cocok dengan filter ini':''}.</td></tr>`}
      </tbody>
    </table>
  </div>
  </div>
  ${isLoggedIn ? `<div class="lpj-toolbar no-print"><button class="btn small" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button></div>` : ''}`;
}

function filterAbsensi(){
  const s = getDokumenGlobal();
  s.absensi = s.absensi || {};
  s.absensi.filter_kategori = document.getElementById('doc-abs-kategori').value;
  s.absensi.filter_rt = document.getElementById('doc-abs-rt').value;
  saveDB(); renderContent();
}
function simpanAbsensi(){
  const s = getDokumenGlobal();
  s.absensi = s.absensi || {};
  s.absensi.judul = document.getElementById('doc-abs-judul').value.trim();
  s.absensi.tanggal = document.getElementById('doc-abs-tanggal').value;
  saveDB(); renderContent(); toast('💾 Form absensi diperbarui');
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
  saveDB(); renderSidebar();
  goSection(isMenuAktif(currentSection) ? currentSection : 'dashboard');
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
    event: { nama: ev.nama, tahun: ev.tahun, fitur: ev.fitur || null },
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
      db.events.push({ id:newEventId, nama: parsed.event.nama || 'Event Impor', tahun: parsed.event.tahun || new Date().getFullYear(), fitur: parsed.event.fitur || undefined, created_at: new Date().toISOString() });
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
  const fiturAwal = eventFitur(editing);
  const eventLain = db.events.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
  setModal(editing?'Edit Event':'Buat Event', `
    <div class="field"><label>Nama Event</label><input id="f-nama" placeholder="HUT RI 82" value="${editing?esc(editing.nama):''}"></div>
    <div class="field"><label>Tahun</label><input id="f-tahun" type="number" value="${editing?esc(editing.tahun):new Date().getFullYear()}"></div>

    ${!editing && eventLain.length ? `
    <div class="field">
      <label>Salin Data Anggota (opsional)</label>
      <select id="f-salin-anggota">
        <option value="">— Jangan salin, mulai kosong —</option>
        ${eventLain.map(e=>{
          const jumlah = db.anggota.filter(a=>a.event_id===e.id).length;
          return `<option value="${e.id}">${esc(e.nama)} (${esc(e.tahun)}) · ${jumlah} anggota</option>`;
        }).join('')}
      </select>
      <div class="hint">Nama, kategori, RT &amp; jenis kelamin akan disalin. Status iuran diset ulang jadi "Belum Lunas" karena ini event baru.</div>
    </div>` : ''}

    <div class="field" style="margin-top:6px;">
      <label>Fitur yang Dipakai</label>
      <div class="field-hint" style="margin:-2px 0 8px; color:var(--ink-soft); font-size:12.5px;">Nonaktifkan modul yang tidak dipakai supaya menu lebih ringkas. Iuran, Buku Kegiatan & LPJ selalu aktif.</div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <button type="button" class="btn secondary small" onclick="setFiturModalPreset('lengkap')">Pilih Semua (Lengkap)</button>
        <button type="button" class="btn secondary small" onclick="setFiturModalPreset('sederhana')">Hanya Iuran & LPJ</button>
      </div>
      <div id="fitur-opsional-list" style="display:flex; flex-direction:column; gap:6px;">
        ${FITUR_OPSIONAL.map(f=>`
          <label style="display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:400;">
            <input type="checkbox" id="fitur-${f.key}" ${fiturAwal[f.key]?'checked':''}> ${esc(f.label)}
          </label>`).join('')}
      </div>
    </div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Buat', cls:'', onclick:()=>{
      const nama = document.getElementById('f-nama').value.trim();
      const tahun = document.getElementById('f-tahun').value.trim();
      if(!nama){ toast('Nama wajib'); return; }
      const fitur = {};
      FITUR_OPSIONAL.forEach(f => fitur[f.key] = !!document.getElementById(`fitur-${f.key}`)?.checked);
      if(editing){
        const namaLama = editing.nama;
        editing.nama = nama; editing.tahun = tahun; editing.fitur = fitur;
        saveDB(); closeModal(); renderSidebar(); renderContent(); toast('Event diperbarui');
        notifyTelegram(`✏️ Edit event: ${namaLama} → ${nama}`, `Tahun: ${tahun}`);
      } else {
        const newId = uid();
        db.events.push({id:newId, nama, tahun, fitur, created_at:new Date().toISOString()});
        db.settings[newId] = {tarif:{sekolah:0,bekerja:0,perantauan:0,khusus:0}, hadiahBudget:{}};
        const sourceEventId = document.getElementById('f-salin-anggota')?.value || '';
        let jumlahDisalin = 0;
        if(sourceEventId){
          db.anggota.filter(a=>a.event_id===sourceEventId).forEach(a=>{
            db.anggota.push({id:uid(), event_id:newId, nama:a.nama, kategori:a.kategori, rt:a.rt, gender:a.gender, nominal_wajib:a.nominal_wajib, status:'belum_lunas', tanggal_bayar:null});
            jumlahDisalin++;
          });
        }
        db.activeEventId = newId;
        saveDB(); closeModal(); renderSidebar(); goSection('pengaturan');
        toast(jumlahDisalin ? `Event dibuat, ${jumlahDisalin} anggota disalin` : 'Event dibuat');
        notifyTelegram(`📂 Event baru: ${nama}`, `Tahun: ${tahun}${jumlahDisalin ? `\nAnggota disalin: ${jumlahDisalin}` : ''}`);
      }
    }}
  ]);
}
function setFiturModalPreset(preset){
  const src = preset === 'lengkap' ? FITUR_PRESET_LENGKAP : FITUR_PRESET_SEDERHANA;
  FITUR_OPSIONAL.forEach(f=>{
    const cb = document.getElementById(`fitur-${f.key}`);
    if(cb) cb.checked = !!src[f.key];
  });
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
function closeModal(){ document.getElementById('overlay').classList.remove('show'); if(typeof closeAllGudangCombos==='function') closeAllGudangCombos(); }
document.getElementById('modal-close').onclick = closeModal;
// Catatan: tutup overlay HANYA jika mousedown & click sama-sama kena backdrop.
// Ini mencegah modal tertutup tidak sengaja saat user scroll/geser di dalam modal
// (jari mulai di dalam modal, geser, lalu lepas di area backdrop) atau saat
// posisi modal bergeser akibat munculnya keyboard di HP.
let overlayMouseDownOnBackdrop = false;
document.getElementById('overlay').addEventListener('mousedown', (e)=>{ overlayMouseDownOnBackdrop = (e.target.id==='overlay'); });
document.getElementById('overlay').addEventListener('click', (e)=>{ if(e.target.id==='overlay' && overlayMouseDownOnBackdrop) closeModal(); overlayMouseDownOnBackdrop = false; });

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
   PANITIA / SINOMAN
   Generator "Susunan Panitia" WYSIWYG untuk acara warga di luar
   event 17-an (hajatan, sinoman, dll). Tidak terikat event_id —
   makanya array-nya (db.panitiaSinoman) tidak difilter pakai eid()
   seperti modul lain, dan section-nya masuk EVENTLESS_SECTIONS di
   renderContent() supaya tetap bisa dibuka walau belum ada event
   17-an yang aktif.
   ============================================================ */

// view state lokal (tidak disimpan ke DB): 'list' = daftar semua susunan
// panitia tersimpan, 'edit' = lagi buka/isi satu susunan.
let panitiaView = { mode: 'list', editingId: null };

// Ambil semua nama anggota yang sudah pernah diinput di modul Iuran Anggota,
// dari SEMUA event (bukan cuma event aktif) — dipakai sebagai sumber
// autocomplete. Ganti bagian ini kalau nanti nama diambil dari tabel lain.
function panitiaDaftarNama(){
  const set = new Set();
  db.anggota.forEach(a => { if(a.nama && a.nama.trim()) set.add(a.nama.trim()); });
  return [...set].sort((a,b)=>a.localeCompare(b));
}

function panitiaGetDoc(id){ return db.panitiaSinoman.find(d=>d.id===id); }

function panitiaTouch(doc){ doc.updated_at = new Date().toISOString(); }

function panitiaBuatBaru(){
  if(!canEdit()){ toast('⛔ Login untuk membuat susunan panitia'); return; }
  const now = new Date().toISOString();
  const doc = {
    id: uid(),
    judul: 'Susunan Panitia',
    organisasi: 'Karang Taruna Inti',
    dusun: '', desa: '', kecamatan: '', kabupaten: '',
    hari: '', tanggal: null, tempat: '',
    jadwal_piket: Array.from({length:9}, () => ({ pagi:'', siang:'', sore:'' })),
    kelompok_utama: [
      { id: uid(), judul: 'Undur-Undur Walimahan (Among Tamu)', koor: '', rows: [] },
      { id: uid(), judul: 'Tenong (Among Hantaran)', koor: '', rows: [] },
      { id: uid(), judul: 'Sie Walimahan', koor: '', rows: [] },
      { id: uid(), judul: 'Konsumsi Putri', koor: '', rows: [] },
    ],
    kelompok_samping: [
      { id: uid(), label: 'Juru Kunci', nama: '' },
      { id: uid(), label: 'Rokok', nama: '' },
      { id: uid(), label: 'Sie Konsumsi', nama: '' },
      { id: uid(), label: 'Sie Keamanan', nama: '' },
      { id: uid(), label: 'Sie Parkir', nama: '' },
    ],
    ketua_nama: '', ketua_jabatan: 'Ketua Karang Taruna',
    ttd_url: '',
    created_at: now, updated_at: now,
  };
  db.panitiaSinoman.push(doc);
  saveDB();
  panitiaView = { mode: 'edit', editingId: doc.id };
  renderContent();
}

function panitiaBuka(id){ panitiaView = { mode: 'edit', editingId: id }; renderContent(); window.scrollTo({top:0, behavior:'instant'}); }
function panitiaKembali(){ panitiaView = { mode: 'list', editingId: null }; renderContent(); }

function panitiaDuplikat(id){
  if(!canEdit()){ toast('⛔ Login untuk menduplikat'); return; }
  const src = panitiaGetDoc(id); if(!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid();
  copy.judul = (src.judul || 'Susunan Panitia') + ' (Salinan)';
  const now = new Date().toISOString();
  copy.created_at = now; copy.updated_at = now;
  copy.kelompok_utama.forEach(g => { g.id = uid(); g.rows.forEach(r => r.id = uid()); });
  copy.kelompok_samping.forEach(s => { s.id = uid(); });
  db.panitiaSinoman.push(copy);
  saveDB();
  toast('✓ Disalin');
  renderContent();
}

function panitiaHapus(id){
  if(!canEdit()){ toast('⛔ Login untuk menghapus'); return; }
  const doc = panitiaGetDoc(id); if(!doc) return;
  if(!confirm(`Hapus susunan panitia "${doc.judul || '(Tanpa judul)'}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  db.panitiaSinoman = db.panitiaSinoman.filter(d=>d.id!==id);
  saveDB();
  toast('🗑 Dihapus');
  if(panitiaView.editingId === id) panitiaView = { mode: 'list', editingId: null };
  renderContent();
}

// ---- Update field-field sederhana (tanpa re-render, supaya kursor tidak lompat) ----
function panitiaSetTop(docId, field, value){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  // Kolom `tanggal` di Supabase bertipe date — kirim null kalau kosong,
  // karena string kosong '' ditolak Postgres untuk tipe date.
  if(field === 'tanggal' && value === '') value = null;
  doc[field] = value; panitiaTouch(doc); saveDB();
}
function panitiaSetJadwal(docId, idx, field, value){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.jadwal_piket[idx][field] = value; panitiaTouch(doc); saveDB();
}
function panitiaSetKelompokJudul(docId, gIdx, value){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_utama[gIdx].judul = value; panitiaTouch(doc); saveDB();
}
function panitiaSetKelompokKoor(docId, gIdx, value){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_utama[gIdx].koor = value; panitiaTouch(doc); saveDB();
}
function panitiaSetRowNama(docId, gIdx, rIdx, value){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_utama[gIdx].rows[rIdx].nama = value; panitiaTouch(doc); saveDB();
}
function panitiaSetSampingLabel(docId, idx, value){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_samping[idx].label = value; panitiaTouch(doc); saveDB();
}
function panitiaSetSampingNama(docId, idx, value){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_samping[idx].nama = value; panitiaTouch(doc); saveDB();
}

// ---- Perubahan struktur (jumlah baris/kelompok) — perlu re-render ----
function panitiaAddJadwalRow(docId){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.jadwal_piket.push({ pagi:'', siang:'', sore:'' });
  panitiaTouch(doc); saveDB(); renderContent();
}
function panitiaRemoveJadwalRow(docId, idx){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  if(doc.jadwal_piket.length<=1) return;
  doc.jadwal_piket.splice(idx,1);
  panitiaTouch(doc); saveDB(); renderContent();
}
function panitiaAddRow(docId, gIdx){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_utama[gIdx].rows.push({ id: uid(), nama:'', isLabel:false });
  panitiaTouch(doc); saveDB(); renderContent();
}
function panitiaRemoveRow(docId, gIdx, rIdx){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_utama[gIdx].rows.splice(rIdx,1);
  panitiaTouch(doc); saveDB(); renderContent();
}
function panitiaToggleRowLabel(docId, gIdx, rIdx){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  const row = doc.kelompok_utama[gIdx].rows[rIdx];
  row.isLabel = !row.isLabel;
  panitiaTouch(doc); saveDB(); renderContent();
}
function panitiaAddKelompok(docId){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_utama.push({ id: uid(), judul: 'Kelompok Baru', koor:'', rows: [] });
  panitiaTouch(doc); saveDB(); renderContent();
}
function panitiaRemoveKelompok(docId, gIdx){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  if(!confirm('Hapus kelompok ini beserta semua isinya?')) return;
  doc.kelompok_utama.splice(gIdx,1);
  panitiaTouch(doc); saveDB(); renderContent();
}
function panitiaAddSamping(docId){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_samping.push({ id: uid(), label: 'Kelompok Baru', nama:'' });
  panitiaTouch(doc); saveDB(); renderContent();
}
function panitiaRemoveSamping(docId, idx){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.kelompok_samping.splice(idx,1);
  panitiaTouch(doc); saveDB(); renderContent();
}

// ---- Tanda tangan ----
function panitiaUploadTTDTrigger(docId){
  const input = document.getElementById('ttd-input-'+docId);
  if(input) input.click();
}
function panitiaUploadTTD(docId, inputEl){
  const file = inputEl.files && inputEl.files[0];
  if(!file) return;
  if(file.size > 2*1024*1024){ toast('⛔ Ukuran gambar maksimal 2MB'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const doc = panitiaGetDoc(docId); if(!doc) return;
    doc.ttd_url = reader.result;
    panitiaTouch(doc); saveDB(); renderContent();
  };
  reader.readAsDataURL(file);
}
function panitiaRemoveTTD(docId){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  doc.ttd_url = '';
  panitiaTouch(doc); saveDB(); renderContent();
}

// ---- Simpan manual & export JPEG ----
function panitiaSimpanManual(docId){
  saveDB();
  toast('💾 Tersimpan');
}
function panitiaExportJPEG(docId){
  const doc = panitiaGetDoc(docId); if(!doc) return;
  const el = document.getElementById('panitia-capture-'+docId);
  if(!el){ toast('⛔ Gagal menemukan template'); return; }
  if(typeof html2canvas === 'undefined'){ toast('⛔ Gagal memuat modul export gambar. Cek koneksi internet lalu muat ulang.'); return; }
  el.classList.add('exporting');
  html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
    el.classList.remove('exporting');
    const link = document.createElement('a');
    const namaFile = (doc.judul || 'susunan-panitia').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    link.download = `${namaFile || 'susunan-panitia'}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    toast('⬇ JPEG berhasil diunduh');
  }).catch(err => {
    el.classList.remove('exporting');
    console.error('Gagal export JPEG:', err);
    toast('⛔ Gagal membuat JPEG: ' + (err.message||'error tak dikenal'));
  });
}

/* ---------------- RENDER ---------------- */
function renderPanitiaSinoman(){
  return panitiaView.mode === 'edit' && panitiaGetDoc(panitiaView.editingId)
    ? renderPanitiaEditor(panitiaGetDoc(panitiaView.editingId))
    : renderPanitiaList();
}

function renderPanitiaList(){
  const isLoggedIn = !!getCurrentUser();
  const list = [...db.panitiaSinoman].sort((a,b)=> (b.updated_at||'').localeCompare(a.updated_at||''));
  const cards = list.map(d => {
    const jumlahOrang = (d.kelompok_utama||[]).reduce((s,g)=> s + g.rows.filter(r=>!r.isLabel && r.nama.trim()).length, 0)
      + (d.kelompok_samping||[]).filter(s=>s.nama && s.nama.trim()).length;
    return `<div class="panitia-card">
      <div class="pc-title">${esc(d.judul || '(Tanpa judul)')}</div>
      <div class="pc-meta">${[d.hari, d.tanggal?fmtDate(d.tanggal):''].filter(Boolean).join(', ') || 'Belum ada tanggal'}</div>
      <div class="pc-meta">${esc(d.tempat || '-')}</div>
      <div class="pc-count">${jumlahOrang} orang tercatat</div>
      <div class="pc-actions">
        <button class="btn small" onclick="panitiaBuka('${d.id}')">Buka</button>
        <button class="btn secondary small" onclick="panitiaDuplikat('${d.id}')" ${!isLoggedIn?'disabled':''}>Duplikat</button>
        <button class="icon-btn" onclick="panitiaHapus('${d.id}')" ${!isLoggedIn?'disabled':''} title="Hapus">🗑</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="panel">
    <div class="panel-head">
      <div><h3>🗂️ Panitia / Sinoman</h3><div class="desc">Susunan panitia acara warga (hajatan, sinoman, dll) — tidak terikat event 17-an yang aktif.</div></div>
      ${isLoggedIn ? `<button class="btn" onclick="panitiaBuatBaru()">+ Susunan Baru</button>` : ''}
    </div>
    <div class="panel-body">
      ${list.length ? `<div class="panitia-grid">${cards}</div>` : `
        <div class="empty-state">
          <h3>Belum ada susunan panitia</h3>
          <p>${isLoggedIn ? 'Buat susunan panitia pertama untuk acara warga, misalnya resepsi pernikahan.' : 'Login untuk membuat susunan panitia.'}</p>
          ${isLoggedIn ? `<button class="btn" onclick="panitiaBuatBaru()">+ Susunan Baru</button>` : `<button class="btn" onclick="openLoginModal()">🔑 Login</button>`}
        </div>`}
    </div>
  </div>`;
}

function renderPanitiaEditor(doc){
  const isLoggedIn = !!getCurrentUser();
  const dis = isLoggedIn ? '' : 'disabled';
  const namaListId = 'panitia-nama-list';
  const namaOptions = panitiaDaftarNama().map(n=>`<option value="${esc(n)}">`).join('');

  const jadwalRows = doc.jadwal_piket.map((r,idx)=>`
    <tr>
      <td class="pt-no">${idx+1}</td>
      <td><input class="pt-input" list="${namaListId}" value="${esc(r.pagi)}" ${dis} oninput="panitiaSetJadwal('${doc.id}',${idx},'pagi',this.value)"></td>
      <td><input class="pt-input" list="${namaListId}" value="${esc(r.siang)}" ${dis} oninput="panitiaSetJadwal('${doc.id}',${idx},'siang',this.value)"></td>
      <td><input class="pt-input" list="${namaListId}" value="${esc(r.sore)}" ${dis} oninput="panitiaSetJadwal('${doc.id}',${idx},'sore',this.value)"></td>
      <td class="editor-controls pt-row-tools">${isLoggedIn?`<button class="icon-btn" onclick="panitiaRemoveJadwalRow('${doc.id}',${idx})" title="Hapus baris">✕</button>`:''}</td>
    </tr>`).join('');

  const kelompokHtml = doc.kelompok_utama.map((g, gIdx) => {
    const rows = g.rows.map((r, rIdx) => r.isLabel ? `
      <tr class="pt-label-row">
        <td colspan="2">
          <input class="pt-input pt-label-input" value="${esc(r.nama)}" ${dis} placeholder="Label (mis. Prasmanan)" oninput="panitiaSetRowNama('${doc.id}',${gIdx},${rIdx},this.value)">
        </td>
        <td class="editor-controls pt-row-tools">
          ${isLoggedIn?`<button class="icon-btn" onclick="panitiaToggleRowLabel('${doc.id}',${gIdx},${rIdx})" title="Jadikan baris nama biasa">🏷</button><button class="icon-btn" onclick="panitiaRemoveRow('${doc.id}',${gIdx},${rIdx})" title="Hapus baris">✕</button>`:''}
        </td>
      </tr>` : `
      <tr>
        <td class="pt-no">${rIdx+1}</td>
        <td><input class="pt-input" list="${namaListId}" value="${esc(r.nama)}" ${dis} placeholder="Nama" oninput="panitiaSetRowNama('${doc.id}',${gIdx},${rIdx},this.value)"></td>
        <td class="editor-controls pt-row-tools">
          ${isLoggedIn?`<button class="icon-btn" onclick="panitiaToggleRowLabel('${doc.id}',${gIdx},${rIdx})" title="Jadikan label (mis. Prasmanan)">🏷</button><button class="icon-btn" onclick="panitiaRemoveRow('${doc.id}',${gIdx},${rIdx})" title="Hapus baris">✕</button>`:''}
        </td>
      </tr>`).join('');

    return `<div class="pt-group">
      <div class="pt-group-head">
        <input class="pt-input pt-group-title" value="${esc(g.judul)}" ${dis} oninput="panitiaSetKelompokJudul('${doc.id}',${gIdx},this.value)">
        ${isLoggedIn?`<button class="icon-btn editor-controls" onclick="panitiaRemoveKelompok('${doc.id}',${gIdx})" title="Hapus kelompok">🗑</button>`:''}
      </div>
      <div class="pt-koor-row">
        <span class="pt-koor-label">Koor:</span>
        <input class="pt-input" list="${namaListId}" value="${esc(g.koor)}" ${dis} placeholder="(opsional)" oninput="panitiaSetKelompokKoor('${doc.id}',${gIdx},this.value)">
      </div>
      <table class="panitia-table">
        <tbody>${rows || `<tr><td colspan="3" class="pt-empty-row">Belum ada anggota</td></tr>`}</tbody>
      </table>
      ${isLoggedIn?`<button class="btn secondary small editor-controls" onclick="panitiaAddRow('${doc.id}',${gIdx})">+ Baris</button>`:''}
    </div>`;
  }).join('');

  const sampingHtml = doc.kelompok_samping.map((s, idx) => `
    <div class="pt-side-row">
      <input class="pt-input pt-side-label" value="${esc(s.label)}" ${dis} oninput="panitiaSetSampingLabel('${doc.id}',${idx},this.value)">
      <span class="pt-colon">:</span>
      <input class="pt-input pt-side-nama" list="${namaListId}" value="${esc(s.nama)}" ${dis} placeholder="Nama" oninput="panitiaSetSampingNama('${doc.id}',${idx},this.value)">
      ${isLoggedIn?`<button class="icon-btn editor-controls" onclick="panitiaRemoveSamping('${doc.id}',${idx})" title="Hapus">✕</button>`:''}
    </div>`).join('');

  return `<datalist id="${namaListId}">${namaOptions}</datalist>
  <input type="file" id="ttd-input-${doc.id}" accept="image/*" style="display:none" onchange="panitiaUploadTTD('${doc.id}', this)">

  <div class="panitia-toolbar">
    <button class="btn secondary small" onclick="panitiaKembali()">← Daftar</button>
    <div class="spacer"></div>
    ${isLoggedIn?`<button class="btn secondary small" onclick="panitiaUploadTTDTrigger('${doc.id}')">📌 Upload TTD</button>`:''}
    ${isLoggedIn?`<button class="btn secondary small" onclick="panitiaSimpanManual('${doc.id}')">💾 Simpan</button>`:''}
    <button class="btn small" onclick="panitiaExportJPEG('${doc.id}')">⬇ Unduh JPEG</button>
  </div>

  <div class="panitia-paper" id="panitia-capture-${doc.id}">
    <div class="pt-head">
      <input class="pt-input pt-title" value="${esc(doc.judul)}" ${dis} oninput="panitiaSetTop('${doc.id}','judul',this.value)">
      <div class="pt-org-row">
        <input class="pt-input pt-org" value="${esc(doc.organisasi)}" ${dis} oninput="panitiaSetTop('${doc.id}','organisasi',this.value)">
      </div>
      <div class="pt-org-detail">
        (Dk. <input class="pt-input pt-inline" value="${esc(doc.dusun)}" placeholder="dusun" ${dis} oninput="panitiaSetTop('${doc.id}','dusun',this.value)">,
        Ds. <input class="pt-input pt-inline" value="${esc(doc.desa)}" placeholder="desa" ${dis} oninput="panitiaSetTop('${doc.id}','desa',this.value)">,
        Kec. <input class="pt-input pt-inline" value="${esc(doc.kecamatan)}" placeholder="kecamatan" ${dis} oninput="panitiaSetTop('${doc.id}','kecamatan',this.value)">,
        <input class="pt-input pt-inline" value="${esc(doc.kabupaten)}" placeholder="kabupaten" ${dis} oninput="panitiaSetTop('${doc.id}','kabupaten',this.value)">)
      </div>
      <div class="pt-meta-row">
        <span>Hari/Tanggal:</span>
        <input class="pt-input pt-inline" value="${esc(doc.hari)}" placeholder="Hari" ${dis} oninput="panitiaSetTop('${doc.id}','hari',this.value)">,
        <input class="pt-input pt-inline pt-date" type="date" value="${esc(doc.tanggal)}" ${dis} oninput="panitiaSetTop('${doc.id}','tanggal',this.value)">
      </div>
      <div class="pt-meta-row">
        <span>Tempat:</span>
        <input class="pt-input pt-inline pt-tempat" value="${esc(doc.tempat)}" placeholder="mis. Bpk Tamin, RT 02" ${dis} oninput="panitiaSetTop('${doc.id}','tempat',this.value)">
      </div>
    </div>

    <div class="pt-body">
      <div class="pt-main">
        <div class="pt-section-title">Jadwal Piket</div>
        <table class="panitia-table pt-jadwal-table">
          <thead><tr><th></th><th>Pagi</th><th>Siang</th><th>Sore</th><th class="editor-controls"></th></tr></thead>
          <tbody>${jadwalRows}</tbody>
        </table>
        ${isLoggedIn?`<button class="btn secondary small editor-controls" onclick="panitiaAddJadwalRow('${doc.id}')">+ Baris</button>`:''}

        ${kelompokHtml}
        ${isLoggedIn?`<button class="btn secondary small editor-controls" onclick="panitiaAddKelompok('${doc.id}')">+ Kelompok Baru</button>`:''}
      </div>

      <div class="pt-side">
        <div class="pt-section-title">Lain-lain</div>
        ${sampingHtml}
        ${isLoggedIn?`<button class="btn secondary small editor-controls" onclick="panitiaAddSamping('${doc.id}')">+ Kelompok Baru</button>`:''}
      </div>
    </div>

    <div class="pt-penutup">
      Ditandatangani di ${esc(doc.dusun || '________')}, ${doc.tanggal ? fmtDate(doc.tanggal) : '________'}
    </div>
    <div class="pt-signature">
      <div class="sign-block">
        <div class="sign-label">
          <input class="pt-input pt-inline pt-center" value="${esc(doc.ketua_jabatan)}" ${dis} oninput="panitiaSetTop('${doc.id}','ketua_jabatan',this.value)">,
        </div>
        <div class="pt-ttd-area">
          ${doc.ttd_url ? `<img src="${doc.ttd_url}" class="pt-ttd-img">${isLoggedIn?`<button class="icon-btn editor-controls pt-ttd-remove" onclick="panitiaRemoveTTD('${doc.id}')" title="Hapus TTD">✕</button>`:''}` : `<div class="sign-space"></div>`}
        </div>
        <input class="pt-input pt-inline pt-center sign-name" list="${namaListId}" value="${esc(doc.ketua_nama)}" placeholder="Nama Ketua" ${dis} oninput="panitiaSetTop('${doc.id}','ketua_nama',this.value)">
      </div>
    </div>
  </div>`;
}

/* ============================================================
   GUDANG ASET DESA
   Modul hasil merger dari aplikasi "Sedesa" (buku pinjam aset desa).
   Tidak terikat event 17-an (aset desa bersifat permanen), makanya
   ada di EVENTLESS_SECTIONS. Data disimpan di tabel kt_gudang_*
   pada project Supabase Merdeka yang sama (bukan project terpisah
   lagi). Hak kelola memakai role login Merdeka: hanya admin yang
   boleh mengelola aset/status/riwayat — user & petugas & guest cuma
   bisa lihat stok & mengajukan pinjam, sama seperti dulu (dulu warga
   umum tidak butuh login sama sekali untuk mengajukan pinjam).
   ============================================================ */
let gudangInventory = [];
let gudangTransactions = [];
let gudangSubTab = 'stok'; // stok | pinjam | histori | kelola
let gudangLoaded = false;
let gudangSearchStok = '';
let gudangSearchHistori = '';
let gudangFilterHistori = '';
const GUDANG_HIST_KEEP = 10;

function gudangCanKelola(){ return isAdmin(); }

async function loadGudangData(){
  try{
    const [invRes, trxRes, itemsRes] = await Promise.all([
      sb.from('kt_gudang_inventory').select('*').order('created_at', {ascending:true}),
      sb.from('kt_gudang_transactions').select('*').order('created_at', {ascending:false}),
      sb.from('kt_gudang_transaction_items').select('*'),
    ]);
    if(invRes.error){ console.error('Gagal memuat kt_gudang_inventory:', invRes.error); return; }
    if(trxRes.error){ console.error('Gagal memuat kt_gudang_transactions:', trxRes.error); return; }
    if(itemsRes.error){ console.error('Gagal memuat kt_gudang_transaction_items:', itemsRes.error); return; }

    gudangInventory = (invRes.data||[]).map(r=>({
      id:r.id, nama:r.nama, gudang:r.gudang, total:r.total, tersedia:r.tersedia,
      isActive: r.is_active !== false, lastUpdated: r.last_updated,
    }));
    const items = itemsRes.data||[];
    gudangTransactions = (trxRes.data||[]).map(r=>({
      id:r.id, resi:r.resi, nama:r.nama, alamat:r.alamat, wa:r.wa,
      tglPinjam:r.tgl_pinjam, tglKembali:r.tgl_kembali, status:r.status, createdAt:r.created_at,
      items: items.filter(it=>it.transaction_id===r.id).map(it=>({itemId:it.item_id, nama:it.nama, gudang:it.gudang, qty:it.qty})),
    }));
    gudangLoaded = true;
  }catch(e){
    console.error('Gagal memuat data Gudang:', e);
    toast('⚠️ Gagal memuat data Gudang Aset.');
  }
}

async function gudangRefresh(){
  toast('⏳ Menyegarkan data Gudang...');
  await loadGudangData();
  if(currentSection==='gudang'){ renderContent(); }
  toast('✅ Data Gudang diperbarui.');
}

function gudangGroupByLokasi(list){
  const map = {}; const order = [];
  list.forEach(i=>{ if(!map[i.gudang]){ map[i.gudang]=[]; order.push(i.gudang); } map[i.gudang].push(i); });
  order.sort((a,b)=>a.localeCompare(b,'id'));
  order.forEach(g=>map[g].sort((a,b)=>a.nama.localeCompare(b.nama,'id')));
  return {order, map};
}

function gudangStokBadgeClass(tersedia, total){
  if(tersedia<=0) return 'stok-habis';
  if(tersedia<=Math.max(1,Math.round(total*0.15))) return 'stok-menipis';
  return '';
}

function fmtGudangTanggal(iso){ if(!iso) return '—'; const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }

/* ============================================================
   RENDER UTAMA
   ============================================================ */
function renderGudang(){
  if(!gudangLoaded){
    loadGudangData().then(()=>{ if(currentSection==='gudang') renderContent(); });
    return `<div class="empty-state"><h3>Memuat data Gudang...</h3><p>Mohon tunggu sebentar.</p></div>`;
  }

  const isLoggedIn = !!getCurrentUser();
  const canKelola = gudangCanKelola();
  const tabs = [
    {key:'stok', label:'Stok Barang'},
    {key:'pinjam', label:'Ajukan Pinjam'},
    {key:'histori', label:'Riwayat Peminjaman'},
  ];
  if(canKelola) tabs.push({key:'kelola', label:'Kelola Inventaris'});
  if(!tabs.find(t=>t.key===gudangSubTab)) gudangSubTab = 'stok';

  const tabsHtml = `<div class="gudang-tabs">
    ${tabs.map(t=>`<button class="btn ${gudangSubTab===t.key?'':'secondary'} small" onclick="gudangSwitchTab('${t.key}')">${t.label}</button>`).join('')}
  </div>`;

  let body = '';
  if(gudangSubTab==='stok') body = renderGudangStok();
  else if(gudangSubTab==='pinjam') body = renderGudangPinjam();
  else if(gudangSubTab==='histori') body = renderGudangHistori();
  else if(gudangSubTab==='kelola' && canKelola) body = renderGudangKelola();
  else body = renderGudangStok();

  return `${tabsHtml}${body}`;
}

function gudangSwitchTab(key){ gudangSubTab = key; renderContent(); }

/* ============================================================
   TAB: STOK BARANG (publik — bisa dilihat guest)
   ============================================================ */
function renderGudangStok(){
  const q = gudangSearchStok.toLowerCase();
  const aktif = gudangInventory.filter(i=>i.isActive && i.nama.toLowerCase().includes(q));
  const {order, map} = gudangGroupByLokasi(aktif);

  const sections = order.map(lokasi=>{
    const items = map[lokasi];
    const totalUnit = items.reduce((s,i)=>s+i.total,0);
    const tersediaUnit = items.reduce((s,i)=>s+i.tersedia,0);
    const cards = items.map(i=>{
      const pct = i.total>0 ? Math.round((i.tersedia/i.total)*100) : 0;
      const cls = gudangStokBadgeClass(i.tersedia, i.total);
      const label = i.tersedia<=0 ? 'Habis' : `${i.tersedia} / ${i.total} tersedia`;
      return `<div class="gudang-item-card">
        <div class="gudang-item-name">${esc(i.nama)}</div>
        <div class="gudang-item-stok"><span class="badge ${cls||'lunas'}">${label}</span></div>
        <div class="gudang-item-bar"><div class="gudang-item-bar-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="gudang-item-meta">Stok diperbarui: ${i.lastUpdated?fmtGudangTanggal(i.lastUpdated):'—'}</div>
      </div>`;
    }).join('');
    return `<div class="gudang-lokasi-block">
      <div class="gudang-lokasi-head"><span>📦 ${esc(lokasi)}</span><span class="badge">${tersediaUnit} / ${totalUnit} unit tersedia</span></div>
      <div class="gudang-item-grid">${cards}</div>
    </div>`;
  }).join('');

  return `
  <div class="panel">
    <div class="panel-head">
      <div><h3>Inventaris Aset Desa</h3><div class="desc">Daftar aset dan ketersediaan stok per gudang/lokasi. Data ini terbuka untuk seluruh warga.</div></div>
    </div>
    <div class="panel-body">
      <div class="filter-row">
        <div class="search-box" style="flex:1;min-width:200px;">
          <input type="text" id="gudang-search-stok" placeholder="🔍 Cari nama barang..." value="${esc(gudangSearchStok)}" oninput="gudangSearchStok=this.value; renderContent();">
        </div>
      </div>
      ${aktif.length ? sections : `<div class="empty-state"><h3>Tidak ada aset</h3><p>${q?'Tidak ditemukan aset yang cocok dengan pencarian.':'Belum ada aset tercatat.'}</p></div>`}
    </div>
  </div>`;
}

/* ============================================================
   TAB: AJUKAN PINJAM
   ============================================================ */
function renderGudangPinjam(){
  const belumKembali = gudangTransactions.filter(t=>t.status==='aktif'||t.status==='bermasalah');
  const totalUnitBelumKembali = belumKembali.reduce((s,t)=>s+t.items.reduce((x,it)=>x+it.qty,0),0);

  const statusCard = belumKembali.length===0 ? `
    <div class="panel" style="border-left:3px solid var(--hijau);">
      <div class="panel-body"><b>✅ Semua Barang Sudah Kembali</b><div class="desc" style="margin-top:4px;">Tidak ada peminjaman yang sedang berjalan saat ini.</div></div>
    </div>` : `
    <div class="panel" style="border-left:3px solid var(--orange);">
      <div class="panel-body">
        <b>⚠️ ${totalUnitBelumKembali} unit belum kembali</b>
        <div class="desc" style="margin-top:4px;">${belumKembali.length} peminjaman masih berada di luar gudang. Lihat detailnya di tab Riwayat Peminjaman.</div>
      </div>
    </div>`;

  return `
  ${statusCard}
  <div class="panel">
    <div class="panel-head">
      <div><h3>Pengajuan Pinjam Aset</h3><div class="desc">Isi form untuk meminjam barang inventaris desa. Stok akan berkurang otomatis setelah pengajuan dikirim.</div></div>
      <button class="btn" onclick="openGudangPinjamModal()">+ Ajukan Peminjaman</button>
    </div>
  </div>`;
}

// Nota nomor & tampilan dipakai di 2 tempat: modal konfirmasi sebelum kirim,
// dan tab Riwayat Peminjaman (supaya peminjam bisa lihat ulang nota yang sudah disetujui).
function buildGudangNotaHtml({resi, nama, alamat, pencatat, tglPinjam, tglKembali, items, tanggalCetak, statusHtml}){
  const dataPeminjam = [
    ['Nama Peminjam', esc(nama)],
    ['RT / Alamat', esc(alamat)],
  ];
  const dataPeminjaman = [
    ['Pencatat', esc(pencatat)],
    ['Tanggal Pinjam', fmtGudangTanggal(tglPinjam)],
    ['Rencana Kembali', fmtGudangTanggal(tglKembali)],
  ];
  const totalQty = items.reduce((s,it)=>s+Number(it.qty||0),0);
  // Kolom "Gudang" digabung jadi sub-teks di bawah nama barang (bukan kolom
  // terpisah) supaya tabel cuma 3 kolom — di layar HP yang sempit, 4 kolom
  // (No/Nama/Gudang/Qty) gampang kepotong di sisi kanan karena kolom Gudang
  // ikut rebutan lebar dengan kolom lain.
  const itemRows = items.map((it,i)=>`<tr>
    <td class="no">${i+1}</td>
    <td class="nama-cell"><div class="nb-nama">${esc(it.nama)}</div><div class="nb-gudang">${esc(it.gudang)}</div></td>
    <td class="num">${it.qty}</td>
  </tr>`).join('');
  return `
    <div class="nota-sheet" id="gudang-nota-sheet">
      <div class="nota-header">
        <img src="icons/logo-kop.png" alt="Logo Karang Taruna Inti" class="nota-logo">
        <div class="nota-header-text">
          <div class="nota-org">Karang Taruna Inti</div>
          <div class="nota-org-sub">Bagian Gudang &amp; Inventaris</div>
        </div>
        <div class="nota-title-wrap">
          <div class="nota-title">Nota Pengajuan Pinjam</div>
          <div class="nota-no">No. ${esc(resi)} · ${fmtGudangTanggal(tanggalCetak)}</div>
        </div>
      </div>
      <div class="nota-body">
        <div class="nota-section-label">Data Peminjam</div>
        <div class="nota-info-grid">
          ${dataPeminjam.map(([l,v])=>`<div class="nota-info-item"><span class="l">${l}</span><span class="v">${v}</span></div>`).join('')}
        </div>
        <div class="nota-section-label">Detail Peminjaman</div>
        <div class="nota-info-grid">
          ${dataPeminjaman.map(([l,v])=>`<div class="nota-info-item"><span class="l">${l}</span><span class="v">${v}</span></div>`).join('')}
        </div>
        <div class="nota-section-label">Rincian Barang</div>
        <table class="nota-table">
          <thead><tr><th style="width:24px;">No</th><th>Nama Barang</th><th class="num">Qty</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot><tr class="nota-total-row"><td colspan="2">Total ${items.length} jenis barang</td><td class="num">${totalQty} unit</td></tr></tfoot>
        </table>
      </div>
      ${statusHtml || ''}
    </div>`;
}

// Opsi RT pada form pengajuan pinjam — beda dari RT_LIST menu Anggota, karena di sini
// perlu opsi "Lainnya" untuk peminjam dari luar desa (input alamat manual).
const GUDANG_PINJAM_RT_LIST = [
  {v:'rt1', l:'RT 1'},
  {v:'rt2', l:'RT 2'},
  {v:'rt3', l:'RT 3'},
  {v:'lainnya', l:'Lainnya (Luar Desa)'},
];
let _gudangPinjamRows = [];
let _gudangPinjamHeader = {nama:'', rt:'', alamatCustom:'', pencatat:'', tglPinjam:'', tglKembali:''};
function openGudangPinjamModal(){
  const aktif = gudangInventory.filter(i=>i.isActive);
  if(aktif.length===0){ toast('⛔ Belum ada aset aktif yang bisa dipinjam.'); return; }
  _gudangPinjamRows = [{itemId:'', qty:1}];
  _gudangPinjamHeader = {nama:'', rt:'', alamatCustom:'', pencatat:'', tglPinjam:todayISO(), tglKembali:''};
  renderGudangPinjamModalBody();
}
function gudangComboIconChevron(){
  return `<svg class="combo-chevron" width="15" height="15" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function gudangComboIconCheck(){
  return `<svg class="combo-check" width="15" height="15" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function gudangComboItemLabel(i){ return i ? `${i.nama} — ${i.gudang}` : ''; }
function gudangComboPanelHtml(idx, selectedId){
  const {order, map} = gudangGroupByLokasi(gudangInventory.filter(i=>i.isActive));
  const groupsHtml = order.map(lokasi=>`
    <div class="combo-group" data-combo-group>
      <div class="combo-group-label">${esc(lokasi)}</div>
      ${map[lokasi].map(i=>{
        const habis = i.tersedia<=0;
        const selected = i.id===selectedId;
        return `<button type="button" class="combo-option${habis?' disabled':''}${selected?' selected':''}"
          ${habis?'disabled':`onclick="selectGudangComboItem(${idx}, '${i.id}')"`}>
          <span class="combo-option-main">
            <span class="combo-option-name">${esc(i.nama)}</span>
          </span>
          <span class="combo-option-side">
            ${habis ? '<span class="badge stok-habis">Habis</span>' : `<span class="combo-option-sisa">Sisa ${i.tersedia}</span>`}
            ${selected ? gudangComboIconCheck() : ''}
          </span>
        </button>`;
      }).join('')}
    </div>`).join('');
  return `
    <div class="combo-list" data-combo-list>${groupsHtml || '<div class="combo-empty">Belum ada aset aktif.</div>'}</div>`;
}
let _gudangComboOpenIdx = null;
let _gudangComboPanelEl = null;
function gudangComboPositionPanel(trigger, panel){
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  // Lebar panel dilebarkan minimal 280px (atau lebar trigger kalau memang lebih lebar dari itu),
  // supaya nama barang yang panjang tidak terpotong di layar sempit/mobile — panel tidak lagi
  // dibatasi persis selebar tombol combo yang berbagi ruang dengan kolom Jumlah & tombol hapus.
  const panelWidth = Math.min(vw - 16, Math.max(rect.width, 280));
  panel.style.left = Math.max(8, rect.left) + 'px';
  panel.style.width = panelWidth + 'px';
  // Ukur tinggi panel dulu (sudah ada di body tapi belum "show") supaya bisa hitung apakah cukup ruang di bawah.
  const panelH = panel.offsetHeight || 320;
  const spaceBelow = vh - rect.bottom;
  const spaceAbove = rect.top;
  if(spaceBelow < panelH + 12 && spaceAbove > spaceBelow){
    panel.style.top = Math.max(8, rect.top - panelH - 6) + 'px';
  } else {
    panel.style.top = (rect.bottom + 6) + 'px';
  }
  // Jangan sampai melebar keluar dari layar di kanan
  const maxLeft = vw - panelWidth - 8;
  if(parseFloat(panel.style.left) > maxLeft) panel.style.left = Math.max(8, maxLeft) + 'px';
}
function gudangRTComboPanelHtml(selectedValue){
  const optionsHtml = GUDANG_PINJAM_RT_LIST.map(r=>{
    const selected = r.v === selectedValue;
    return `<button type="button" class="combo-option${selected?' selected':''}" onclick="selectGudangRT('${r.v}')">
      <span class="combo-option-main"><span class="combo-option-name">${esc(r.l)}</span></span>
      <span class="combo-option-side">${selected ? gudangComboIconCheck() : ''}</span>
    </button>`;
  }).join('');
  return `<div class="combo-list" data-combo-list>${optionsHtml}</div>`;
}
function toggleGudangRTCombo(){
  const trigger = document.getElementById('gp-rt-trigger');
  if(!trigger) return;
  if(_gudangComboOpenIdx === 'rt'){ closeAllGudangCombos(); return; }
  closeAllGudangCombos();
  const panel = document.createElement('div');
  panel.className = 'combo-panel combo-panel-floating';
  panel.id = 'gudang-combo-floating';
  panel.innerHTML = gudangRTComboPanelHtml(_gudangPinjamHeader.rt);
  document.body.appendChild(panel);
  gudangComboPositionPanel(trigger, panel);
  requestAnimationFrame(()=>panel.classList.add('show'));
  trigger.classList.add('open');
  _gudangComboOpenIdx = 'rt';
  _gudangComboPanelEl = panel;
}
function selectGudangRT(v){
  _gudangPinjamHeader.rt = v;
  closeAllGudangCombos();
  renderGudangPinjamModalBody();
}
function toggleGudangCombo(idx){
  const trigger = document.getElementById(`gp-combo-trigger-${idx}`);
  if(!trigger) return;
  if(_gudangComboOpenIdx === idx){ closeAllGudangCombos(); return; }
  closeAllGudangCombos();
  const row = _gudangPinjamRows[idx];
  const panel = document.createElement('div');
  panel.className = 'combo-panel combo-panel-floating';
  panel.id = 'gudang-combo-floating';
  panel.innerHTML = gudangComboPanelHtml(idx, row ? row.itemId : '');
  document.body.appendChild(panel);
  gudangComboPositionPanel(trigger, panel);
  requestAnimationFrame(()=>panel.classList.add('show'));
  trigger.classList.add('open');
  _gudangComboOpenIdx = idx;
  _gudangComboPanelEl = panel;
}
function closeAllGudangCombos(){
  if(_gudangComboPanelEl){ _gudangComboPanelEl.remove(); _gudangComboPanelEl = null; }
  document.querySelectorAll('.combo-trigger.open').forEach(t=>t.classList.remove('open'));
  _gudangComboOpenIdx = null;
}
function selectGudangComboItem(idx, itemId){
  _gudangPinjamRows[idx].itemId = itemId;
  closeAllGudangCombos();
  renderGudangPinjamModalBody();
}
document.addEventListener('click', (e)=>{
  if(e.target.closest('.combo-panel-floating') || e.target.closest('.combo-trigger')) return;
  closeAllGudangCombos();
});
function gudangComboRepositionOpen(){
  if(_gudangComboOpenIdx===null || !_gudangComboPanelEl) return;
  const trigger = document.getElementById(`gp-combo-trigger-${_gudangComboOpenIdx}`);
  if(!trigger || !document.body.contains(trigger)){ closeAllGudangCombos(); return; }
  gudangComboPositionPanel(trigger, _gudangComboPanelEl);
}
// Pakai reposisi (bukan tutup) saat resize/scroll — resize sering terpicu oleh
// keyboard HP yang muncul waktu kolom cari di-fokus, jadi kalau langsung ditutup
// dropdown-nya akan langsung hilang lagi begitu baru dibuka (flicker berulang).
window.addEventListener('resize', gudangComboRepositionOpen);
window.addEventListener('scroll', gudangComboRepositionOpen, true);
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape') closeAllGudangCombos();
});
function renderGudangPinjamModalBody(){
  const activeInv = gudangInventory.filter(i=>i.isActive);
  const rowsHtml = _gudangPinjamRows.map((r,idx)=>{
    const selectedItem = activeInv.find(i=>i.id===r.itemId);
    return `
    <div class="item-fields-row" style="display:flex; gap:8px; align-items:flex-end; margin-bottom:10px;">
      <div class="field combo" style="flex:2; margin-bottom:0; position:relative;">
        ${idx===0 ? `<label>Barang <span class="combo-hint">— ketuk untuk lihat daftar &amp; stok</span></label>` : ''}
        <button type="button" id="gp-combo-trigger-${idx}" class="combo-trigger${selectedItem?'':' placeholder'}" onclick="toggleGudangCombo(${idx})">
          <span class="combo-trigger-label">${selectedItem ? esc(gudangComboItemLabel(selectedItem)) : '-- Pilih Barang --'}</span>
          ${gudangComboIconChevron()}
        </button>
      </div>
      <div class="field" style="flex:1; margin-bottom:0;">
        ${idx===0 ? `<label>Jumlah</label>` : ''}
        <input type="number" min="1" value="${r.qty}" oninput="_gudangPinjamRows[${idx}].qty=parseInt(this.value,10)||1">
      </div>
      <button type="button" class="icon-btn" title="Hapus baris" onclick="gudangPinjamRemoveRow(${idx})">🗑</button>
    </div>`;
  }).join('');

  const rtValue = _gudangPinjamHeader.rt;
  const isLainnya = rtValue === 'lainnya';
  const rtSelected = GUDANG_PINJAM_RT_LIST.find(r=>r.v===rtValue);
  const body = `
    <div class="field"><label>Nama Peminjam</label><input type="text" id="gp-nama" placeholder="Nama lengkap peminjam" value="${esc(_gudangPinjamHeader.nama)}" oninput="_gudangPinjamHeader.nama=this.value"></div>
    <div class="field combo" style="margin-bottom:0; position:relative;">
      <label>RT</label>
      <button type="button" id="gp-rt-trigger" class="combo-trigger${rtSelected?'':' placeholder'}" onclick="toggleGudangRTCombo()">
        <span class="combo-trigger-label">${rtSelected ? esc(rtSelected.l) : '-- Pilih RT --'}</span>
        ${gudangComboIconChevron()}
      </button>
    </div>
    ${isLainnya ? `<div class="field" style="margin-top:14px;"><label>Alamat Lengkap <span class="combo-hint">— untuk peminjam luar desa</span></label><input type="text" id="gp-alamat-custom" placeholder="Contoh: Ds. Sukamaju, Kec. ..." value="${esc(_gudangPinjamHeader.alamatCustom)}" oninput="_gudangPinjamHeader.alamatCustom=this.value"></div>` : `<div style="margin-bottom:14px;"></div>`}
    <div class="field"><label>Nama Pencatat</label><input type="text" id="gp-pencatat" placeholder="Nama petugas pencatat" value="${esc(_gudangPinjamHeader.pencatat)}" oninput="_gudangPinjamHeader.pencatat=this.value"></div>
    <div class="filter-row">
      <div class="field" style="flex:1;"><label>Tanggal Pinjam</label><input type="date" id="gp-tgl-pinjam" value="${esc(_gudangPinjamHeader.tglPinjam)}" oninput="_gudangPinjamHeader.tglPinjam=this.value"></div>
      <div class="field" style="flex:1;"><label>Rencana Kembali</label><input type="date" id="gp-tgl-kembali" value="${esc(_gudangPinjamHeader.tglKembali)}" oninput="_gudangPinjamHeader.tglKembali=this.value"></div>
    </div>
    <div style="border-top:1px solid var(--garis); padding-top:14px; margin-top:6px;">
      <label style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-soft); margin-bottom:10px;">Barang yang Dipinjam</label>
      <div id="gp-item-rows">${rowsHtml}</div>
      <button type="button" class="btn secondary small" onclick="gudangPinjamAddRow()">+ Tambah Barang Lain</button>
    </div>`;

  setModal('Ajukan Peminjaman Aset', body, [
    {label:'Batal', cls:'secondary', onclick: closeModal},
    {label:'Periksa & Kirim', onclick: gudangValidateAndConfirmPinjam},
  ]);
}
function gudangPinjamAddRow(){
  _gudangPinjamRows.push({itemId:'', qty:1});
  const newIdx = _gudangPinjamRows.length-1;
  renderGudangPinjamModalBody();
  setTimeout(()=>toggleGudangCombo(newIdx), 80);
}
function gudangPinjamRemoveRow(idx){
  if(_gudangPinjamRows.length<=1){ toast('Minimal satu baris barang diperlukan.'); return; }
  closeAllGudangCombos();
  _gudangPinjamRows.splice(idx,1);
  renderGudangPinjamModalBody();
}

function gudangValidateAndConfirmPinjam(){
  const nama = document.getElementById('gp-nama').value.trim();
  const rt = _gudangPinjamHeader.rt;
  if(!rt){ toast('⛔ Pilih RT peminjam.'); return; }
  const rtLabel = (GUDANG_PINJAM_RT_LIST.find(r=>r.v===rt)||{}).l || rt;
  const alamat = rt==='lainnya' ? (document.getElementById('gp-alamat-custom').value.trim()) : rtLabel;
  if(rt==='lainnya' && !alamat){ toast('⛔ Isi alamat lengkap untuk peminjam luar desa.'); return; }
  const wa = document.getElementById('gp-pencatat').value.trim();
  const tglPinjam = document.getElementById('gp-tgl-pinjam').value;
  const tglKembali = document.getElementById('gp-tgl-kembali').value;

  if(!nama || !alamat || !wa || !tglPinjam || !tglKembali){ toast('⛔ Lengkapi semua data peminjam.'); return; }
  if(tglKembali < tglPinjam){ toast('⛔ Tanggal kembali tidak boleh sebelum tanggal pinjam.'); return; }

  const items = [];
  for(const r of _gudangPinjamRows){
    if(!r.itemId){ toast('⛔ Pilih barang pada setiap baris.'); return; }
    if(!r.qty || r.qty<1){ toast('⛔ Jumlah barang harus minimal 1.'); return; }
    const inv = gudangInventory.find(i=>i.id===r.itemId);
    if(!inv){ toast('⛔ Barang tidak ditemukan.'); return; }
    items.push({itemId:r.itemId, nama:inv.nama, gudang:inv.gudang, qty:r.qty});
  }
  const merged = {};
  items.forEach(it=>{ if(merged[it.itemId]) merged[it.itemId].qty+=it.qty; else merged[it.itemId]={...it}; });
  const finalItems = Object.values(merged);
  for(const it of finalItems){
    const inv = gudangInventory.find(i=>i.id===it.itemId);
    if(it.qty > inv.tersedia){ toast(`⛔ Total ${it.nama} melebihi stok tersedia (${inv.tersedia}).`); return; }
  }

  const pending = {nama, alamat, wa, tglPinjam, tglKembali, finalItems};
  const nomorNota = 'NP-' + Date.now().toString().slice(-6);
  const notaHtml = buildGudangNotaHtml({
    resi: nomorNota, nama, alamat, pencatat: wa, tglPinjam, tglKembali,
    items: finalItems, tanggalCetak: todayISO(),
    statusHtml: `<div class="nota-footer">⚠️ <span>Setelah dikirim, stok barang langsung berkurang dan data tersimpan di server. Periksa nama barang &amp; jumlah dengan teliti sebelum melanjutkan.</span></div>`,
  });
  setModal('Periksa Sebelum Mengirim', notaHtml, [
    {label:'Periksa Lagi', cls:'secondary', onclick: renderGudangPinjamModalBody},
    {label:'Ya, Sudah Benar — Kirim', onclick: ()=>gudangSubmitPinjam(pending)},
  ]);
}

async function gudangSubmitPinjam(p){
  closeModal();
  toast('⏳ Mengirim pengajuan...');
  try{
    const seqRes = await sb.rpc('kt_gudang_claim_next_resi', {});
    if(seqRes.error || !seqRes.data || !seqRes.data.length) throw new Error(seqRes.error?.message || 'Gagal mengklaim nomor resi.');
    const seq = seqRes.data[0].seq;
    const resi = 'TRX-' + String(seq).padStart(3,'0');
    const trxId = uid();

    const insTrx = await sb.from('kt_gudang_transactions').insert({
      id: trxId, resi, nama:p.nama, alamat:p.alamat, wa:p.wa,
      tgl_pinjam:p.tglPinjam, tgl_kembali:p.tglKembali, status:'aktif',
    });
    if(insTrx.error) throw new Error(insTrx.error.message);

    const decremented = [];
    for(const it of p.finalItems){
      const r = await sb.rpc('kt_gudang_borrow_stock', {p_item_id: it.itemId, p_qty: it.qty});
      if(r.error || !r.data || !r.data.length){
        // rollback
        for(const d of decremented){ try{ await sb.rpc('kt_gudang_return_stock', {p_item_id:d.itemId, p_qty:d.qty}); }catch(e){} }
        try{ await sb.from('kt_gudang_transactions').delete().eq('id', trxId); }catch(e){}
        throw new Error(`Stok "${it.nama}" tidak cukup — mungkin baru saja dipinjam orang lain. Silakan coba lagi.`);
      }
      decremented.push(it);
      const invItem = gudangInventory.find(i=>i.id===it.itemId);
      if(invItem) invItem.tersedia = r.data[0].tersedia;
    }

    for(const it of p.finalItems){
      await sb.from('kt_gudang_transaction_items').insert({transaction_id:trxId, item_id:it.itemId, nama:it.nama, gudang:it.gudang, qty:it.qty});
    }

    const trx = {id:trxId, resi, nama:p.nama, alamat:p.alamat, wa:p.wa, tglPinjam:p.tglPinjam, tglKembali:p.tglKembali, status:'aktif', items:p.finalItems};
    gudangTransactions.unshift(trx);
    toast('✅ Peminjaman berhasil disimpan.');
    gudangOpenReceipt(trx);
  }catch(err){
    console.error(err);
    toast('⛔ Gagal menyimpan: ' + err.message);
  }
}

function gudangBuildWaMessage(trx){
  const itemsText = trx.items.map(it=>`- ${it.qty}× ${it.nama} (${it.gudang})`).join('%0A');
  return `*PENGAJUAN PINJAM ASET DESA*%0AResi: ${trx.resi}%0ANama: ${trx.nama}%0AAlamat: ${trx.alamat}%0ATgl Pinjam: ${fmtGudangTanggal(trx.tglPinjam)}%0ARencana Kembali: ${fmtGudangTanggal(trx.tglKembali)}%0A%0ABarang:%0A${itemsText}`;
}
function gudangOpenReceipt(trx){
  const lines = [
    ['Alamat', esc(trx.alamat)], ['Pencatat', esc(trx.wa)],
    ['Tgl Pinjam', fmtGudangTanggal(trx.tglPinjam)], ['Rencana Kembali', fmtGudangTanggal(trx.tglKembali)],
    ...trx.items.map(it=>['Barang', `${it.qty}× ${esc(it.nama)} (${esc(it.gudang)})`]),
  ];
  const body = `<p class="mono" style="font-size:15px; margin:0 0 12px;">#${esc(trx.resi)} — ${esc(trx.nama)}</p>
    ${lines.map(([k,v])=>`<div class="filter-row" style="margin-bottom:4px;"><b style="min-width:120px;">${k}</b><span>${v}</span></div>`).join('')}`;
  setModal('Bukti Pengajuan', body, [
    {label:'Tutup', cls:'secondary', onclick: closeModal},
    {label:'Kirim ke WhatsApp Admin', onclick: ()=>window.open(`https://wa.me/?text=${gudangBuildWaMessage(trx)}`, '_blank')},
  ]);
}

/* ============================================================
   TAB: RIWAYAT PEMINJAMAN
   ============================================================ */
function renderGudangHistori(){
  const canKelola = gudangCanKelola();
  const q = gudangSearchHistori.toLowerCase();
  const filtered = gudangTransactions.filter(t=>{
    const matchQ = t.resi.toLowerCase().includes(q) || t.nama.toLowerCase().includes(q);
    const matchS = !gudangFilterHistori || t.status===gudangFilterHistori;
    return matchQ && matchS;
  });
  const totalFiltered = filtered.length;
  const visible = filtered.slice(0, GUDANG_HIST_KEEP);
  const statusLabel = {aktif:'⏳ Aktif', selesai:'✅ Selesai', bermasalah:'⚠️ Bermasalah'};
  const statusBadgeCls = {aktif:'', selesai:'lunas', bermasalah:'belum'};

  const rows = visible.map(t=>{
    const itemsText = t.items.map(it=>`${it.qty}× ${esc(it.nama)} <span style="color:var(--ink-soft);">[${esc(it.gudang)}]</span>`).join('<br>');
    const statusCell = canKelola
      ? `<select onchange="gudangChangeStatus('${t.id}', this.value)">
          <option value="aktif" ${t.status==='aktif'?'selected':''}>⏳ Aktif</option>
          <option value="selesai" ${t.status==='selesai'?'selected':''}>✅ Selesai</option>
          <option value="bermasalah" ${t.status==='bermasalah'?'selected':''}>⚠️ Bermasalah</option>
        </select>`
      : `<span class="badge ${statusBadgeCls[t.status]||''}">${statusLabel[t.status]||t.status}</span>`;
    return `<tr>
      <td><b>#${esc(t.resi)}</b><div style="font-size:12px; color:var(--ink-soft);">${esc(t.nama)}</div></td>
      <td>${itemsText}</td>
      <td>${fmtGudangTanggal(t.tglPinjam)} → ${fmtGudangTanggal(t.tglKembali)}</td>
      <td>${statusCell}</td>
      <td><button type="button" class="btn secondary small" onclick="gudangShowNota('${t.id}')">🧾 Lihat Nota</button></td>
    </tr>`;
  }).join('');

  const limitNote = totalFiltered > GUDANG_HIST_KEEP
    ? `<p style="font-size:11.5px; color:var(--ink-soft); margin-top:10px;">Menampilkan ${GUDANG_HIST_KEEP} riwayat terbaru dari ${totalFiltered} yang cocok. Riwayat "Selesai" yang sudah lama otomatis dihapus (maks. ${GUDANG_HIST_KEEP} disimpan); Aktif/Bermasalah tidak ikut terhapus.</p>` : '';

  return `
  <div class="panel">
    <div class="panel-head">
      <div><h3>Log Peminjaman</h3><div class="desc">${canKelola?'Ubah status transaksi lewat dropdown.':'Hanya admin yang dapat mengubah status transaksi.'}</div></div>
      ${canKelola?`<button class="btn secondary small" style="border-color:var(--merah); color:var(--merah);" onclick="gudangDeleteAllHistory()">🗑️ Hapus Riwayat Selesai</button>`:''}
    </div>
    <div class="panel-body">
      <div class="filter-row">
        <div class="search-box" style="flex:1;min-width:180px;"><input type="text" id="gudang-search-histori" placeholder="🔍 Cari resi / nama..." value="${esc(gudangSearchHistori)}" oninput="gudangSearchHistori=this.value; renderContent();"></div>
        <div class="field" style="margin-bottom:0;">
          <select onchange="gudangFilterHistori=this.value; renderContent();">
            <option value="">Semua Status</option>
            <option value="aktif" ${gudangFilterHistori==='aktif'?'selected':''}>⏳ Aktif</option>
            <option value="selesai" ${gudangFilterHistori==='selesai'?'selected':''}>✅ Selesai</option>
            <option value="bermasalah" ${gudangFilterHistori==='bermasalah'?'selected':''}>⚠️ Bermasalah</option>
          </select>
        </div>
      </div>
      <div style="overflow-x:auto;">
      <table class="anggota-table">
        <thead><tr><th>Resi / Peminjam</th><th>Barang &amp; Gudang</th><th>Tanggal</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="5">Belum ada transaksi peminjaman tercatat.</td></tr>`}</tbody>
      </table>
      </div>
      ${limitNote}
    </div>
  </div>`;
}

function gudangShowNota(id){
  const t = gudangTransactions.find(x=>x.id===id);
  if(!t) return;
  const statusLabel = {aktif:'⏳ Aktif — masih di luar gudang', selesai:'✅ Selesai — barang sudah dikembalikan', bermasalah:'⚠️ Bermasalah'};
  const statusHtml = `<div class="nota-footer"><span>Status saat ini: <b>${statusLabel[t.status]||t.status}</b> · Nota ini sesuai dengan pengajuan yang sudah disetujui &amp; dikirim peminjam.</span></div>`;
  const notaHtml = buildGudangNotaHtml({
    resi: t.resi, nama: t.nama, alamat: t.alamat, pencatat: t.wa,
    tglPinjam: t.tglPinjam, tglKembali: t.tglKembali, items: t.items,
    tanggalCetak: (t.createdAt||'').slice(0,10) || t.tglPinjam,
    statusHtml,
  });
  setModal('Nota Peminjaman', notaHtml, [
    {label:'Tutup', cls:'secondary', onclick: closeModal},
    {label:'⬇ Unduh JPEG', cls:'', onclick: ()=>gudangExportNotaJPEG(t.resi)},
  ]);
}

// Export tampilan nota (di modal Riwayat Peminjaman) jadi file JPEG, dengan pola
// yang sama seperti panitiaExportJPEG() — pakai html2canvas karena nota-nya
// murni HTML/CSS (bukan gambar), belum ada elemen input yang perlu disamarkan
// seperti pada editor panitia, jadi tidak perlu toggle class 'exporting'.
function gudangExportNotaJPEG(resi){
  const el = document.getElementById('gudang-nota-sheet');
  if(!el){ toast('⛔ Gagal menemukan nota'); return; }
  if(typeof html2canvas === 'undefined'){ toast('⛔ Gagal memuat modul export gambar. Cek koneksi internet lalu muat ulang.'); return; }
  html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
    const link = document.createElement('a');
    const namaFile = (resi || 'nota-peminjaman').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    link.download = `${namaFile || 'nota-peminjaman'}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    toast('⬇ JPEG berhasil diunduh');
  }).catch(err => {
    console.error('Gagal export JPEG nota:', err);
    toast('⛔ Gagal membuat JPEG: ' + (err.message||'error tak dikenal'));
  });
}

async function gudangPruneOldHistory(){
  const selesai = gudangTransactions.filter(t=>t.status==='selesai');
  if(selesai.length <= GUDANG_HIST_KEEP) return;
  const toDelete = selesai.slice(GUDANG_HIST_KEEP);
  const idList = toDelete.map(t=>t.id);
  try{ await sb.from('kt_gudang_transaction_items').delete().in('transaction_id', idList); }catch(e){}
  try{
    await sb.from('kt_gudang_transactions').delete().in('id', idList);
    const delIds = new Set(idList);
    gudangTransactions = gudangTransactions.filter(t=>!delIds.has(t.id));
  }catch(e){ console.warn('Gagal prune riwayat gudang:', e); }
}

async function gudangChangeStatus(id, newStatus){
  if(!gudangCanKelola()){ toast('🔒 Hanya admin yang dapat mengubah status peminjaman.'); renderContent(); return; }
  const t = gudangTransactions.find(x=>x.id===id);
  if(!t) return;
  const wasActive = t.status==='aktif' || t.status==='bermasalah';
  const nowSelesai = newStatus==='selesai';
  try{
    if(nowSelesai && wasActive){
      for(const it of t.items){
        const r = await sb.rpc('kt_gudang_return_stock', {p_item_id: it.itemId, p_qty: it.qty});
        if(!r.error && r.data && r.data[0]){ const inv = gudangInventory.find(i=>i.id===it.itemId); if(inv) inv.tersedia = r.data[0].tersedia; }
      }
    }
    if(t.status==='selesai' && !nowSelesai){
      for(const it of t.items){
        const r = await sb.rpc('kt_gudang_reborrow_stock', {p_item_id: it.itemId, p_qty: it.qty});
        if(!r.error && r.data && r.data[0]){ const inv = gudangInventory.find(i=>i.id===it.itemId); if(inv) inv.tersedia = r.data[0].tersedia; }
      }
    }
    const upd = await sb.from('kt_gudang_transactions').update({status:newStatus}).eq('id', id);
    if(upd.error) throw new Error(upd.error.message);
    t.status = newStatus;
    if(newStatus==='selesai') await gudangPruneOldHistory();
    toast('✅ Status transaksi diperbarui.');
    renderContent();
  }catch(err){
    console.error(err);
    toast('⛔ Gagal update status: ' + err.message);
  }
}

async function gudangDeleteAllHistory(){
  if(!gudangCanKelola()){ toast('🔒 Hanya admin yang dapat menghapus riwayat.'); return; }
  const selesai = gudangTransactions.filter(t=>t.status==='selesai');
  const belumSelesai = gudangTransactions.length - selesai.length;
  if(selesai.length===0){ toast('Tidak ada riwayat berstatus "Selesai" yang bisa dihapus.'); return; }
  const ket = belumSelesai>0 ? `\n\n(${belumSelesai} transaksi Aktif/Bermasalah akan tetap disimpan.)` : '';
  if(!confirm(`Hapus ${selesai.length} riwayat peminjaman berstatus "Selesai"? Tindakan ini tidak dapat dibatalkan.${ket}`)) return;
  if(!confirm('Konfirmasi sekali lagi: riwayat akan dihapus permanen dari server. Lanjutkan?')) return;
  const idList = selesai.map(t=>t.id);
  try{
    await sb.from('kt_gudang_transaction_items').delete().in('transaction_id', idList);
    const del = await sb.from('kt_gudang_transactions').delete().in('id', idList);
    if(del.error) throw new Error(del.error.message);
    const delIds = new Set(idList);
    gudangTransactions = gudangTransactions.filter(t=>!delIds.has(t.id));
    toast(`✅ ${selesai.length} riwayat selesai berhasil dihapus.`);
    renderContent();
  }catch(err){
    console.error(err);
    toast('⛔ Gagal menghapus riwayat: ' + err.message);
  }
}

/* ============================================================
   TAB: KELOLA INVENTARIS (admin only)
   ============================================================ */
function renderGudangKelola(){
  const totalJenis = gudangInventory.length;
  const totalTersedia = gudangInventory.reduce((s,i)=>s+i.tersedia,0);
  const totalDipinjam = gudangInventory.reduce((s,i)=>s+(i.total-i.tersedia),0);
  const q = (gudangSearchKelola||'').toLowerCase();
  const filtered = gudangInventory.filter(i=>i.nama.toLowerCase().includes(q)||i.gudang.toLowerCase().includes(q));

  const rows = filtered.map(i=>{
    const namaLabel = i.isActive ? esc(i.nama) : `${esc(i.nama)} <span class="badge readonly">Nonaktif</span>`;
    const actionBtn = i.isActive
      ? `<button class="icon-btn" title="Nonaktifkan" onclick="gudangDeleteStok('${i.id}')">🗑</button>`
      : `<button class="icon-btn" title="Aktifkan kembali" onclick="gudangAktifkanStok('${i.id}')">↺</button>`;
    return `<tr>
      <td>${namaLabel}</td>
      <td><span class="badge">${esc(i.gudang)}</span></td>
      <td class="num ${gudangStokBadgeClass(i.tersedia,i.total)}">${i.tersedia}</td>
      <td class="num">${i.total}</td>
      <td style="white-space:nowrap;"><button class="icon-btn" title="Edit" onclick="openGudangStokModal('${i.id}')">✎</button>${actionBtn}</td>
    </tr>`;
  }).join('');

  return `
  <div class="stat-grid-ringkasan" style="margin-bottom:20px;">
    <div class="stat-card"><div class="lbl">Jenis Aset</div><div class="val">${totalJenis}</div></div>
    <div class="stat-card pemasukan"><div class="lbl">Unit Tersedia</div><div class="val">${totalTersedia}</div></div>
    <div class="stat-card"><div class="lbl">Unit Dipinjam</div><div class="val">${totalDipinjam}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <div><h3>Data Gudang</h3><div class="desc">Export/import cadangan data inventaris &amp; riwayat peminjaman (JSON).</div></div>
      <div style="display:flex; gap:8px;">
        <button class="btn secondary small" onclick="gudangExportJSON()">⬇ Export JSON</button>
        <button class="btn secondary small" onclick="document.getElementById('gudang-import-input').click()">⬆ Import JSON</button>
        <input type="file" id="gudang-import-input" accept=".json" style="display:none" onchange="gudangImportJSON(this)">
      </div>
    </div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <div><h3>Inventory Terkini</h3></div>
      <button class="btn" onclick="openGudangStokModal()">+ Tambah Aset</button>
    </div>
    <div class="panel-body">
      <div class="filter-row">
        <div class="search-box" style="flex:1;"><input type="text" id="gudang-search-kelola" placeholder="🔍 Cari nama barang atau gudang..." value="${esc(gudangSearchKelola||'')}" oninput="gudangSearchKelola=this.value; renderContent();"></div>
      </div>
      <div style="overflow-x:auto;">
      <table class="anggota-table">
        <thead><tr><th>Barang</th><th>Lokasi</th><th class="num">Tersedia</th><th class="num">Total</th><th></th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="5">Belum ada aset tercatat. Tambahkan lewat tombol di atas.</td></tr>`}</tbody>
      </table>
      </div>
    </div>
  </div>`;
}
let gudangSearchKelola = '';

// Lokasi gudang mengikuti penamaan yang sudah dipakai di data lama ("Gudang RT 1" dst),
// bukan daftar RT umum (RT_LIST) yang dipakai di menu Anggota — supaya aset baru
// masuk ke grup yang sama dengan data lama, bukan bikin grup terpisah.
const GUDANG_LOKASI_LIST = ['Gudang RT 1', 'Gudang RT 2', 'Gudang RT 3', 'Gudang Karang Taruna'];
function gudangLokasiOptions(selectedGudang){
  const known = GUDANG_LOKASI_LIST.map(l=>`<option value="${esc(l)}" ${selectedGudang===l?'selected':''}>${esc(l)}</option>`).join('');
  const legacy = (selectedGudang && !GUDANG_LOKASI_LIST.includes(selectedGudang))
    ? `<option value="${esc(selectedGudang)}" selected>${esc(selectedGudang)} (lama)</option>` : '';
  return `<option value="">-- Pilih Lokasi --</option>${known}${legacy}`;
}
function openGudangStokModal(id){
  const item = id ? gudangInventory.find(i=>i.id===id) : null;
  const dipinjam = item ? (item.total - item.tersedia) : 0;
  const body = `
    <div class="field"><label>Nama Barang</label><input type="text" id="gs-nama" placeholder="Kursi Plastik Hijau" value="${item?esc(item.nama):''}"></div>
    <div class="field"><label>Lokasi / Gudang</label>
      <select id="gs-gudang">${gudangLokasiOptions(item?item.gudang:'')}</select>
    </div>
    <div class="field"><label>Total Unit</label><input type="number" min="0" id="gs-total" value="${item?item.total:''}"></div>
    ${item ? `<div class="hint" style="margin:-6px 0 14px;">Sedang dipinjam: <b>${dipinjam}</b> unit. Stok tersedia otomatis dihitung dari Total Unit dikurangi yang sedang dipinjam.</div>` : ''}`;
  setModal(item?'Ubah Aset':'Tambah Aset', body, [
    {label:'Batal', cls:'secondary', onclick: closeModal},
    {label:'Simpan', onclick: ()=>gudangSaveStok(id)},
  ]);
}
async function gudangSaveStok(id){
  const nama = document.getElementById('gs-nama').value.trim();
  const gudang = document.getElementById('gs-gudang').value.trim();
  const total = parseInt(document.getElementById('gs-total').value, 10);
  if(!nama || !gudang){ toast('⛔ Nama & lokasi wajib diisi.'); return; }
  if(isNaN(total) || total<0){ toast('⛔ Total unit harus angka valid.'); return; }
  const now = todayISO();
  try{
    if(id){
      const existing = gudangInventory.find(i=>i.id===id);
      const dipinjam = existing.total - existing.tersedia;
      if(dipinjam > total){ toast(`⛔ Total unit (${total}) tidak boleh kurang dari jumlah yang sedang dipinjam (${dipinjam}).`); return; }
      const tersedia = total - dipinjam;
      const upd = await sb.from('kt_gudang_inventory').update({nama, gudang, total, tersedia, last_updated: now}).eq('id', id);
      if(upd.error) throw new Error(upd.error.message);
      Object.assign(existing, {nama, gudang, total, tersedia, lastUpdated: now});
      toast('✅ Data aset tersimpan.');
    } else {
      const newId = uid();
      const tersedia = total;
      const ins = await sb.from('kt_gudang_inventory').insert({id:newId, nama, gudang, total, tersedia, last_updated: now, is_active: true});
      if(ins.error) throw new Error(ins.error.message);
      gudangInventory.push({id:newId, nama, gudang, total, tersedia, lastUpdated: now, isActive: true});
      toast('✅ Aset baru ditambahkan.');
    }
    closeModal();
    renderContent();
  }catch(err){
    console.error(err);
    toast('⛔ Gagal menyimpan: ' + err.message);
  }
}
async function gudangDeleteStok(id){
  const item = gudangInventory.find(i=>i.id===id);
  if(!item) return;
  if(!confirm(`Nonaktifkan "${item.nama}" dari inventaris aktif? Riwayat peminjaman lama tetap aman.`)) return;
  try{
    const upd = await sb.from('kt_gudang_inventory').update({is_active:false}).eq('id', id);
    if(upd.error) throw new Error(upd.error.message);
    item.isActive = false;
    toast('✅ Aset dinonaktifkan.');
    renderContent();
  }catch(err){
    console.error(err);
    toast('⛔ Gagal menonaktifkan: ' + err.message);
  }
}
async function gudangAktifkanStok(id){
  const item = gudangInventory.find(i=>i.id===id);
  if(!item) return;
  try{
    const upd = await sb.from('kt_gudang_inventory').update({is_active:true}).eq('id', id);
    if(upd.error) throw new Error(upd.error.message);
    item.isActive = true;
    toast('✅ Aset diaktifkan kembali.');
    renderContent();
  }catch(err){
    console.error(err);
    toast('⛔ Gagal mengaktifkan: ' + err.message);
  }
}

function gudangExportJSON(){
  const payload = {exportedAt: new Date().toISOString(), inventory: gudangInventory, transactions: gudangTransactions};
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gudang-backup-${todayISO()}.json`;
  a.click();
  toast('✅ Backup Gudang berhasil diekspor.');
}
function gudangImportJSON(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e)=>{
    try{
      const parsed = JSON.parse(e.target.result);
      if(!parsed.inventory || !parsed.transactions) throw new Error('Format file backup tidak dikenali.');
      if(!confirm(`Import akan MENAMBAH ${parsed.inventory.length} aset dan ${parsed.transactions.length} transaksi baru ke database (data lama tidak dihapus). Lanjutkan?`)) return;
      toast('⏳ Mengimpor data...');
      for(const inv of parsed.inventory){
        await sb.from('kt_gudang_inventory').upsert({
          id: inv.id||uid(), nama:inv.nama, gudang:inv.gudang, total:inv.total, tersedia:inv.tersedia,
          is_active: inv.isActive!==false, last_updated: inv.lastUpdated||null,
        }, {onConflict:'id'});
      }
      for(const trx of parsed.transactions){
        await sb.from('kt_gudang_transactions').upsert({
          id: trx.id||uid(), resi:trx.resi, nama:trx.nama, alamat:trx.alamat, wa:trx.wa,
          tgl_pinjam:trx.tglPinjam||null, tgl_kembali:trx.tglKembali||null, status:trx.status||'aktif',
        }, {onConflict:'id'});
        for(const it of (trx.items||[])){
          await sb.from('kt_gudang_transaction_items').insert({transaction_id: trx.id, item_id: it.itemId, nama: it.nama, gudang: it.gudang, qty: it.qty});
        }
      }
      await loadGudangData();
      toast('✅ Import selesai.');
      renderContent();
    }catch(err){
      console.error(err);
      toast('⛔ Gagal import: ' + err.message);
    }
    input.value = '';
  };
  reader.readAsText(file);
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
document.getElementById('nav-global').addEventListener('click', (e)=>{
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
  // Muat data Gudang di belakang layar (tidak memblokir tampilan awal) supaya
  // saat pertama kali buka menu Gudang, datanya sudah siap tanpa jeda loading.
  loadGudangData();
})();
