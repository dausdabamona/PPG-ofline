"""
Model Security: Users, Role, Resource, RolePermission, UserRole
Manajemen user dan hak akses
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import bcrypt

from .base import Base, TimestampMixin, SyncMixin


class Users(Base, TimestampMixin, SyncMixin):
    """
    User/pengguna sistem
    """
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String(255), nullable=False)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(20))
    email = Column(String(100))
    alamat = Column(Text)
    is_aktif = Column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password: str):
        """Hash dan set password"""
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password: str) -> bool:
        """Verifikasi password"""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    @property
    def role_names(self) -> list:
        """Daftar nama role user"""
        return [ur.role.nama for ur in self.roles if ur.is_aktif and ur.role]

    @property
    def highest_role(self) -> 'Role | None':
        """Role dengan level tertinggi (angka terkecil)"""
        active_roles = [ur.role for ur in self.roles if ur.is_aktif and ur.role]
        if not active_roles:
            return None
        return min(active_roles, key=lambda r: r.level or 999)

    def has_permission(self, resource_kode: str, action: str) -> bool:
        """
        Cek apakah user punya permission untuk resource dan action tertentu
        action: 'view', 'create', 'edit', 'delete'
        """
        for user_role in self.roles:
            if not user_role.is_aktif or not user_role.role:
                continue
            for perm in user_role.role.permissions:
                if perm.resource and perm.resource.kode == resource_kode:
                    if action == 'view' and perm.can_view:
                        return True
                    elif action == 'create' and perm.can_create:
                        return True
                    elif action == 'edit' and perm.can_edit:
                        return True
                    elif action == 'delete' and perm.can_delete:
                        return True
        return False

    def to_dict(self, include_password: bool = False) -> dict:
        data = {
            'id': self.id,
            'nama': self.nama,
            'username': self.username,
            'phone': self.phone,
            'email': self.email,
            'alamat': self.alamat,
            'is_aktif': self.is_aktif,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sync_id': self.sync_id,
            'role_names': self.role_names,
        }
        if include_password:
            data['password_hash'] = self.password_hash
        return data

    def __repr__(self):
        return f"<Users(username='{self.username}', nama='{self.nama}')>"


class Role(Base, SyncMixin):
    """
    Role/peran dalam sistem
    """
    __tablename__ = 'role'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kode = Column(String(50), unique=True, nullable=False, index=True)
    nama = Column(String(100), nullable=False)
    level = Column(Integer, default=10)  # Semakin kecil = semakin tinggi

    # Relationships
    user_roles = relationship("UserRole", back_populates="role")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'kode': self.kode,
            'nama': self.nama,
            'level': self.level,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<Role(kode='{self.kode}', nama='{self.nama}')>"


class Resource(Base, SyncMixin):
    """
    Resource/menu dalam sistem
    """
    __tablename__ = 'resource'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kode = Column(String(50), unique=True, nullable=False, index=True)
    nama = Column(String(100), nullable=False)
    urutan = Column(Integer, default=0)
    is_aktif = Column(Boolean, default=True, nullable=False)

    # Relationships
    permissions = relationship("RolePermission", back_populates="resource")

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'kode': self.kode,
            'nama': self.nama,
            'urutan': self.urutan,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<Resource(kode='{self.kode}', nama='{self.nama}')>"


class RolePermission(Base, SyncMixin):
    """
    Permission role terhadap resource
    """
    __tablename__ = 'role_permission'

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey('role.id'), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey('resource.id'), nullable=False, index=True)

    can_view = Column(Boolean, default=False)
    can_create = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)

    # Relationships
    role = relationship("Role", back_populates="permissions")
    resource = relationship("Resource", back_populates="permissions")

    __table_args__ = (
        Index('idx_role_permission_unique', 'role_id', 'resource_id', unique=True),
    )

    @property
    def permission_summary(self) -> str:
        """Ringkasan permission dalam format string"""
        perms = []
        if self.can_view:
            perms.append('V')
        if self.can_create:
            perms.append('C')
        if self.can_edit:
            perms.append('E')
        if self.can_delete:
            perms.append('D')
        return ''.join(perms) or '-'

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'role_id': self.role_id,
            'resource_id': self.resource_id,
            'can_view': self.can_view,
            'can_create': self.can_create,
            'can_edit': self.can_edit,
            'can_delete': self.can_delete,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<RolePermission(role_id={self.role_id}, resource_id={self.resource_id}, perms='{self.permission_summary}')>"


class UserRole(Base, SyncMixin):
    """
    Mapping user ke role dengan scope wilayah
    """
    __tablename__ = 'user_role'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey('role.id'), nullable=False, index=True)
    wilayah_id = Column(Integer, ForeignKey('wilayah.id'), nullable=True)  # Scope wilayah
    is_aktif = Column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("Users", back_populates="roles")
    role = relationship("Role", back_populates="user_roles")
    wilayah = relationship("Wilayah")

    __table_args__ = (
        Index('idx_user_role_aktif', 'user_id', 'is_aktif'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'role_id': self.role_id,
            'wilayah_id': self.wilayah_id,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<UserRole(user_id={self.user_id}, role_id={self.role_id})>"
