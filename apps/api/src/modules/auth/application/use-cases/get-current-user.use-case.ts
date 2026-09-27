import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../../users/domain/repositories/user.repository.js';
import { toAuthUserView, type AuthUserView } from '../dto/auth-user.view.js';
import { AuthenticationRequiredError } from '../errors/auth.errors.js';

/** The signed-in user and their permissions (`GET /auth/me`). */
@Injectable()
export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<AuthUserView> {
    const user = await this.users.findById(userId);
    if (!user?.canLogin()) throw new AuthenticationRequiredError();
    return toAuthUserView(user);
  }
}
