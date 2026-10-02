export class AppError extends Error {
  public readonly isOperational: boolean;

  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, 'validation_error', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, 'unauthorized', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, 'forbidden', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string | number) {
    const msg = id !== undefined ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(404, 'not_found', msg);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(409, 'conflict', message, details);
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'Upstream service failure', details?: unknown) {
    super(502, 'upstream_error', message, details);
  }
}
