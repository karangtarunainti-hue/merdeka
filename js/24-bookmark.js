/* ============================================================
   TAUTAN PENTING (BOOKMARK)
   Kumpulan link penting organisasi (grup WA, form pendaftaran,
   rekening donasi, dsb) — TIDAK terikat event 17-an manapun, sama
   seperti Agenda/Kas/Gudang/Dokumen. Semua orang (termasuk guest)
   bisa melihat & membuka link; hanya user yang login (atau petugas
   yang ditugaskan ke bidang "Tautan Penting") yang bisa
   menambah/mengedit/menghapus.
   ============================================================ */

// Pastikan URL yang disimpan selalu punya skema (http/https) supaya link
// bisa langsung diklik dan tidak dianggap path relatif oleh browser
// (mis. user cuma ngetik "wa.me/xxx" tanpa "https://").
function normalisasiUrlBookmark(url){
  const u = (url || '').trim();
  if(!u) return '';
  if(/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

function renderBookmark(){
  const list = gBookmark();
  const isLoggedIn = !!getCurrentUser();
  const canEdit = canEditSection('bookmark');

  const cards = list.map(b => `
    <div class="panel-body" style="display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border,#eee);">
      <a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer" style="flex:1; min-width:0; text-decoration:none; color:inherit;">
        <div style="font-weight:600;">🔗 ${esc(b.judul)}</div>
        ${b.deskripsi ? `<div class="sub" style="opacity:.75; margin-top:2px;">${esc(b.deskripsi)}</div>` : ''}
        <div class="mono" style="font-size:12px; opacity:.6; margin-top:2px; overflow-wrap:anywhere;">${esc(b.url)}</div>
      </a>
      <div style="white-space:nowrap;">
        <button class="icon-btn" onclick="openBookmarkModal('${b.id}')" ${!canEdit ? 'disabled' : ''} title="Edit">✎</button>
        <button class="icon-btn" onclick="hapusBookmark('${b.id}')" ${!canEdit ? 'disabled' : ''} title="Hapus">🗑</button>
      </div>
    </div>`).join('');

  return `
  <div class="panel">
    <div class="panel-head">
      <div><h3>🔗 Tautan Penting</h3>
      <div class="desc">Link penting organisasi — grup WA, form, rekening, dsb</div></div>
      ${canEdit ? `<button class="btn" onclick="openBookmarkModal()">+ Tambah Tautan</button>` : ''}
    </div>
    <div class="panel-body flush">
      ${cards || `<div class="empty-row" style="padding:30px;text-align:center;">Belum ada tautan. ${isLoggedIn ? 'Tambahkan tautan penting supaya mudah diakses semua orang.' : 'Login untuk menambah tautan.'}</div>`}
    </div>
  </div>`;
}

function openBookmarkModal(id){
  if (!canEditSection('bookmark')) { toast('⛔ Login untuk mengedit data'); return; }
  const editing = id ? db.bookmark.find(b=>b.id===id) : null;
  setModal(editing?'Edit Tautan':'Tambah Tautan', `
    <div class="field"><label>Judul</label><input id="f-bookmark-judul" value="${editing?esc(editing.judul):''}" placeholder="mis. Grup WA Panitia"></div>
    <div class="field"><label>URL</label><input id="f-bookmark-url" value="${editing?esc(editing.url):''}" placeholder="mis. https://chat.whatsapp.com/xxxxx"></div>
    <div class="field"><label>Deskripsi (opsional)</label>
      <textarea id="f-bookmark-deskripsi" rows="2" placeholder="Keterangan singkat...">${editing?esc(editing.deskripsi||''):''}</textarea>
    </div>
  `, [
    {label:'Batal', cls:'secondary', onclick:closeModal},
    {label:editing?'Simpan':'Tambah', cls:'', onclick:()=>{
      const judul = document.getElementById('f-bookmark-judul').value.trim();
      const url = normalisasiUrlBookmark(document.getElementById('f-bookmark-url').value);
      const deskripsi = document.getElementById('f-bookmark-deskripsi').value.trim();
      if(!judul || !url){ toast('Judul & URL wajib diisi'); return; }
      let actionMsg = editing ? `✏️ Edit tautan: ${editing.judul} → ${judul}` : `➕ Tautan baru: ${judul}`;
      if(editing){ Object.assign(editing, {judul, url, deskripsi}); }
      else{ db.bookmark.push({id:uid(), judul, url, deskripsi}); }
      saveDB(); closeModal(); renderContent(); toast('Tautan disimpan');
      notifyTelegram(actionMsg, `URL: ${url}\nDeskripsi: ${deskripsi || '-'}`, 'umum');
    }}
  ]);
}

function hapusBookmark(id){
  if (!canEditSection('bookmark')) { toast('⛔ Login untuk mengedit data'); return; }
  if(!confirm('Hapus tautan ini?')) return;
  const b = db.bookmark.find(x=>x.id===id);
  db.bookmark = db.bookmark.filter(x=>x.id!==id);
  saveDB(); renderContent(); toast('Tautan dihapus');
  if(b) notifyTelegram(`🗑️ Hapus tautan: ${b.judul}`, `URL: ${b.url}`, 'umum');
}
