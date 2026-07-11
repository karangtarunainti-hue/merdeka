/* ============================================================
   PANDUAN APLIKASI
   Halaman santai buat kenalan sama aplikasi ini: apa gunanya,
   gimana alurnya dari nol sampai LPJ jadi, dan menu-menu apa
   aja yang ada. Ditulis sesantai mungkin biar gampang dicerna
   pengurus baru yang belum pernah pegang aplikasi ini.
   ============================================================ */
function renderPanduan(){
  const user = getCurrentUser();
  const isAdminUser = user && user.role === 'admin';

  return `
  <div class="panel">
    <div class="panel-head">
      <div><h3>📖 Selamat Datang!</h3>
        <div class="desc">Kenalan dulu yuk sama aplikasi ini sebelum mulai pakai</div>
      </div>
    </div>
    <div class="panel-body">
      <p style="line-height:1.7; margin:0 0 10px;">
        Aplikasi ini dibuat buat bantu pengurus <b>Karang Taruna</b> ngurusin acara/kegiatan
        (17-an, jalan santai, lomba, dll) biar catatannya rapi, uangnya jelas keluar-masuknya,
        dan pas laporan pertanggungjawaban (LPJ) dibikin, semua tinggal cetak — nggak perlu
        rekap ulang dari nota-nota yang berserakan 😅.
      </p>
      <p style="line-height:1.7; margin:0;">
        Semua data yang kamu isi otomatis tersimpan dan ikut ke-sync ke server (Supabase), jadi
        biarpun kamu ganti HP/laptop atau buka dari device lain, datanya tetap sama. Kalau lagi
        nggak ada internet pun aplikasi tetap bisa dipakai (data disimpan dulu di HP), nanti
        otomatis nyambung lagi begitu online.
      </p>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <div><h3>🚀 Alur Pemakaian, dari Nol sampai LPJ Jadi</h3>
        <div class="desc">Ikutin urutan ini biar nggak bingung mulai dari mana</div>
      </div>
    </div>
    <div class="panel-body">
      <div class="role-info-grid">
        <div class="role-info-card">
          <div class="ric-title">1️⃣ Login</div>
          <div class="ric-desc">Login pakai akun Admin/User/Petugas di pojok kanan atas. Belum login pun kamu masih bisa lihat-lihat data (mode Guest, tapi cuma bisa lihat, nggak bisa ubah).</div>
        </div>
        <div class="role-info-card">
          <div class="ric-title">2️⃣ Buat Event/Kegiatan</div>
          <div class="ric-desc">Khusus Admin: bikin event tahunan dulu (mis. "17 Agustus 2026") lewat tombol + Buat Event. Semua data nanti nempel ke event yang lagi aktif.</div>
        </div>
        <div class="role-info-card">
          <div class="ric-title">3️⃣ Pilih Fitur yang Dipakai</div>
          <div class="ric-desc">Waktu bikin event, centang fitur yang memang dibutuhkan (Donatur, Lomba, Hadiah, Jalan Santai, dst). Nggak semua kegiatan butuh semua fitur, jadi bisa dimatikan biar menu nggak penuh.</div>
        </div>
        <div class="role-info-card">
          <div class="ric-title">4️⃣ Input Data Harian</div>
          <div class="ric-desc">Mulai catat Iuran Anggota, Donatur, Pemasukan Lain, Operasional, kebutuhan Lomba & Hadiah, sampai belanja perlengkapan — sesuai kejadian sehari-hari.</div>
        </div>
        <div class="role-info-card">
          <div class="ric-title">5️⃣ Pantau di Buku Kegiatan</div>
          <div class="ric-desc">Menu Buku Kegiatan (dashboard) nunjukin rekap saldo, pemasukan, pengeluaran secara real-time. Jadi tiap saat bisa cek "duit masih ada berapa?".</div>
        </div>
        <div class="role-info-card">
          <div class="ric-title">6️⃣ Cetak LPJ</div>
          <div class="ric-desc">Kalau acara udah selesai, tinggal buka menu Laporan (LPJ) — semua rekap otomatis kesusun rapi, tinggal cetak/print buat dilaporin ke warga.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <div><h3>🧭 Kenalan Sama Menu-Menunya</h3>
        <div class="desc">Menu "Per Kegiatan" isinya ganti-ganti ngikutin event aktif. Menu "Global" datanya sama terus walau event dipindah.</div>
      </div>
    </div>
    <div class="panel-body">
      <h4 style="margin:0 0 8px; font-size:13.5px; color:var(--ink-soft);">📌 Menu Per Kegiatan (nempel ke event aktif)</h4>
      <div class="role-info-grid" style="margin-bottom:18px;">
        <div class="role-info-card"><div class="ric-title">📅 Jadwal Kegiatan</div><div class="ric-desc">Catat jadwal & pengingat acara biar nggak ada yang kelewat.</div></div>
        <div class="role-info-card"><div class="ric-title">📊 Buku Kegiatan</div><div class="ric-desc">Dashboard utama: rekap saldo & reminder tugas yang belum kelar.</div></div>
        <div class="role-info-card"><div class="ric-title">💰 Iuran Anggota</div><div class="ric-desc">Catat siapa aja yang udah/belum bayar iuran warga.</div></div>
        <div class="role-info-card"><div class="ric-title">❤️ Donatur</div><div class="ric-desc">Catat sumbangan tunai dari donatur di luar iuran warga.</div></div>
        <div class="role-info-card"><div class="ric-title">🔄 Pemasukan Lain</div><div class="ric-desc">Buat pemasukan yang bukan iuran maupun donasi (mis. hasil jualan, sponsor).</div></div>
        <div class="role-info-card"><div class="ric-title">💼 Operasional Kegiatan</div><div class="ric-desc">Catat biaya operasional umum acara (konsumsi, sewa, dekorasi, dll).</div></div>
        <div class="role-info-card"><div class="ric-title">🚩 Lomba & Perlengkapan</div><div class="ric-desc">Rencanakan lomba apa aja yang diadain, plus perlengkapan yang dibutuhkan tiap lomba.</div></div>
        <div class="role-info-card"><div class="ric-title">🎁 Kebutuhan Hadiah / Hadiah Jalan Santai</div><div class="ric-desc">Susun target hadiah per kategori peserta & juara, biar belanjanya terarah.</div></div>
        <div class="role-info-card"><div class="ric-title">🛍️ Belanja Perlengkapan / Hadiah / Jalan Santai</div><div class="ric-desc">Daftar belanja aktual — catat barang yang udah dibeli beserta harganya, dibandingkan sama target di atas.</div></div>
        <div class="role-info-card"><div class="ric-title">📋 Laporan (LPJ)</div><div class="ric-desc">Cetak laporan pertanggungjawaban lengkap dari semua data event ini.</div></div>
        <div class="role-info-card"><div class="ric-title">📝 Daftar Anggota</div><div class="ric-desc">Rekap & cetak daftar nama anggota untuk kebutuhan event ini (mis. absensi).</div></div>
      </div>

      <h4 style="margin:0 0 8px; font-size:13.5px; color:var(--ink-soft);">🌐 Menu Global (tidak ganti walau event dipindah)</h4>
      <div class="role-info-grid">
        <div class="role-info-card"><div class="ric-title">📖 Panduan</div><div class="ric-desc">Halaman yang lagi kamu baca ini!</div></div>
        <div class="role-info-card"><div class="ric-title">🗒️ Agenda Kegiatan</div><div class="ric-desc">Catatan agenda organisasi yang nggak terikat ke satu event tertentu.</div></div>
        <div class="role-info-card"><div class="ric-title">👛 Kas Karang Taruna</div><div class="ric-desc">Buku kas umum organisasi, terpisah dari kas per event.</div></div>
        <div class="role-info-card"><div class="ric-title">📚 Database Anggota</div><div class="ric-desc">Data master semua anggota — bisa dicek & difilter kapan aja.</div></div>
        <div class="role-info-card"><div class="ric-title">📦 Gudang Aset</div><div class="ric-desc">Inventaris barang/aset milik desa/organisasi, lengkap sama fitur pinjam-kembalikan.</div></div>
        <div class="role-info-card"><div class="ric-title">📄 Surat & Dokumen</div><div class="ric-desc">Bikin undangan, proposal, dan lembar absensi dengan cepat.</div></div>
        ${isAdminUser ? `<div class="role-info-card"><div class="ric-title">⚙️ Pengaturan</div><div class="ric-desc">Atur tarif iuran, kelola daftar event, dan pengaturan lain (khusus Admin).</div></div>` : ''}
        ${isAdminUser ? `<div class="role-info-card"><div class="ric-title">👥 Manajemen User</div><div class="ric-desc">Tambah/atur akun pengguna beserta perannya (khusus Admin).</div></div>` : ''}
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <div><h3>🔑 Siapa Boleh Ngapain?</h3>
        <div class="desc">Level akses tiap peran, biar tau batasan masing-masing</div>
      </div>
    </div>
    <div class="panel-body">
      <div class="role-info-grid">
        <div class="role-info-card">
          <div class="ric-title">👤 Guest (Belum Login)</div>
          <div class="ric-desc">Cuma bisa lihat data (read-only). Nggak bisa tambah, edit, atau hapus apa pun.</div>
        </div>
        <div class="role-info-card">
          <div class="ric-title">🛠️ Petugas</div>
          <div class="ric-desc">Login khusus buat satu/beberapa bidang tertentu aja (mis. cuma pegang Iuran Anggota). Di luar bidang itu, menu lain nggak kelihatan.</div>
        </div>
        <div class="role-info-card">
          <div class="ric-title">👤 User</div>
          <div class="ric-desc">Bisa lihat & edit hampir semua data kegiatan. Tapi nggak bisa buka Pengaturan.</div>
        </div>
        <div class="role-info-card">
          <div class="ric-title">⚡ Admin</div>
          <div class="ric-desc">Akses penuh — termasuk bikin event baru, Pengaturan, dan Manajemen User.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <div><h3>💡 Tips Biar Makin Lancar</h3>
        <div class="desc">Beberapa hal kecil yang kadang kelewat</div>
      </div>
    </div>
    <div class="panel-body">
      <ul style="margin:0; padding-left:18px; line-height:1.9;">
        <li>Selalu cek <b>event mana yang lagi aktif</b> (dropdown di sidebar) sebelum input data — salah event, datanya nyasar ke kegiatan lain.</li>
        <li>Fitur yang dimatikan pas bikin event bisa diaktifkan lagi kapan aja lewat tombol ✎ di daftar event pada menu Pengaturan.</li>
        <li>Nomor <b>Kebutuhan Hadiah/Lomba</b> itu cuma target, sedangkan <b>Belanja</b> itu catatan realisasi — dua-duanya perlu diisi biar kelihatan progres belanjanya.</li>
        <li>Jangan lupa cek menu <b>Database Anggota</b> secara berkala biar data warga tetap update, soalnya dipakai di banyak menu lain (Iuran, Daftar Anggota, dll).</li>
        <li>Kalau ragu soal siapa yang boleh akses apa, cek lagi bagian "Siapa Boleh Ngapain?" di atas atau tanya Admin.</li>
      </ul>
    </div>
  </div>
  `;
}
