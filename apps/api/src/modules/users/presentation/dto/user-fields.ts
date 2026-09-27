// Request limits shared by the user DTOs. The name and email limits come from the
// domain; the password policy is enforced here, at the edge (the domain never sees passwords).
export { USER_NAME_MAX_LENGTH } from '../../domain/entities/user.js';
export { EMAIL_MAX_LENGTH } from '../../domain/value-objects/email.js';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const ROLE_MESSAGE = 'role must be one of: ADMIN, EDITOR, AUTHOR';
export const STATUS_MESSAGE = 'status must be one of: ACTIVE, DISABLED';
export const EMAIL_MESSAGE = 'email must be a valid email address';
