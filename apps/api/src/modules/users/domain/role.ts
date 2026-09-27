export enum Role {
  /** System account created by the seed; never managed through the users API. */
  ROOT = 'ROOT',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  AUTHOR = 'AUTHOR',
}

/** Roles that user management may assign. ROOT is never assignable. */
export const ASSIGNABLE_ROLES = [Role.ADMIN, Role.EDITOR, Role.AUTHOR] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(role: Role): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly Role[]).includes(role);
}
