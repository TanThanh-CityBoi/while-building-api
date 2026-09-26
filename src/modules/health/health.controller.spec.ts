import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const query = vi.fn();
  let controller: HealthController;

  beforeEach(async () => {
    query.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DataSource, useValue: { query } }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('reports ok when the database responds', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('throws 503 and logs when the database is unreachable', async () => {
    query.mockRejectedValue(new Error('connection refused'));
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const error: unknown = await controller.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      status: 'error',
      database: 'down',
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('connection refused'),
    );

    warn.mockRestore();
  });
});
