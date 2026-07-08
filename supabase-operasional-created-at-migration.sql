-- ============================================================
-- MIGRASI: kolom `created_at` di tabel kt_operasional
--
-- LATAR BELAKANG:
-- Daftar Biaya Operasional perlu menampilkan transaksi PALING BARU
-- di baris paling atas. Sebelumnya urutan hanya mengandalkan kolom
-- `tanggal` (tanggal yang dipilih user, bisa sama untuk banyak baris,
-- dan bisa diisi mundur), jadi transaksi yang baru saja ditambahkan
-- tidak selalu muncul paling atas kalau tanggalnya sama/lebih lama
-- dari baris lain. Kolom `created_at` merekam kapan baris benar-benar
-- dibuat, terisi otomatis lewat default now() saat insert.
--
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================

alter table kt_operasional add column if not exists created_at timestamptz default now();

-- Isi baris lama yang masih null. Karena urutan asli tidak diketahui lagi,
-- dipakai waktu sekarang sekadar supaya kolomnya tidak kosong (tidak
-- mempengaruhi baris baru yang dibuat setelah migrasi ini).
update kt_operasional set created_at = now() where created_at is null;
