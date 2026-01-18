"""
Sync Service - Business logic untuk sinkronisasi data
Export/Import backup file (.ppg)
"""
import json
import gzip
import hashlib
import os
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, date
from pathlib import Path

from database.models import (
    SyncLog, SyncConflict, Jamaah, Enrollment, Wilayah, Jenjang,
    TahunAjaran, Pengajian, KeaktifanPengajian, ProgressJamaah,
    PenilaianAkhlaq, Users, Role, BidangMateri, KategoriMateri, MateriItem
)
from config import SYNC_VERSION, BACKUP_DIR, DEVICE_ID


class SyncService:
    """
    Service untuk sinkronisasi data antar device
    Export ke file .ppg (compressed JSON)
    Import dan merge dengan conflict resolution
    """

    # Urutan tabel untuk export/import (parent tables dulu)
    TABLE_ORDER = [
        ('wilayah', Wilayah),
        ('jenjang', Jenjang),
        ('tahun_ajaran', TahunAjaran),
        ('role', Role),
        ('users', Users),
        ('bidang_materi', BidangMateri),
        ('kategori_materi', KategoriMateri),
        ('materi_item', MateriItem),
        ('jamaah', Jamaah),
        ('enrollment', Enrollment),
        ('pengajian', Pengajian),
        ('keaktifan_pengajian', KeaktifanPengajian),
        ('progress_jamaah', ProgressJamaah),
        ('penilaian_akhlaq', PenilaianAkhlaq),
    ]

    def __init__(self, session: Session, device_id: str = None):
        self.session = session
        self.device_id = device_id or DEVICE_ID

    def export_backup(
        self,
        output_path: str = None,
        tables: List[str] = None,
        since: datetime = None,
        wilayah_id: int = None,
        include_master: bool = True
    ) -> str:
        """
        Export data ke file backup (.ppg)

        Args:
            output_path: Path file output (optional, auto-generate if None)
            tables: List nama tabel yang di-export (default: semua)
            since: Export data yang diubah sejak tanggal ini
            wilayah_id: Filter berdasarkan wilayah
            include_master: Include master data (jenjang, role, dll)

        Returns:
            Path file backup yang dibuat
        """
        tables_to_export = tables or [t[0] for t in self.TABLE_ORDER]

        export_data = {
            'version': SYNC_VERSION,
            'device_id': self.device_id,
            'export_time': datetime.now().isoformat(),
            'export_params': {
                'since': since.isoformat() if since else None,
                'wilayah_id': wilayah_id,
                'include_master': include_master,
            },
            'tables': {}
        }

        total_records = 0

        for table_name, model in self.TABLE_ORDER:
            if table_name not in tables_to_export:
                continue

            # Skip master tables if not included
            if not include_master and table_name in ['jenjang', 'role', 'bidang_materi', 'kategori_materi', 'materi_item']:
                continue

            query = self.session.query(model)

            # Filter by updated date if specified
            if since:
                if hasattr(model, 'updated_at'):
                    query = query.filter(model.updated_at >= since)
                elif hasattr(model, 'created_at'):
                    query = query.filter(model.created_at >= since)

            # Filter by wilayah if specified (for tables that have wilayah_id)
            if wilayah_id and hasattr(model, 'wilayah_id'):
                # Get all child wilayah IDs
                wilayah = self.session.query(Wilayah).get(wilayah_id)
                if wilayah:
                    wilayah_ids = [w.id for w in wilayah.get_all_children(include_self=True)]
                    query = query.filter(model.wilayah_id.in_(wilayah_ids))

            records = []
            for row in query.all():
                if hasattr(row, 'to_dict'):
                    records.append(row.to_dict())
                else:
                    # Fallback for models without to_dict
                    records.append({
                        c.name: getattr(row, c.name)
                        for c in row.__table__.columns
                    })

            export_data['tables'][table_name] = records
            total_records += len(records)

        # Generate checksum
        json_str = json.dumps(export_data, indent=2, default=str, ensure_ascii=False)
        checksum = hashlib.sha256(json_str.encode()).hexdigest()
        export_data['checksum'] = checksum

        # Regenerate JSON with checksum
        json_str = json.dumps(export_data, indent=2, default=str, ensure_ascii=False)

        # Generate filename if not provided
        if not output_path:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = str(BACKUP_DIR / f"backup_{self.device_id}_{timestamp}.ppg")

        # Ensure directory exists
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # Compress and save
        with gzip.open(output_path, 'wt', encoding='utf-8') as f:
            f.write(json_str)

        # Get file size
        file_size = os.path.getsize(output_path)

        # Log export
        self._log_sync('export', output_path, total_records, file_size)

        return output_path

    def import_backup(
        self,
        file_path: str,
        merge_strategy: str = 'update'
    ) -> Dict[str, Any]:
        """
        Import data dari file backup

        Args:
            file_path: Path file backup
            merge_strategy:
                - 'update': Update existing, insert new (default)
                - 'replace': Replace all data
                - 'skip': Only insert new records

        Returns:
            Summary of import operation
        """
        # Read and decompress
        with gzip.open(file_path, 'rt', encoding='utf-8') as f:
            content = f.read()

        import_data = json.loads(content)

        # Verify checksum
        stored_checksum = import_data.pop('checksum', None)
        json_str = json.dumps(import_data, indent=2, default=str, ensure_ascii=False)
        calculated_checksum = hashlib.sha256(json_str.encode()).hexdigest()

        if stored_checksum and stored_checksum != calculated_checksum:
            raise ValueError("Checksum tidak valid - file mungkin corrupt")

        summary = {
            'version': import_data.get('version'),
            'source_device': import_data.get('device_id'),
            'export_time': import_data.get('export_time'),
            'tables': {},
            'conflicts': [],
            'errors': []
        }

        # Import in order
        for table_name, model in self.TABLE_ORDER:
            if table_name not in import_data.get('tables', {}):
                continue

            records = import_data['tables'][table_name]

            inserted = 0
            updated = 0
            skipped = 0
            errors = 0

            for record in records:
                try:
                    result = self._import_record(model, record, merge_strategy)
                    if result == 'inserted':
                        inserted += 1
                    elif result == 'updated':
                        updated += 1
                    elif result == 'conflict':
                        summary['conflicts'].append({
                            'table': table_name,
                            'sync_id': record.get('sync_id')
                        })
                        skipped += 1
                    else:
                        skipped += 1
                except Exception as e:
                    errors += 1
                    summary['errors'].append({
                        'table': table_name,
                        'record': record.get('sync_id'),
                        'error': str(e)
                    })

            summary['tables'][table_name] = {
                'inserted': inserted,
                'updated': updated,
                'skipped': skipped,
                'errors': errors
            }

        self.session.commit()

        # Log import
        total = sum(t['inserted'] + t['updated'] for t in summary['tables'].values())
        file_size = os.path.getsize(file_path)
        self._log_sync('import', file_path, total, file_size)

        return summary

    def _import_record(
        self,
        model,
        record: Dict[str, Any],
        strategy: str
    ) -> str:
        """
        Import single record

        Returns: 'inserted', 'updated', 'skipped', or 'conflict'
        """
        sync_id = record.get('sync_id')

        if not sync_id or not hasattr(model, 'sync_id'):
            # No sync_id, always insert (generate new ID)
            record_copy = {k: v for k, v in record.items() if k != 'id'}
            new_record = model(**self._parse_record(model, record_copy))
            self.session.add(new_record)
            return 'inserted'

        # Check if exists
        existing = self.session.query(model).filter(
            model.sync_id == sync_id
        ).first()

        if existing:
            if strategy == 'skip':
                return 'skipped'
            elif strategy in ('update', 'replace'):
                # Compare timestamps for conflict detection
                local_updated = getattr(existing, 'updated_at', None) or getattr(existing, 'created_at', None)
                remote_updated = record.get('updated_at') or record.get('created_at')

                if remote_updated and local_updated:
                    remote_dt = datetime.fromisoformat(remote_updated) if isinstance(remote_updated, str) else remote_updated
                    if remote_dt <= local_updated:
                        # Local is newer, potential conflict
                        self._create_conflict(model.__tablename__, sync_id, existing, record)
                        return 'conflict'

                # Update existing record
                for key, value in self._parse_record(model, record).items():
                    if key not in ('id', 'sync_id', 'created_at'):
                        setattr(existing, key, value)
                return 'updated'
        else:
            # Insert new record
            record_copy = {k: v for k, v in record.items() if k != 'id'}
            new_record = model(**self._parse_record(model, record_copy))
            self.session.add(new_record)
            return 'inserted'

    def _parse_record(self, model, record: Dict[str, Any]) -> Dict[str, Any]:
        """Parse and convert record data types"""
        parsed = {}
        for key, value in record.items():
            if not hasattr(model, key):
                continue

            if value is None:
                parsed[key] = None
                continue

            # Get column type
            column = getattr(model, key, None)
            if column is None:
                continue

            # Parse dates
            if isinstance(value, str):
                if 'date' in key.lower() or key.endswith('_at'):
                    try:
                        if 'T' in value:
                            parsed[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                        else:
                            parsed[key] = date.fromisoformat(value)
                        continue
                    except:
                        pass

            parsed[key] = value

        return parsed

    def _create_conflict(
        self,
        table_name: str,
        sync_id: str,
        local_record,
        remote_record: Dict[str, Any]
    ):
        """Create conflict record for manual resolution"""
        conflict = SyncConflict(
            table_name=table_name,
            record_sync_id=sync_id,
            local_data=json.dumps(local_record.to_dict() if hasattr(local_record, 'to_dict') else {}, default=str),
            remote_data=json.dumps(remote_record, default=str),
            resolution='pending'
        )
        self.session.add(conflict)

    def _log_sync(
        self,
        sync_type: str,
        file_name: str,
        records_count: int,
        file_size: int = None
    ):
        """Log sync operation"""
        log = SyncLog(
            device_id=self.device_id,
            sync_type=sync_type,
            records_count=records_count,
            file_name=os.path.basename(file_name),
            file_size=file_size,
            status='success'
        )
        self.session.add(log)
        self.session.flush()

    def get_pending_conflicts(self) -> List[SyncConflict]:
        """Get all pending conflicts"""
        return self.session.query(SyncConflict).filter(
            SyncConflict.resolution == 'pending'
        ).all()

    def resolve_conflict(
        self,
        conflict_id: int,
        resolution: str,
        user_id: int = None
    ) -> bool:
        """
        Resolve a sync conflict

        Args:
            conflict_id: ID of conflict to resolve
            resolution: 'keep_local', 'keep_remote', or 'merged'
            user_id: ID of user resolving the conflict
        """
        conflict = self.session.query(SyncConflict).get(conflict_id)
        if not conflict:
            return False

        if resolution == 'keep_remote':
            # Apply remote data
            remote_data = json.loads(conflict.remote_data)
            table_name = conflict.table_name

            # Find model
            model = None
            for name, m in self.TABLE_ORDER:
                if name == table_name:
                    model = m
                    break

            if model:
                existing = self.session.query(model).filter(
                    model.sync_id == conflict.record_sync_id
                ).first()
                if existing:
                    for key, value in self._parse_record(model, remote_data).items():
                        if key not in ('id', 'sync_id'):
                            setattr(existing, key, value)

        conflict.resolve(resolution, user_id)
        self.session.flush()
        return True

    def get_sync_history(self, limit: int = 50) -> List[SyncLog]:
        """Get sync history"""
        return self.session.query(SyncLog).order_by(
            SyncLog.sync_time.desc()
        ).limit(limit).all()

    def get_last_sync(self, sync_type: str = None) -> Optional[SyncLog]:
        """Get last sync operation"""
        query = self.session.query(SyncLog)
        if sync_type:
            query = query.filter(SyncLog.sync_type == sync_type)
        return query.order_by(SyncLog.sync_time.desc()).first()
