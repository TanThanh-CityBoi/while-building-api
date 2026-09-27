import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    // Bounded contexts. AuthModule also registers the global AccessTokenGuard and
    // PermissionsGuard: every route requires authentication unless marked @Public().
    UsersModule,
    AuthModule,
    ContentModule,
    HealthModule,
  ],
})
export class AppModule {}
