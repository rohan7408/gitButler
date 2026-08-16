import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(options?: { name?: string; level?: string }): Logger {
  return pino({
    name: options?.name ?? 'git-butler',
    level: options?.level ?? (process.env.GIT_BUTLER_LOG_LEVEL || 'info'),
    transport:
      process.env.NODE_ENV !== 'production' && !process.env.GIT_BUTLER_RAW_LOGS
        ? undefined
        : undefined,
  });
}

export const defaultLogger = createLogger();
