import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import { ValidationError } from '@archboard/shared/errors';
import { createApp, errorHandler } from '../src/app.ts';
import express from 'express';

const logger = pino({ level: 'silent' });

describe('health endpoints', () => {
  it('GET /api/health is always ok', async () => {
    const app = createApp({ logger, checks: {} });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version: 'dev' });
    expect(res.headers['x-request-id']).toMatch(/^[\w-]{8,}$/);
  });

  it('GET /api/health/ready reports each dependency', async () => {
    const app = createApp({
      logger,
      checks: {
        database: async () => undefined,
        redis: async () => Promise.reject(new Error('down')),
      },
    });
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', checks: { database: 'ok', redis: 'fail' } });
  });

  it('times out a hanging dependency instead of hanging the probe', async () => {
    const app = createApp({ logger, checks: { slow: () => new Promise(() => undefined) } });
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(503);
  }, 5000);

  it('sets security headers and hides the framework', async () => {
    const res = await request(createApp({ logger, checks: {} })).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('propagates a safe incoming request id', async () => {
    const res = await request(createApp({ logger, checks: {} }))
      .get('/api/health')
      .set('X-Request-Id', 'abc12345-trace');
    expect(res.headers['x-request-id']).toBe('abc12345-trace');
  });
});

describe('errors', () => {
  it('unknown API routes return problem+json 404', async () => {
    const res = await request(createApp({ logger, checks: {} })).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      title: 'Endpoint not found.',
    });
  });

  it('malformed JSON returns 400 with a readable title', async () => {
    const app = createApp({ logger, checks: {} });
    const res = await request(app)
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Request body is not valid JSON.');
  });

  it('maps AppErrors with field errors and hides unexpected error details', async () => {
    const app = express();
    app.get('/validation', () => {
      throw new ValidationError('Check the highlighted fields.', [
        { path: 'title', message: 'Too long' },
      ]);
    });
    app.get('/boom', () => {
      throw new Error('secret internal detail');
    });
    app.use(errorHandler(logger));

    const v = await request(app).get('/validation');
    expect(v.status).toBe(422);
    expect(v.body.fieldErrors).toEqual([{ path: 'title', message: 'Too long' }]);

    const b = await request(app).get('/boom');
    expect(b.status).toBe(500);
    expect(JSON.stringify(b.body)).not.toContain('secret');
  });
});
