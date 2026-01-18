"""
User Service - Business logic untuk user dan autentikasi
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime

from database.models import Users, Role, UserRole, Resource, RolePermission
from .base_service import BaseService


class UserService(BaseService[Users]):
    """
    Service untuk mengelola user dan autentikasi
    """

    def __init__(self, session: Session):
        super().__init__(session, Users)
        self._current_user: Optional[Users] = None

    @property
    def current_user(self) -> Optional[Users]:
        """Get current logged in user"""
        return self._current_user

    def login(self, username: str, password: str) -> Optional[Users]:
        """
        Authenticate user
        Returns: User object if success, None if failed
        """
        user = self.session.query(Users).filter(
            Users.username == username,
            Users.is_aktif == True
        ).first()

        if user and user.check_password(password):
            self._current_user = user
            return user

        return None

    def logout(self):
        """Logout current user"""
        self._current_user = None

    def is_authenticated(self) -> bool:
        """Check if user is logged in"""
        return self._current_user is not None

    def create_user(
        self,
        username: str,
        password: str,
        nama: str,
        role_kode: str = 'viewer',
        wilayah_id: int = None,
        **kwargs
    ) -> Users:
        """Create new user with role"""
        # Check username uniqueness
        existing = self.session.query(Users).filter(
            Users.username == username
        ).first()
        if existing:
            raise ValueError(f"Username '{username}' sudah digunakan")

        # Create user
        user = Users(
            username=username,
            nama=nama,
            **kwargs
        )
        user.set_password(password)
        self.session.add(user)
        self.session.flush()

        # Assign role
        role = self.session.query(Role).filter(Role.kode == role_kode).first()
        if role:
            user_role = UserRole(
                user_id=user.id,
                role_id=role.id,
                wilayah_id=wilayah_id,
                is_aktif=True
            )
            self.session.add(user_role)

        self.session.flush()
        return user

    def change_password(
        self,
        user_id: int,
        old_password: str,
        new_password: str
    ) -> bool:
        """Change user password"""
        user = self.get_by_id(user_id)
        if not user:
            return False

        if not user.check_password(old_password):
            return False

        user.set_password(new_password)
        self.session.flush()
        return True

    def reset_password(self, user_id: int, new_password: str) -> bool:
        """Reset password (admin only)"""
        user = self.get_by_id(user_id)
        if not user:
            return False

        user.set_password(new_password)
        self.session.flush()
        return True

    def has_permission(
        self,
        user_id: int,
        resource_kode: str,
        action: str
    ) -> bool:
        """Check if user has permission for action on resource"""
        user = self.get_by_id(user_id)
        if not user:
            return False
        return user.has_permission(resource_kode, action)

    def get_user_permissions(self, user_id: int) -> Dict[str, Dict[str, bool]]:
        """Get all permissions for user"""
        user = self.get_by_id(user_id)
        if not user:
            return {}

        permissions = {}
        for resource in self.session.query(Resource).filter(Resource.is_aktif == True).all():
            permissions[resource.kode] = {
                'view': user.has_permission(resource.kode, 'view'),
                'create': user.has_permission(resource.kode, 'create'),
                'edit': user.has_permission(resource.kode, 'edit'),
                'delete': user.has_permission(resource.kode, 'delete'),
            }
        return permissions

    def assign_role(
        self,
        user_id: int,
        role_kode: str,
        wilayah_id: int = None
    ) -> UserRole:
        """Assign role to user"""
        role = self.session.query(Role).filter(Role.kode == role_kode).first()
        if not role:
            raise ValueError(f"Role '{role_kode}' tidak ditemukan")

        # Check if already assigned
        existing = self.session.query(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role.id
        ).first()

        if existing:
            existing.is_aktif = True
            existing.wilayah_id = wilayah_id
            return existing

        user_role = UserRole(
            user_id=user_id,
            role_id=role.id,
            wilayah_id=wilayah_id,
            is_aktif=True
        )
        self.session.add(user_role)
        self.session.flush()
        return user_role

    def remove_role(self, user_id: int, role_kode: str) -> bool:
        """Remove role from user"""
        role = self.session.query(Role).filter(Role.kode == role_kode).first()
        if not role:
            return False

        user_role = self.session.query(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role.id
        ).first()

        if user_role:
            user_role.is_aktif = False
            self.session.flush()
            return True

        return False

    def get_all_active(self) -> List[Users]:
        """Get all active users"""
        return self.session.query(Users).filter(
            Users.is_aktif == True
        ).order_by(Users.nama).all()

    def get_by_role(self, role_kode: str) -> List[Users]:
        """Get users by role"""
        return self.session.query(Users).join(
            UserRole, Users.id == UserRole.user_id
        ).join(
            Role, UserRole.role_id == Role.id
        ).filter(
            Role.kode == role_kode,
            Users.is_aktif == True,
            UserRole.is_aktif == True
        ).order_by(Users.nama).all()


class RoleService(BaseService[Role]):
    """
    Service untuk mengelola role
    """

    def __init__(self, session: Session):
        super().__init__(session, Role)

    def get_all_ordered(self) -> List[Role]:
        """Get all roles ordered by level"""
        return self.session.query(Role).order_by(Role.level).all()

    def get_by_kode(self, kode: str) -> Optional[Role]:
        """Get role by kode"""
        return self.session.query(Role).filter(Role.kode == kode).first()

    def set_permissions(
        self,
        role_id: int,
        permissions: Dict[str, Dict[str, bool]]
    ):
        """
        Set permissions for role
        permissions: {'resource_kode': {'view': True, 'create': False, ...}, ...}
        """
        for resource_kode, perms in permissions.items():
            resource = self.session.query(Resource).filter(
                Resource.kode == resource_kode
            ).first()
            if not resource:
                continue

            # Get or create permission
            rp = self.session.query(RolePermission).filter(
                RolePermission.role_id == role_id,
                RolePermission.resource_id == resource.id
            ).first()

            if rp:
                rp.can_view = perms.get('view', False)
                rp.can_create = perms.get('create', False)
                rp.can_edit = perms.get('edit', False)
                rp.can_delete = perms.get('delete', False)
            else:
                rp = RolePermission(
                    role_id=role_id,
                    resource_id=resource.id,
                    can_view=perms.get('view', False),
                    can_create=perms.get('create', False),
                    can_edit=perms.get('edit', False),
                    can_delete=perms.get('delete', False),
                )
                self.session.add(rp)

        self.session.flush()
