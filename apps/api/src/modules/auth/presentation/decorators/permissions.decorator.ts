import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../../domain/authorization/role-permissions.js';

export const PERMISSIONS_KEY = 'auth:permissions';

/**
 * Requires the signed-in user to hold *all* of the given permissions.
 * Enforced by the global PermissionsGuard.
 *
 * @example
 * @Permissions(UserPermission.USERS_READ)
 * @Get()
 * list() {}
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
