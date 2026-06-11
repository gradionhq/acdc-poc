// test/logger.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { type Request, type Response, type NextFunction } from 'express';
import { requestLogger } from '../src/logger';

/**
 * Build minimal mock Request / Response objects sufficient for requestLogger.
 * Response is an EventEmitter so we can emit 'finish' and 'close' in tests.
 */
function buildMocks(): {
  req: Partial<Request>;
  res: EventEmitter & Partial<Response>;
  next: NextFunction;
} {
  const req: Partial<Request> = { method: 'GET', path: '/test' };
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
  }) as EventEmitter & Partial<Response>;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('requestLogger middleware', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    // Remove test suppression so logs are emitted.
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('calls next()', () => {
    const { req, res, next } = buildMocks();
    requestLogger(req as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('logs on the "finish" event', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { req, res, next } = buildMocks();

    requestLogger(req as Request, res as unknown as Response, next);
    res.emit('finish');

    expect(consoleSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(logged).toMatchObject({ method: 'GET', path: '/test', status: 200 });
    expect(typeof logged.ms).toBe('number');
  });

  it('logs on the "close" event (aborted request)', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { req, res, next } = buildMocks();

    requestLogger(req as Request, res as unknown as Response, next);
    res.emit('close');

    expect(consoleSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(logged).toMatchObject({ method: 'GET', path: '/test', status: 200 });
  });

  it('logs exactly once when both "finish" and "close" fire', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { req, res, next } = buildMocks();

    requestLogger(req as Request, res as unknown as Response, next);
    res.emit('finish');
    res.emit('close');

    // Must not double-log.
    expect(consoleSpy).toHaveBeenCalledOnce();
  });

  it('suppresses output in test environment (NODE_ENV=test)', () => {
    process.env.NODE_ENV = 'test';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { req, res, next } = buildMocks();

    requestLogger(req as Request, res as unknown as Response, next);
    res.emit('finish');
    res.emit('close');

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
