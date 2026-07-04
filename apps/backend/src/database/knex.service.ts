import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

@Injectable()
export class KnexService implements OnModuleDestroy {
  private readonly db: Knex;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.getOrThrow<string>('DATABASE_URL');
    const dbSsl = this.configService.get<boolean>('DB_SSL', true);
    const poolMin = Number(this.configService.get<string>('DB_POOL_MIN') ?? 0);
    const poolMax = Number(this.configService.get<string>('DB_POOL_MAX') ?? 10);

    this.db = knex({
      client: 'pg',
      connection: {
        connectionString: databaseUrl,
        ssl: dbSsl
          ? {
              rejectUnauthorized: false,
            }
          : false,
      },
      pool: {
        min: poolMin,
        max: poolMax,
        idleTimeoutMillis: 30000,
      },
      acquireConnectionTimeout: 60000,
    });
  }

  get connection(): Knex {
    return this.db;
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }
}
