import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  AuthorDirectory,
  type Author,
} from '../../application/ports/author-directory.js';

/**
 * Reads author names straight from the `users` table: a read-only query, so
 * the content context needs nothing from the users module's code.
 */
@Injectable()
export class TypeOrmAuthorDirectory extends AuthorDirectory {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async findByIds(ids: readonly string[]): Promise<Map<string, Author>> {
    if (ids.length === 0) return new Map();
    const rows: Author[] = await this.dataSource.query(
      'SELECT "id", "name" FROM "users" WHERE "id" = ANY($1::uuid[])',
      [ids],
    );
    return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name }]));
  }
}
