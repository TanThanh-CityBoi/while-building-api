import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';

/**
 * Webhook app: will receive inbound webhooks from external providers, verify
 * them and hand them on for processing. Only the application shell exists so
 * far — no providers, queues or database.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  controllers: [HealthController],
})
export class AppModule {}
