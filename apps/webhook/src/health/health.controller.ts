import { Controller, Get } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
}

// Liveness/readiness probe.
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
