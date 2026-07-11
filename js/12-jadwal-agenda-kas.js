/* ============================================================
   JADWAL (dengan auth check)
   ============================================================ */
function renderJadwal(){
  const list = gJadwal().slice().sort((a,b) => {
    return new Date(a.tanggal) - new Date(b.tanggal);
  });
  const isLoggedIn = !!getCurrentUser();

  const today = new Date();
  const cards = list.map(j => {
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
    <div class="jadwal-item ${j.status==='selesai'?'selesai':''} ${j.status!=='selesai'&&diffDays<0?'terlambat':''}">
      <div class="jadwal-item-top">
        <div class="jadwal-item-date">
          <span class="jadwal-item-date-main">${fmtDateHariShort(j.tanggal)}</span>
          ${j.jam?`<span class="jadwal-item-jam">⏰ ${esc(j.jam)}</span>`:''}
        </div>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="jadwal-item-title">${esc(j.judul)}</div>
      <div class="jadwal-item-meta"><span class="kategori-pill">${labelKategoriJadwal(j.kategori)}</span></div>
      ${j.deskripsi?`<div class="jadwal-item-desc">${esc(j.deskripsi)}</div>`:''}
      <div class="jadwal-item-actions">
        <button class="btn secondary small" onclick="toggleJadwalStatus('${j.id}')" ${!isLoggedIn ? 'disabled' : ''}>${j.status === 'selesai' ? 'Buka' : 'Selesai'}</button>
        <button class="icon-btn" onclick="openJadwalModal('${j.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Edit">✎</button>
        <button class="icon-btn" onclick="hapusJadwal('${j.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Hapus">🗑</button>
      </div>
    </div>`;
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
      <div><h3>📅 Jadwal Kegiatan</h3>
        <div class="desc">Kelola jadwal kegiatan dan pengingat</div>
      </div>
      ${isLoggedIn ? `<button class="btn" onclick="openJadwalModal()">+ Tambah Jadwal</button>` : ''}
    </div>
    <div class="panel-body">
      <div class="jadwal-item-list">${cards || `<div class="empty-row" style="padding:30px;text-align:center;">Belum ada jadwal. ${isLoggedIn ? 'Tambahkan jadwal untuk mendapatkan pengingat.' : 'Login untuk menambah jadwal.'}</div>`}</div>
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
      <div class="field"><label>Jam (opsional)</label><input id="f-jam" type="time" value="${editing?(editing.jam||''):''}"></div>
    </div>
    <div class="field"><label>Kategori</label>
      <select id="f-kategori">${KATEGORI_JADWAL.map(k=>`<option value="${k.v}" ${editing&&editing.kategori===k.v?'selected':''}>${k.l}</option>`).join('')}</select>
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
      const jam = document.getElementById('f-jam').value || null;
      const kategori = document.getElementById('f-kategori').value;
      const deskripsi = document.getElementById('f-deskripsi').value.trim();
      const status = document.getElementById('f-status').value;
      if(!judul || !tanggal){ toast('Judul & tanggal wajib diisi'); return; }
      let actionMsg = editing ? `✏️ Edit jadwal: ${editing.judul} → ${judul}` : `➕ Jadwal baru: ${judul}`;
      if(editing){ Object.assign(editing, {judul, tanggal, jam, kategori, deskripsi, status}); }
      else{ db.jadwal.push({id:uid(), event_id:eid(), judul, tanggal, jam, kategori, deskripsi, status}); }
      saveDB(); closeModal(); renderContent(); renderTopbarSaldo(); toast('Jadwal disimpan');
      notifyTelegram(actionMsg, `Jadwal: ${fmtDateJam(tanggal, jam)}\nKategori: ${labelKategoriJadwal(kategori)}\nDeskripsi: ${deskripsi || '-'}`);
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
  notifyTelegram(`${action}: ${j.judul}`, `Jadwal: ${fmtDateJam(j.tanggal, j.jam)}`);
}

function hapusJadwal(id){
  if (!canEditSection('jadwal')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus jadwal ini?')) return;
  const j = db.jadwal.find(x=>x.id===id);
  db.jadwal = db.jadwal.filter(j=>j.id!==id);
  saveDB(); renderContent(); toast('Jadwal dihapus');
  if(j) notifyTelegram(`🗑️ Hapus jadwal: ${j.judul}`, `Jadwal: ${fmtDateJam(j.tanggal, j.jam)}`);
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
  function statusAgenda(a){
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
    return {diffDays, statusLabel, statusClass};
  }

  const rows = list.map(a => {
    const {diffDays, statusLabel, statusClass} = statusAgenda(a);
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

  // Kartu khusus HP — dipakai lewat .agenda-mobile-wrap (lihat media query
  // max-width:820px di style.css), tampilan komputer TETAP pakai tabel di
  // atas (.agenda-table-wrap) dan tidak berubah sama sekali. Meniru gaya
  // kartu Jadwal Kegiatan (hari/tanggal di atas, judul jadi judul kartu,
  // kategori disembunyikan supaya ringkas), tapi tanpa jam karena Agenda
  // Kegiatan memang tidak punya field jam.
  const cards = list.map(a => {
    const {diffDays, statusLabel, statusClass} = statusAgenda(a);
    return `
    <div class="jadwal-item ${a.status==='selesai'?'selesai':''} ${a.status!=='selesai'&&diffDays<0?'terlambat':''}">
      <div class="jadwal-item-top">
        <div class="jadwal-item-date">
          <span class="jadwal-item-date-main">${fmtDateHariShort(a.tanggal)}</span>
        </div>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="jadwal-item-title">${esc(a.judul)}</div>
      ${a.deskripsi?`<div class="jadwal-item-desc">${esc(a.deskripsi)}</div>`:''}
      <div class="jadwal-item-actions">
        <button class="btn secondary small" onclick="toggleAgendaStatus('${a.id}')" ${!isLoggedIn ? 'disabled' : ''}>${a.status === 'selesai' ? 'Buka' : 'Selesai'}</button>
        <button class="icon-btn" onclick="openAgendaModal('${a.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Edit">✎</button>
        <button class="icon-btn" onclick="hapusAgenda('${a.id}')" ${!isLoggedIn ? 'disabled' : ''} title="Hapus">🗑</button>
      </div>
    </div>`;
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
      </div>
      ${isLoggedIn ? `<button class="btn" onclick="openAgendaModal()">+ Tambah Agenda</button>` : ''}
    </div>
    <div class="panel-body flush agenda-table-wrap">
      <table class="general-table jadwal-table">
        <thead><tr><th>Tanggal</th><th>Status</th><th>Kategori</th><th>Judul</th><th>Deskripsi</th><th></th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="6">Belum ada agenda. ${isLoggedIn ? 'Tambahkan agenda untuk mendapatkan pengingat.' : 'Login untuk menambah agenda.'}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="panel-body agenda-mobile-wrap">
      <div class="jadwal-item-list">${cards || `<div class="empty-row" style="padding:30px;text-align:center;">Belum ada agenda. ${isLoggedIn ? 'Tambahkan agenda untuk mendapatkan pengingat.' : 'Login untuk menambah agenda.'}</div>`}</div>
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

  // Tabel ringkas khusus HP — tetap berupa TABEL utuh (bukan kartu):
  // No, Keterangan, Debit, Kredit, Saldo. Kolom Tanggal & Aksi disembunyikan
  // supaya 5 kolom inti muat tanpa geser; baris bisa diketuk langsung untuk
  // Edit (tombol Hapus dipindah ke dalam modal edit, lihat openKasModal).
  // Kalau layar HP sangat sempit, kolom Saldo ikut disembunyikan lewat CSS
  // (lihat media query .kas-table-mobile di style.css) sehingga tampilan
  // jadi No, Keterangan, Debit, Kredit saja.
  const mobileRows = displayList.map((k, idx) => `
    <tr${canKelola ? ` class="row-clickable" onclick="openKasModal('${k.id}')"` : ''}>
      <td data-label="No">${idx + 1}</td>
      <td data-label="Keterangan">${esc(k.keterangan||'-')}</td>
      <td data-label="Debit" class="num">${Number(k.debit||0)>0 ? fmtRp(k.debit) : '-'}</td>
      <td data-label="Kredit" class="num">${Number(k.kredit||0)>0 ? fmtRp(k.kredit) : '-'}</td>
      <td data-label="Saldo" class="num">${fmtRp(k._saldo)}</td>
    </tr>`).join('');

  return `
  <div class="stat-grid">
    <div class="stat-card pemasukan"><div class="lbl">Total Debit</div><div class="val">${fmtRp(totalDebit)}</div></div>
    <div class="stat-card pengeluaran"><div class="lbl">Total Kredit</div><div class="val">${fmtRp(totalKredit)}</div></div>
    <div class="stat-card ${saldo<0?'defisit':'saldo'}"><div class="lbl">Saldo Kas</div><div class="val">${fmtRp(saldo)}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <div></div>
      ${canKelola ? `<button class="btn" onclick="openKasModal()">+ Tambah Transaksi</button>` : ''}
    </div>
    <div class="panel-body flush kas-table-wrap">
      <table class="general-table kas-table">
        <thead><tr><th>No</th><th>Tanggal</th><th>Keterangan</th><th class="num">Debit</th><th class="num">Kredit</th><th class="num">Saldo</th>${canKelola?'<th></th>':''}</tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="${canKelola?7:6}">Belum ada transaksi kas. ${canKelola ? '' : 'Hanya role tertentu yang bisa menambah transaksi.'}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="panel-body flush kas-mobile-wrap">
      <table class="general-table kas-table-mobile">
        <thead><tr><th>No</th><th>Keterangan</th><th class="num">Debit</th><th class="num">Kredit</th><th class="num">Saldo</th></tr></thead>
        <tbody>${mobileRows || `<tr class="empty-row"><td colspan="5">Belum ada transaksi kas. ${canKelola ? '' : 'Hanya role tertentu yang bisa menambah transaksi.'}</td></tr>`}</tbody>
      </table>
    </div>
  </div>
  <div class="kas-footnote">
    Catatan: Dokumen ini merupakan salinan digital (backup).
    Referensi utama tetap pada buku besar fisik.
    Apabila terdapat perbedaan, maka buku besar manual menjadi acuan resmi.
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
    ...(editing ? [{label:'Hapus', cls:'danger', onclick:()=>{ closeModal(); hapusKas(editing.id); }}] : []),
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

