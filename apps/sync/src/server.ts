import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Logger } from '@archboard/shared/logger';
import { CloseCode, PROTOCOL_MIN, PROTOCOL_VERSION } from '@archboard/protocol';

export interface SyncServerOptions {
  logger: Logger;
  /** Allowed Origin header for WebSocket upgrades (the public app origin). */
  publicOrigin: string;
  /** Max inbound frame size in bytes (DESIGN §6.1). */
  maxPayload?: number;
}

export interface SyncServer {
  server: Server;
  wss: WebSocketServer;
  connections: () => number;
  close: () => Promise<void>;
}

const BOARD_PATH = /^\/ws\/boards\/([A-Za-z0-9_-]{1,40})$/;

function reject(socket: Duplex, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

/**
 * Phase 1 skeleton: health endpoints, origin check, path routing and a WebSocket echo used by
 * the uptime monitor. Board rooms, auth, Yjs sync and the pen lease arrive in Phase 4.
 */
export function createSyncServer(options: SyncServerOptions): SyncServer {
  const { logger } = options;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: options.maxPayload ?? 1024 * 1024,
  });

  const server = createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/healthz' || req.url === '/ws/healthz')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(
        JSON.stringify({
          status: 'ok',
          connections: wss.clients.size,
          protocol: { min: PROTOCOL_MIN, max: PROTOCOL_VERSION },
        }),
      );
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 404, title: 'Not found' }));
  });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://internal');
    const origin = req.headers.origin;
    // Browsers always send Origin on WebSocket upgrades; reject cross-site attempts early.
    // Non-browser clients (uptime monitor, load tests) may omit it.
    if (origin !== undefined && origin !== options.publicOrigin) {
      logger.warn({ origin }, 'rejected websocket upgrade from foreign origin');
      reject(socket, 403, 'Forbidden');
      return;
    }

    if (url.pathname === '/ws/healthz') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.on('message', (data, isBinary) => ws.send(data, { binary: isBinary }));
      });
      return;
    }

    if (BOARD_PATH.test(url.pathname)) {
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        // Rooms are not implemented yet: tell the client to retry later rather than hanging.
        ws.close(CloseCode.TryAgainLater, 'Rooms are not available yet');
      });
      return;
    }

    reject(socket, 404, 'Not Found');
  });

  return {
    server,
    wss,
    connections: () => wss.clients.size,
    close: () =>
      new Promise<void>((resolve) => {
        for (const client of wss.clients)
          client.close(CloseCode.TryAgainLater, 'Server restarting');
        wss.close();
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
