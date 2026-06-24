import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly connectionUrl: URL;

  constructor(private readonly dataSource: DataSource) {
    const databaseUrl = process.env.DATABASE_URL?.trim();

    if (!databaseUrl) {
      throw new Error('Missing DATABASE_URL in backend/.env');
    }

    this.connectionUrl = new URL(databaseUrl);
  }

  async onModuleInit() {
    const rows = await this.dataSource.query<{
      database: string;
      username: string;
    }[]>('SELECT current_database() AS database, current_user AS username');
    const connection = rows[0];
    const port = this.connectionUrl.port || '5432';

    this.logger.log(
      `Connected to PostgreSQL database "${connection.database}" as "${connection.username}" at ${this.connectionUrl.hostname}:${port}`,
    );
  }

  query<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
    return this.dataSource.query<T[]>(text, values);
  }

  async getHealth() {
    const rows = await this.query<{
      database: string;
      checkedAt: Date;
    }>('SELECT current_database() AS database, NOW() AS "checkedAt"');

    return {
      status: 'ok',
      entities: this.dataSource.entityMetadatas.length,
      ...rows[0],
    };
  }

  onModuleDestroy() {
    this.logger.log('PostgreSQL connection pool closed');
  }
}
