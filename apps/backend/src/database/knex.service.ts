import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { type Knex } from 'knex';

@Injectable()
export class KnexService implements OnModuleDestroy {
  private readonly db: Knex;

  constructor(private readonly configService: ConfigService) {
    this.db = knex({
      client: 'pg',
      connection: this.configService.getOrThrow<string>('DATABASE_URL'),
    });
  }

  get connection(): Knex {
    return this.db;
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }
}
