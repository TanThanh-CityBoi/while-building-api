import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordHasher } from './application/ports/password-hasher.js';
import { BootstrapRootUserUseCase } from './application/use-cases/bootstrap-root-user.use-case.js';
import { ChangeUserStatusUseCase } from './application/use-cases/change-user-status.use-case.js';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case.js';
import { GetUserUseCase } from './application/use-cases/get-user.use-case.js';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case.js';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case.js';
import { UserRepository } from './domain/repositories/user.repository.js';
import { UserOrmEntity } from './infrastructure/persistence/user.orm-entity.js';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm-user.repository.js';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher.js';
import { UsersController } from './presentation/controllers/users.controller.js';

/**
 * Users bounded context: accounts, roles, status and credentials. It does not
 * depend on the auth context (auth depends on it) — route authorization only
 * uses auth's decorators, enforced by auth's global guards.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UsersController],
  providers: [
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    ListUsersUseCase,
    GetUserUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    ChangeUserStatusUseCase,
    DeleteUserUseCase,
    BootstrapRootUserUseCase,
  ],
  // Used by the auth context to sign users in.
  exports: [UserRepository, PasswordHasher],
})
export class UsersModule {}
