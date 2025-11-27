export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, code?: string): HttpError {
    return new HttpError(400, message, code);
  }

  static unauthorized(message = 'Unauthorized', code?: string): HttpError {
    return new HttpError(401, message, code);
  }

  static forbidden(message = 'Forbidden', code?: string): HttpError {
    return new HttpError(403, message, code);
  }

  static notFound(message = 'Not found', code?: string): HttpError {
    return new HttpError(404, message, code);
  }

  static conflict(message: string, code?: string): HttpError {
    return new HttpError(409, message, code);
  }

  static internal(message = 'Internal server error', code?: string): HttpError {
    return new HttpError(500, message, code);
  }
}

