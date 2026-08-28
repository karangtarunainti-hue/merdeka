-- ============================================================
-- HARDENING MIGRATION — cache insight AI
-- Menutup celah: kt_ai_insight, kt_ai_insight_lomba,
-- kt_ai_insight_belanja_hadiah, kt_kalender_insight dibuat SETELAH
-- 34-hardening-migration.sql, jadi tidak ikut ke daftar tabel yang
-- di-hardening di sana — keempatnya masih anon_full_access
-- (using true, with check true), artinya siapa pun tanpa login bisa
-- INSERT/UPDATE/DELETE cache insight event manapun.
--
-- Aman diterapkan: js/27-ai-insight.js & js/28-kalender-peringatan.js
-- sudah menjaga setiap generate*Insight() dengan
-- `if(!getCurrentUser()) return;` di sisi client — guest memang
-- cuma pernah membaca cache ini, tidak pernah menulis. Jadi
-- membatasi tulis ke session_is_logged_in() tidak mematahkan
-- alur guest yang sudah ada.
--
-- Pola SAMA seperti BAGIAN 3 di 34-hardening-migration.sql: baca
-- tetap terbuka untuk anon (supaya guest tetap bisa lihat insight
-- yang sudah ada), tulis (insert/update/delete) hanya kalau login.
--
-- Jalankan di Supabase Dashboard > SQL Editor > Run.
-- Aman dijalankan berkali-kali (idempotent). Tidak perlu urutan
-- deploy khusus — fungsi session_is_logged_in() sudah ada dari
-- 34-hardening-migration.sql (wajib dijalankan lebih dulu kalau
-- project ini belum pernah menjalankannya).
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'kt_ai_insight', 'kt_ai_insight_lomba', 'kt_ai_insight_belanja_hadiah',
    'kt_kalender_insight'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'Lewati % (tabel belum ada)', t;
      continue;
    end if;

    execute format('alter table %I enable row level security;', t);

    execute format('drop policy if exists "anon_full_access" on %I;', t);
    execute format('drop policy if exists "%s_read" on %I;', t, t);
    execute format('drop policy if exists "%s_write" on %I;', t, t);

    execute format(
      'create policy "%s_read" on %I for select to anon using (true);', t, t
    );
    execute format(
      'create policy "%s_write" on %I for all to anon '
      'using (session_is_logged_in()) with check (session_is_logged_in());',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- SELESAI
-- ============================================================
-- Verifikasi cepat setelah dijalankan — tidak boleh ada baris
-- untuk 4 tabel ini dengan policy terbuka selain SELECT:
--
--   select tablename, policyname, cmd, qual
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in (
--       'kt_ai_insight', 'kt_ai_insight_lomba',
--       'kt_ai_insight_belanja_hadiah', 'kt_kalender_insight'
--     )
--   order by tablename, cmd;
-- ============================================================
