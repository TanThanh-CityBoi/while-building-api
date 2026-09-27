import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../application/dto/authenticated-user.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

/** Injects the signed-in user (id, email, name, role, permissions). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      // Only reachable on a @Public() route — a programming error.
      throw new UnauthorizedException();
    }
    return request.user;
  },
);
