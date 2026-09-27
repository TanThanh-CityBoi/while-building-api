import {
  ALL_PERMISSIONS,
  type Permission,
} from '../../domain/authorization/role-permissions.js';
import { Role } from '../../../users/domain/role.js';
import { ApiProperty } from '@nestjs/swagger';

/** The signed-in user as returned to clients (no secrets, no internals). */
export class AuthUserDto {
  id!: string;
  email!: string;
  name!: string;
  role!: Role;
  /** Derived from the role on the server; clients use it for UX only. */
  @ApiProperty({ enum: ALL_PERMISSIONS, isArray: true })
  permissions!: Permission[];
}

export class AuthUserResponseDto {
  data!: AuthUserDto;
}

export class TokenResponseDto {
  /** Short-lived JWT for `Authorization: Bearer`. Keep it in memory only. */
  accessToken!: string;
  /** Access-token lifetime in seconds. */
  expiresIn!: number;
}

export class LoginResponseDto extends TokenResponseDto {
  user!: AuthUserDto;
}
