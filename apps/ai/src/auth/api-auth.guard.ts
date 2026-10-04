import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthApi, AuthApiUnavailableError } from './auth-api.js';
import {
  REQUIRED_PERMISSION,
  type AuthenticatedRequest,
} from './authenticated-user.js';

/**
 * Requires the CMS's `Authorization: Bearer <access token>`, checked by the
 * API itself (every request, so logout and role changes apply at once), and
 * the CONTENT_READ permission. Sets `request.user` for later guards (rate limiting).
 */
@Injectable()
export class ApiAuthGuard implements CanActivate {
  private readonly logger = new Logger(ApiAuthGuard.name);

  constructor(private readonly auth: AuthApi) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Sign in to use the assistant.');
    }

    let user;
    try {
      user = await this.auth.currentUser(token);
    } catch (error) {
      if (!(error instanceof AuthApiUnavailableError)) throw error;
      this.logger.warn(`Cannot authenticate: ${error.message}`);
      throw new ServiceUnavailableException(
        'The assistant is unavailable right now. Try again later.',
      );
    }

    if (!user) {
      throw new UnauthorizedException(
        'Your session has expired. Sign in again.',
      );
    }
    if (!user.permissions.includes(REQUIRED_PERMISSION)) {
      throw new ForbiddenException(
        'You do not have permission to use the assistant.',
      );
    }
    request.user = user;
    return true;
  }
}
