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

  if(!items.length) return `<div class="belanja-toko-page"><div class="panel"><div class="panel-head"><h3>🎁 Belanja Hadiah</h3></div><div class="panel-body"><div class="empty-state"><h3>Belum ada hadiah</h3>${isLoggedIn ? `<button class="btn" onclick="goSection('hadiah')">+ Tambah Hadiah</button>` : ''}</div></div></div></div>`;

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
    const jumlahPackUtuh = isiPerPack > 1 ? Math.floor(totalQty / isiPerPack) : 0;
    const sisaSatuan = isiPerPack > 1 ? totalQty % isiPerPack : 0;

    const tagHtml = list.map(item => {
      // Hadiah non-partisipasi digabung dari SEMUA lomba dgn kategori_peserta yang sama
      // (lihat hitungKebutuhanHadiah di 10-lomba.js), jadi qty di sini bukan utk 1 lomba
      // saja. Tambahkan info jumlah lomba biar user tahu kenapa qty-nya sebesar itu.
      const jumlahLomba = item.juara_ke !== 'partisipasi' ? gLomba().filter(l=>l.kategori_peserta===item.kategori_peserta).length : 0;
      const lombaInfo = jumlahLomba > 1 ? ` <span style="opacity:.65;">(gabungan ${jumlahLomba} lomba)</span>` : '';
      return `<span class="tag">Kategori: ${labelPeserta(item.kategori_peserta)} · ${labelJuara(item.juara_ke)} · ${item.itemQtyDibeli} pcs${lombaInfo}</span>`;
    }).join('');
    const packTagHtml = jumlahPackUtuh > 0
      ? `<span class="tag pack-tag">📦 Beli ${jumlahPackUtuh} pack (isi ${isiPerPack})${sisaSatuan>0?` + ${sisaSatuan} pcs satuan`:''} → ${totalQty} pcs</span>`
      : (isiPerPack > 1 ? `<span class="tag pack-tag">📦 Beli ${sisaSatuan} pcs satuan (kurang dari 1 pack isi ${isiPerPack})</span>` : '');

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

  return `<div class="belanja-toko-page"><div class="stat-grid"><div class="stat-card belanja-hadiah"><div class="lbl">Total Item</div><div class="val">${totalItem}</div></div><div class="stat-card pemasukan"><div class="lbl">Belum Dibeli</div><div class="val">${totalBelum}</div></div><div class="stat-card saldo"><div class="lbl">Estimasi Total</div><div class="val">${fmtRp(totalEstimasi)}</div></div></div>
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
    const jumlahPackUtuh = Math.floor(totalQty / isiPerPack);
    const sisaSatuan = totalQty % isiPerPack;
    const rincianBeli = jumlahPackUtuh > 0
      ? `${jumlahPackUtuh} pack${sisaSatuan>0?` + ${sisaSatuan} pcs satuan`:''}`
      : `${sisaSatuan} pcs satuan`;
    toast(`✓ "${group.nama}": beli ${rincianBeli} (isi ${isiPerPack}/pack) — Rp${fmtRp(hargaSatuanBaru)}/pcs`);
    notifyTelegram(`✏️ Update kemasan & harga belanja hadiah: ${group.nama}`, `Isi per pack: ${isiPerPack}\nHarga per pack: ${fmtRp(hargaMasuk)} (≈ ${fmtRp(hargaSatuanBaru)}/pcs)\nKebutuhan: ${totalQty} pcs → beli ${rincianBeli}`);
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
  
  if(!items.length) return `<div class="belanja-toko-page"><div class="panel"><div class="panel-head"><h3>📦 Belanja Perlengkapan</h3></div><div class="panel-body"><div class="empty-state"><h3>Belum ada perlengkapan</h3>${isLoggedIn ? `<button class="btn" onclick="goSection('lomba')">+ Tambah Kebutuhan</button>` : ''}</div></div></div></div>`;

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
        <div class="nama"><span class="nama-text">${esc(g.nama)}</span><span class="qty-total">(Total: ${totalQty})</span></div>
        <div class="detail">${tagHtml}${semuaDibeli&&tglTerbaru?`<span>✓ Dibeli: ${fmtDate(tglTerbaru)}</span>`:(groupBelum.length && groupBelum.length<groupItems.length ? `<span style="color:var(--orange);">Sebagian belum (${groupBelum.length}/${groupItems.length})</span>` : '')}</div>
      </div>
      <div class="harga">${fmtRp(totalHarga)}</div>
    </div>`;
  }).join('');

  return `<div class="belanja-toko-page"><div class="stat-grid"><div class="stat-card belanja-perlengkapan"><div class="lbl">Total Item</div><div class="val">${totalItem}</div></div><div class="stat-card pemasukan"><div class="lbl">Belum Dibeli</div><div class="val">${totalBelum}</div></div><div class="stat-card saldo"><div class="lbl">Estimasi Total</div><div class="val">${fmtRp(totalEstimasi)}</div></div></div>
  <div class="panel"><div class="panel-head"><div><h3>📦 Daftar Belanja Perlengkapan</h3><div class="desc">Belum dibeli: <strong>${fmtRp(totalBelumEstimasi)}</strong></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn success small" onclick="tandaiSemuaBelanjaPerlengkapan()" ${!isLoggedIn ? 'disabled' : ''}>✓ Semua Dibeli</button>
      <button class="btn secondary small" onclick="resetSemuaBelanjaPerlengkapan()" ${!isLoggedIn ? 'disabled' : ''}>↺ Reset</button>
    </div></div>
  <div class="panel-body">${groupHtml}</div></div></div>`;
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

  const rows = list.map((h, idx) => {
    const belanja = db.daftarBelanjaJalanSantai.find(b => b.hadiah_jalan_id === h.id && b.event_id === eid());
    const sudahDibeli = belanja && belanja.status === 'dibeli';
    return `
    <tr class="${sudahDibeli?'dibeli':''}">
      <td>${idx+1}</td>
      <td>${esc(h.nama_hadiah)}</td>
      <td class="num">${fmtRp(h.harga_satuan)}</td>
      <td class="num">${h.qty}</td>
      <td class="num">${fmtRp(Number(h.harga_satuan||0) * Number(h.qty||0))}</td>
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
        <thead><tr><th>No</th><th>Nama Hadiah</th><th class="num">Harga Satuan</th><th class="num">Qty</th><th class="num">Total</th><th></th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="6">Belum ada hadiah jalan santai.</td></tr>`}</tbody>
        ${list.length > 0 ? `<tfoot><tr><td colspan="4">Total</td><td class="num">${fmtRp(total)}</td><td></td></tr></tfoot>` : ''}
      </table>
    </div>
  </div>`;
}

function openHadiahJalanModal(id){
  if (!canEditSection('hadiah-jalan')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.hadiahJalanSantai.find(h=>h.id===id) : null;
  setModal(editing?'Edit Hadiah Jalan Santai':'Tambah Hadiah Jalan Santai', `
    <div class="field"><label>Nama Hadiah</label><input id="f-nama" value="${editing?esc(editing.nama_hadiah):''}" placeholder="mis. Baju, Topi, Snack Pack"></div>
    <div class="field-row">
      <div class="field"><label>Harga Satuan (Rp)</label><input id="f-harga" class="currency-input" type="text" value="${editing?formatCurrency(editing.harga_satuan):''}"></div>
      <div class="field"><label>Qty</label><input id="f-qty" type="number" min="1" value="${editing?editing.qty:1}"></div>
    </div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'pink', onclick:()=>{
      const nama_hadiah = document.getElementById('f-nama').value.trim();
      const qty = Number(document.getElementById('f-qty').value||0);
      const harga_satuan = getCurrencyValue(document.getElementById('f-harga'));
      if(!nama_hadiah || qty <= 0 || harga_satuan <= 0){ toast('Nama, qty & harga wajib diisi'); return; }
      let actionMsg = editing ? `✏️ Edit hadiah jalan santai: ${editing.nama_hadiah} → ${nama_hadiah}` : `➕ Hadiah jalan santai baru: ${nama_hadiah}`;
      if(editing){ Object.assign(editing, {nama_hadiah, qty, harga_satuan}); }
      else{ db.hadiahJalanSantai.push({id:uid(), event_id:eid(), nama_hadiah, qty, harga_satuan}); }
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast('Hadiah jalan santai disimpan');
      notifyTelegram(actionMsg, `Qty: ${qty}\nHarga: ${fmtRp(harga_satuan)}\nTotal: ${fmtRp(harga_satuan * qty)}`);
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
  if(h) notifyTelegram(`🗑️ Hapus hadiah jalan santai: ${h.nama_hadiah}`, `Qty: ${h.qty}\nHarga: ${fmtRp(h.harga_satuan)}`);
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
  if(actionMsg) notifyTelegram(actionMsg, `Qty: ${h.qty}\nHarga: ${fmtRp(h.harga_satuan)}`);
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
    detail.push(`Qty ${h.qty} × ${fmtRp(h.harga_satuan)}`);
  });
  saveDB(); renderContent(); renderTopbarSaldo();
  if(newStatus==='dibeli'){
    toast(`✓ "${group.nama}" dibeli`);
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
    <div class="belanja-toko-page">
    <div class="panel">
      <div class="panel-head"><h3>🛍️ Belanja Jalan Santai</h3></div>
      <div class="panel-body">
        <div class="empty-state"><h3>Belum ada hadiah</h3><p>Tambahkan hadiah jalan santai dulu.</p>
          ${isLoggedIn ? `<button class="btn pink" onclick="goSection('hadiah-jalan')">+ Tambah Hadiah</button>` : ''}
        </div>
      </div>
    </div>
    </div>`;
  }

  // Kelompokkan per NAMA hadiah (kalau ada beberapa entri dengan nama sama), total digabung
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
    const groupItems = g.list;
    window._belanjaJalanGroups[gi] = {nama: g.nama, refs: groupItems.map(i=>i.id)};

    const totalQty = groupItems.reduce((s,i)=>s+Number(i.qty||0),0);
    const totalHarga = groupItems.reduce((s, i) => s + i.hargaTotal, 0);
    const semuaDibeli = groupItems.every(i=>i.sudahDibeli);
    const groupBelum = groupItems.filter(i => !i.sudahDibeli);
    const tglTerbaru = groupItems.filter(i=>i.tanggalBeli).map(i=>i.tanggalBeli).sort().pop();

    const tagHtml = groupItems.map(item => `<span class="tag tag-pink">${item.qty} @${fmtRp(item.harga_satuan)}</span>`).join('');

    return `<div class="belanja-item ${semuaDibeli ? 'dibeli' : ''}">
      <div class="checkbox-wrapper ${semuaDibeli ? 'checked' : ''} ${!isLoggedIn ? 'disabled' : ''}" 
           onclick="${isLoggedIn ? `toggleBelanjaJalanGroup(${gi})` : 'toast(\'⛔ Login untuk mengedit\')'}">
      </div>
      <div class="info">
        <div class="nama"><span class="nama-text">${esc(g.nama)}</span><span class="qty-total">(Total: ${totalQty})</span></div>
        <div class="detail">${tagHtml}${semuaDibeli&&tglTerbaru?`<span>✓ Dibeli: ${fmtDate(tglTerbaru)}</span>`:(groupBelum.length && groupBelum.length<groupItems.length ? `<span style="color:var(--orange);">Sebagian belum (${groupBelum.length}/${groupItems.length})</span>` : '')}</div>
      </div>
      <div class="harga">${fmtRp(totalHarga)}</div>
    </div>`;
  }).join('');

  return `
  <div class="belanja-toko-page">
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
      detail.push(`${h.nama_hadiah}`);
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

