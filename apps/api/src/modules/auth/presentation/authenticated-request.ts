import type { Request } from 'express';
import type { AuthenticatedUser } from '../application/dto/authenticated-user.js';

/** An Express request after the AccessTokenGuard has authenticated it. */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
