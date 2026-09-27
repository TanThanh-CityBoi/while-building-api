import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';

/**
 * Integration app: will hold third-party integrations (OAuth, external APIs,
 * payment and cloud providers). Only the application shell exists so far — no
 * providers, queues or database.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  controllers: [HealthController],
})
export class AppModule {}
