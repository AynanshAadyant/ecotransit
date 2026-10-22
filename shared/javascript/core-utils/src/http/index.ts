import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/index.js';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function ok<T>(res: Response, data: T): void {
  res.status(200).json(data);
}

export function created<T>(res: Response, data: T): void {
  res.status(201).json(data);
}

export function noContent(res: Response): void {
  res.status(204).end();
}

export abstract class BaseController {
  protected handle<T>(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<T>,
  ): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await fn(req, res, next);
        if (res.headersSent) {
          return;
        }
        if (result === undefined) {
          res.status(204).end();
        } else {
          res.status(200).json(result);
        }
      } catch (err) {
        next(err);
      }
    };
  }
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent || !res || typeof res.status !== 'function') {
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof ZodError || (err instanceof Error && err.name === 'ZodError')) {
    const issues = (err as ZodError).issues || (err as unknown as { errors: unknown }).errors;
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request parameters',
        details: issues,
      },
    });
    return;
  }

  // Fallback for unhandled errors
  const isProduction = process.env['NODE_ENV'] === 'production';
  const message = isProduction
    ? 'An unexpected internal server error occurred'
    : err instanceof Error
      ? err.message
      : 'Internal server error';
  console.error('[UnhandledError]', err);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message,
    },
  });
}
