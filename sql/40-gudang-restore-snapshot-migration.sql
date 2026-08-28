-- ============================================================
-- MIGRASI: RPC atomik kt_gudang_restore_snapshot
-- Jalankan di Supabase Dashboard project MERDEKA > SQL Editor > Run.
-- Aman dijalankan berkali-kali (idempotent).
--
-- MASALAH: js/15b-snapshot.js (restoreGudangFromPayload(), dipakai baik
-- oleh "Pulihkan Snapshot" maupun Impor "Timpa Semua" di
-- js/15-pengaturan-event.js) sudah lama memanggil
-- `sb.rpc('kt_gudang_restore_snapshot', {p_inventory, p_transactions,
-- p_items, p_resi_seq})` dan CLAUDE.md/README.md sudah mendokumentasikan
-- fungsi ini, TAPI file migrasi yang membuatnya (disebut di komentar JS
-- sebagai `supabase-gudang-restore-snapshot-migration.sql`) ternyata
-- tidak pernah ikut ter-bundle ke folder sql/ ini. Akibatnya setiap kali
-- admin memulihkan snapshot atau melakukan impor "Timpa Semua", data
-- lain (db.xxx) berhasil dipulihkan tapi data Gudang SELALU gagal dengan
-- error "function kt_gudang_restore_snapshot(...) does not exist" —
-- tanpa ada indikasi ke admin selain toast peringatan di UI.
--
-- PERBAIKAN: RPC ini melakukan FULL WIPE + INSERT keempat tabel
-- kt_gudang_* dalam SATU transaksi server (bukan beberapa delete()/
-- insert() terpisah dari JS), supaya koneksi putus di tengah proses
-- tidak meninggalkan tabel Gudang kosong separuh — sama seperti pola
-- kt_gudang_import_backup (sql/31) tapi FULL-WIPE (menimpa, bukan
-- upsert) karena ini memang semantik "restore", bukan "impor tambahan".
--
-- Bentuk payload: hasil `select('*')` mentah dari tiap tabel kt_gudang_*
-- (lihat fetchGudangBackupData() di js/15b-snapshot.js), jadi field-nya
-- SAMA PERSIS dengan nama kolom tabel (snake_case: is_active,
-- last_updated, tgl_pinjam, tgl_kembali, item_id, dst) — BUKAN
-- camelCase seperti format Export/Import JSON per-modul
-- (gudangExportJSON()/kt_gudang_import_backup di sql/31).
-- ============================================================

drop function if exists kt_gudang_restore_snapshot(jsonb, jsonb, jsonb, jsonb);
create function kt_gudang_restore_snapshot(
  p_inventory jsonb,
  p_transactions jsonb,
  p_items jsonb,
  p_resi_seq jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Hapus child dulu (transaction_items punya FK ke transactions),
  -- baru parent, supaya tidak kena FK violation.
  delete from kt_gudang_transaction_items;
  delete from kt_gudang_transactions;
  delete from kt_gudang_inventory;
  delete from kt_gudang_resi_seq;

  insert into kt_gudang_inventory (id, nama, gudang, total, tersedia, is_active, last_updated, created_at)
  select
    coalesce(nullif(x->>'id', ''), gen_random_uuid()::text),
    coalesce(x->>'nama', ''),
    coalesce(x->>'gudang', ''),
    coalesce((x->>'total')::integer, 0),
    coalesce((x->>'tersedia')::integer, 0),
    coalesce((x->>'is_active')::boolean, true),
    nullif(x->>'last_updated', '')::date,
    coalesce(nullif(x->>'created_at', '')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_inventory, '[]'::jsonb)) x;

  insert into kt_gudang_transactions (id, resi, nama, alamat, wa, tgl_pinjam, tgl_kembali, status, created_at)
  select
    coalesce(nullif(x->>'id', ''), gen_random_uuid()::text),
    coalesce(x->>'resi', ''),
    coalesce(x->>'nama', ''),
    coalesce(x->>'alamat', ''),
    coalesce(x->>'wa', ''),
    nullif(x->>'tgl_pinjam', '')::date,
    nullif(x->>'tgl_kembali', '')::date,
    coalesce(nullif(x->>'status', ''), 'aktif'),
    coalesce(nullif(x->>'created_at', '')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb)) x;

  insert into kt_gudang_transaction_items (id, transaction_id, item_id, nama, gudang, qty, created_at)
  select
    coalesce(nullif(x->>'id', '')::uuid, gen_random_uuid()),
    x->>'transaction_id',
    x->>'item_id',
    coalesce(x->>'nama', ''),
    coalesce(x->>'gudang', ''),
    coalesce((x->>'qty')::integer, 0),
    coalesce(nullif(x->>'created_at', '')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x;

  insert into kt_gudang_resi_seq (id, seq)
  select
    coalesce((x->>'id')::int, 1),
    coalesce((x->>'seq')::integer, 1)
  from jsonb_array_elements(coalesce(p_resi_seq, '[]'::jsonb)) x;

  -- Payload lama/kosong tidak boleh meninggalkan tabel seq tanpa baris
  -- sama sekali — kt_gudang_claim_next_resi() mengasumsikan selalu ada
  -- baris id=1 (fallback insert di fungsi itu hanya jaga-jaga race
  -- condition, bukan pengganti baris yang memang sengaja tidak ada).
  insert into kt_gudang_resi_seq (id, seq) values (1, 1)
  on conflict (id) do nothing;
end;
$$;
grant execute on function kt_gudang_restore_snapshot(jsonb, jsonb, jsonb, jsonb) to anon;
