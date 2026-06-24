import { NestFactory } from '@nestjs/core';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function bootstrap() {
  loadLocalEnv();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
