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

