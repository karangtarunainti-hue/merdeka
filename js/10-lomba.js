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
        <div><span class="nomor-badge kategori-${l.kategori_peserta}">${idx+1}</span><span class="name">${esc(l.nama)}</span><span class="kategori-pill" style="margin-left:8px;">${labelPeserta(l.kategori_peserta)}</span>${Number(l.jumlah_anggota_regu||1)>1?`<span class="kategori-pill khusus" style="margin-left:6px;">👥 Beregu ×${l.jumlah_anggota_regu}${l.hadiah_per_regu?' · 1 hadiah/regu':''}</span>`:''}</div>
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
  const anggotaAwal = editing?(editing.jumlah_anggota_regu||1):1;
  const hadiahPerReguAwal = editing ? !!editing.hadiah_per_regu : false;
  setModal(editing?'Edit Lomba':'Tambah Lomba', `<div class="field"><label>Nama Lomba</label><input id="f-nama" value="${editing?esc(editing.nama):''}"></div><div class="field"><label>Kategori Peserta</label><select id="f-kategori">${KATEGORI_PESERTA.map(k=>`<option value="${k.v}" ${editing&&editing.kategori_peserta===k.v?'selected':''}>${k.l}</option>`).join('')}</select></div><div class="field"><label>Jumlah Anggota per Regu</label><input id="f-anggota" type="number" min="1" value="${anggotaAwal}" oninput="toggleHadiahPerReguHint()"><div class="hint">Isi 1 jika lomba perorangan. Jika lomba beregu (misal 1 regu = 5 orang), isi 5.</div></div><div class="field" id="f-hadiah-per-regu-wrap" style="display:${anggotaAwal>1?'block':'none'};"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="f-hadiah-per-regu" ${hadiahPerReguAwal?'checked':''} style="width:auto;"> Hadiah 1 paket untuk seluruh regu (bukan per anggota)</label><div class="hint">Dicentang: kebutuhan hadiah lomba ini dihitung 1 paket saja meski jumlah anggota regu lebih dari 1. Tidak dicentang (default): kebutuhan hadiah dikalikan jumlah anggota regu (tiap anggota dapat paket sendiri).</div></div>`, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const nama=document.getElementById('f-nama').value.trim(); const kategori_peserta=document.getElementById('f-kategori').value; 
      const jumlah_anggota_regu=Math.max(1, Number(document.getElementById('f-anggota').value||1));
      const hadiah_per_regu = jumlah_anggota_regu>1 && !!document.getElementById('f-hadiah-per-regu').checked;
      if(!nama){toast('Nama wajib');return;}
      let actionMsg = editing ? `✏️ Edit lomba: ${editing.nama} → ${nama}` : `➕ Lomba baru: ${nama}`;
      if(editing){ 
        editing.nama=nama; editing.kategori_peserta=kategori_peserta; editing.jumlah_anggota_regu=jumlah_anggota_regu; editing.hadiah_per_regu=hadiah_per_regu;
      }
      else{ db.lomba.push({id:uid(),event_id:eid(),nama,kategori_peserta,jumlah_anggota_regu,hadiah_per_regu}); }
      saveDB();
      // Lomba bertambah/berubah → kebutuhan paket hadiah berubah, sinkronkan stok yang harus dibeli.
      autoSyncHadiahStok(true);
      closeModal(); renderContent(); renderTopbarSaldo(); toast('Disimpan');
      notifyTelegram(actionMsg, `Kategori: ${labelPeserta(kategori_peserta)}\nAnggota/regu: ${jumlah_anggota_regu}${hadiah_per_regu?' (1 hadiah untuk seluruh regu)':''}`);
    }}
  ]);
}
function toggleHadiahPerReguHint(){
  const anggota = Math.max(1, Number(document.getElementById('f-anggota').value||1));
  const wrap = document.getElementById('f-hadiah-per-regu-wrap');
  if(wrap) wrap.style.display = anggota>1 ? 'block' : 'none';
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
    const totalKebutuhanPaket = lombaKategoriList.reduce((s,l)=>s+anggotaHadiahLomba(l),0);
    const adaBeregu = lombaKategoriList.some(l => Number(l.jumlah_anggota_regu||1) > 1 && !l.hadiah_per_regu);
    const groupHtml = items.map(h => {
      const isPartisipasi = h.juara_ke === 'partisipasi';
      const kebutuhan = isPartisipasi ? null : totalKebutuhanPaket;
      const kurangItems = kebutuhan!=null ? h.items.filter(item => Number(item.qty_dibeli||0) < hitungTargetQtyItem(item, kebutuhan)) : [];
      const totalItem = h.items.reduce((s, item) => s + (Number(item.harga_satuan||0) * Number(item.qty_dibeli||0)), 0);
      // Harga SATU paket saja (isi paket × qty/paket) — dipakai untuk dibandingkan
      // dengan budget, karena budget diatur per paket/per pemenang, bukan akumulasi
      // seluruh lomba di kategori ini (yang jumlahnya beda-beda tiap kategori).
      const totalPerPaket = h.items.reduce((s, item) => s + (Number(item.harga_satuan||0) * Math.max(1,Number(item.qty_per_paket||1))), 0);
      const namaLombaTitle = esc(lombaKategoriList.map(l => Number(l.jumlah_anggota_regu||1)>1 ? `${l.nama} (beregu ×${l.jumlah_anggota_regu}${l.hadiah_per_regu?', 1 hadiah/regu':''})` : l.nama).join(', '));
      const rincianLomba = adaBeregu ? ` = ${lombaKategoriList.map(l=>anggotaHadiahLomba(l)).join('+')}` : '';
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
            <button class="icon-btn" onclick="editHadiahItem('${h.id}','${item.id}')" ${!isLoggedIn ? 'disabled' : ''}>✎</button>
            <button class="icon-btn" onclick="hapusHadiahItem('${h.id}','${item.id}')" ${!isLoggedIn ? 'disabled' : ''}>🗑</button>
          </div>`;}).join('')}
          ${isLoggedIn ? `<div class="add-item-row"><input type="text" id="add-item-name-${h.id}" placeholder="Nama hadiah" style="flex:2;" onblur="autofillHargaHadiah(this)"><input type="text" id="add-item-price-${h.id}" class="currency-input" placeholder="Harga" style="flex:1;"><input type="number" id="add-item-perpaket-${h.id}" placeholder="Qty/paket" value="1" min="1" style="flex:0.7;" title="Berapa pcs item ini per 1 paket juara"><button class="btn secondary small" onclick="tambahItemHadiah('${h.id}', ${kebutuhan!=null?kebutuhan:'null'})">+ Tambah</button></div>` : `<div class="hint" style="padding:8px 0;">🔒 Login untuk menambah item</div>`}
        </div></div>`;
    }).join('');
    const kebutuhanInfo = jumlahLomba > 0 ? `<span style="font-size:11.5px;color:var(--ink-soft);font-weight:500;text-transform:none;letter-spacing:0;margin-left:8px;">(${jumlahLomba} lomba${adaBeregu?` · butuh ${totalKebutuhanPaket} pcs karena ada beregu`:''})</span>` : '';
    const daftarLombaInfo = lombaKategoriList.length ? `<div class="lomba-mini-list">${lombaKategoriList.map((l,i)=>{const anggota=Number(l.jumlah_anggota_regu||1); const perRegu=anggota>1&&l.hadiah_per_regu; return `<span class="lomba-mini-chip">${anggota>1?`<span class="num beregu">${anggotaHadiahLomba(l)}×</span>`:`<span class="num">${i+1}</span>`}${esc(l.nama)}${anggota>1?` <span class="beregu-tag">${perRegu?'1 hadiah/regu':'beregu'}</span>`:''}</span>`;}).join('')}</div>` : '';
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
    // keb bisa null (juara partisipasi, memang tidak ada target) ATAU 0 (belum ada
    // lomba dibuat untuk kategori ini). Keduanya sama-sama "belum diketahui jumlah
    // paket yang dibutuhkan", jadi budget tetap dihitung penuh (×1) — bukan ditiadakan
    // (×0) — supaya Total Budget tetap masuk akal sebelum data lomba diinput.
    return s2 + budgetPerPaket * (keb || 1);
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
function anggotaHadiahLomba(l){ return l.hadiah_per_regu ? 1 : Math.max(1, Number(l.jumlah_anggota_regu||1)); }
function hitungKebutuhanHadiah(kategoriPeserta, juaraKe){
  if(juaraKe === 'partisipasi') return null;
  return gLomba().filter(l => l.kategori_peserta === kategoriPeserta).reduce((s,l)=> s + anggotaHadiahLomba(l), 0);
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
async function editHadiahItem(hadiahId,itemId){ 
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const h=db.hadiahKategori.find(x=>x.id===hadiahId); const item=h && h.items.find(it=>it.id===itemId); if(!item){ toast('Item tidak ditemukan'); return; }
  const newNama = await promptModal({title:'Edit Item Hadiah', label:'Nama', defaultValue:item.nama});
  if(newNama===null) return;
  const newHarga = await promptModal({title:'Edit Item Hadiah', label:'Harga (Rp)', defaultValue:item.harga_satuan, type:'currency'});
  if(newHarga===null) return;
  const newPerPaket = await promptModal({title:'Edit Item Hadiah', label:'Qty per paket', hint:'Dasar hitung kebutuhan otomatis.', defaultValue:item.qty_per_paket||1, type:'number'});
  if(newPerPaket===null) return;
  const newQty = await promptModal({title:'Edit Item Hadiah', label:'Qty total (dibeli)', hint:'Boleh diisi lebih untuk cadangan.', defaultValue:item.qty_dibeli, type:'number'});
  if(newQty===null) return;
  if(!newNama.trim()||Number(newQty)<0){toast('Nama & qty wajib');return;} item.nama=newNama.trim(); item.harga_satuan=Number(newHarga)||0; item.qty_per_paket=Math.max(1,Number(newPerPaket)||1); item.qty_dibeli=Number(newQty)||0;
  const samaCount = samakanHargaItemSejenis(item.nama, item.harga_satuan, item.id);
  saveDB(); renderContent(); toast(samaCount>0?`Diupdate, harga disamakan ke ${samaCount} item "${item.nama}" lainnya`:'Diupdate'); 
  notifyTelegram(`✏️ Edit item hadiah: ${item.nama}`, `Paket: ${labelPeserta(h.kategori_peserta)} - ${labelJuara(h.juara_ke)}\nHarga: ${fmtRp(item.harga_satuan)}\nQty: ${item.qty_dibeli}${item.qty_per_paket>1?` (${item.qty_per_paket} buah per paket)`:''}`);
}
function hapusHadiahItem(hadiahId,itemId){ 
  if (!canEditSection('hadiah')) { toast('⛔ Login untuk mengedit data'); return; }
  const h=db.hadiahKategori.find(x=>x.id===hadiahId); const itemIdx=h ? h.items.findIndex(it=>it.id===itemId) : -1; if(itemIdx===-1){ toast('Item tidak ditemukan'); return; } const itemName = h.items[itemIdx].nama; if(!confirm(`Hapus "${itemName}"?`)) return; h.items.splice(itemIdx,1); if(h.items.length===0) db.hadiahKategori=db.hadiahKategori.filter(x=>x.id!==hadiahId); saveDB(); renderContent(); toast('Dihapus'); 
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
