import { describe, expect, it } from 'vitest';
import { buildPostgresOptions } from './postgres-options.js';

class ExampleEntity {}
class ExampleMigration1700000000000 {}

describe('buildPostgresOptions', () => {
  const options = buildPostgresOptions(
    {
      DATABASE_HOST: 'db',
      DATABASE_PORT: 5433,
      DATABASE_USER: 'app',
      DATABASE_PASSWORD: 'secret',
      DATABASE_NAME: 'while_building',
    },
    { entities: [ExampleEntity], migrations: [ExampleMigration1700000000000] },
  );

  it('connects with the DATABASE_* settings and the schema it is given', () => {
    expect(options).toMatchObject({
      type: 'postgres',
      host: 'db',
      port: 5433,
      username: 'app',
      password: 'secret',
      database: 'while_building',
      entities: [ExampleEntity],
      migrations: [ExampleMigration1700000000000],
    });
  });

  it('never changes the schema on its own', () => {
    expect(options).toMatchObject({
      synchronize: false,
      migrationsRun: false,
      installExtensions: false,
      uuidExtension: 'pgcrypto',
    });
  });
});
