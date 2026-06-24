import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseController } from './database.controller';
import { DATABASE_ENTITIES } from './entities';
import { DatabaseSeedService } from './database-seed.service';
import { DatabaseService } from './database.service';
import { GoogleAdsAccountRegistryService } from './google-ads-account-registry.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL?.trim();
        if (!databaseUrl) throw new Error('Missing DATABASE_URL in backend/.env');

        return {
          type: 'postgres' as const,
          url: databaseUrl,
          entities: DATABASE_ENTITIES,
          synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
          migrationsRun: false,
          logging: process.env.DATABASE_LOGGING === 'true',
          ssl:
            process.env.DATABASE_SSL === 'true'
              ? { rejectUnauthorized: false }
              : false,
          extra: {
            max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
            connectionTimeoutMillis: 5_000,
            idleTimeoutMillis: 30_000,
          },
        };
      },
    }),
  ],
  controllers: [DatabaseController],
  providers: [DatabaseService, DatabaseSeedService, GoogleAdsAccountRegistryService],
  exports: [DatabaseService, GoogleAdsAccountRegistryService],
})
export class DatabaseModule {}
