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
      <button class="btn" id="login-submit-btn" onclick="manualLogin()">Login</button>
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
  // Sebelumnya tombol Login tetap bisa di-tap berkali-kali selama menunggu
  // respons server, tanpa keterangan apa pun kalau koneksi lambat — user bisa
  // ngetap ulang beberapa kali mengira tap pertama tidak kena. Sekarang tombol
  // dikunci + teksnya berubah selama proses berlangsung, dan dikembalikan lagi
  // kalau gagal supaya user bisa coba ulang.
  const btn = document.getElementById('login-submit-btn');
  const originalLabel = btn ? btn.textContent : 'Login';
  if(btn){ btn.disabled = true; btn.textContent = 'Memproses...'; }
  try{
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
  } finally {
    // Kalau berhasil, modal sudah ditutup duluan jadi elemen ini sudah tidak
    // ada lagi (aman, getElementById tinggal balikin null). Kalau gagal/modal
    // masih terbuka, tombol dikembalikan seperti semula supaya bisa dicoba lagi.
    const btnAfter = document.getElementById('login-submit-btn');
    if(btnAfter){ btnAfter.disabled = false; btnAfter.textContent = originalLabel; }
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

