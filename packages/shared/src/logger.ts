import { pino, type Logger, type LoggerOptions } from 'pino';

export type { Logger };

/** Structured JSON logs. Never log tokens, cookies or email addresses. */
export function createLogger(service: string, level = 'info'): Logger {
  const options: LoggerOptions = {
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.token',
        '*.email',
      ],
      censor: '[redacted]',
    },
    formatters: { level: (label) => ({ level: label }) },
  };
  return pino(options);
}
