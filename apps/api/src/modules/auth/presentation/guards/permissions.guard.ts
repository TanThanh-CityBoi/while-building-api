import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  hasAllPermissions,
  type Permission,
} from '../../domain/authorization/role-permissions.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';

/**
 * Global guard (runs after the AccessTokenGuard). Routes without @Permissions()
 * only need authentication; routes with it need every listed permission.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new UnauthorizedException();
    if (!hasAllPermissions(user.permissions, required)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }
    return true;
  }
}
