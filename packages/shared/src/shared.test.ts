import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { baseEnvSchema, loadEnv } from './env.ts';
import { ConflictError, isAppError, NotFoundError, ValidationError } from './errors.ts';

describe('loadEnv', () => {
  const schema = baseEnvSchema.extend({ PORT: z.coerce.number().int() });

  it('parses and applies defaults', () => {
    const env = loadEnv(schema, { PUBLIC_ORIGIN: 'https://example.com', PORT: '3000' });
    expect(env).toEqual({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      PUBLIC_ORIGIN: 'https://example.com',
      PORT: 3000,
    });
  });

  it('lists every problem at once', () => {
    expect(() => loadEnv(schema, { PUBLIC_ORIGIN: 'not a url', PORT: 'x' })).toThrow(
      /PUBLIC_ORIGIN[\s\S]*PORT|PORT[\s\S]*PUBLIC_ORIGIN/,
    );
  });
});

describe('errors', () => {
  it('carry an HTTP status, a stable code and a safe message', () => {
    const notFound = new NotFoundError('Board');
    expect(isAppError(notFound)).toBe(true);
    expect([notFound.status, notFound.code, notFound.message]).toEqual([
      404,
      'NOT_FOUND',
      'Board not found.',
    ]);
    expect(new ConflictError('Taken').status).toBe(409);
    expect(new ValidationError('Bad', [{ path: 'x', message: 'y' }]).fieldErrors).toHaveLength(1);
    expect(isAppError(new Error('plain'))).toBe(false);
  });
});
