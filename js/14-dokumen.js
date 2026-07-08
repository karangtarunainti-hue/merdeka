/* ============================================================
   SURAT & DOKUMEN
   Kumpulan dokumen siap cetak: Surat Undangan Kegiatan, Proposal
   Kegiatan, Form Absensi (berdasar Database Anggota), dan Jadwal
   Sinoman (jadwal piket pagi/siang/sore, nama dipilih dari Database
   Anggota). Draft teksnya disimpan di db.dokumenGlobal (kolom jsonb
   `dokumen` di tabel kt_dokumen_global — lihat
   supabase-dokumen-global-migration.sql, tidak perlu migrasi baru
   karena kolomnya jsonb bebas struktur). Pola cetaknya sama seperti
   LPJ: render di layar, lalu tombol "Cetak / Simpan sebagai PDF"
   yang memanggil window.print().
   ============================================================ */
function nl2br(s){ return esc(s).replace(/\n/g, '<br>'); }

// Nama untuk dropdown Pagi/Siang/Sore di Jadwal Sinoman — diambil dari
// Database Anggota (bukan ketik bebas), sama seperti dropdown lain di app ini.
function dokumenDaftarNama(){
  const set = new Set();
  db.anggota.forEach(a => { if(a.nama && a.nama.trim()) set.add(a.nama.trim()); });
  return [...set].sort((a,b)=>a.localeCompare(b));
}
function dokumenOptionsNama(selected){
  const names = dokumenDaftarNama();
  const opts = names.map(n => `<option value="${esc(n)}" ${n===selected?'selected':''}>${esc(n)}</option>`).join('');
  const extra = (selected && !names.includes(selected))
    ? `<option value="${esc(selected)}" selected>${esc(selected)} (tidak ada di data anggota)</option>` : '';
  return `<option value=""${!selected?' selected':''}>— pilih nama —</option>${extra}${opts}`;
}

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
    {key:'jadwal_sinoman', label:'🗓️ Jadwal Sinoman'},
  ];
  const tabNav = `<div class="dokumen-tabs no-print">${tabs.map(t=>`<button type="button" class="dokumen-tab ${_dokumenTab===t.key?'active':''}" onclick="gotoDokumenTab('${t.key}')">${t.label}</button>`).join('')}</div>`;
  let body = '';
  if(_dokumenTab==='proposal') body = renderProposalKegiatan(ev);
  else if(_dokumenTab==='absensi') body = renderFormAbsensi(ev);
  else if(_dokumenTab==='jadwal_sinoman') body = renderJadwalSinoman(ev);
  else body = renderSuratUndangan(ev);
  return tabNav + body;
}

/* ---------- 1. Surat Undangan Kegiatan ---------- */
// Membungkus form-isi (kiri) & pratinjau (kanan) supaya di layar lebar
// keduanya tampil berdampingan (lihat .dokumen-layout di style.css) — jadi
// tidak perlu scroll ke bawah untuk lihat hasil saat mengisi form. Di layar
// sempit/HP, CSS otomatis menumpuk keduanya secara vertikal seperti biasa.
// Kalau editForm kosong (guest, tidak login), pratinjau ditampilkan sendiri
// tanpa pembungkus grid, supaya tetap center seperti tampilan guest sebelumnya.
function wrapDokumenLayout(editFormHtml, previewHtml){
  if(!editFormHtml) return previewHtml;
  return `<div class="dokumen-layout">${editFormHtml}<div class="dokumen-preview-col">${previewHtml}</div></div>`;
}

function renderSuratUndangan(ev){
  const isLoggedIn = !!getCurrentUser();
  const d = getDokumenGlobal().undangan || {};
  const namaKegiatanDefault = d.nama_kegiatan || (ev ? ev.nama : '');
  const editForm = isLoggedIn ? `
  <div class="panel no-print">
    <div class="panel-head"><h3>✏️ Isi Data Surat Undangan</h3></div>
    <div class="panel-body">
      <div class="field-row">
        <div class="field"><label>Nomor Surat</label><input id="doc-und-nomor" value="${esc(d.nomor_surat||'')}" placeholder="001/KT-Inti/VII/2026" oninput="liveUndangan('nomor_surat', this.value)"></div>
        <div class="field"><label>Perihal</label><input id="doc-und-perihal" value="${esc(d.perihal||'')}" placeholder="Undangan Rapat Persiapan" oninput="liveUndangan('perihal', this.value)"></div>
      </div>
      <div class="field"><label>Nama Kegiatan</label><input id="doc-und-nama-kegiatan" value="${esc(namaKegiatanDefault)}" placeholder="Contoh: 17-an Tahun 2026" oninput="liveUndangan('nama_kegiatan', this.value)"></div>
      <div class="field"><label>Kepada Yth.</label><input id="doc-und-kepada" value="${esc(d.kepada||'')}" placeholder="Seluruh Warga RT 01-03 / Pengurus Karang Taruna" oninput="liveUndangan('kepada', this.value)"></div>
      <div class="field-row">
        <div class="field"><label>Hari, Tanggal</label><input id="doc-und-hari-tanggal" value="${esc(d.hari_tanggal||'')}" placeholder="Minggu, 17 Agustus 2026" oninput="liveUndangan('hari_tanggal', this.value)"></div>
        <div class="field"><label>Waktu</label><input id="doc-und-waktu" value="${esc(d.waktu||'')}" placeholder="19.30 WIB - selesai" oninput="liveUndangan('waktu', this.value)"></div>
      </div>
      <div class="field"><label>Tempat</label><input id="doc-und-tempat" value="${esc(d.tempat||'')}" placeholder="Balai Desa / Rumah Bapak RT 02" oninput="liveUndangan('tempat', this.value)"></div>
      <div class="field"><label>Acara</label><input id="doc-und-acara" value="${esc(d.acara||'')}" placeholder="Rapat persiapan ${esc(namaKegiatanDefault||'kegiatan')}" oninput="liveUndangan('acara', this.value)"></div>
      <div class="field"><label>Catatan Tambahan (opsional)</label><textarea id="doc-und-catatan" rows="3" placeholder="Mohon hadir tepat waktu..." oninput="liveUndangan('catatan', this.value)">${esc(d.catatan||'')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Jabatan Penandatangan 1</label><input id="doc-und-jab1" value="${esc(d.jabatan1||'Ketua Panitia')}" oninput="liveUndangan('jabatan1', this.value)"></div>
        <div class="field"><label>Nama Penandatangan 1</label><input id="doc-und-nama1" value="${esc(d.nama1||'')}" oninput="liveUndangan('nama1', this.value)"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Jabatan Penandatangan 2</label><input id="doc-und-jab2" value="${esc(d.jabatan2||'Sekretaris')}" oninput="liveUndangan('jabatan2', this.value)"></div>
        <div class="field"><label>Nama Penandatangan 2</label><input id="doc-und-nama2" value="${esc(d.nama2||'')}" oninput="liveUndangan('nama2', this.value)"></div>
      </div>
      <div class="field-hint" style="color:var(--ink-soft); font-size:12.5px; margin-top:6px;">✅ Tersimpan otomatis saat Anda mengetik.</div>
    </div>
  </div>` : '';

  return wrapDokumenLayout(editForm, `
  <div class="lpj-scale-wrap" id="lpj-scale-wrap">
  <div class="lpj-print-area surat-print-area" id="lpj-print-area">
    <div class="lpj-header">
      <div class="lpj-header-inner">
        <img src="icons/logo-kop.png" alt="Logo Karang Taruna Inti" class="lpj-logo">
        <div class="lpj-header-text">
          <div class="lpj-eyebrow">Karang Taruna Inti</div>
          <h2>SURAT UNDANGAN</h2>
          <div class="lpj-sub" id="und-prev-nomor">${d.nomor_surat ? `Nomor: ${esc(d.nomor_surat)}` : 'Nomor: -'}</div>
        </div>
        <div class="lpj-header-spacer" aria-hidden="true"></div>
      </div>
    </div>

    <p class="surat-body">Perihal: <strong id="und-prev-perihal">${esc(d.perihal||'-')}</strong></p>
    <p class="surat-body">Kepada Yth.<br><strong id="und-prev-kepada">${esc(d.kepada||'-')}</strong><br>di Tempat</p>
    <p class="surat-body">Dengan hormat,</p>
    <p class="surat-body">Sehubungan dengan pelaksanaan kegiatan <strong id="und-prev-namakegiatan">${esc(d.nama_kegiatan||'-')}</strong>, kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada:</p>
    <table class="lpj-table surat-detail-table">
      <tbody>
        <tr><td class="surat-detail-label">Hari, Tanggal</td><td>: <span id="und-prev-haritanggal">${esc(d.hari_tanggal||'-')}</span></td></tr>
        <tr><td class="surat-detail-label">Waktu</td><td>: <span id="und-prev-waktu">${esc(d.waktu||'-')}</span></td></tr>
        <tr><td class="surat-detail-label">Tempat</td><td>: <span id="und-prev-tempat">${esc(d.tempat||'-')}</span></td></tr>
        <tr><td class="surat-detail-label">Acara</td><td>: <span id="und-prev-acara">${esc(d.acara||'-')}</span></td></tr>
      </tbody>
    </table>
    <p class="surat-body" id="und-prev-catatan" style="${d.catatan ? '' : 'display:none'}">${d.catatan ? nl2br(d.catatan) : ''}</p>
    <p class="surat-body">Demikian undangan ini kami sampaikan. Atas perhatian dan kehadirannya kami ucapkan terima kasih.</p>

    <div class="lpj-signature">
      <div class="surat-ttd"><div id="und-prev-jab1">${esc(d.jabatan1||'Ketua Panitia')}</div><div class="surat-ttd-space"></div><div><strong id="und-prev-nama1">${esc(d.nama1||'(.....................)')}</strong></div></div>
      <div class="surat-ttd"><div id="und-prev-jab2">${esc(d.jabatan2||'Sekretaris')}</div><div class="surat-ttd-space"></div><div><strong id="und-prev-nama2">${esc(d.nama2||'(.....................)')}</strong></div></div>
    </div>
  </div>
  </div>
  ${isLoggedIn ? `<div class="lpj-toolbar no-print"><button class="btn small" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button></div>` : ''}`);
}

function setPrevText(id, text){ const el = document.getElementById(id); if(el) el.textContent = text; }

// Autosave: dipanggil langsung dari oninput tiap field form Undangan.
// Menyimpan ke db (lalu ke Supabase via saveDB() yang sudah di-debounce 400ms)
// TANPA renderContent(), supaya form tidak di-render ulang & fokus/kursor
// input tidak hilang saat user masih mengetik. Pratinjau surat di-update
// langsung lewat DOM (textContent) supaya tetap tampak realtime.
function liveUndangan(field, value){
  const s = getDokumenGlobal();
  s.undangan = s.undangan || {};
  s.undangan[field] = value;
  saveDB();

  if(field === 'nomor_surat') setPrevText('und-prev-nomor', value ? `Nomor: ${value}` : 'Nomor: -');
  else if(field === 'perihal') setPrevText('und-prev-perihal', value || '-');
  else if(field === 'kepada') setPrevText('und-prev-kepada', value || '-');
  else if(field === 'nama_kegiatan') setPrevText('und-prev-namakegiatan', value || '-');
  else if(field === 'hari_tanggal') setPrevText('und-prev-haritanggal', value || '-');
  else if(field === 'waktu') setPrevText('und-prev-waktu', value || '-');
  else if(field === 'tempat') setPrevText('und-prev-tempat', value || '-');
  else if(field === 'acara') setPrevText('und-prev-acara', value || '-');
  else if(field === 'catatan'){
    const el = document.getElementById('und-prev-catatan');
    if(el){
      if(value){ el.style.display=''; el.innerHTML = nl2br(value); }
      else { el.style.display='none'; el.innerHTML=''; }
    }
  }
  else if(field === 'jabatan1') setPrevText('und-prev-jab1', value || 'Ketua Panitia');
  else if(field === 'nama1') setPrevText('und-prev-nama1', value || '(.....................)');
  else if(field === 'jabatan2') setPrevText('und-prev-jab2', value || 'Sekretaris');
  else if(field === 'nama2') setPrevText('und-prev-nama2', value || '(.....................)');
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
      <div class="field"><label>Tema/Judul Kegiatan</label><input id="doc-prop-tema" value="${esc(temaDefault)}" placeholder="Contoh: 17-an Tahun 2026" oninput="liveProposal('tema', this.value)"></div>
      <div class="field"><label>Latar Belakang</label><textarea id="doc-prop-latar" rows="4" placeholder="Uraikan alasan/konteks kegiatan ini diadakan..." oninput="liveProposal('latar_belakang', this.value)">${esc(d.latar_belakang||'')}</textarea></div>
      <div class="field"><label>Maksud &amp; Tujuan</label><textarea id="doc-prop-tujuan" rows="3" placeholder="Satu tujuan per baris" oninput="liveProposal('tujuan', this.value)">${esc(d.tujuan||'')}</textarea></div>
      <div class="field"><label>Susunan Acara</label><textarea id="doc-prop-susunan" rows="4" placeholder="Satu kegiatan per baris, mis: 19.30 - Pembukaan" oninput="liveProposal('susunan_acara', this.value)">${esc(d.susunan_acara||'')}</textarea></div>
      <div class="field"><label>Penutup (opsional)</label><textarea id="doc-prop-penutup" rows="2" placeholder="Paragraf penutup, kosongkan untuk pakai kalimat baku" oninput="liveProposal('penutup', this.value)">${esc(d.penutup||'')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Jabatan Penandatangan 1</label><input id="doc-prop-jab1" value="${esc(d.jabatan1||'Ketua Panitia')}" oninput="liveProposal('jabatan1', this.value)"></div>
        <div class="field"><label>Nama Penandatangan 1</label><input id="doc-prop-nama1" value="${esc(d.nama1||'')}" oninput="liveProposal('nama1', this.value)"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Jabatan Penandatangan 2</label><input id="doc-prop-jab2" value="${esc(d.jabatan2||'Ketua Karang Taruna')}" oninput="liveProposal('jabatan2', this.value)"></div>
        <div class="field"><label>Nama Penandatangan 2</label><input id="doc-prop-nama2" value="${esc(d.nama2||'')}" oninput="liveProposal('nama2', this.value)"></div>
      </div>
      <div class="field-hint" style="color:var(--ink-soft); font-size:12.5px; margin-top:6px;">✅ Tersimpan otomatis saat Anda mengetik.</div>
    </div>
  </div>` : '';

  const tujuanItems = (d.tujuan||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const susunanItems = (d.susunan_acara||'').split('\n').map(s=>s.trim()).filter(Boolean);

  return wrapDokumenLayout(editForm, `
  <div class="lpj-scale-wrap" id="lpj-scale-wrap">
  <div class="lpj-print-area surat-print-area" id="lpj-print-area">
    <div class="lpj-header">
      <div class="lpj-header-inner">
        <img src="icons/logo-kop.png" alt="Logo Karang Taruna Inti" class="lpj-logo">
        <div class="lpj-header-text">
          <div class="lpj-eyebrow">Karang Taruna Inti</div>
          <h2>PROPOSAL KEGIATAN</h2>
          <div class="lpj-sub" id="prop-prev-tema">${esc(temaDefault||'-')}${ev ? ` — Tahun ${esc(String(ev.tahun))}` : ''}</div>
        </div>
        <div class="lpj-header-spacer" aria-hidden="true"></div>
      </div>
    </div>

    <h3>1. Latar Belakang</h3>
    <p class="surat-body" id="prop-prev-latar">${d.latar_belakang ? nl2br(d.latar_belakang) : '<span class="hint">Belum diisi.</span>'}</p>

    <h3>2. Maksud &amp; Tujuan</h3>
    <div id="prop-prev-tujuan">${tujuanItems.length ? `<ul class="proposal-list">${tujuanItems.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="surat-body"><span class="hint">Belum diisi.</span></p>'}</div>

    <h3>3. Susunan Acara</h3>
    <div id="prop-prev-susunan">${susunanItems.length ? `<ul class="proposal-list">${susunanItems.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="surat-body"><span class="hint">Belum diisi.</span></p>'}</div>

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
    <p class="surat-body" id="prop-prev-penutup">${d.penutup ? nl2br(d.penutup) : `Demikian proposal kegiatan <strong>${esc(temaDefault||'ini')}</strong> ini kami susun. Besar harapan kami atas dukungan dan partisipasi semua pihak demi kelancaran acara ini.`}</p>

    <div class="lpj-signature">
      <div class="surat-ttd"><div id="prop-prev-jab1">${esc(d.jabatan1||'Ketua Panitia')}</div><div class="surat-ttd-space"></div><div><strong id="prop-prev-nama1">${esc(d.nama1||'(.....................)')}</strong></div></div>
      <div class="surat-ttd"><div id="prop-prev-jab2">${esc(d.jabatan2||'Ketua Karang Taruna')}</div><div class="surat-ttd-space"></div><div><strong id="prop-prev-nama2">${esc(d.nama2||'(.....................)')}</strong></div></div>
    </div>
  </div>
  </div>
  ${isLoggedIn ? `<div class="lpj-toolbar no-print"><button class="btn small" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button></div>` : ''}`);
}

// Autosave: sama seperti liveUndangan — simpan ke db + Supabase (debounced)
// tanpa renderContent(), lalu update pratinjau langsung lewat DOM.
function liveProposal(field, value){
  const s = getDokumenGlobal();
  s.proposal = s.proposal || {};
  s.proposal[field] = value;
  saveDB();

  if(field === 'tema'){
    const ev = activeEvent();
    const el = document.getElementById('prop-prev-tema');
    if(el) el.textContent = (value || '-') + (ev ? ` — Tahun ${ev.tahun}` : '');
    const penutupEl = document.getElementById('prop-prev-penutup');
    const penutupVal = document.getElementById('doc-prop-penutup');
    if(penutupEl && penutupVal && !penutupVal.value.trim()){
      penutupEl.innerHTML = `Demikian proposal kegiatan <strong>${esc(value||'ini')}</strong> ini kami susun. Besar harapan kami atas dukungan dan partisipasi semua pihak demi kelancaran acara ini.`;
    }
  }
  else if(field === 'latar_belakang'){
    const el = document.getElementById('prop-prev-latar');
    if(el) el.innerHTML = value ? nl2br(value) : '<span class="hint">Belum diisi.</span>';
  }
  else if(field === 'tujuan'){
    const items = value.split('\n').map(s=>s.trim()).filter(Boolean);
    const el = document.getElementById('prop-prev-tujuan');
    if(el) el.innerHTML = items.length ? `<ul class="proposal-list">${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="surat-body"><span class="hint">Belum diisi.</span></p>';
  }
  else if(field === 'susunan_acara'){
    const items = value.split('\n').map(s=>s.trim()).filter(Boolean);
    const el = document.getElementById('prop-prev-susunan');
    if(el) el.innerHTML = items.length ? `<ul class="proposal-list">${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="surat-body"><span class="hint">Belum diisi.</span></p>';
  }
  else if(field === 'penutup'){
    const el = document.getElementById('prop-prev-penutup');
    const temaVal = document.getElementById('doc-prop-tema');
    if(el) el.innerHTML = value ? nl2br(value) : `Demikian proposal kegiatan <strong>${esc(temaVal ? temaVal.value.trim() : 'ini') || 'ini'}</strong> ini kami susun. Besar harapan kami atas dukungan dan partisipasi semua pihak demi kelancaran acara ini.`;
  }
  else if(field === 'jabatan1') setPrevText('prop-prev-jab1', value || 'Ketua Panitia');
  else if(field === 'nama1') setPrevText('prop-prev-nama1', value || '(.....................)');
  else if(field === 'jabatan2') setPrevText('prop-prev-jab2', value || 'Ketua Karang Taruna');
  else if(field === 'nama2') setPrevText('prop-prev-nama2', value || '(.....................)');
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
        <div class="field"><label>Judul Acara</label><input id="doc-abs-judul" value="${esc(judulDefault)}" placeholder="Contoh: 17-an Tahun 2026" oninput="liveAbsensi('judul', this.value)"></div>
        <div class="field"><label>Tanggal</label><input id="doc-abs-tanggal" type="date" value="${esc(d.tanggal||todayISO())}" onchange="liveAbsensi('tanggal', this.value)"></div>
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
      <div class="field-hint" style="color:var(--ink-soft); font-size:12.5px; margin-top:6px;">✅ Tersimpan otomatis saat Anda mengetik.</div>
    </div>
  </div>` : '';

  return wrapDokumenLayout(editForm, `
  <div class="lpj-scale-wrap" id="lpj-scale-wrap">
  <div class="lpj-print-area surat-print-area" id="lpj-print-area">
    <div class="lpj-header">
      <div class="lpj-header-inner">
        <img src="icons/logo-kop.png" alt="Logo Karang Taruna Inti" class="lpj-logo">
        <div class="lpj-header-text">
          <div class="lpj-eyebrow">Karang Taruna Inti</div>
          <h2>DAFTAR HADIR</h2>
          <div class="lpj-sub" id="abs-prev-judul">${esc(judulDefault||'-')}</div>
          <div class="lpj-meta">Tanggal: <span id="abs-prev-tanggal">${fmtDate(d.tanggal||todayISO())}</span>${filterKategori?` · Kategori: ${esc(labelKategori(filterKategori))}`:''}${filterRT?` · ${esc(labelRT(filterRT))}`:''}</div>
        </div>
        <div class="lpj-header-spacer" aria-hidden="true"></div>
      </div>
    </div>

    <table class="lpj-table absensi-table">
      <thead><tr><th style="width:36px;">No</th><th>Nama</th><th>RT</th><th>Tanda Tangan</th></tr></thead>
      <tbody>
        ${list.length ? list.map((a,i)=>`<tr><td class="num">${i+1}</td><td>${esc(a.nama)}</td><td>${esc(labelRT(a.rt))}</td><td class="absensi-ttd-cell"></td></tr>`).join('') : `<tr class="empty-row"><td colspan="4">Belum ada data anggota${filterKategori||filterRT?' yang cocok dengan filter ini':''}.</td></tr>`}
      </tbody>
    </table>
  </div>
  </div>
  ${isLoggedIn ? `<div class="lpj-toolbar no-print"><button class="btn small" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button></div>` : ''}`);
}

function filterAbsensi(){
  const s = getDokumenGlobal();
  s.absensi = s.absensi || {};
  s.absensi.filter_kategori = document.getElementById('doc-abs-kategori').value;
  s.absensi.filter_rt = document.getElementById('doc-abs-rt').value;
  saveDB(); renderContent();
}
function liveAbsensi(field, value){
  const s = getDokumenGlobal();
  s.absensi = s.absensi || {};
  s.absensi[field] = value;
  saveDB();

  if(field === 'judul') setPrevText('abs-prev-judul', value || '-');
  else if(field === 'tanggal') setPrevText('abs-prev-tanggal', fmtDate(value||todayISO()));
}

/* ---------- 4. Jadwal Sinoman (jadwal piket pagi/siang/sore) ---------- */
function renderJadwalSinoman(ev){
  const isLoggedIn = !!getCurrentUser();
  const d = getDokumenGlobal().jadwal_sinoman;
  const judulDefault = d.judul || (ev ? ev.nama : '');

  const rowsEdit = d.rows.map((r,idx)=>`
    <tr>
      <td class="num" style="width:60px;">Hari ${idx+1}</td>
      <td><select id="js-row-${idx}-pagi" style="width:100%" onchange="jadwalSinomanSetCell(${idx},'pagi',this.value)">${dokumenOptionsNama(r.pagi)}</select></td>
      <td><select id="js-row-${idx}-siang" style="width:100%" onchange="jadwalSinomanSetCell(${idx},'siang',this.value)">${dokumenOptionsNama(r.siang)}</select></td>
      <td><select id="js-row-${idx}-sore" style="width:100%" onchange="jadwalSinomanSetCell(${idx},'sore',this.value)">${dokumenOptionsNama(r.sore)}</select></td>
      <td style="width:36px;"><button class="icon-btn" onclick="jadwalSinomanRemoveRow(${idx})" title="Hapus baris">✕</button></td>
    </tr>`).join('');

  const editForm = isLoggedIn ? `
  <div class="panel no-print">
    <div class="panel-head"><h3>✏️ Isi Jadwal Sinoman</h3></div>
    <div class="panel-body">
      <div class="field-row">
        <div class="field"><label>Judul Acara</label><input id="doc-js-judul" value="${esc(judulDefault)}" placeholder="Contoh: 17-an Tahun 2026" oninput="liveJadwalSinoman('judul', this.value)"></div>
        <div class="field"><label>Tempat</label><input id="doc-js-tempat" value="${esc(d.tempat||'')}" placeholder="Balai Desa / Rumah Bapak RT 02" oninput="liveJadwalSinoman('tempat', this.value)"></div>
      </div>

      <div class="field-hint" style="color:var(--ink-soft); font-size:12.5px; margin:16px 0 6px;">✅ Tersimpan otomatis saat Anda mengetik. Nama dipilih dari Database Anggota juga tersimpan otomatis.</div>
      <table class="lpj-table">
        <thead><tr><th></th><th>Pagi</th><th>Siang</th><th>Sore</th><th></th></tr></thead>
        <tbody>${rowsEdit}</tbody>
      </table>
      <button class="btn secondary small" onclick="jadwalSinomanAddRow()">+ Tambah Baris</button>
    </div>
  </div>` : '';

  const rowsPrint = d.rows.map((r,idx)=>`<tr><td class="num">${idx+1}</td><td>${esc(r.pagi)||'-'}</td><td>${esc(r.siang)||'-'}</td><td>${esc(r.sore)||'-'}</td></tr>`).join('');

  return wrapDokumenLayout(editForm, `
  <div class="lpj-scale-wrap" id="lpj-scale-wrap">
  <div class="lpj-print-area surat-print-area" id="lpj-print-area">
    <div class="lpj-header">
      <div class="lpj-header-inner">
        <img src="icons/logo-kop.png" alt="Logo Karang Taruna Inti" class="lpj-logo">
        <div class="lpj-header-text">
          <div class="lpj-eyebrow">Karang Taruna Inti</div>
          <h2>JADWAL SINOMAN</h2>
          <div class="lpj-sub" id="js-prev-judul">${esc(judulDefault||'-')}</div>
          <div class="lpj-meta" id="js-prev-tempat">${d.tempat ? `Tempat: ${esc(d.tempat)}` : ''}</div>
        </div>
        <div class="lpj-header-spacer" aria-hidden="true"></div>
      </div>
    </div>

    <table class="lpj-table">
      <thead><tr><th style="width:60px;">Hari</th><th>Pagi</th><th>Siang</th><th>Sore</th></tr></thead>
      <tbody>${rowsPrint || `<tr class="empty-row"><td colspan="4">Belum ada jadwal diisi.</td></tr>`}</tbody>
    </table>
  </div>
  </div>
  ${isLoggedIn ? `<div class="lpj-toolbar no-print"><button class="btn small" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button></div>` : ''}`);
}

function liveJadwalSinoman(field, value){
  const s = getDokumenGlobal();
  s.jadwal_sinoman[field] = value;
  saveDB();

  if(field === 'judul') setPrevText('js-prev-judul', value || '-');
  else if(field === 'tempat') setPrevText('js-prev-tempat', value ? `Tempat: ${value}` : '');
}
function jadwalSinomanSetCell(idx, field, value){
  const s = getDokumenGlobal();
  if(!s.jadwal_sinoman.rows[idx]) return;
  s.jadwal_sinoman.rows[idx][field] = value;
  saveDB();
}
function jadwalSinomanAddRow(){
  const s = getDokumenGlobal();
  s.jadwal_sinoman.rows.push({ pagi:'', siang:'', sore:'' });
  saveDB(); renderContent();
}
function jadwalSinomanRemoveRow(idx){
  const s = getDokumenGlobal();
  if(s.jadwal_sinoman.rows.length<=1) return;
  s.jadwal_sinoman.rows.splice(idx,1);
  saveDB(); renderContent();
}

