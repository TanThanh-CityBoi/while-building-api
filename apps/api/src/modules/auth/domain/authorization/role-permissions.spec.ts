import { describe, expect, it } from 'vitest';
import { ContentPermission } from '../../../content/domain/content-permission.js';
import { Role } from '../../../users/domain/role.js';
import { UserPermission } from '../../../users/domain/user-permission.js';
import {
  ALL_PERMISSIONS,
  hasAllPermissions,
  permissionsForRole,
} from './role-permissions.js';

describe('role → permission policy', () => {
  it('lists every permission, users first, then content', () => {
    expect(ALL_PERMISSIONS).toEqual([
      'USERS_READ',
      'USERS_CREATE',
      'USERS_UPDATE',
      'USERS_DELETE',
      'CONTENT_READ',
      'CONTENT_CREATE',
      'CONTENT_UPDATE',
      'CONTENT_DELETE',
      'CONTENT_PUBLISH',
    ]);
  });

  it('gives ROOT and ADMIN every permission', () => {
    expect(permissionsForRole(Role.ROOT)).toEqual(ALL_PERMISSIONS);
    expect(permissionsForRole(Role.ADMIN)).toEqual(ALL_PERMISSIONS);
  });

  it('lets EDITOR work on and publish content, but not manage users', () => {
    expect(permissionsForRole(Role.EDITOR)).toEqual([
      ContentPermission.CONTENT_READ,
      ContentPermission.CONTENT_CREATE,
      ContentPermission.CONTENT_UPDATE,
      ContentPermission.CONTENT_PUBLISH,
    ]);
  });

  it('lets AUTHOR write content, but not publish or delete it', () => {
    expect(permissionsForRole(Role.AUTHOR)).toEqual([
      ContentPermission.CONTENT_READ,
      ContentPermission.CONTENT_CREATE,
      ContentPermission.CONTENT_UPDATE,
    ]);
  });

  it('returns a copy callers cannot use to change the policy', () => {
    permissionsForRole(Role.AUTHOR).push(UserPermission.USERS_DELETE);
    expect(permissionsForRole(Role.AUTHOR)).not.toContain(
      UserPermission.USERS_DELETE,
    );
  });

  it('checks that every required permission is granted', () => {
    const editor = permissionsForRole(Role.EDITOR);
    expect(hasAllPermissions(editor, [ContentPermission.CONTENT_PUBLISH])).toBe(
      true,
    );
    expect(
      hasAllPermissions(editor, [
        ContentPermission.CONTENT_PUBLISH,
        ContentPermission.CONTENT_DELETE,
      ]),
    ).toBe(false);
  });
});
