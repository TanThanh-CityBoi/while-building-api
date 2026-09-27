import { ContentPermission } from '../../../content/domain/content-permission.js';
import { Role } from '../../../users/domain/role.js';
import { UserPermission } from '../../../users/domain/user-permission.js';

/** Every permission. Each bounded context owns its own set. */
export type Permission = UserPermission | ContentPermission;

export const ALL_PERMISSIONS: readonly Permission[] = [
  ...Object.values(UserPermission),
  ...Object.values(ContentPermission),
];

/**
 * The authorization policy: which role grants which permissions. A static
 * table for now; the single place to change what a role may do.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [Role.ROOT]: ALL_PERMISSIONS,
  [Role.ADMIN]: ALL_PERMISSIONS,
  [Role.EDITOR]: [
    ContentPermission.CONTENT_READ,
    ContentPermission.CONTENT_CREATE,
    ContentPermission.CONTENT_UPDATE,
    ContentPermission.CONTENT_PUBLISH,
  ],
  [Role.AUTHOR]: [
    ContentPermission.CONTENT_READ,
    ContentPermission.CONTENT_CREATE,
    ContentPermission.CONTENT_UPDATE,
  ],
};

export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasAllPermissions(
  granted: readonly Permission[],
  required: readonly Permission[],
): boolean {
  return required.every((permission) => granted.includes(permission));
}
