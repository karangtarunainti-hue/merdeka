/* ============================================================
   DATABASE LOMBA
   Tidak terikat event tertentu — halaman ini mengumpulkan SEMUA
   lomba yang pernah diinput di SEMUA event/tahun (db.lomba & 
   db.lombaKebutuhan sudah dimuat penuh lintas event, lihat loadDB()
   di js/db.js), dikelompokkan berdasarkan NAMA lomba. Tujuannya:
   jadi "contekan" saat bikin lomba yang sama di tahun berikutnya —
   daftar perlengkapan & harga terakhir sudah kelihatan, tinggal
   dipilih item mana yang mau disalin ke event aktif, lalu panitia
   cukup sesuaikan harga/qty-nya (lihat openPakaiLombaModal di bawah).
   Halaman ini READ-ONLY terhadap data historis (tidak ada hapus/edit
   di sini) — supaya riwayat lomba tahun-tahun sebelumnya tetap utuh.
   Untuk edit/hapus data asli, tetap lewat menu Lomba & Perlengkapan
   di event yang bersangkutan.
   ============================================================ */
let dbLombaSearch = '';
let dbLombaKategoriFilter = 'semua';
let dbLombaOpenKeys = new Set();
let dbLombaVersionSel = {};

function dbLombaNormKey(nama){ return String(nama||'').trim().toLowerCase(); }

// Kelompokkan seluruh db.lomba (lintas event) berdasarkan nama (case/spasi
// diabaikan), tiap kelompok berisi semua "versi" (satu versi = satu lomba
// di satu event/tahun), diurutkan dari tahun terbaru ke terlama supaya versi
// yang tampil duluan adalah yang paling relevan/terbaru.
function dbLombaGroups(){
  const map = new Map();
  db.lomba.forEach(l=>{
    const nama = String(l.nama||'').trim();
    if(!nama) return;
    const key = dbLombaNormKey(nama);
    if(!map.has(key)) map.set(key, {key, nama, versions:[]});
    const ev = db.events.find(e=>e.id===l.event_id) || null;
    map.get(key).versions.push({lomba:l, event:ev});
  });
  const groups = Array.from(map.values());
  groups.forEach(g=>{
    g.versions.sort((a,b)=>{
      const ta = Number(a.event?.tahun||0), tb = Number(b.event?.tahun||0);
      if(tb!==ta) return tb-ta;
      return String(b.lomba.tanggal||'').localeCompare(String(a.lomba.tanggal||''));
    });
  });
  groups.sort((a,b)=>a.nama.localeCompare(b.nama,'id',{sensitivity:'base'}));
  return groups;
}

function renderDatabaseLomba(){
  const semuaGroups = dbLombaGroups();
  const q = dbLombaSearch.trim().toLowerCase();
  let groups = semuaGroups;
  if(dbLombaKategoriFilter!=='semua') groups = groups.filter(g=>g.versions.some(v=>v.lomba.kategori_peserta===dbLombaKategoriFilter));
  if(q) groups = groups.filter(g=>g.nama.toLowerCase().includes(q));

  const totalItemUnik = new Set(db.lombaKebutuhan.map(k=>{
    const l = db.lomba.find(x=>x.id===k.lomba_id);
    return l ? `${dbLombaNormKey(l.nama)}__${dbLombaNormKey(k.nama_item)}` : null;
  }).filter(Boolean)).size;

  const statCards = `<div class="stat-grid">
    <div class="stat-card info"><div class="lbl">Nama Lomba Tersimpan</div><div class="val">${semuaGroups.length}</div></div>
    <div class="stat-card"><div class="lbl">Jenis Perlengkapan Tersimpan</div><div class="val">${totalItemUnik}</div></div>
  </div>`;

  const filterHtml = `<div class="filter-row">
    <div class="search-box" style="flex:1;min-width:200px;">
      <div class="search-input-wrap"><i data-lucide="search" class="inline-icon search-input-icon"></i><input type="text" id="db-lomba-search" placeholder="Cari nama lomba..." value="${esc(dbLombaSearch)}" oninput="dbLombaApplySearch(this.value)"></div>
    </div>
    <div class="field" style="margin-bottom:0;min-width:170px;">
      <label style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Kategori Peserta</label>
      <select id="db-lomba-filter-kategori" onchange="dbLombaApplyFilter(this.value)">
        <option value="semua" ${dbLombaKategoriFilter==='semua'?'selected':''}>Semua Kategori</option>
        ${KATEGORI_PESERTA.map(k=>`<option value="${k.v}" ${dbLombaKategoriFilter===k.v?'selected':''}>${k.l}</option>`).join('')}
      </select>
    </div>
  </div>`;

  const cardsHtml = groups.map(renderDbLombaCard).join('') || `<div class="empty-row" style="padding:30px;text-align:center;">${q||dbLombaKategoriFilter!=='semua' ? 'Tidak ada lomba yang cocok dengan pencarian/filter.' : 'Belum ada riwayat lomba tersimpan. Data di sini otomatis terisi begitu ada lomba yang diinput lewat menu Lomba & Perlengkapan.'}</div>`;

  return `${statCards}
  <div class="panel">
    <div class="panel-head">
      <div><h3>📚 Database Lomba</h3><div class="desc">Riwayat semua lomba yang pernah diinput beserta perlengkapannya, dari semua tahun/event — dipakai sebagai contekan saat bikin lomba serupa tahun depan. Halaman ini gabungan dari semua event, tidak cuma event aktif.</div></div>
    </div>
    <div class="panel-body">
      ${filterHtml}
      ${cardsHtml}
    </div>
  </div>`;
}

function dbLombaApplySearch(v){ dbLombaSearch = v; renderContent(); }
function dbLombaApplyFilter(v){ dbLombaKategoriFilter = v; renderContent(); }
function dbLombaToggleCard(key){ dbLombaOpenKeys.has(key)?dbLombaOpenKeys.delete(key):dbLombaOpenKeys.add(key); renderContent(); }
function dbLombaPilihVersi(key, idx){ dbLombaVersionSel[key]=idx; dbLombaOpenKeys.add(key); renderContent(); }

function renderDbLombaCard(g){
  const isOpen = dbLombaOpenKeys.has(g.key);
  const selIdx = Math.min(dbLombaVersionSel[g.key]||0, g.versions.length-1);
  const versi = g.versions[selIdx];
  const lomba = versi.lomba;
  const items = db.lombaKebutuhan.filter(k=>k.lomba_id===lomba.id);
  const subtotal = items.reduce((s,k)=>s+(Number(k.harga_realisasi ?? k.harga_estimasi ?? 0)*Number(k.qty||0)),0);

  const eventChips = g.versions.map((v,i)=>{
    const label = v.event ? `${esc(v.event.nama)}${v.event.tahun?' · '+esc(v.event.tahun):''}` : 'Event terhapus';
    return `<span class="kategori-pill ${i===selIdx?'khusus':''}" style="cursor:pointer;" onclick="event.stopPropagation(); dbLombaPilihVersi('${g.key}',${i})" title="Lihat perlengkapan versi ini">${label}</span>`;
  }).join('');

  return `<div class="lomba-card ${isOpen?'open':''}">
    <div class="lomba-card-head" onclick="dbLombaToggleCard('${g.key}')" style="cursor:pointer;">
      <div class="lomba-head-title"><span class="name">${esc(g.nama)}</span><span class="lomba-head-tags"><span class="kategori-pill">${labelPeserta(lomba.kategori_peserta)}</span><span class="lomba-badge">${g.versions.length} tahun dipakai</span></span></div>
      <div class="lomba-head-meta">
        <span class="lomba-badge">${items.length} item</span>
        <span class="mono lomba-head-subtotal">${fmtRp(subtotal)}</span>
        <svg class="chevron" width="16" height="16" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>
    <div class="lomba-card-body">
      <div class="hint" style="margin-bottom:8px;">Pernah dipakai di ${g.versions.length} event — klik salah satu di bawah buat lihat perlengkapan versi tahun itu:</div>
      <div class="lomba-mini-list" style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;">${eventChips}</div>
      <div style="overflow-x:auto;">
      <table class="lomba-table"><thead><tr><th>Item Perlengkapan</th><th class="num">Harga Terakhir</th><th class="num">Qty</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${items.map(k=>{
        const harga = Number(k.harga_realisasi ?? k.harga_estimasi ?? 0);
        return `<tr><td>${esc(k.nama_item)}</td><td class="num">${fmtRp(harga)}</td><td class="num"><span class="qty-pill">${k.qty}</span></td><td class="num">${fmtRp(harga*k.qty)}</td></tr>`;
      }).join('') || `<tr class="empty-row"><td colspan="4">Belum ada perlengkapan tercatat untuk versi ini.</td></tr>`}</tbody>
      ${items.length?`<tfoot><tr><td colspan="3">Subtotal</td><td class="num">${fmtRp(subtotal)}</td></tr></tfoot>`:''}
      </table></div>
      <div style="margin-top:14px;">
        <button class="btn" onclick="openPakaiLombaModal('${lomba.id}')">📥 Pakai Lomba Ini untuk Event Aktif</button>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   PAKAI LOMBA DARI DATABASE → DISALIN KE EVENT AKTIF
   Kalau event aktif belum punya lomba dengan nama sama, dibuatkan
   lomba baru (kategori peserta & jumlah anggota regu ikut versi
   yang dipilih). Kalau sudah ada (mis. sudah sempat ditambah manual),
   item yang belum ada tinggal ditambahkan ke lomba itu — item yang
   namanya sama otomatis dilewati (anti dobel), sama seperti pola
   "Salin dari Event Lain" di Database Anggota. Harga yang disalin
   pakai harga realisasi/estimasi terakhir sebagai titik awal —
   panitia tinggal sesuaikan lagi harga & qty-nya di menu Lomba.
   ============================================================ */
function openPakaiLombaModal(lombaId){
  if (!canEditSection('lomba')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!eid()){ toast('Pilih atau buat event aktif dulu di sidebar'); return; }
  const template = db.lomba.find(l=>l.id===lombaId);
  if(!template){ toast('Data lomba tidak ditemukan'); return; }
  const items = db.lombaKebutuhan.filter(k=>k.lomba_id===template.id);
  const existingTarget = gLomba().find(l=>dbLombaNormKey(l.nama)===dbLombaNormKey(template.nama));
  const existingItemNames = existingTarget ? new Set(gKebutuhan(existingTarget.id).map(k=>dbLombaNormKey(k.nama_item))) : new Set();

  const infoText = existingTarget
    ? `Event aktif sudah punya lomba bernama <b>${esc(existingTarget.nama)}</b>. Perlengkapan yang belum ada akan ditambahkan ke lomba itu (item dengan nama sama otomatis dilewati).`
    : `Akan dibuat lomba baru <b>${esc(template.nama)}</b> (${labelPeserta(template.kategori_peserta)}${Number(template.jumlah_anggota_regu||1)>1?`, beregu ×${template.jumlah_anggota_regu}`:''}) di event aktif, lengkap dengan perlengkapan terpilih. Harga yang tersalin adalah harga terakhir tercatat — tinggal disesuaikan lagi kalau ada perubahan harga/kuantitas.`;

  const rowsHtml = items.length ? items.map(k=>{
    const dobel = existingItemNames.has(dbLombaNormKey(k.nama_item));
    const harga = Number(k.harga_realisasi ?? k.harga_estimasi ?? 0);
    return `<label style="display:flex; align-items:center; gap:8px; padding:6px 2px; ${dobel?'opacity:.5;':''} border-bottom:1px solid var(--line);">
      <input type="checkbox" class="pakai-lomba-item-chk" value="${k.id}" ${dobel?'disabled':'checked'} onchange="updatePakaiLombaCountLabel()">
      <span style="flex:1;">${esc(k.nama_item)} <span style="color:var(--ink-soft); font-size:11.5px;">· ${fmtRp(harga)} × ${k.qty}</span></span>
      ${dobel?'<span style="font-size:11px;color:var(--ink-soft);">sudah ada</span>':''}
    </label>`;
  }).join('') : `<div class="hint" style="padding:8px 2px;">Versi lomba ini belum punya data perlengkapan untuk disalin.</div>`;

  setModal(`📥 Pakai "${esc(template.nama)}"`, `
    <div class="hint" style="margin-bottom:12px;">${infoText}</div>
    ${items.length ? `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <label style="font-size:12px; display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="pakai-lomba-pilih-semua" onchange="togglePakaiLombaPilihSemua(this.checked)"> Pilih Semua Perlengkapan</label>
      <span id="pakai-lomba-count-label" style="font-size:12px; color:var(--ink-soft);"></span>
    </div>` : ''}
    <div style="max-height:320px; overflow-y:auto; border:1px solid var(--line); border-radius:8px; padding:4px 8px;">${rowsHtml}</div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label: existingTarget ? 'Tambahkan ke Lomba' : 'Buat Lomba', cls:'', onclick:()=>konfirmasiPakaiLomba(lombaId, existingTarget?existingTarget.id:null)}
  ]);
  setTimeout(()=>{
    const selectableCount = document.querySelectorAll('.pakai-lomba-item-chk:not(:disabled)').length;
    const pilihSemuaEl = document.getElementById('pakai-lomba-pilih-semua');
    if(pilihSemuaEl) pilihSemuaEl.checked = selectableCount>0;
    updatePakaiLombaCountLabel();
  }, 0);
}
function togglePakaiLombaPilihSemua(checked){
  document.querySelectorAll('.pakai-lomba-item-chk:not(:disabled)').forEach(c=>c.checked=checked);
  updatePakaiLombaCountLabel();
}
function updatePakaiLombaCountLabel(){
  const label = document.getElementById('pakai-lomba-count-label');
  if(!label) return;
  const total = document.querySelectorAll('.pakai-lomba-item-chk').length;
  const checked = document.querySelectorAll('.pakai-lomba-item-chk:checked').length;
  label.textContent = total ? `${checked} dari ${total} dipilih` : '';
}
function konfirmasiPakaiLomba(templateId, existingTargetId){
  if (!canEditSection('lomba')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!eid()){ toast('Pilih atau buat event aktif dulu di sidebar'); return; }
  const template = db.lomba.find(l=>l.id===templateId);
  if(!template) return;
  const checked = Array.from(document.querySelectorAll('.pakai-lomba-item-chk:checked'));

  let targetLomba = existingTargetId ? db.lomba.find(l=>l.id===existingTargetId) : null;
  let isNew = false;
  if(!targetLomba){
    targetLomba = {
      id: uid(), event_id: eid(), nama: template.nama, kategori_peserta: template.kategori_peserta,
      tanggal: null, jam: null,
      jumlah_anggota_regu: template.jumlah_anggota_regu||1, hadiah_per_regu: !!template.hadiah_per_regu,
      estimasi_peserta: 0, koordinator_anggota_id: null, koordinator_anggota_ids: [], jadwal_id: null
    };
    db.lomba.push(targetLomba);
    isNew = true;
  }
  let count = 0;
  checked.forEach(chk=>{
    const src = db.lombaKebutuhan.find(k=>k.id===chk.value);
    if(!src) return;
    const harga_estimasi = Number(src.harga_realisasi ?? src.harga_estimasi ?? 0);
    db.lombaKebutuhan.push({id:uid(), lomba_id:targetLomba.id, nama_item:src.nama_item, harga_estimasi, harga_realisasi:null, qty:src.qty});
    count++;
  });
  saveDB();
  closeModal();
  openLombaIds.add(targetLomba.id);
  goSection('lomba');
  toast(isNew ? `✓ Lomba "${targetLomba.nama}" dibuat dengan ${count} item perlengkapan — cek lagi harga & qty-nya` : `✓ ${count} item perlengkapan ditambahkan ke "${targetLomba.nama}" — cek lagi harga & qty-nya`);
  notifyTelegram(
    isNew ? `📥 Lomba baru dari Database Lomba: ${targetLomba.nama}` : `📥 Tambah perlengkapan dari Database Lomba: ${targetLomba.nama}`,
    `${count} item perlengkapan disalin dari riwayat lomba tahun sebelumnya (harga masih perlu dicek ulang).`,
    'lomba'
  );
}
