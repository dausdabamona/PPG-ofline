-- =============================================================================
-- PPG — Pembinaan Generasi Penerus
-- Migrasi 0001: Skema awal (KONTRAK semua modul)
--
-- Jalankan di Supabase SQL Editor (atau psql). RLS BELUM diaktifkan di sini —
-- itu migrasi berikutnya (P0.3).
--
-- Catatan offline-first:
--   Semua tabel DATA (jamaah, enrollment, presensi, pengajian, penilaian,
--   hafalan) memakai id TEXT (UUID disimpan sbg teks agar serasi dengan Dexie/
--   IndexedDB) + kolom metadata sinkronisasi. Tabel referensi (wilayah, users)
--   TIDAK memakai metadata sinkronisasi.
--
--   kelompok_id pada tabel jamaah/presensi/penilaian/hafalan adalah DENORMALISASI
--   (cache) yang diisi otomatis oleh trigger dari enrollment AKTIF. Dipakai RLS
--   untuk filter cepat. Sumber kebenaran kepemilikan kelompok = tabel enrollment.
-- =============================================================================

-- gen_random_uuid() tersedia bawaan di PostgreSQL 13+ (dipakai Supabase).

-- =============================================================================
-- 1. TABEL REFERENSI (tanpa metadata sinkronisasi)
-- =============================================================================

-- Hierarki wilayah: daerah -> desa -> kelompok (self-referencing).
CREATE TABLE IF NOT EXISTS wilayah (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama       TEXT NOT NULL,
  tingkat    TEXT NOT NULL CHECK (tingkat IN ('daerah', 'desa', 'kelompok')),
  parent_id  TEXT REFERENCES wilayah (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE wilayah IS 'Hierarki wilayah PPG: daerah -> desa -> kelompok (self-referencing).';
COMMENT ON COLUMN wilayah.parent_id IS 'Wilayah induk. NULL untuk tingkat tertinggi (daerah).';

-- Pengguna aplikasi. id mengacu ke auth.users Supabase (pola profiles).
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nama       TEXT NOT NULL,
  email      TEXT UNIQUE,
  role       TEXT NOT NULL DEFAULT 'mubaligh'
             CHECK (role IN ('mubaligh', 'pengurus_desa', 'pengurus_daerah')),
  wilayah_id TEXT REFERENCES wilayah (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Profil pengguna; id = auth.users.id. wilayah_id menentukan cakupan akses (dipakai RLS di P0.3).';

-- =============================================================================
-- 2. TABEL DATA (dengan metadata sinkronisasi offline-first)
--    Pola kolom wajib di setiap tabel data:
--      id TEXT PK (UUID), created_at, updated_at, last_modified,
--      sync_version INTEGER, is_deleted INTEGER, device_id TEXT, kelompok_id TEXT
-- =============================================================================

-- Data pribadi jamaah (generus).
CREATE TABLE IF NOT EXISTS jamaah (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama            TEXT NOT NULL,
  jenis_kelamin   TEXT CHECK (jenis_kelamin IN ('L', 'P')),
  tempat_lahir    TEXT,
  tanggal_lahir   DATE,
  alamat          TEXT,
  no_hp           TEXT,
  fase_kehidupan  TEXT CHECK (fase_kehidupan IN
                     ('paud', 'caberawit', 'praremaja', 'remaja', 'usia_mandiri')),
  status          TEXT NOT NULL DEFAULT 'aktif'
                  CHECK (status IN ('aktif', 'nonaktif', 'pindah', 'wafat')),
  foto_url        TEXT,
  -- metadata offline-first
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_version    INTEGER     NOT NULL DEFAULT 0,
  is_deleted      INTEGER     NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  device_id       TEXT,
  kelompok_id     TEXT REFERENCES wilayah (id) ON DELETE SET NULL
);

COMMENT ON COLUMN jamaah.kelompok_id IS 'DENORMALISASI: diisi otomatis dari enrollment aktif via trigger.';

-- Enrollment = kepemilikan kelompok. SUMBER KEBENARAN.
CREATE TABLE IF NOT EXISTS enrollment (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  jamaah_id       TEXT NOT NULL REFERENCES jamaah (id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'aktif'
                  CHECK (status IN ('aktif', 'nonaktif', 'pindah', 'lulus')),
  tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
  -- metadata offline-first (kelompok_id di sini = kolom inti, bukan denormalisasi)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_version    INTEGER     NOT NULL DEFAULT 0,
  is_deleted      INTEGER     NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  device_id       TEXT,
  kelompok_id     TEXT NOT NULL REFERENCES wilayah (id) ON DELETE RESTRICT
);

COMMENT ON TABLE enrollment IS 'Sumber kebenaran kepemilikan kelompok jamaah.';

-- Satu jamaah hanya boleh punya SATU enrollment aktif.
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_aktif
  ON enrollment (jamaah_id)
  WHERE status = 'aktif' AND is_deleted = 0;

-- Pengajian (kegiatan per kelompok).
CREATE TABLE IF NOT EXISTS pengajian (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  jenis           TEXT NOT NULL,
  tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
  materi          TEXT,
  -- metadata offline-first (kelompok_id = kolom inti)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_version    INTEGER     NOT NULL DEFAULT 0,
  is_deleted      INTEGER     NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  device_id       TEXT,
  kelompok_id     TEXT NOT NULL REFERENCES wilayah (id) ON DELETE RESTRICT
);

-- Presensi jamaah pada suatu pengajian.
CREATE TABLE IF NOT EXISTS presensi (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  jamaah_id       TEXT NOT NULL REFERENCES jamaah (id) ON DELETE CASCADE,
  pengajian_id    TEXT NOT NULL REFERENCES pengajian (id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'hadir'
                  CHECK (status IN ('hadir', 'izin', 'sakit', 'alpa')),
  tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan      TEXT,
  -- metadata offline-first
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_version    INTEGER     NOT NULL DEFAULT 0,
  is_deleted      INTEGER     NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  device_id       TEXT,
  kelompok_id     TEXT REFERENCES wilayah (id) ON DELETE SET NULL,
  UNIQUE (jamaah_id, pengajian_id)
);

COMMENT ON COLUMN presensi.kelompok_id IS 'DENORMALISASI: diisi otomatis dari enrollment aktif jamaah via trigger.';

-- Penilaian jamaah.
CREATE TABLE IF NOT EXISTS penilaian (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  jamaah_id       TEXT NOT NULL REFERENCES jamaah (id) ON DELETE CASCADE,
  jenis           TEXT NOT NULL,
  nilai           NUMERIC,
  tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan      TEXT,
  -- metadata offline-first
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_version    INTEGER     NOT NULL DEFAULT 0,
  is_deleted      INTEGER     NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  device_id       TEXT,
  kelompok_id     TEXT REFERENCES wilayah (id) ON DELETE SET NULL
);

COMMENT ON COLUMN penilaian.kelompok_id IS 'DENORMALISASI: diisi otomatis dari enrollment aktif jamaah via trigger.';

-- Hafalan jamaah.
CREATE TABLE IF NOT EXISTS hafalan (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  jamaah_id        TEXT NOT NULL REFERENCES jamaah (id) ON DELETE CASCADE,
  materi           TEXT NOT NULL,
  status_progress  TEXT NOT NULL DEFAULT 'belum'
                   CHECK (status_progress IN ('belum', 'proses', 'lancar', 'selesai')),
  tanggal          DATE NOT NULL DEFAULT CURRENT_DATE,
  -- metadata offline-first
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_version     INTEGER     NOT NULL DEFAULT 0,
  is_deleted       INTEGER     NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  device_id        TEXT,
  kelompok_id      TEXT REFERENCES wilayah (id) ON DELETE SET NULL
);

COMMENT ON COLUMN hafalan.kelompok_id IS 'DENORMALISASI: diisi otomatis dari enrollment aktif jamaah via trigger.';

-- =============================================================================
-- 3. INDEX (last_modified untuk sync, kelompok_id untuk RLS, + kolom filter)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_wilayah_parent     ON wilayah (parent_id);
CREATE INDEX IF NOT EXISTS idx_wilayah_tingkat    ON wilayah (tingkat);
CREATE INDEX IF NOT EXISTS idx_users_wilayah      ON users (wilayah_id);

CREATE INDEX IF NOT EXISTS idx_jamaah_kelompok    ON jamaah (kelompok_id);
CREATE INDEX IF NOT EXISTS idx_jamaah_modified    ON jamaah (last_modified);
CREATE INDEX IF NOT EXISTS idx_jamaah_status      ON jamaah (status);

CREATE INDEX IF NOT EXISTS idx_enrollment_jamaah   ON enrollment (jamaah_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_kelompok ON enrollment (kelompok_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_modified ON enrollment (last_modified);

CREATE INDEX IF NOT EXISTS idx_pengajian_kelompok  ON pengajian (kelompok_id);
CREATE INDEX IF NOT EXISTS idx_pengajian_modified  ON pengajian (last_modified);
CREATE INDEX IF NOT EXISTS idx_pengajian_tanggal   ON pengajian (tanggal);

CREATE INDEX IF NOT EXISTS idx_presensi_jamaah     ON presensi (jamaah_id);
CREATE INDEX IF NOT EXISTS idx_presensi_pengajian  ON presensi (pengajian_id);
CREATE INDEX IF NOT EXISTS idx_presensi_kelompok   ON presensi (kelompok_id);
CREATE INDEX IF NOT EXISTS idx_presensi_modified   ON presensi (last_modified);

CREATE INDEX IF NOT EXISTS idx_penilaian_jamaah    ON penilaian (jamaah_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_kelompok  ON penilaian (kelompok_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_modified  ON penilaian (last_modified);

CREATE INDEX IF NOT EXISTS idx_hafalan_jamaah      ON hafalan (jamaah_id);
CREATE INDEX IF NOT EXISTS idx_hafalan_kelompok    ON hafalan (kelompok_id);
CREATE INDEX IF NOT EXISTS idx_hafalan_modified    ON hafalan (last_modified);

-- =============================================================================
-- 4. TRIGGER FUNCTIONS
-- =============================================================================

-- 4a. Saat UPDATE: perbarui updated_at, last_modified, dan naikkan sync_version.
CREATE OR REPLACE FUNCTION fn_touch_row()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at    := now();
  NEW.last_modified := now();
  NEW.sync_version  := COALESCE(OLD.sync_version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4b. Helper: kelompok_id dari enrollment AKTIF seorang jamaah.
CREATE OR REPLACE FUNCTION fn_kelompok_aktif(p_jamaah_id TEXT)
RETURNS TEXT AS $$
  SELECT e.kelompok_id
  FROM enrollment e
  WHERE e.jamaah_id = p_jamaah_id
    AND e.status = 'aktif'
    AND e.is_deleted = 0
  ORDER BY e.tanggal DESC, e.last_modified DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 4c. BEFORE INSERT/UPDATE pada jamaah: set kelompok_id dari enrollment aktif.
CREATE OR REPLACE FUNCTION fn_set_kelompok_jamaah()
RETURNS TRIGGER AS $$
BEGIN
  NEW.kelompok_id := COALESCE(fn_kelompok_aktif(NEW.id), NEW.kelompok_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4d. BEFORE INSERT/UPDATE pada presensi/penilaian/hafalan: set kelompok_id
--     dari enrollment aktif jamaah terkait.
CREATE OR REPLACE FUNCTION fn_set_kelompok_by_jamaah()
RETURNS TRIGGER AS $$
BEGIN
  NEW.kelompok_id := COALESCE(fn_kelompok_aktif(NEW.jamaah_id), NEW.kelompok_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4e. AFTER INSERT/UPDATE pada enrollment: propagasi kelompok_id ke jamaah dan
--     turunannya (presensi/penilaian/hafalan). Mengatasi urutan: jamaah dibuat
--     lebih dulu (kelompok_id NULL), lalu enrollment mengisinya.
CREATE OR REPLACE FUNCTION fn_propagasi_kelompok_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  v_jamaah   TEXT := NEW.jamaah_id;
  v_kelompok TEXT;
BEGIN
  v_kelompok := fn_kelompok_aktif(v_jamaah);
  IF v_kelompok IS NOT NULL THEN
    UPDATE jamaah    SET kelompok_id = v_kelompok
      WHERE id = v_jamaah        AND kelompok_id IS DISTINCT FROM v_kelompok;
    UPDATE presensi  SET kelompok_id = v_kelompok
      WHERE jamaah_id = v_jamaah AND kelompok_id IS DISTINCT FROM v_kelompok;
    UPDATE penilaian SET kelompok_id = v_kelompok
      WHERE jamaah_id = v_jamaah AND kelompok_id IS DISTINCT FROM v_kelompok;
    UPDATE hafalan   SET kelompok_id = v_kelompok
      WHERE jamaah_id = v_jamaah AND kelompok_id IS DISTINCT FROM v_kelompok;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. TRIGGERS
-- =============================================================================

-- 5a. Touch (BEFORE UPDATE) untuk semua tabel data.
DROP TRIGGER IF EXISTS trg_jamaah_touch    ON jamaah;
CREATE TRIGGER trg_jamaah_touch    BEFORE UPDATE ON jamaah
  FOR EACH ROW EXECUTE FUNCTION fn_touch_row();

DROP TRIGGER IF EXISTS trg_enrollment_touch ON enrollment;
CREATE TRIGGER trg_enrollment_touch BEFORE UPDATE ON enrollment
  FOR EACH ROW EXECUTE FUNCTION fn_touch_row();

DROP TRIGGER IF EXISTS trg_pengajian_touch  ON pengajian;
CREATE TRIGGER trg_pengajian_touch  BEFORE UPDATE ON pengajian
  FOR EACH ROW EXECUTE FUNCTION fn_touch_row();

DROP TRIGGER IF EXISTS trg_presensi_touch   ON presensi;
CREATE TRIGGER trg_presensi_touch   BEFORE UPDATE ON presensi
  FOR EACH ROW EXECUTE FUNCTION fn_touch_row();

DROP TRIGGER IF EXISTS trg_penilaian_touch  ON penilaian;
CREATE TRIGGER trg_penilaian_touch  BEFORE UPDATE ON penilaian
  FOR EACH ROW EXECUTE FUNCTION fn_touch_row();

DROP TRIGGER IF EXISTS trg_hafalan_touch    ON hafalan;
CREATE TRIGGER trg_hafalan_touch    BEFORE UPDATE ON hafalan
  FOR EACH ROW EXECUTE FUNCTION fn_touch_row();

-- 5b. Denormalisasi kelompok_id (BEFORE INSERT/UPDATE).
--     Dijalankan setelah kolom selain kelompok_id diset; nama 'a_' agar urut
--     sebelum trigger touch secara alfabet (tidak kritikal, kolom berbeda).
DROP TRIGGER IF EXISTS trg_jamaah_set_kelompok    ON jamaah;
CREATE TRIGGER trg_jamaah_set_kelompok    BEFORE INSERT OR UPDATE ON jamaah
  FOR EACH ROW EXECUTE FUNCTION fn_set_kelompok_jamaah();

DROP TRIGGER IF EXISTS trg_presensi_set_kelompok  ON presensi;
CREATE TRIGGER trg_presensi_set_kelompok  BEFORE INSERT OR UPDATE ON presensi
  FOR EACH ROW EXECUTE FUNCTION fn_set_kelompok_by_jamaah();

DROP TRIGGER IF EXISTS trg_penilaian_set_kelompok ON penilaian;
CREATE TRIGGER trg_penilaian_set_kelompok BEFORE INSERT OR UPDATE ON penilaian
  FOR EACH ROW EXECUTE FUNCTION fn_set_kelompok_by_jamaah();

DROP TRIGGER IF EXISTS trg_hafalan_set_kelompok   ON hafalan;
CREATE TRIGGER trg_hafalan_set_kelompok   BEFORE INSERT OR UPDATE ON hafalan
  FOR EACH ROW EXECUTE FUNCTION fn_set_kelompok_by_jamaah();

-- 5c. Propagasi dari enrollment (AFTER INSERT/UPDATE).
DROP TRIGGER IF EXISTS trg_enrollment_propagasi ON enrollment;
CREATE TRIGGER trg_enrollment_propagasi AFTER INSERT OR UPDATE ON enrollment
  FOR EACH ROW EXECUTE FUNCTION fn_propagasi_kelompok_enrollment();

-- =============================================================================
-- 6. VIEW AGREGASI
-- =============================================================================

-- Rekap per kelompok: jumlah jamaah aktif, kehadiran, dan progress hafalan.
CREATE OR REPLACE VIEW v_rekap_kelompok AS
WITH base AS (
  SELECT
    w.id        AS kelompok_id,
    w.nama      AS nama_kelompok,
    w.parent_id AS desa_id,
    (SELECT COUNT(*) FROM enrollment e
       WHERE e.kelompok_id = w.id AND e.status = 'aktif' AND e.is_deleted = 0)
      AS jumlah_jamaah,
    (SELECT COUNT(*) FROM presensi p
       WHERE p.kelompok_id = w.id AND p.is_deleted = 0)
      AS total_presensi,
    (SELECT COUNT(*) FROM presensi p
       WHERE p.kelompok_id = w.id AND p.is_deleted = 0 AND p.status = 'hadir')
      AS total_hadir,
    (SELECT COUNT(*) FROM hafalan h
       WHERE h.kelompok_id = w.id AND h.is_deleted = 0)
      AS total_hafalan,
    (SELECT COUNT(*) FROM hafalan h
       WHERE h.kelompok_id = w.id AND h.is_deleted = 0
         AND h.status_progress IN ('lancar', 'selesai'))
      AS hafalan_tuntas
  FROM wilayah w
  WHERE w.tingkat = 'kelompok'
)
SELECT
  base.*,
  CASE WHEN total_presensi > 0
       THEN ROUND(100.0 * total_hadir / total_presensi, 1)
       ELSE 0 END AS persentase_kehadiran,
  CASE WHEN total_hafalan > 0
       THEN ROUND(100.0 * hafalan_tuntas / total_hafalan, 1)
       ELSE 0 END AS persentase_hafalan_tuntas
FROM base;

COMMENT ON VIEW v_rekap_kelompok IS 'Rekap agregasi per kelompok: jumlah jamaah aktif, kehadiran, progress hafalan.';

-- =============================================================================
-- SELESAI migrasi 0001.
-- =============================================================================
