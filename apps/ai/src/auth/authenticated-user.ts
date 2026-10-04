import type { Request } from 'express';

/** The signed-in CMS user, as returned by the API's GET /auth/me. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/** Using the assistant means reading content, so it needs CONTENT_READ (every role has it). */
export const REQUIRED_PERMISSION = 'CONTENT_READ';
