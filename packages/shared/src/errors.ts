/**
 * Application error hierarchy. Services throw these; the API error middleware maps them to
 * RFC 9457 problem+json responses and the sync server maps them to protocol error codes.
 */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'GONE'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface FieldError {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Whether `message` is safe to show to the client. 5xx messages are hidden by default. */
  readonly expose: boolean;
  readonly fieldErrors: FieldError[] | undefined;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    options: { cause?: unknown; expose?: boolean; fieldErrors?: FieldError[] } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.expose = options.expose ?? status < 500;
    this.fieldErrors = options.fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors: FieldError[] = []) {
    super('VALIDATION_FAILED', 422, message, { fieldErrors });
  }
}
export class UnauthenticatedError extends AppError {
  constructor(message = 'Sign in to continue.') {
    super('UNAUTHENTICATED', 401, message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You don't have access to this.") {
    super('FORBIDDEN', 403, message);
  }
}
export class NotFoundError extends AppError {
  constructor(what = 'Resource') {
    super('NOT_FOUND', 404, `${what} not found.`);
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
  }
}
export class GoneError extends AppError {
  constructor(message: string) {
    super('GONE', 410, message);
  }
}
export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED', 429, 'Too many requests. Please slow down.');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
