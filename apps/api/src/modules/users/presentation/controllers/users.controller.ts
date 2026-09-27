import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../auth/application/dto/authenticated-user.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Permissions } from '../../../auth/presentation/decorators/permissions.decorator.js';
import { ChangeUserStatusUseCase } from '../../application/use-cases/change-user-status.use-case.js';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case.js';
import { DeleteUserUseCase } from '../../application/use-cases/delete-user.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case.js';
import { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case.js';
import { UserPermission } from '../../domain/user-permission.js';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { ListUsersQueryDto } from '../dto/list-users-query.dto.js';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto.js';
import { UpdateUserDto } from '../dto/update-user.dto.js';
import {
  UserListResponseDto,
  UserResponseDto,
} from '../dto/user-response.dto.js';

const UserId = () => Param('id', new ParseUUIDPipe());

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in.' })
@ApiForbiddenResponse({ description: 'Missing permission.' })
@Controller('users')
export class UsersController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly changeUserStatus: ChangeUserStatusUseCase,
    private readonly deleteUser: DeleteUserUseCase,
  ) {}

  /** Lists users (never ROOT), newest first. */
  @Get()
  @Permissions(UserPermission.USERS_READ)
  async list(@Query() query: ListUsersQueryDto): Promise<UserListResponseDto> {
    const { users, ...meta } = await this.listUsers.execute(query);
    return { data: users, meta };
  }

  @Get(':id')
  @Permissions(UserPermission.USERS_READ)
  @ApiNotFoundResponse({ description: 'No such (manageable) user.' })
  async get(@UserId() id: string): Promise<UserResponseDto> {
    return { data: await this.getUser.execute(id) };
  }

  @Post()
  @Permissions(UserPermission.USERS_CREATE)
  @ApiConflictResponse({ description: 'Email already in use.' })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return { data: await this.createUser.execute(dto) };
  }

  /** Updates name, email, role and/or resets the password. */
  @Patch(':id')
  @Permissions(UserPermission.USERS_UPDATE)
  @ApiNotFoundResponse({ description: 'No such (manageable) user.' })
  @ApiConflictResponse({ description: 'Email already in use.' })
  async update(
    @UserId() id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return {
      data: await this.updateUser.execute({ ...dto, id, actorId: actor.id }),
    };
  }

  /** Enables or disables an account. Disabling ends its sessions. */
  @Patch(':id/status')
  @Permissions(UserPermission.USERS_UPDATE)
  @ApiNotFoundResponse({ description: 'No such (manageable) user.' })
  async updateStatus(
    @UserId() id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return {
      data: await this.changeUserStatus.execute({
        id,
        actorId: actor.id,
        status: dto.status,
      }),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(UserPermission.USERS_DELETE)
  @ApiNotFoundResponse({ description: 'No such (manageable) user.' })
  remove(
    @UserId() id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.deleteUser.execute({ id, actorId: actor.id });
  }
}
