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

function renderDanaSosial(){
  const canEdit = canEditSection('dana-sosial');
  const tahun = danaSosialTahunAktif;
  const anggotaList = gDanaSosialAnggota();
  const now = new Date();
  const rekapBulanIni = hitungRekapBulanDanaSosial(now.getFullYear(), now.getMonth() + 1);
  const saldoTotal = hitungSaldoDanaSosialTotal();

  const tahunOptions = danaSosialTahunList().map(t => `<option value="${t}" ${t===tahun?'selected':''}>${t}</option>`).join('');
  const theadBulan = DANA_SOSIAL_BULAN_LABEL.map(l => `<th>${l}</th>`).join('');

  const rows = anggotaList.map(a => {
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
      <td class="ds-nama">${esc(a.nama)}${canEdit?` <button class="icon-btn" onclick="openDanaSosialAnggotaModal('${a.id}')" title="Edit">✎</button>`:''}</td>
      ${cells}
    </tr>`;
  }).join('');

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

  <div class="panel">
    <div class="panel-head">
      <div><h3>Daftar Anggota &amp; Status Bayar</h3>
        <div class="desc">Iuran ${fmtRp(DANA_SOSIAL_IURAN_PER_ORANG)}/orang/bulan · klik sel bulan untuk tandai lunas/belum</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <select id="ds-tahun-select" onchange="gantiTahunDanaSosial(this.value)">${tahunOptions}</select>
        ${canEdit?`<button class="btn" onclick="openDanaSosialAnggotaModal()">+ Tambah Anggota</button>`:''}
      </div>
    </div>
    <div class="panel-body flush">
      <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table class="general-table ds-table">
          <thead><tr><th>Nama</th>${theadBulan}</tr></thead>
          <tbody>${rows || `<tr class="empty-row"><td colspan="13">Belum ada anggota Dana Sosial. ${canEdit?'Klik + Tambah Anggota untuk mulai.':'Hanya role tertentu yang bisa menambah anggota.'}</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <div><h3>Rekap Bulanan ${tahun}</h3>
        <div class="desc">Terkumpul dikurangi potongan konsumsi pertemuan (flat ${fmtRp(DANA_SOSIAL_POTONGAN_KONSUMSI)}/bulan)</div>
      </div>
    </div>
    <div class="panel-body flush">
      <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table class="general-table ds-rekap-table">
          <thead><tr><th>Bulan</th><th>Wajib</th><th>Lunas</th><th>Terkumpul</th><th>Potongan</th><th>Saldo Bersih</th></tr></thead>
          <tbody>${rekapRows}</tbody>
          <tfoot><tr class="ds-rekap-total"><td>Total ${tahun}</td><td></td><td></td><td class="num">${fmtRp(totalTerkumpulTahun)}</td><td class="num">${fmtRp(totalPotonganTahun)}</td><td class="num ${totalSaldoTahun<0?'ds-minus':''}">${fmtRp(totalSaldoTahun)}</td></tr></tfoot>
        </table>
      </div>
      <div class="ds-footnote">* Saldo bulan yang belum terlewati bersifat proyeksi (asumsi potongan konsumsi tetap berlaku).</div>
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
  `, [
    {label:'Batal', cls:'secondary', onclick:()=>closeModal()},
    ...(editing ? [{label:'Hapus', cls:'danger', onclick:()=>{ closeModal(); hapusDanaSosialAnggota(editing.id); }}] : []),
    {label: editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const nama = document.getElementById('f-ds-nama').value.trim();
      const tanggal_gabung = document.getElementById('f-ds-gabung').value || todayISO();
      if (!nama){ toast('Nama wajib diisi'); return; }
      closeModal();
      if (editing){
        editing.nama = nama; editing.tanggal_gabung = tanggal_gabung;
        notifyTelegram(`✏️ Edit anggota Dana Sosial: ${nama}`);
      } else {
        db.danaSosialAnggota.push({ id: uid(), nama, tanggal_gabung, aktif: true, created_at: new Date().toISOString() });
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
