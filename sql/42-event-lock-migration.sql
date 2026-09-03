-- ============================================================
-- MIGRASI: Kunci Event (locked) di tabel kt_events
-- ============================================================
-- Event yang sudah selesai & dilaporkan bisa dikunci oleh Admin supaya
-- semua data yang terikat ke event itu (anggota, donatur, transaksi,
-- operasional, lomba, hadiah, belanja, jadwal, tarif iuran, harga kupon,
-- dst — lihat EVENT_LOCKED_SECTIONS di js/05-navigation.js) tidak bisa
-- diubah lagi sampai Admin membuka kuncinya lagi. Lihat toggleEventLock()
-- di js/15-pengaturan-event.js dan canEditSection() di js/02-auth.js.
--
-- CATATAN: penguncian ini ditegakkan di sisi client (JS) mengikuti model
-- keamanan aplikasi yang sudah ada (RLS tabel data dibuka penuh untuk
-- anon, lihat sql/01-rls-setup.sql). Kolom ini tetap disinkron ke server
-- lewat jalur upsert kt_events yang sudah ada, jadi status kunci konsisten
-- di semua device begitu Admin mengunci/membuka dari device manapun.
-- ============================================================

alter table kt_events add column if not exists locked boolean not null default false;
alter table kt_events add column if not exists locked_at timestamptz;
alter table kt_events add column if not exists locked_by text;
