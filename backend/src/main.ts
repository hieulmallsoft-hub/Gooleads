import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

type HttpRequest = {
  ip?: string;
  method?: string;
  originalUrl?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
};

type HttpResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): HttpResponse;
  json(body: unknown): void;
};

function securityHeaders(_request: HttpRequest, response: HttpResponse, next: () => void) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    response.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }
  next();
}

function createRateLimiter() {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (request: HttpRequest, response: HttpResponse, next: () => void) => {
    const path = request.originalUrl?.split('?')[0] ?? '';
    const rule = path.endsWith('/auth/login')
      ? { name: 'login', limit: 5, windowMs: 15 * 60_000 }
      : /\/ai-|\/automation\/run|\/assets\/replace|\/sync\/batch/.test(path)
        ? { name: 'mutation', limit: 20, windowMs: 60_000 }
        : null;
    if (!rule) {
      next();
      return;
    }

    const forwarded = process.env.TRUST_PROXY === 'true'
      ? String(request.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()
      : '';
    const client = forwarded || request.ip || request.socket?.remoteAddress || 'unknown';
    const key = `${rule.name}:${client}`;
    const now = Date.now();
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + rule.windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.setHeader('RateLimit-Limit', String(rule.limit));
    response.setHeader('RateLimit-Remaining', String(Math.max(rule.limit - bucket.count, 0)));
    response.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > rule.limit) {
      response.status(429).json({
        statusCode: 429,
        message: 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.',
      });
      return;
    }
    next();
  };
}

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

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.enableShutdownHooks();
  if (process.env.TRUST_PROXY === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.use(securityHeaders);
  app.use(createRateLimiter());
  app.useBodyParser('json', { limit: process.env.JSON_BODY_LIMIT ?? '1mb' });
  app.useBodyParser('urlencoded', {
    limit: process.env.FORM_BODY_LIMIT ?? '1mb',
    extended: true,
  });
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
