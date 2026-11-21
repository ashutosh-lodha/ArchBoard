import { describe, expect, it } from 'vitest';
import {
  CLOSE_MESSAGES,
  CloseCode,
  encode,
  parseClientMessage,
  parseServerMessage,
  PROTOCOL_VERSION,
} from './index.ts';

describe('client messages', () => {
  it('accepts well-formed messages', () => {
    const raw = encode({ v: 1, type: 'pen.give', payload: { to: 'u_abc123' } });
    expect(parseClientMessage(raw)).toEqual({
      v: 1,
      type: 'pen.give',
      payload: { to: 'u_abc123' },
    });
    expect(
      parseClientMessage(
        JSON.stringify({
          v: 1,
          type: 'interview.update',
          payload: { op: 'req.add', kind: 'functional', text: 'Shorten URLs' },
        }),
      ),
    ).not.toBeNull();
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['unknown type', JSON.stringify({ v: 1, type: 'pen.steal', payload: {} })],
    ['wrong version', JSON.stringify({ v: 2, type: 'pen.request', payload: {} })],
    [
      'extra payload fields on empty messages',
      JSON.stringify({ v: 1, type: 'pen.take', payload: { force: true } }),
    ],
    ['bad principal', JSON.stringify({ v: 1, type: 'pen.give', payload: { to: 'admin' } })],
    ['unknown emoji', JSON.stringify({ v: 1, type: 'reaction', payload: { emoji: '💣' } })],
    [
      'oversized token',
      JSON.stringify({ v: 1, type: 'auth.refresh', payload: { token: 'x'.repeat(9000) } }),
    ],
  ])('rejects %s', (_name, raw) => {
    expect(parseClientMessage(raw)).toBeNull();
  });

  it('does not accept server-only messages from clients', () => {
    expect(
      parseClientMessage(JSON.stringify({ v: 1, type: 'ack', payload: { upTo: 1, seq: 1 } })),
    ).toBeNull();
  });
});

describe('server messages', () => {
  it('parses hello', () => {
    const hello = {
      v: PROTOCOL_VERSION,
      type: 'hello',
      payload: {
        serverTime: Date.now(),
        principal: 'g_guest1',
        displayName: 'Priya',
        role: 'EDITOR',
        pen: { holder: 'u_owner', epoch: 3, since: Date.now() },
        room: { locked: false },
        protocol: { min: 1, max: 1 },
      },
    };
    expect(parseServerMessage(JSON.stringify(hello))?.type).toBe('hello');
  });
});

describe('close codes', () => {
  it('has a UI message (or silent reconnect) for every custom close code', () => {
    for (const code of Object.values(CloseCode)) {
      if (code === CloseCode.Normal) continue;
      expect(CLOSE_MESSAGES[code], `close code ${code}`).toBeDefined();
    }
  });
});
