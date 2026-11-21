import { z } from 'zod';

/**
 * WebSocket protocol between apps/web and apps/sync (DESIGN §6.5).
 * Binary frames carry Yjs; text frames carry JSON control messages validated on both ends.
 */

export const PROTOCOL_VERSION = 1;
/** Oldest client protocol the server still accepts (N-1 support window). */
export const PROTOCOL_MIN = 1;

/** First varuint of every binary frame. */
export const BinaryMessage = {
  /** y-protocols sync (step 1 / step 2 / update) — used for catch-up. */
  Sync: 0,
  /** y-protocols awareness — cursors, selection, laser, follow target. */
  Awareness: 1,
  /** Durable presenter update: [10][clientUpdateId][update]; answered by an `ack`. */
  DurableUpdate: 10,
} as const;

export const CloseCode = {
  Normal: 1000,
  TryAgainLater: 1013,
  BadProtocolVersion: 4400,
  AuthExpired: 4401,
  Forbidden: 4403,
  BoardNotFound: 4404,
  BoardLocked: 4409,
  InviteRevoked: 4410,
  RateLimited: 4429,
} as const;
export type CloseCode = (typeof CloseCode)[keyof typeof CloseCode];

export const ErrorCode = z.enum([
  'PEN_REQUIRED',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'PERSIST_FAILED',
  'BAD_MESSAGE',
  'FORBIDDEN',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** "u_<userId>" for Clerk users, "g_<guestId>" for guests. */
export const Principal = z.string().regex(/^[ug]_[A-Za-z0-9]{1,40}$/);
export const Role = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export type Role = z.infer<typeof Role>;

export const PenState = z
  .object({
    holder: Principal,
    epoch: z.int().nonnegative(),
    since: z.number(),
  })
  .nullable();
export type PenState = z.infer<typeof PenState>;

export const InterviewState = z.object({
  active: z.boolean(),
  problem: z.string().max(4000),
  requirements: z
    .array(
      z.object({
        id: z.string().max(40),
        kind: z.enum(['functional', 'nonfunctional']),
        text: z.string().max(300),
        done: z.boolean(),
      }),
    )
    .max(100),
  phases: z
    .array(
      z.object({
        key: z.string().max(40),
        label: z.string().max(60),
        minutes: z.number().min(1).max(240),
      }),
    )
    .min(1)
    .max(10),
  timer: z.object({
    phaseIndex: z.int().nonnegative(),
    /** Server epoch ms when the current phase (re)started, null when not running. */
    startedAt: z.number().nullable(),
    /** Milliseconds already elapsed in the phase before the last start (for pause/resume). */
    elapsedMs: z.number().nonnegative(),
  }),
});
export type InterviewState = z.infer<typeof InterviewState>;

export const DEFAULT_PHASES: InterviewState['phases'] = [
  { key: 'requirements', label: 'Requirements', minutes: 5 },
  { key: 'estimation', label: 'Estimation', minutes: 5 },
  { key: 'high-level', label: 'High-level design', minutes: 15 },
  { key: 'deep-dive', label: 'Deep dive', minutes: 15 },
  { key: 'wrap-up', label: 'Wrap-up', minutes: 5 },
];

const empty = z.object({}).strict();

function message<T extends string, P extends z.ZodType>(type: T, payload: P) {
  return z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal(type),
    id: z.string().max(40).optional(),
    payload,
  });
}

// ---------------------------------------------------------------------------------------------
// Client → server

export const InterviewOp = z.discriminatedUnion('op', [
  z.object({ op: z.literal('start') }),
  z.object({ op: z.literal('end') }),
  z.object({ op: z.literal('timer.start') }),
  z.object({ op: z.literal('timer.pause') }),
  z.object({ op: z.literal('timer.next') }),
  z.object({ op: z.literal('timer.reset') }),
  z.object({ op: z.literal('problem.set'), text: z.string().max(4000) }),
  z.object({ op: z.literal('phases.set'), phases: InterviewState.shape.phases }),
  z.object({
    op: z.literal('req.add'),
    kind: z.enum(['functional', 'nonfunctional']),
    text: z.string().min(1).max(300),
  }),
  z.object({ op: z.literal('req.toggle'), id: z.string().max(40) }),
  z.object({ op: z.literal('req.remove'), id: z.string().max(40) }),
]);

export const ClientMessage = z.discriminatedUnion('type', [
  message('auth.refresh', z.object({ token: z.string().min(1).max(8192) })),
  message('pen.request', empty),
  message('pen.respond', z.object({ to: Principal, accept: z.boolean() })),
  message('pen.give', z.object({ to: Principal })),
  message('pen.take', empty),
  message('pen.release', empty),
  message('pen.heartbeat', z.object({ epoch: z.int().nonnegative() })),
  message('interview.update', InterviewOp),
  message(
    'reaction',
    z.object({
      emoji: z.enum(['👍', '🎉', '🤔', '❓', '👀']),
      at: z.object({ x: z.number(), y: z.number() }).optional(),
    }),
  ),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---------------------------------------------------------------------------------------------
// Server → client

export const ServerMessage = z.discriminatedUnion('type', [
  message(
    'hello',
    z.object({
      serverTime: z.number(),
      principal: Principal,
      displayName: z.string(),
      role: Role,
      pen: PenState,
      room: z.object({ locked: z.boolean() }),
      protocol: z.object({ min: z.int(), max: z.int() }),
    }),
  ),
  message('pen.requested', z.object({ by: Principal, at: z.number() })),
  message(
    'pen.granted',
    z.object({
      to: Principal,
      from: Principal.nullable(),
      epoch: z.int(),
      reason: z.enum([
        'request_accepted',
        'given',
        'taken_back',
        'acquired',
        'resumed',
        'expired_to_owner',
      ]),
    }),
  ),
  message('pen.declined', z.object({ by: Principal })),
  message(
    'pen.revoked',
    z.object({ from: Principal, reason: z.enum(['taken_back', 'role_changed']) }),
  ),
  message('pen.expired', z.object({ previous: Principal, next: Principal.nullable() })),
  message('interview.state', z.object({ state: InterviewState, serverTime: z.number() })),
  message(
    'comment.event',
    z.object({
      kind: z.enum(['created', 'updated', 'resolved', 'deleted']),
      commentId: z.string(),
      nodeId: z.string().nullable(),
    }),
  ),
  message(
    'reaction',
    z.object({
      by: Principal,
      emoji: z.string(),
      at: z.object({ x: z.number(), y: z.number() }).optional(),
    }),
  ),
  message('ack', z.object({ upTo: z.int().nonnegative(), seq: z.int().nonnegative() })),
  message('role.changed', z.object({ role: Role })),
  message('error', z.object({ code: ErrorCode, message: z.string(), retryable: z.boolean() })),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];

/** Parse a text frame; returns null instead of throwing so a bad frame never crashes a room. */
export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const result = ClientMessage.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const result = ServerMessage.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function encode<M extends ClientMessage | ServerMessage>(msg: M): string {
  return JSON.stringify(msg);
}

/** What the UI says for each close code (UX §8). `null` means reconnect silently. */
export const CLOSE_MESSAGES: Record<number, { message: string | null; reconnect: boolean }> = {
  [CloseCode.AuthExpired]: { message: null, reconnect: true },
  [CloseCode.Forbidden]: { message: 'You no longer have access to this board.', reconnect: false },
  [CloseCode.BoardNotFound]: {
    message: "This board doesn't exist or was deleted.",
    reconnect: false,
  },
  [CloseCode.BoardLocked]: { message: 'The owner locked this board.', reconnect: false },
  [CloseCode.InviteRevoked]: {
    message: 'This link has expired or was revoked — ask the owner for a new one.',
    reconnect: false,
  },
  [CloseCode.BadProtocolVersion]: {
    message: 'ArchBoard was updated — reload to continue. Your work is safe.',
    reconnect: false,
  },
  [CloseCode.RateLimited]: {
    message: 'Too many connection attempts. Retrying shortly…',
    reconnect: true,
  },
  [CloseCode.TryAgainLater]: { message: null, reconnect: true },
};
