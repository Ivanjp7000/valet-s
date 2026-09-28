export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof HttpError
    ? error.status === 401
    : error instanceof Error && /^401:/.test(error.message);
}
