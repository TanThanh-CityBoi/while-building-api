import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from '../../../../shared/validation/transformers.js';
import { ASSIGNABLE_ROLES, type AssignableRole } from '../../domain/role.js';
import { UserStatus } from '../../domain/user-status.js';
import { ROLE_MESSAGE, STATUS_MESSAGE } from './user-fields.js';

export class ListUsersQueryDto {
  /** 1-based page number. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  /** Matches name or email (case-insensitive). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES, { message: ROLE_MESSAGE })
  role?: AssignableRole;

  @IsOptional()
  @IsEnum(UserStatus, { message: STATUS_MESSAGE })
  status?: UserStatus;
}
