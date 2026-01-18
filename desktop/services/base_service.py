"""
Base Service - Template untuk semua service
"""
from typing import TypeVar, Generic, Type, List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from datetime import datetime

from database.models.base import Base

T = TypeVar('T', bound=Base)


class BaseService(Generic[T]):
    """
    Base service dengan operasi CRUD standar
    """

    def __init__(self, session: Session, model: Type[T]):
        self.session = session
        self.model = model

    def get_all(
        self,
        filters: Dict[str, Any] = None,
        order_by: str = None,
        order_desc: bool = False,
        limit: int = None,
        offset: int = None
    ) -> List[T]:
        """
        Get all records with optional filters, ordering, and pagination
        """
        query = self.session.query(self.model)

        # Apply filters
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    column = getattr(self.model, key)
                    if isinstance(value, str) and '%' in value:
                        # LIKE query
                        query = query.filter(column.ilike(value))
                    elif isinstance(value, (list, tuple)):
                        # IN query
                        query = query.filter(column.in_(value))
                    else:
                        # Exact match
                        query = query.filter(column == value)

        # Apply ordering
        if order_by and hasattr(self.model, order_by):
            column = getattr(self.model, order_by)
            query = query.order_by(desc(column) if order_desc else asc(column))

        # Apply pagination
        if offset:
            query = query.offset(offset)
        if limit:
            query = query.limit(limit)

        return query.all()

    def get_by_id(self, record_id: int) -> Optional[T]:
        """Get single record by ID"""
        return self.session.query(self.model).filter(
            self.model.id == record_id
        ).first()

    def get_by_sync_id(self, sync_id: str) -> Optional[T]:
        """Get single record by sync_id"""
        if not hasattr(self.model, 'sync_id'):
            return None
        return self.session.query(self.model).filter(
            self.model.sync_id == sync_id
        ).first()

    def create(self, data: Dict[str, Any]) -> T:
        """Create new record"""
        # Remove None values and computed fields
        clean_data = {k: v for k, v in data.items()
                     if v is not None and hasattr(self.model, k)}

        record = self.model(**clean_data)
        self.session.add(record)
        self.session.flush()
        return record

    def update(self, record_id: int, data: Dict[str, Any]) -> Optional[T]:
        """Update existing record"""
        record = self.get_by_id(record_id)
        if not record:
            return None

        for key, value in data.items():
            if hasattr(record, key) and key not in ('id', 'sync_id', 'created_at'):
                setattr(record, key, value)

        # Update timestamp if available
        if hasattr(record, 'updated_at'):
            record.updated_at = datetime.now()

        self.session.flush()
        return record

    def delete(self, record_id: int, soft: bool = True) -> bool:
        """
        Delete record
        soft=True: Set status_aktif=False (if available)
        soft=False: Hard delete from database
        """
        record = self.get_by_id(record_id)
        if not record:
            return False

        if soft and hasattr(record, 'status_aktif'):
            record.status_aktif = False
            if hasattr(record, 'updated_at'):
                record.updated_at = datetime.now()
        elif soft and hasattr(record, 'is_aktif'):
            record.is_aktif = False
        else:
            self.session.delete(record)

        self.session.flush()
        return True

    def count(self, filters: Dict[str, Any] = None) -> int:
        """Count records with optional filters"""
        query = self.session.query(self.model)

        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    query = query.filter(getattr(self.model, key) == value)

        return query.count()

    def exists(self, filters: Dict[str, Any]) -> bool:
        """Check if record exists with given filters"""
        return self.count(filters) > 0

    def upsert_by_sync_id(self, data: Dict[str, Any]) -> T:
        """
        Insert or update based on sync_id
        Used for synchronization
        """
        sync_id = data.get('sync_id')
        if not sync_id:
            return self.create(data)

        existing = self.get_by_sync_id(sync_id)
        if existing:
            return self.update(existing.id, data)
        else:
            return self.create(data)

    def bulk_create(self, data_list: List[Dict[str, Any]]) -> List[T]:
        """Create multiple records"""
        records = []
        for data in data_list:
            record = self.create(data)
            records.append(record)
        return records

    def refresh(self, record: T) -> T:
        """Refresh record from database"""
        self.session.refresh(record)
        return record
