import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';
import {
  trimAndLowercase,
  trimString,
} from '../../../../shared/validation/transformers.js';
import { ASSIGNABLE_ROLES, type AssignableRole } from '../../domain/role.js';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ROLE_MESSAGE,
  USER_NAME_MAX_LENGTH,
} from './user-fields.js';

export class CreateUserDto {
  @Transform(trimAndLowercase)
  @IsEmail({}, { message: EMAIL_MESSAGE })
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @Transform(trimString)
  @IsString()
  @Length(1, USER_NAME_MAX_LENGTH)
  name!: string;

  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  password!: string;

  /** ROOT cannot be assigned. */
  @IsIn(ASSIGNABLE_ROLES, { message: ROLE_MESSAGE })
  role!: AssignableRole;
}
