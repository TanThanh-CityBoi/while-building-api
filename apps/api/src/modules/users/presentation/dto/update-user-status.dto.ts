import { IsEnum } from 'class-validator';
import { UserStatus } from '../../domain/user-status.js';
import { STATUS_MESSAGE } from './user-fields.js';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, { message: STATUS_MESSAGE })
  status!: UserStatus;
}
