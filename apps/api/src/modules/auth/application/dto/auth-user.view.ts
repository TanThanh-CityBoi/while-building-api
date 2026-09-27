import type { User } from '../../../users/domain/entities/user.js';
import type { Role } from '../../../users/domain/role.js';
import {
  permissionsForRole,
  type Permission,
} from '../../domain/authorization/role-permissions.js';

/** The signed-in user as clients see it (`GET /auth/me`). No secrets. */
export interface AuthUserView {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Derived from the role; clients use them for UX only. */
  permissions: Permission[];
}

export function toAuthUserView(user: User): AuthUserView {
  return {
    id: user.id,
    email: user.email.value,
    name: user.name,
    role: user.role,
    permissions: permissionsForRole(user.role),
  };
}
