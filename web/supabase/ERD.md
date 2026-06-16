# ERD — Skema Database PPG (Migrasi 0001)

Diagram relasi entitas untuk PPG (Pembinaan Generasi Penerus). Sumber kebenaran
skema: [`migrations/0001_init_schema.sql`](./migrations/0001_init_schema.sql).

## Diagram

```mermaid
erDiagram
    wilayah ||--o{ wilayah    : "parent_id (self-ref)"
    wilayah ||--o{ users      : "wilayah_id"
    wilayah ||--o{ enrollment : "kelompok_id (inti)"
    wilayah ||--o{ pengajian  : "kelompok_id (inti)"
    wilayah ||--o{ jamaah     : "kelompok_id (denorm)"
    wilayah ||--o{ presensi   : "kelompok_id (denorm)"
    wilayah ||--o{ penilaian  : "kelompok_id (denorm)"
    wilayah ||--o{ hafalan    : "kelompok_id (denorm)"

    jamaah    ||--o{ enrollment : "jamaah_id"
    jamaah    ||--o{ presensi   : "jamaah_id"
    jamaah    ||--o{ penilaian  : "jamaah_id"
    jamaah    ||--o{ hafalan    : "jamaah_id"
    pengajian ||--o{ presensi   : "pengajian_id"

    wilayah {
        text id PK
        text nama
        text tingkat "daerah|desa|kelompok"
        text parent_id FK "self-ref"
        timestamptz created_at
    }

    users {
        uuid id PK "= auth.users.id"
        text nama
        text email UK
        text role "mubaligh|pengurus_desa|pengurus_daerah"
        text wilayah_id FK
        timestamptz created_at
    }

    jamaah {
        text id PK
        text nama
        text jenis_kelamin "L|P"
        text tempat_lahir
        date tanggal_lahir
        text alamat
        text no_hp
        text fase_kehidupan
        text status "aktif|nonaktif|pindah|wafat"
        text foto_url
        timestamptz created_at
        timestamptz updated_at
        timestamptz last_modified
        int sync_version
        int is_deleted
        text device_id
        text kelompok_id FK "DENORM dari enrollment"
    }

    enrollment {
        text id PK
        text jamaah_id FK
        text kelompok_id FK "INTI"
        text status "aktif|nonaktif|pindah|lulus"
        date tanggal
        timestamptz created_at
        timestamptz updated_at
        timestamptz last_modified
        int sync_version
        int is_deleted
        text device_id
    }

    pengajian {
        text id PK
        text jenis
        date tanggal
        text materi
        text kelompok_id FK "INTI"
        timestamptz created_at
        timestamptz updated_at
        timestamptz last_modified
        int sync_version
        int is_deleted
        text device_id
    }

    presensi {
        text id PK
        text jamaah_id FK
        text pengajian_id FK
        text status "hadir|izin|sakit|alpa"
        date tanggal
        text keterangan
        text kelompok_id FK "DENORM"
        timestamptz created_at
        timestamptz updated_at
        timestamptz last_modified
        int sync_version
        int is_deleted
        text device_id
    }

    penilaian {
        text id PK
        text jamaah_id FK
        text jenis
        numeric nilai
        date tanggal
        text keterangan
        text kelompok_id FK "DENORM"
        timestamptz created_at
        timestamptz updated_at
        timestamptz last_modified
        int sync_version
        int is_deleted
        text device_id
    }

    hafalan {
        text id PK
        text jamaah_id FK
        text materi
        text status_progress "belum|proses|lancar|selesai"
        date tanggal
        text kelompok_id FK "DENORM"
        timestamptz created_at
        timestamptz updated_at
        timestamptz last_modified
        int sync_version
        int is_deleted
        text device_id
    }
```

## Catatan relasi & keputusan

1. **Hierarki wilayah** self-referencing: `daerah → desa → kelompok` lewat
   `parent_id`. Semua data terikat ke `kelompok` (tingkat terbawah).
2. **`enrollment` = sumber kebenaran** kepemilikan kelompok. Dijamin **satu
   enrollment aktif per jamaah** via index unik parsial `uq_enrollment_aktif`.
3. **`kelompok_id` denormalisasi** pada `jamaah`, `presensi`, `penilaian`,
   `hafalan` — diisi otomatis oleh trigger dari enrollment aktif. Dipakai RLS
   (P0.3) untuk filter cepat tanpa join ke enrollment.
4. **`kelompok_id` inti** pada `enrollment` dan `pengajian` (bukan denormalisasi).
5. **Trigger**:
   - `fn_touch_row` — naikkan `sync_version`, set `updated_at`/`last_modified`
     saat UPDATE (semua tabel data).
   - `fn_set_kelompok_jamaah` / `fn_set_kelompok_by_jamaah` — isi `kelompok_id`
     denormalisasi saat INSERT/UPDATE.
   - `fn_propagasi_kelompok_enrollment` — saat enrollment berubah, sebarkan
     `kelompok_id` ke jamaah dan turunannya (mengatasi urutan insert).
6. **View `v_rekap_kelompok`** — agregasi per kelompok: jumlah jamaah aktif,
   total/persentase kehadiran, dan progress hafalan.
7. **RLS belum aktif** — diatur pada migrasi berikutnya (P0.3).

## Verifikasi

Migrasi sudah dijalankan pada PostgreSQL 16 lokal tanpa error, dan alur trigger
(propagasi kelompok, kenaikan `sync_version`, perpindahan kelompok, batasan
enrollment aktif tunggal) sudah diuji fungsional.
