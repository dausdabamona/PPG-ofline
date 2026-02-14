# Rencana Konversi PyQt6 → Kivy/KivyMD

## Status: BELUM DIMULAI (Mulai Rabu setelah reset token)

---

## Ringkasan Codebase Saat Ini

**Framework**: PyQt6 (Desktop)
**Database**: SQLite + SQLAlchemy ORM
**Entry Point**: `desktop/main.py`
**Total Halaman**: 10 halaman
**Total Service**: 9 service
**Total Model**: 10+ model

---

## Struktur Halaman yang Perlu Dikonversi

| No | Halaman | File | Kompleksitas |
|----|---------|------|-------------|
| 1 | Dashboard | `pages/dashboard_page.py` | Sedang (statistik, kartu) |
| 2 | Generus | `pages/generus_page.py` | Tinggi (CRUD, tabel, filter) |
| 3 | Pengajian | `pages/pengajian_page.py` | Tinggi (CRUD, tabel) |
| 4 | Presensi | `pages/presensi_page.py` | Tinggi (CRUD, status) |
| 5 | Penilaian | `pages/penilaian_page.py` | Tinggi (CRUD, penilaian) |
| 6 | Kurikulum | `pages/kurikulum_page.py` | Sedang (CRUD) |
| 7 | Wilayah | `pages/wilayah_page.py` | Sedang (hierarki) |
| 8 | Laporan | `pages/laporan_page.py` | Sedang (report) |
| 9 | Pengaturan | `pages/pengaturan_page.py` | Sedang (import/export) |
| 10 | Sync | placeholder | Rendah |

## Komponen UI yang Perlu Dikonversi

| No | Komponen | File | Kivy Equivalent |
|----|----------|------|----------------|
| 1 | Sidebar | `components/sidebar.py` | MDNavigationDrawer |
| 2 | Stat Card | `components/stat_card.py` | MDCard custom |
| 3 | Table Widget | `components/table_widget.py` | MDDataTable |
| 4 | Form Dialog | `components/form_dialog.py` | MDDialog + MDTextField |
| 5 | Theme/Style | `ui/styles/theme.py` | KivyMD theme_cls |

## Yang TIDAK Perlu Diubah

- `database/` - Semua model & connection (SQLAlchemy tetap)
- `services/` - Semua business logic (tetap sama)
- `config.py` - Konfigurasi (minor adjustment)

---

## Urutan Pengerjaan (7 Fase)

### Fase 1: Setup & Struktur Dasar
- [ ] Install Kivy + KivyMD
- [ ] Buat `main.py` baru dengan Kivy App
- [ ] Setup KivyMD theme (warna hijau PPG)
- [ ] Buat ScreenManager untuk navigasi

### Fase 2: Navigasi & Layout
- [ ] Konversi Sidebar → MDNavigationDrawer
- [ ] Buat base screen template
- [ ] Setup routing antar halaman

### Fase 3: Komponen Reusable
- [ ] StatCard → MDCard custom
- [ ] TableWidget → MDDataTable
- [ ] FormDialog → MDDialog dengan form fields

### Fase 4: Halaman Utama
- [ ] Dashboard (statistik + kartu)
- [ ] Generus (tabel + CRUD)
- [ ] Pengajian (tabel + CRUD)

### Fase 5: Halaman Lanjutan
- [ ] Presensi (attendance tracking)
- [ ] Penilaian (grading)
- [ ] Kurikulum (curriculum)

### Fase 6: Halaman Pendukung
- [ ] Wilayah (region management)
- [ ] Laporan (reports)
- [ ] Pengaturan (settings, excel import/export)

### Fase 7: Finalisasi
- [ ] Testing semua halaman
- [ ] Build APK dengan Buildozer (jika target Android)
- [ ] Fix bug & polish UI

---

## Mapping PyQt6 → Kivy/KivyMD

```
QMainWindow          → MDApp + MDScreen
QStackedWidget       → ScreenManager
QWidget/QFrame       → BoxLayout / MDCard
QPushButton          → MDRaisedButton / MDIconButton
QLabel               → MDLabel
QLineEdit            → MDTextField
QComboBox            → MDDropdownMenu
QTableWidget         → MDDataTable
QDialog              → MDDialog
QMessageBox          → MDDialog (alert)
QVBoxLayout          → BoxLayout(orientation='vertical')
QHBoxLayout          → BoxLayout(orientation='horizontal')
QGridLayout          → GridLayout
QScrollArea          → ScrollView
QTabWidget           → MDTabs
StyleSheet (CSS-like) → KV Language (.kv files)
```

---

## Catatan Penting
1. **Database & Service layer TETAP** - tidak perlu ditulis ulang
2. **KV Language** - Gunakan file .kv terpisah untuk layout (lebih bersih)
3. **Target**: Desktop + Android (Kivy cross-platform)
4. **Estimasi**: 5-7 sesi kerja dengan Claude Max
