import pino from 'pino';

export interface Logger {
  info(obj: object, msg?: string): void;
  info(msg: string): void;
  warn(obj: object, msg?: string): void;
  warn(msg: string): void;
  error(obj: object, msg?: string): void;
  error(msg: string): void;
  debug(obj: object, msg?: string): void;
  debug(msg: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(serviceName: string): Logger {
  return pino({
    name: serviceName,
    level: process.env['LOG_LEVEL'] || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service: serviceName,
    },
  });
}
