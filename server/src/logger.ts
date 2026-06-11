import { type Request, type Response, type NextFunction } from 'express';

/**
 * Request logger middleware.
 * Logs method, path, status code, and response time (ms) for every request.
 * Suppresses output in the test environment to keep test output clean.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  let logged = false;

  // Log exactly once regardless of whether the response completed normally
  // ('finish') or the client disconnected before the response was fully sent
  // ('close').  Without 'close', aborted requests are silently missed.
  const log = (): void => {
    if (logged || process.env.NODE_ENV === 'test') return;
    logged = true;
    const ms = Date.now() - start;
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms,
      }),
    );
  };

  res.once('finish', log);
  res.once('close', log);

  next();
}
