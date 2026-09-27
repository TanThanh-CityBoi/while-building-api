import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';

/**
 * Notification app: will deliver notifications (email and others) on behalf of
 * the other apps. Only the application shell exists so far — no providers,
 * queues or database.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  controllers: [HealthController],
})
export class AppModule {}
