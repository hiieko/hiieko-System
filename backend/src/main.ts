import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'crypto';
import helmet from 'helmet';
import { PrismaService } from './common/prisma/prisma.service';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { assertJwtSecretStrength } from './common/config/env-security';

/** Same-site local development origins, used only when CORS_ORIGIN is unset. */
const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:19006'];

/**
 * Slice 2 (L4) — turns `CORS_ORIGIN` (comma-separated) into the CORS allowlist.
 *
 * An explicit list is required because credentialed requests (`credentials: true`) can
 * never be combined with a `*` origin. Requests from an origin outside the list simply
 * receive no `Access-Control-Allow-Origin` header and are blocked by the browser; native
 * clients that send no Origin header are not affected.
 */
export function parseCorsOrigins(raw?: string): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Phase 0.5 (Item 2): fail fast on a missing/placeholder/too-short JWT_SECRET in
  // production, before any request can be served.
  assertJwtSecretStrength();

  const app = await NestFactory.create(AppModule);
  const prisma = app.get(PrismaService);

  // Phase 0.5 (Item 3): baseline security headers (X-Content-Type-Options: nosniff,
  // X-Frame-Options: DENY, HSTS, Referrer-Policy, and a CSP). Applied before every route
  // — including /health/* — so all responses carry them and `X-Powered-By` is removed.
  // The CSP is intentionally permissive enough for the Swagger UI at /api/docs (inline
  // scripts/styles) and for Google Fonts; the goal is a solid scanner score, not a
  // locked-down browser app.
  const connectSources = Array.from(
    new Set(["'self'", ...parseCorsOrigins(process.env.CORS_ORIGIN)]),
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: connectSources,
        },
      },
      // CORS is handled by enableCors() below; leave CORP permissive so the SPA on
      // another origin can embed API-served images (e.g. receipt blobs).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
    }),
  );

  // Permissions-Policy has no helmet option; set it explicitly.
  app.use((_req: any, res: any, next: any) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), geolocation=(self), microphone=()',
    );
    next();
  });

  // Operational endpoints intentionally bypass application auth so load balancers and
  // orchestrators can distinguish a live process from a ready database-backed process.
  const httpServer = app.getHttpAdapter().getInstance();
  httpServer.get('/health/live', (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', service: 'hiieko-api' });
  });
  httpServer.get('/health/ready', async (_req: any, res: any) => {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      res.status(200).json({ status: 'ready', service: 'hiieko-api', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'not_ready', service: 'hiieko-api', database: 'unavailable' });
    }
  });

  // Structured access logs: no request bodies, cookies, authorization headers, or query values.
  app.use((req: any, res: any, next: any) => {
    const requestId = req.header('x-request-id') || randomUUID();
    const startedAt = Date.now();
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      logger.log(JSON.stringify({
        type: 'http_request',
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      }));
    });
    next();
  });

  // Slice 2 (L4): credentialed requests are now part of the contract (the httpOnly
  // `hiieko_rt` refresh cookie), and `Access-Control-Allow-Origin: *` is ILLEGAL together
  // with `credentials: true`. CORS therefore switches to an explicit allowlist taken from
  // CORS_ORIGIN (comma-separated). Non-browser clients (the frozen Mobile app) send no
  // Origin header and are unaffected.
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    // P4.4 (D2): Mobile's offline queue sends its replay key as the `Idempotency-Key` header
    // (Mobile/src/services/apiClient.ts). A browser pre-flight would otherwise reject it, so
    // the header is part of the allowed CORS contract from now on.
    allowedHeaders: 'Content-Type, Accept, Authorization, Idempotency-Key',
  });

  logger.log(`CORS allowlist: ${allowedOrigins.join(', ')}`);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Global exception filter and response envelope interceptor
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(new Reflector()));

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('HIIEKO Solar Site Management API')
    .setDescription('Central NestJS REST API for HIIEKO Solar EPC Management System (Web & Mobile)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port,'0.0.0.0');
  logger.log(`HIIEKO Backend API running on http://localhost:${port}`);
  logger.log(`Swagger OpenAPI docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
