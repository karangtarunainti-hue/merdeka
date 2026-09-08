-- ============================================================
-- MIGRASI: kolom `pj` (penanggung jawab) di kt_agenda
-- Dipakai untuk rencana kegiatan tahunan hasil rapat akhir tahun:
-- tiap agenda/rencana kegiatan bisa ditugaskan ke satu koordinator/PJ,
-- bukan cuma judul+tanggal tanpa pemilik.
--
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================
alter table kt_agenda add column if not exists pj text default '';
