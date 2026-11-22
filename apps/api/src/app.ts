import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { isAppError, NotFoundError } from '@archboard/shared/errors';
import type { Logger } from '@archboard/shared/logger';
import { boardRoutes, type BoardRouteDeps } from './boards/routes.ts';

/** A named dependency check for the readiness probe (e.g. the database). */
export type HealthCheck = () => Promise<void>;

export interface AppDeps {
  logger: Logger;
  checks: Record<string, HealthCheck>;
  trustProxy?: number;
  version?: string;
  /** Board storage. Omitted in tests that only cover health checks. */
  boards?: Omit<BoardRouteDeps, 'logger'>;
}

const READY_TIMEOUT_MS = 2000;

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/**
 * Build the Express app: health checks and the board API (routes → store).
 * Kept free of process-level side effects so tests can create as many apps as they like.
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.trustProxy ?? 1);

  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/health') ?? false },
    }),
  );
  app.use(helmet());
  app.use(express.json({ limit: '256kb' }));

  /** Liveness: the process is up and serving. */
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: deps.version ?? 'dev' });
  });

  /** Readiness: every dependency answers within 2 s (UptimeHQ monitors this). */
  app.get('/api/health/ready', (async (_req, res) => {
    const results = await Promise.all(
      Object.entries(deps.checks).map(async ([name, check]) => {
        try {
          await withTimeout(check(), READY_TIMEOUT_MS);
          return [name, 'ok'] as const;
        } catch (err) {
          deps.logger.warn({ err, check: name }, 'readiness check failed');
          return [name, 'fail'] as const;
        }
      }),
    );
    const ok = results.every(([, s]) => s === 'ok');
    res
      .status(ok ? 200 : 503)
      .json({ status: ok ? 'ok' : 'degraded', checks: Object.fromEntries(results) });
  }) as RequestHandler);

  if (deps.boards) app.use('/api', boardRoutes({ ...deps.boards, logger: deps.logger }));

  app.use('/api', (_req, _res, next) => next(new NotFoundError('Endpoint')));

  app.use(errorHandler(deps.logger));
  return app;
}

/** Central error handler: AppError → RFC 9457 problem+json; anything else → generic 500. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    const requestId = String(req.id ?? '');
    // Body-parser errors (malformed JSON, too large) carry a status.
    const parserStatus =
      typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
        ? err.status
        : undefined;

    if (isAppError(err)) {
      if (err.status >= 500) logger.error({ err, requestId }, 'request failed');
      res
        .status(err.status)
        .type('application/problem+json')
        .json({
          type: 'about:blank',
          title: err.expose ? err.message : 'Something went wrong on our side.',
          status: err.status,
          code: err.code,
          ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
          requestId,
        });
      return;
    }
    if (parserStatus === 400 || parserStatus === 413) {
      res
        .status(parserStatus)
        .type('application/problem+json')
        .json({
          type: 'about:blank',
          title:
            parserStatus === 413 ? 'Request body is too large.' : 'Request body is not valid JSON.',
          status: parserStatus,
          code: parserStatus === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
          requestId,
        });
      return;
    }
    logger.error({ err, requestId }, 'unhandled error');
    res.status(500).type('application/problem+json').json({
      type: 'about:blank',
      title: 'Something went wrong on our side. Please try again.',
      status: 500,
      code: 'INTERNAL',
      requestId,
    });
  };
}
