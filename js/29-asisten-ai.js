/* ============================================================
   ASISTEN AI ("Second Brain") — chat mengambang yang bisa ditanya
   soal data app ini (bukan cuma panel narasi statis kayak
   27-ai-insight.js). Numpang di infrastruktur generik AI.tanya()
   (js/26-ai.js -> Edge Function ai-generate -> Gemini).

   Beda dari 27-ai-insight.js:
   - ai-insight.js: 1 arah, auto-generate, cache per event, guest
     boleh baca (tapi tidak memicu generate).
   - Modul ini: 2 arah (tanya-jawab bebas), dipicu manual per
     pesan oleh user yang login (BUKAN guest — lihat alasan di
     bawah), riwayat cuma di memori tab (hilang kalau reload,
     TIDAK disimpan ke Supabase/localStorage) supaya tidak nambah
     skema baru & tidak menyimpan isi obrolan yang mungkin
     menyinggung data sensitif (nominal, nama anggota, dst).

   Kenapa guest tidak boleh pakai: fitur ini butuh ngirim ringkasan
   data (termasuk daftar nama anggota belum lunas, dsb — lihat
   susunAsistenKonteks()) ke system prompt supaya jawabannya
   berguna. ai-insight.js sengaja MENGHINDARI detail per-orang di
   panel yang guest juga bisa lihat; di sini kita balik pendekatannya
   (gating akses, bukan gating detail) supaya jawaban chat tetap
   berguna buat pengurus yang login.

   UI: FAB bulat pojok kanan bawah (mirip pola banner mengambang di
   23-install-prompt.js, tapi ini persistent toggle bukan banner
   auto-muncul) + panel chat. Sengaja TIDAK pakai setModal()/#overlay
   supaya user bisa scroll-scroll halaman lain sambil panel tetap
   kebuka (mis. sambil ngecek angka pas nanya).

   RAG (retrieval-augmented generation): selain ringkasan data langsung
   dari susunAsistenKonteks() (angka-angka live), tiap pertanyaan juga
   dicocokkan secara SEMANTIK ke catatan di Second Brain
   (js/30-second-brain.js — secondBrainCariUntukAsisten()) supaya
   jawabannya juga bisa memakai catatan/ide/dokumen/konteks bebas yang
   tidak masuk akal dihitung sebagai "angka ringkasan" (mis. keputusan
   rapat, alasan di balik suatu kebijakan, dsb).
   ============================================================ */

// Riwayat chat sesi ini SAJA — array of {role:'user'|'ai', text}.
// Sengaja module-level var (bukan di `db`) supaya tidak ikut ter-sync
// ke Supabase ataupun tersimpan di localStorage/backup manapun.
let _asistenChatLog = [];
let _asistenPanelOpen = false;
let _asistenSedangMikir = false;

function asistenBolehDipakai(){
  // Sama seperti syarat trigger generate di ai-insight.js: hanya user
  // yang benar-benar login (admin/user/petugas) — guest tidak.
  return !!getCurrentUser();
}

/* ------------------------------------------------------------
   KONTEKS — ringkasan data app buat dikirim sebagai system prompt.
   Dipanggil ulang tiap kali user kirim pesan baru (bukan di-cache
   kayak ai-insight) supaya jawaban selalu berbasis data TERBARU,
   bukan snapshot lama; ringkasan ini jauh lebih murah dihitung
   daripada 1x panggilan AI, jadi tidak masalah dihitung tiap pesan.
   ------------------------------------------------------------ */
function susunAsistenKonteks(){
  const bagian = [];
  const ev = typeof activeEvent === 'function' ? activeEvent() : null;
  bagian.push(`Organisasi: ${getOrgNama()}.`);
  bagian.push(ev ? `Kegiatan aktif: "${ev.nama}"${ev.tanggal ? ' (' + ev.tanggal + ')' : ''}.` : 'Belum ada kegiatan aktif yang dipilih.');

  // Ringkasan Buku Kegiatan (pakai fungsi hitung yang sama dengan Dashboard)
  if (ev && typeof hitungBukuUtama === 'function') {
    const b = hitungBukuUtama();
    bagian.push(`Buku Kegiatan — Pemasukan: iuran Rp${b.iuran}, donasi Rp${b.donasi}, pemasukan lain Rp${b.transaksiLain}. `
      + `Pengeluaran — operasional Rp${b.opsional}, kebutuhan lomba Rp${b.kebutuhanLomba}, hadiah lomba Rp${b.hadiahLomba}, hadiah jalan santai Rp${b.hadiahJalan}. `
      + `Saldo Buku Kegiatan saat ini: Rp${b.saldo}.`);
  }

  // Anggota belum lunas — detail nama boleh dikirim (fitur ini digate
  // untuk user login saja, lihat asistenBolehDipakai()), tapi tetap
  // dibatasi jumlahnya supaya prompt tidak membengkak kalau anggotanya
  // ratusan.
  if (typeof gAnggota === 'function') {
    const semua = gAnggota();
    const belum = semua.filter(a => a.status !== 'lunas');
    if (belum.length > 0) {
      const totalNominal = belum.reduce((s,a) => s + Number(a.nominal_wajib||0), 0);
      const daftar = belum.slice(0, 25).map(a => `${a.nama} (Rp${Number(a.nominal_wajib||0)})`).join(', ');
      const sisa = belum.length > 25 ? `, dan ${belum.length - 25} lainnya` : '';
      bagian.push(`Anggota belum lunas iuran: ${belum.length} dari ${semua.length} orang, total tertunggak Rp${totalNominal}. Daftar: ${daftar}${sisa}.`);
    } else if (semua.length > 0) {
      bagian.push(`Semua ${semua.length} anggota sudah lunas iuran.`);
    }
  }

  // Agenda kegiatan 14 hari ke depan — pakai ulang dataAgendaMendatang()
  // dari 27-ai-insight.js (global function), tapi rentangnya di sana
  // di-hardcode 7 hari, jadi kita hitung ulang sendiri dengan rentang
  // 14 hari supaya chat bisa jawab pertanyaan "agenda 2 minggu ke depan".
  if (typeof gAgenda === 'function') {
    const today = new Date();
    const mendatang = gAgenda().filter(a => a.status !== 'selesai').map(a => {
      const d = new Date(a.tanggal + 'T00:00:00');
      const diffDays = Math.ceil((d - today) / 86400000);
      return { ...a, diffDays };
    }).filter(a => a.diffDays >= 0 && a.diffDays <= 14).sort((a,b) => a.diffDays - b.diffDays);
    if (mendatang.length > 0) {
      bagian.push(`Agenda 14 hari ke depan: ` + mendatang.map(a => `${a.judul} (${a.diffDays===0?'hari ini':a.diffDays===1?'besok':a.diffDays+' hari lagi'})`).join('; ') + '.');
    } else {
      bagian.push('Tidak ada agenda kegiatan dalam 14 hari ke depan.');
    }
  }

  // Lomba — status kebutuhan & hadiah per lomba (event aktif saja).
  if (ev && typeof gLomba === 'function') {
    const daftarLomba = gLomba();
    if (daftarLomba.length > 0) {
      const ringkasLomba = daftarLomba.map(l => {
        const kebutuhan = gKebutuhan(l.id);
        const belumBeliCount = kebutuhan.length; // detail beli/belum sudah dihitung ai-insight, di sini cukup jumlah item
        return `${l.nama} (${belumBeliCount} item kebutuhan)`;
      }).join(', ');
      bagian.push(`Lomba event ini: ${ringkasLomba}.`);
    }
  }

  // Gudang — barang belum kembali (global, tidak terikat event).
  if (typeof gudangTransactions !== 'undefined' && Array.isArray(gudangTransactions)) {
    const belumKembali = gudangTransactions.filter(t => t.status === 'aktif' || t.status === 'bermasalah');
    if (belumKembali.length > 0) {
      const totalUnit = belumKembali.reduce((s,t) => s + t.items.reduce((x,it) => x + it.qty, 0), 0);
      const daftar = belumKembali.slice(0, 15).map(t => `${t.nama} (${t.items.reduce((x,it)=>x+it.qty,0)} unit, kembali ${t.tglKembali})`).join('; ');
      bagian.push(`Aset Gudang belum kembali: ${belumKembali.length} peminjaman, total ${totalUnit} unit. Detail: ${daftar}.`);
    } else {
      bagian.push('Semua aset Gudang sudah kembali (tidak ada peminjaman aktif).');
    }
  }

  // Kas Karang Taruna (global, running balance sederhana).
  if (typeof gKas === 'function') {
    const rows = gKas();
    const saldoKas = rows.reduce((s,r) => s + Number(r.debit||0) - Number(r.kredit||0), 0);
    bagian.push(`Saldo Kas ${getOrgNamaKas()} (di luar Buku Kegiatan event): Rp${saldoKas}.`);
  }

  return bagian.join('\n');
}

const ASISTEN_SYSTEM_PROMPT = `Kamu adalah "Asisten AI" di aplikasi Merdeka — asisten internal buat pengurus Karang Taruna yang bisa ditanya soal data organisasi yang sedang aktif (keuangan kegiatan, iuran anggota, agenda, lomba, aset gudang, kas). Jawab dalam Bahasa Indonesia, singkat dan langsung ke inti, gaya santai-tapi-sopan (sama seperti gaya UI aplikasi ini). Kalau data yang ditanya tidak ada di ringkasan konteks yang diberikan, katakan terus terang kamu tidak punya datanya di sini (jangan mengarang angka). Kamu HANYA asisten baca/tanya-jawab — tidak bisa mengubah data langsung, jadi kalau user minta diubahkan sesuatu, arahkan ke menu terkait di aplikasi.`;

function toggleAsistenPanel(){
  if (!asistenBolehDipakai()) {
    toast('🔒 Login dulu untuk pakai Asisten AI');
    return;
  }
  _asistenPanelOpen = !_asistenPanelOpen;
  renderAsistenWidget();
  if (_asistenPanelOpen) {
    setTimeout(() => document.getElementById('asisten-input')?.focus(), 50);
  }
}

function asistenChatBubbleHtml(m){
  const cls = m.role === 'user' ? 'asisten-bubble-user' : 'asisten-bubble-ai';
  return `<div class="asisten-bubble ${cls}">${esc(m.text)}</div>`;
}

function renderAsistenWidget(){
  let el = document.getElementById('asisten-ai-widget');
  if (!el) {
    el = document.createElement('div');
    el.id = 'asisten-ai-widget';
    document.body.appendChild(el);
  }
  if (!asistenBolehDipakai()) { el.innerHTML = ''; return; }

  const logHtml = _asistenChatLog.length === 0
    ? `<div class="asisten-empty">💬 Tanya apa saja soal data kegiatan ini — misalnya "siapa yang belum bayar iuran?" atau "berapa sisa saldo?".</div>`
    : _asistenChatLog.map(asistenChatBubbleHtml).join('');
  const thinkingHtml = _asistenSedangMikir ? `<div class="asisten-bubble asisten-bubble-ai asisten-bubble-thinking">Mikir dulu…</div>` : '';

  el.innerHTML = `
    <button type="button" id="asisten-fab" class="asisten-fab" title="Asisten AI" aria-label="Buka Asisten AI">🤖</button>
    <div class="asisten-panel ${_asistenPanelOpen ? 'show' : ''}">
      <div class="asisten-panel-head">
        <div><b>🤖 Asisten AI</b><div class="desc">Tanya-jawab soal data kegiatan ini</div></div>
        <button type="button" class="icon-btn" id="asisten-close" title="Tutup" aria-label="Tutup">✕</button>
      </div>
      <div class="asisten-panel-body" id="asisten-log">${logHtml}${thinkingHtml}</div>
      <form class="asisten-panel-input" id="asisten-form">
        <input type="text" id="asisten-input" placeholder="Ketik pertanyaan…" autocomplete="off" ${_asistenSedangMikir ? 'disabled' : ''}>
        <button type="submit" class="icon-btn" title="Kirim" aria-label="Kirim" ${_asistenSedangMikir ? 'disabled' : ''}>📤</button>
      </form>
    </div>`;

  document.getElementById('asisten-fab').onclick = toggleAsistenPanel;
  document.getElementById('asisten-close').onclick = toggleAsistenPanel;
  document.getElementById('asisten-form').onsubmit = asistenKirimPesan;

  const logEl = document.getElementById('asisten-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
}

async function asistenKirimPesan(evt){
  evt.preventDefault();
  if (_asistenSedangMikir) return;
  const input = document.getElementById('asisten-input');
  const teks = (input.value || '').trim();
  if (!teks) return;

  _asistenChatLog.push({ role: 'user', text: teks });
  input.value = '';
  _asistenSedangMikir = true;
  renderAsistenWidget();

  try {
    const konteks = susunAsistenKonteks();
    // RAG (Retrieval-Augmented Generation): cari catatan Second Brain
    // (js/30-second-brain.js) yang maknanya relevan dengan pertanyaan ini,
    // sertakan sebagai bagian konteks TAMBAHAN di luar ringkasan data
    // langsung di atas. Gagal-diam kalau Second Brain belum ada isinya
    // atau lagi bermasalah (lihat secondBrainCariUntukAsisten) — jangan
    // sampai fitur ini gagal menjatuhkan seluruh jawaban chat.
    const catatanRelevan = typeof secondBrainCariUntukAsisten === 'function'
      ? await secondBrainCariUntukAsisten(teks) : '';
    const bagianCatatan = catatanRelevan
      ? `\n\nCatatan Second Brain yang relevan dengan pertanyaan ini (bisa dipakai sebagai konteks tambahan, tapi tetap boleh diragukan kalau kelihatan sudah usang):\n${catatanRelevan}`
      : '';
    const prompt = `Konteks data aplikasi saat ini:\n${konteks}${bagianCatatan}\n\nPertanyaan pengguna: ${teks}`;
    const jawaban = await AI.tanya(prompt, { system: ASISTEN_SYSTEM_PROMPT });
    _asistenChatLog.push({ role: 'ai', text: jawaban });
  } catch (e) {
    _asistenChatLog.push({ role: 'ai', text: '⚠️ ' + (e.message || 'Gagal mendapat jawaban, coba lagi.') });
  } finally {
    _asistenSedangMikir = false;
    renderAsistenWidget();
  }
}

// Render pertama kali begitu app siap (pola sama seperti banner install
// di 23-install-prompt.js: nempel begitu window load, independen dari
// routing/render section manapun) + render ulang tiap login/logout
// (auth.js belum punya event khusus, jadi paling gampang: panggil ulang
// dari initApp lewat window load, dan biarkan render section lain yang
// sudah eksis memicu ulang lewat MutationObserver ikon — cukup aman
// karena widget ini cuma baca getCurrentUser() tiap kali dirender).
window.addEventListener('load', () => {
  renderAsistenWidget();
});
