import { Module } from '@nestjs/common';
import { ApiAuthGuard } from './api-auth.guard.js';
import { AuthApi } from './auth-api.js';
import { HttpAuthApi } from './http-auth-api.js';

@Module({
  providers: [{ provide: AuthApi, useClass: HttpAuthApi }, ApiAuthGuard],
  exports: [AuthApi, ApiAuthGuard],
})
export class AuthModule {}
