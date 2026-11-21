import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { pino } from 'pino';
import { CloseCode } from '@archboard/protocol';
import { createSyncServer, type SyncServer } from '../src/server.ts';

const ORIGIN = 'http://localhost:5180';
let sync: SyncServer;
let base: string;

beforeEach(async () => {
  sync = createSyncServer({ logger: pino({ level: 'silent' }), publicOrigin: ORIGIN });
  await new Promise<void>((resolve) => sync.server.listen(0, '127.0.0.1', resolve));
  const { port } = sync.server.address() as AddressInfo;
  base = `127.0.0.1:${port}`;
});
afterEach(() => sync.close());

function open(path: string, origin?: string): WebSocket {
  return new WebSocket(`ws://${base}${path}`, origin ? { headers: { Origin: origin } } : {});
}

describe('sync server skeleton', () => {
  it('serves /healthz', async () => {
    const res = await fetch(`http://${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', connections: 0 });
  });

  it('echoes on the websocket health endpoint', async () => {
    const ws = open('/ws/healthz', ORIGIN);
    await new Promise((r) => ws.once('open', r));
    const reply = new Promise<string>((r) => ws.once('message', (d) => r(String(d))));
    ws.send('ping');
    expect(await reply).toBe('ping');
    ws.close();
  });

  it('rejects upgrades from a foreign origin', async () => {
    const ws = open('/ws/healthz', 'https://evil.example');
    const status = await new Promise<number>((r) =>
      ws.once('unexpected-response', (_req, res) => r(res.statusCode ?? 0)),
    );
    expect(status).toBe(403);
  });

  it('returns 404 for unknown websocket paths', async () => {
    const ws = open('/ws/nope', ORIGIN);
    const status = await new Promise<number>((r) =>
      ws.once('unexpected-response', (_req, res) => r(res.statusCode ?? 0)),
    );
    expect(status).toBe(404);
  });

  it('asks board clients to retry later until rooms exist', async () => {
    const ws = open('/ws/boards/abc123', ORIGIN);
    const code = await new Promise<number>((r) => ws.once('close', (c) => r(c)));
    expect(code).toBe(CloseCode.TryAgainLater);
  });

  it('closes live sockets with "try again" on shutdown', async () => {
    const ws = open('/ws/healthz', ORIGIN);
    await new Promise((r) => ws.once('open', r));
    const code = new Promise<number>((r) => ws.once('close', (c) => r(c)));
    await sync.close();
    expect(await code).toBe(CloseCode.TryAgainLater);
    // Re-create so afterEach can close cleanly.
    sync = createSyncServer({ logger: pino({ level: 'silent' }), publicOrigin: ORIGIN });
  });
});
