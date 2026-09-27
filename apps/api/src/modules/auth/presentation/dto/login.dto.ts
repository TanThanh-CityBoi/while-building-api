import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimAndLowercase } from '../../../../shared/validation/transformers.js';
import { EMAIL_MAX_LENGTH } from '../../../users/domain/value-objects/email.js';

export class LoginDto {
  @Transform(trimAndLowercase)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  // Capped so password hashing can't be abused with huge inputs.
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
