/* ============================================================
   DANA SOSIAL
   Iuran bulanan Rp 5.000/anggota — TIDAK terikat event 17-an
   manapun (sama seperti Kas Karang Taruna/Agenda/Gudang).

   Daftar anggota di sini adalah daftar MASTER TERPISAH TOTAL dari
   kt_anggota (Iuran Anggota per-event) — lihat kt_dana_sosial_anggota
   di supabase-dana-sosial-migration.sql. Anggota baru yang gabung di
   tengah tahun disimpan `tanggal_gabung`-nya; bulan-bulan SEBELUM itu
   otomatis dikosongkan di tabel (bukan dianggap "belum bayar").

   Setiap bulan direkap: jumlah anggota yang lunas dikali Rp 5.000,
   dikurangi potongan konsumsi pertemuan flat Rp 80.000 (tidak bisa
   diubah per bulan — sesuai keputusan awal fitur ini). Potongan ini
   TIDAK disimpan di DB, dihitung on-the-fly saat render supaya gampang
   diubah lagi nanti kalau kebijakan berubah.

   Struktur mengikuti pola modul eventless lain (lihat renderKas() di
   js/12-jadwal-agenda-kas.js): getter global (gDanaSosialAnggota/
   gDanaSosialBayar di js/18-getters-refresh.js), guard canEditSection
   ('dana-sosial'), dan notifyTelegram() untuk perubahan data anggota
   master (BUKAN untuk tiap toggle lunas/belum per sel — itu bisa
   terjadi puluhan kali dalam semenit saat rekap pertemuan bulanan,
   jadi sengaja tidak dikirim ke Telegram supaya tidak spam).

   Anggota dengan flag `perantauan` (lihat
   supabase-dana-sosial-perantauan-migration.sql) ditampilkan di tabel
   TERPISAH di tab Daftar Bayar, karena mereka biasanya tidak bayar
   bulanan seperti anggota reguler — baru bayar/rapel setahun sekali
   saat pulang. Struktur datanya tetap sama persis (baris
   kt_dana_sosial_bayar per bulan), cuma dipisah tampilannya saja.
   ============================================================ */

const DANA_SOSIAL_IURAN_PER_ORANG = 5000;
const DANA_SOSIAL_POTONGAN_KONSUMSI = 80000;
const DANA_SOSIAL_BULAN_LABEL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// Tahun yang lagi dilihat di tabel/rekap. Reset ke tahun berjalan tiap kali
// halaman dimuat ulang (tidak perlu disimpan permanen) — cukup dropdown di
// halaman utk pindah ke tahun sebelumnya/berikutnya.
let danaSosialTahunAktif = new Date().getFullYear();

// Daftar tahun yang bisa dipilih di dropdown: tahun berjalan, tahun depan
// (biar bisa disiapkan lebih awal), plus tahun mana pun yang sudah punya
// data (baris bayar atau anggota yang gabung di tahun itu).
function danaSosialTahunList(){
  const now = new Date().getFullYear();
  const tahunSet = new Set([now, now + 1]);
  db.danaSosialBayar.forEach(b => tahunSet.add(Number(b.tahun)));
  db.danaSosialAnggota.forEach(a => { if (a.tanggal_gabung) tahunSet.add(Number(a.tanggal_gabung.slice(0,4))); });
  return Array.from(tahunSet).sort((a,b) => b - a);
}

// Anggota wajib bayar bulan ini kalau tanggal gabungnya <= bulan yang dicek.
// Bulan-bulan SEBELUM gabung otomatis tidak wajib (dikosongkan di tabel).
function isWajibDanaSosial(anggota, tahun, bulan){
  if (!anggota.tanggal_gabung) return true;
  const g = new Date(anggota.tanggal_gabung + 'T00:00:00');
  const gKey = g.getFullYear() * 12 + g.getMonth(); // bulan 0-11
  const tKey = Number(tahun) * 12 + (Number(bulan) - 1);
  return tKey >= gKey;
}

function getDanaSosialBayar(anggotaId, tahun, bulan){
  return db.danaSosialBayar.find(b => b.anggota_id === anggotaId && Number(b.tahun) === Number(tahun) && Number(b.bulan) === Number(bulan));
}

// Bulan ini sudah "terlewati" (sudah terjadi atau sedang berjalan)? Dipakai
// supaya rekap bulan-bulan yang belum terjadi diberi label "proyeksi", bukan
// dianggap sudah pasti defisit Rp 80.000.
function danaSosialSudahBerjalan(tahun, bulan){
  const now = new Date();
  const tKey = Number(tahun) * 12 + (Number(bulan) - 1);
  const nKey = now.getFullYear() * 12 + now.getMonth();
  return tKey <= nKey;
}

function hitungRekapBulanDanaSosial(tahun, bulan){
  const anggotaWajib = db.danaSosialAnggota.filter(a => isWajibDanaSosial(a, tahun, bulan));
  const lunasList = anggotaWajib.filter(a => { const r = getDanaSosialBayar(a.id, tahun, bulan); return r && r.lunas; });
  const terkumpul = lunasList.length * DANA_SOSIAL_IURAN_PER_ORANG;
  const potongan = DANA_SOSIAL_POTONGAN_KONSUMSI;
  return {
    wajib: anggotaWajib.length,
    lunas: lunasList.length,
    belum: anggotaWajib.length - lunasList.length,
    terkumpul, potongan,
    saldoBersih: terkumpul - potongan,
    sudahBerjalan: danaSosialSudahBerjalan(tahun, bulan),
  };
}

// Saldo Dana Sosial keseluruhan (sejak anggota pertama gabung sampai bulan
// berjalan sekarang) — dijumlahkan dari saldo bersih tiap bulan yang MEMANG
// sudah punya anggota wajib bayar (bulan sebelum ada anggota sama sekali
// tidak ikut dihitung, karena belum ada pertemuan/potongan konsumsi).
// Bulan yang belum terlewati (masa depan) sengaja tidak diikutkan supaya
// saldo tidak "dipotong" duluan untuk pertemuan yang belum terjadi.
function hitungSaldoDanaSosialTotal(){
  if (db.danaSosialAnggota.length === 0) return 0;
  const now = new Date();
  const tahunMulai = db.danaSosialAnggota.reduce((min, a) => {
    const y = a.tanggal_gabung ? Number(a.tanggal_gabung.slice(0,4)) : now.getFullYear();
    return Math.min(min, y);
  }, now.getFullYear());
  let total = 0;
  for (let y = tahunMulai; y <= now.getFullYear(); y++){
    const bulanAkhir = (y === now.getFullYear()) ? (now.getMonth() + 1) : 12;
    for (let b = 1; b <= bulanAkhir; b++){
      const r = hitungRekapBulanDanaSosial(y, b);
      if (r.wajib > 0) total += r.saldoBersih;
    }
  }
  return total;
}

function gantiTahunDanaSosial(v){
  danaSosialTahunAktif = Number(v);
  renderContent();
}

// Tab aktif di halaman Dana Sosial: 'daftar' (list nama + centang bayar saja,
// tanpa aksi kelola), 'kelola' (tambah/ubah/hapus/ambil dari Database Anggota),
// atau 'rekap' (Rekap Bulanan). Reset ke 'daftar' tiap kali halaman dimuat
// ulang (tidak perlu disimpan permanen), sama seperti pola tab di renderLomba().
let danaSosialActiveTab = 'daftar';
function setDanaSosialTab(tab){
  danaSosialActiveTab = tab;
  renderContent();
}

function renderDanaSosial(){
  const canEdit = canEditSection('dana-sosial');
  const tahun = danaSosialTahunAktif;
  const anggotaList = gDanaSosialAnggota();
  const anggotaReguler = anggotaList.filter(a => !a.perantauan);
  const anggotaPerantauan = anggotaList.filter(a => a.perantauan);
  const now = new Date();
  const rekapBulanIni = hitungRekapBulanDanaSosial(now.getFullYear(), now.getMonth() + 1);
  const saldoTotal = hitungSaldoDanaSosialTotal();

  const tahunOptions = danaSosialTahunList().map(t => `<option value="${t}" ${t===tahun?'selected':''}>${t}</option>`).join('');
  const theadBulan = DANA_SOSIAL_BULAN_LABEL.map(l => `<th>${l}</th>`).join('');

  function buatBarisBayar(list){
    return list.map((a, idx) => {
      const cells = DANA_SOSIAL_BULAN_LABEL.map((_, i) => {
        const bulan = i + 1;
        if (!isWajibDanaSosial(a, tahun, bulan)){
          return `<td class="ds-cell"><span class="ds-toggle ds-muted" title="Belum gabung">·</span></td>`;
        }
        const rec = getDanaSosialBayar(a.id, tahun, bulan);
        const lunas = !!(rec && rec.lunas);
        const titleTxt = `${esc(a.nama)} · ${DANA_SOSIAL_BULAN_LABEL[i]} ${tahun} — ${lunas ? 'Lunas (klik untuk batalkan)' : 'Belum bayar (klik untuk tandai lunas)'}`;
        return `<td class="ds-cell"><button type="button" class="ds-toggle ${lunas?'lunas':'belum'}" ${canEdit?`onclick="toggleDanaSosialBayar('${a.id}',${tahun},${bulan})"`:'disabled'} title="${titleTxt}">${lunas?'✓':''}</button></td>`;
      }).join('');
      return `<tr>
        <td class="ds-no">${idx+1}</td>
        <td class="ds-nama">${esc(a.nama)}</td>
        ${cells}
      </tr>`;
    }).join('');
  }

  const rowsReguler = buatBarisBayar(anggotaReguler);
  const rowsPerantauan = buatBarisBayar(anggotaPerantauan);

  const kelolaRows = anggotaList.map(a => `<tr>
    <td>${esc(a.nama)}${a.perantauan?' <span class="kategori-pill khusus">Perantauan</span>':''}</td>
    <td>${fmtDate(a.tanggal_gabung)}</td>
    <td style="text-align:right; white-space:nowrap;">
      ${canEdit?`<button class="icon-btn" onclick="openDanaSosialAnggotaModal('${a.id}')" title="Edit">✎</button>
      <button class="icon-btn" onclick="hapusDanaSosialAnggota('${a.id}')" title="Hapus">🗑</button>`:''}
    </td>
  </tr>`).join('');

  const rekapRows = DANA_SOSIAL_BULAN_LABEL.map((l, i) => {
    const bulan = i + 1;
    const r = hitungRekapBulanDanaSosial(tahun, bulan);
    if (r.wajib === 0){
      return `<tr class="ds-rekap-kosong"><td>${l} ${tahun}</td><td colspan="5" class="hint">Belum ada anggota wajib bayar</td></tr>`;
    }
    return `<tr>
      <td>${l} ${tahun}</td>
      <td class="num">${r.wajib}</td>
      <td class="num">${r.lunas}</td>
      <td class="num">${fmtRp(r.terkumpul)}</td>
      <td class="num">${fmtRp(r.potongan)}</td>
      <td class="num ${r.saldoBersih<0?'ds-minus':''}">${fmtRp(r.saldoBersih)}${!r.sudahBerjalan?' <span class="hint">(proyeksi)</span>':''}</td>
    </tr>`;
  }).join('');

  let totalTerkumpulTahun = 0, totalPotonganTahun = 0;
  for (let b = 1; b <= 12; b++){
    const r = hitungRekapBulanDanaSosial(tahun, b);
    totalTerkumpulTahun += r.terkumpul;
    if (r.wajib > 0) totalPotonganTahun += r.potongan;
  }
  const totalSaldoTahun = totalTerkumpulTahun - totalPotonganTahun;

  return `
  <div class="stat-grid-ringkasan" style="margin-bottom:26px;">
    <div class="stat-card"><div class="lbl">Total Anggota</div><div class="val">${anggotaList.length}</div></div>
    <div class="stat-card pemasukan"><div class="lbl">Lunas Bulan Ini (${DANA_SOSIAL_BULAN_LABEL[now.getMonth()]} ${now.getFullYear()})</div><div class="val">${rekapBulanIni.lunas} / ${rekapBulanIni.wajib}</div></div>
    <div class="stat-card ${saldoTotal<0?'defisit':'saldo'}"><div class="lbl">Saldo Dana Sosial</div><div class="val">${fmtRp(saldoTotal)}</div></div>
  </div>

  <div class="lomba-tabs">
    <button type="button" class="lomba-tabbtn ${danaSosialActiveTab==='daftar'?'active':''}" onclick="setDanaSosialTab('daftar')">Daftar Bayar</button>
    <button type="button" class="lomba-tabbtn ${danaSosialActiveTab==='kelola'?'active':''}" onclick="setDanaSosialTab('kelola')">Kelola Anggota</button>
    <button type="button" class="lomba-tabbtn ${danaSosialActiveTab==='rekap'?'active':''}" onclick="setDanaSosialTab('rekap')">Rekap Bulanan</button>
  </div>

  <div style="display:${danaSosialActiveTab==='daftar'?'block':'none'};">
  <div class="panel">
    <div class="panel-head">
      <div><h3>Daftar Bayar</h3>
        <div class="desc">Iuran ${fmtRp(DANA_SOSIAL_IURAN_PER_ORANG)}/orang/bulan · klik sel bulan untuk tandai lunas/belum</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <select id="ds-tahun-select" onchange="gantiTahunDanaSosial(this.value)">${tahunOptions}</select>
      </div>
    </div>
    <div class="panel-body flush">
      <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table class="ds-table ds-has-no">
          <thead><tr><th class="ds-no-h">No</th><th class="ds-nama-h">Nama</th>${theadBulan}</tr></thead>
          <tbody>${rowsReguler || `<tr class="empty-row"><td colspan="14">Belum ada anggota Dana Sosial. ${canEdit?'Buka tab Kelola Anggota untuk mulai.':'Hanya role tertentu yang bisa menambah anggota.'}</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="panel" style="margin-top:20px;">
    <div class="panel-head">
      <div><h3>Anggota Perantauan</h3>
        <div class="desc">Biasanya bayar setahun sekali (rapel beberapa bulan) saat pulang/nitip bayar</div>
      </div>
    </div>
    <div class="panel-body flush">
      <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table class="ds-table ds-has-no">
          <thead><tr><th class="ds-no-h">No</th><th class="ds-nama-h">Nama</th>${theadBulan}</tr></thead>
          <tbody>${rowsPerantauan || `<tr class="empty-row"><td colspan="14">Belum ada anggota Perantauan. ${canEdit?'Tandai anggota sebagai Perantauan di tab Kelola Anggota.':''}</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  </div>
  </div>

  <div style="display:${danaSosialActiveTab==='kelola'?'block':'none'};">
  <div class="panel">
    <div class="panel-head">
      <div><h3>Kelola Anggota Dana Sosial</h3>
        <div class="desc">Tambah, ubah, atau hapus anggota master Dana Sosial</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        ${canEdit?`<button class="btn secondary" onclick="sinkronkanPerantauanDanaSosial()">🔄 Sinkronkan Status Perantauan</button>`:''}
        ${canEdit?`<button class="btn secondary" onclick="openImporDanaSosialModal()">📥 Ambil dari Database Anggota</button>`:''}
        ${canEdit?`<button class="btn" onclick="openDanaSosialAnggotaModal()">+ Tambah Anggota</button>`:''}
      </div>
    </div>
    <div class="panel-body flush">
      <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table>
          <thead><tr><th>Nama</th><th>Tanggal Gabung</th><th style="text-align:right;">Aksi</th></tr></thead>
          <tbody>${kelolaRows || `<tr class="empty-row"><td colspan="3">Belum ada anggota Dana Sosial. ${canEdit?'Klik + Tambah Anggota atau Ambil dari Database Anggota untuk mulai.':'Hanya role tertentu yang bisa menambah anggota.'}</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  </div>
  </div>

  <div style="display:${danaSosialActiveTab==='rekap'?'block':'none'};">
  <div class="panel">
    <div class="panel-head">
      <div><h3>Rekap Bulanan ${tahun}</h3>
        <div class="desc">Terkumpul dikurangi potongan konsumsi pertemuan (flat ${fmtRp(DANA_SOSIAL_POTONGAN_KONSUMSI)}/bulan)</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <select id="ds-tahun-select-rekap" onchange="gantiTahunDanaSosial(this.value)">${tahunOptions}</select>
      </div>
    </div>
    <div class="panel-body flush">
      <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table class="ds-rekap-table">
          <thead><tr><th>Bulan</th><th>Wajib</th><th>Lunas</th><th>Terkumpul</th><th>Potongan</th><th>Saldo Bersih</th></tr></thead>
          <tbody>${rekapRows}</tbody>
          <tfoot><tr class="ds-rekap-total"><td>Total ${tahun}</td><td></td><td></td><td class="num">${fmtRp(totalTerkumpulTahun)}</td><td class="num">${fmtRp(totalPotonganTahun)}</td><td class="num ${totalSaldoTahun<0?'ds-minus':''}">${fmtRp(totalSaldoTahun)}</td></tr></tfoot>
        </table>
      </div>
      <div class="ds-footnote">* Saldo bulan yang belum terlewati bersifat proyeksi (asumsi potongan konsumsi tetap berlaku).</div>
    </div>
  </div>
  </div>`;
}

async function toggleDanaSosialBayar(anggotaId, tahun, bulan){
  if (!canEditSection('dana-sosial')) { toast('⛔ Anda tidak memiliki akses untuk mengedit Dana Sosial'); return; }
  const anggota = db.danaSosialAnggota.find(a => a.id === anggotaId);
  if (!anggota) return;
  if (!isWajibDanaSosial(anggota, tahun, bulan)) return;
  let rec = getDanaSosialBayar(anggotaId, tahun, bulan);
  if (rec){
    rec.lunas = !rec.lunas;
    rec.tanggal_bayar = rec.lunas ? todayISO() : null;
  } else {
    rec = { id: uid(), anggota_id: anggotaId, tahun: Number(tahun), bulan: Number(bulan), lunas: true, tanggal_bayar: todayISO(), created_at: new Date().toISOString() };
    db.danaSosialBayar.push(rec);
  }
  saveDB(); renderContent();
}

function openDanaSosialAnggotaModal(id){
  if (!canEditSection('dana-sosial')) { toast('⛔ Anda tidak memiliki akses untuk mengedit Dana Sosial'); return; }
  const editing = id ? db.danaSosialAnggota.find(a => a.id === id) : null;
  setModal(editing ? 'Edit Anggota Dana Sosial' : 'Tambah Anggota Dana Sosial', `
    <div class="field"><label>Nama</label><input id="f-ds-nama" value="${editing?esc(editing.nama):''}" placeholder="Nama lengkap"></div>
    <div class="field"><label>Tanggal Gabung</label><input id="f-ds-gabung" type="date" value="${editing?editing.tanggal_gabung:todayISO()}"></div>
    <div class="hint">Bulan sebelum tanggal gabung otomatis dikosongkan di tabel (dianggap belum wajib bayar).</div>
    <label style="display:flex; align-items:center; gap:8px; margin-top:10px; cursor:pointer;">
      <input type="checkbox" id="f-ds-perantauan" ${editing&&editing.perantauan?'checked':''}> Perantauan
    </label>
    <div class="hint">Anggota Perantauan ditampilkan di tabel terpisah (biasanya bayar setahun sekali/rapel).</div>
  `, [
    {label:'Batal', cls:'secondary', onclick:()=>closeModal()},
    ...(editing ? [{label:'Hapus', cls:'danger', onclick:()=>{ closeModal(); hapusDanaSosialAnggota(editing.id); }}] : []),
    {label: editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const nama = document.getElementById('f-ds-nama').value.trim();
      const tanggal_gabung = document.getElementById('f-ds-gabung').value || todayISO();
      const perantauan = document.getElementById('f-ds-perantauan').checked;
      if (!nama){ toast('Nama wajib diisi'); return; }
      closeModal();
      if (editing){
        editing.nama = nama; editing.tanggal_gabung = tanggal_gabung; editing.perantauan = perantauan;
        notifyTelegram(`✏️ Edit anggota Dana Sosial: ${nama}`);
      } else {
        db.danaSosialAnggota.push({ id: uid(), nama, tanggal_gabung, perantauan, aktif: true, created_at: new Date().toISOString() });
        notifyTelegram(`➕ Anggota Dana Sosial baru: ${nama}`, `Tanggal gabung: ${fmtDate(tanggal_gabung)}`);
      }
      saveDB(); renderContent();
    }}
  ]);
}

function hapusDanaSosialAnggota(id){
  if (!canEditSection('dana-sosial')) { toast('⛔ Anda tidak memiliki akses untuk mengedit Dana Sosial'); return; }
  const a = db.danaSosialAnggota.find(x => x.id === id); if (!a) return;
  if (!confirm(`Hapus "${a.nama}" dari Dana Sosial? Semua riwayat bayar bulanan anggota ini juga akan ikut terhapus.`)) return;
  db.danaSosialAnggota = db.danaSosialAnggota.filter(x => x.id !== id);
  db.danaSosialBayar = db.danaSosialBayar.filter(b => b.anggota_id !== id);
  saveDB(); renderContent();
  notifyTelegram(`🗑️ Hapus anggota Dana Sosial: ${a.nama}`);
}

/* ============================================================
   IMPOR ANGGOTA DARI DATABASE ANGGOTA (kt_anggota)
   Dana Sosial punya daftar anggota MASTER TERPISAH dari kt_anggota
   (lihat catatan di atas file ini), jadi fitur ini cuma cara CEPAT
   mengisi anggota Dana Sosial dari nama-nama yang sudah ada di
   Database Anggota (iuran per-event) — bukan sinkronisasi permanen.
   Nama diambil dari SEMUA event (unik per nama, tidak peduli event
   mana), lalu nama yang sudah terdaftar di Dana Sosial dilewati
   otomatis (anti dobel).
   ============================================================ */
function daftarNamaUnikDariDatabaseAnggota(){
  const seen = new Set();
  const out = [];
  db.anggota.slice().sort((a,b)=>a.nama.localeCompare(b.nama,'id',{sensitivity:'base'})).forEach(a=>{
    const key = (a.nama||'').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(a);
  });
  return out;
}

function openImporDanaSosialModal(){
  if (!canEditSection('dana-sosial')) { toast('⛔ Anda tidak memiliki akses untuk mengedit Dana Sosial'); return; }
  const sumber = daftarNamaUnikDariDatabaseAnggota();
  if (sumber.length === 0){ toast('Database Anggota masih kosong'); return; }
  setModal('📥 Ambil Anggota dari Database Anggota', `
    <div class="field-hint" style="color:var(--ink-soft); font-size:12.5px; margin:-2px 0 10px;">Nama diambil dari Database Anggota (semua event, tanpa duplikat). Nama yang sudah terdaftar di Dana Sosial otomatis dilewati. Tanggal gabung diisi hari ini untuk semua yang dipilih.</div>
    <div class="field"><label>Tanggal Gabung</label><input id="impor-ds-gabung" type="date" value="${todayISO()}"></div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <label style="font-size:12px; display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="impor-ds-pilih-semua" onchange="toggleImporDanaSosialPilihSemua(this.checked)"> Pilih Semua</label>
      <span id="impor-ds-count-label" style="font-size:12px; color:var(--ink-soft);"></span>
    </div>
    <div id="impor-ds-list" style="max-height:320px; overflow-y:auto; border:1px solid var(--line); border-radius:8px; padding:4px 8px;"></div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:'Ambil Anggota Terpilih', cls:'', onclick:konfirmasiImporDanaSosial}
  ]);
  setTimeout(renderImporDanaSosialList, 0);
}

function renderImporDanaSosialList(){
  const listEl = document.getElementById('impor-ds-list');
  if (!listEl) return;
  const namaSekarang = new Set(db.danaSosialAnggota.map(a=>a.nama.trim().toLowerCase()));
  const sumber = daftarNamaUnikDariDatabaseAnggota();
  listEl.innerHTML = sumber.map(a=>{
    const dobel = namaSekarang.has(a.nama.trim().toLowerCase());
    const isPerantauan = a.kategori === 'perantauan';
    return `<label style="display:flex; align-items:center; gap:8px; padding:6px 2px; ${dobel?'opacity:.5;':''} border-bottom:1px solid var(--line);">
      <input type="checkbox" class="impor-ds-chk" value="${esc(a.nama)}" data-perantauan="${isPerantauan?'1':'0'}" ${dobel?'disabled':'checked'} onchange="updateImporDanaSosialCountLabel()">
      <span style="flex:1;">${esc(a.nama)} ${isPerantauan?'<span class="kategori-pill khusus">Perantauan</span>':''}</span>
      ${dobel?'<span style="font-size:11px;color:var(--ink-soft);">sudah ada</span>':''}
    </label>`;
  }).join('');
  const selectableCount = document.querySelectorAll('.impor-ds-chk:not(:disabled)').length;
  const pilihSemuaEl = document.getElementById('impor-ds-pilih-semua');
  if (pilihSemuaEl) pilihSemuaEl.checked = selectableCount > 0;
  updateImporDanaSosialCountLabel();
}

function toggleImporDanaSosialPilihSemua(checked){
  document.querySelectorAll('.impor-ds-chk:not(:disabled)').forEach(c=>c.checked=checked);
  updateImporDanaSosialCountLabel();
}

function updateImporDanaSosialCountLabel(){
  const label = document.getElementById('impor-ds-count-label');
  if (!label) return;
  const total = document.querySelectorAll('.impor-ds-chk').length;
  const checked = document.querySelectorAll('.impor-ds-chk:checked').length;
  label.textContent = total ? `${checked} dari ${total} dipilih` : '';
}

function konfirmasiImporDanaSosial(){
  const checked = Array.from(document.querySelectorAll('.impor-ds-chk:checked'));
  if (checked.length === 0){ toast('Pilih minimal satu anggota untuk diambil'); return; }
  const tanggal_gabung = document.getElementById('impor-ds-gabung').value || todayISO();
  let count = 0;
  checked.forEach(chk=>{
    const nama = chk.value.trim();
    if (!nama) return;
    const perantauan = chk.dataset.perantauan === '1';
    db.danaSosialAnggota.push({ id: uid(), nama, tanggal_gabung, perantauan, aktif: true, created_at: new Date().toISOString() });
    count++;
  });
  saveDB(); closeModal(); renderContent();
  toast(`✓ ${count} anggota diambil dari Database Anggota`);
  notifyTelegram(`📥 Ambil ${count} anggota Dana Sosial dari Database Anggota`, `Tanggal gabung: ${fmtDate(tanggal_gabung)}`);
}

/* ============================================================
   SINKRONISASI STATUS PERANTAUAN UNTUK DATA YANG SUDAH ADA
   Anggota Dana Sosial yang ditambahkan sebelum fitur pemisahan
   Perantauan ada, semuanya masih `perantauan=false` (tercampur
   dengan reguler di tabel utama). Fungsi ini mencocokkan nama tiap
   anggota Dana Sosial dengan Database Anggota (kt_anggota, semua
   event) — kalau ADA salah satu baris dengan nama yang sama dan
   kategori 'perantauan', anggota tsb otomatis ditandai Perantauan.
   Nama yang sudah ditandai manual sebagai Perantauan tidak diutak-
   atik lagi (hanya menambah, tidak pernah menghapus status).
   ============================================================ */
function sinkronkanPerantauanDanaSosial(){
  if (!canEditSection('dana-sosial')) { toast('⛔ Anda tidak memiliki akses untuk mengedit Dana Sosial'); return; }
  const namaPerantauan = new Set(
    db.anggota.filter(a => a.kategori === 'perantauan').map(a => (a.nama||'').trim().toLowerCase())
  );
  if (namaPerantauan.size === 0){ toast('Tidak ada anggota berkategori Perantauan di Database Anggota'); return; }
  let count = 0;
  db.danaSosialAnggota.forEach(a => {
    if (!a.perantauan && namaPerantauan.has((a.nama||'').trim().toLowerCase())){
      a.perantauan = true;
      count++;
    }
  });
  if (count === 0){ toast('Semua anggota sudah sesuai — tidak ada yang perlu disesuaikan'); return; }
  saveDB(); renderContent();
  toast(`✓ ${count} anggota dipindah ke tabel Perantauan`);
  notifyTelegram(`🔄 Sinkronkan status Perantauan Dana Sosial`, `${count} anggota ditandai Perantauan (dicocokkan dari Database Anggota)`);
}
