import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationRequiredError } from '../../application/errors/auth.errors.js';
import { AuthenticateAccessTokenUseCase } from '../../application/use-cases/authenticate-access-token.use-case.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Global guard: every route requires a valid `Authorization: Bearer` access
 * token unless it is marked @Public().
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticate: AuthenticateAccessTokenUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new AuthenticationRequiredError();
    }

    request.user = await this.authenticate.execute(token);
    return true;
  }
}
