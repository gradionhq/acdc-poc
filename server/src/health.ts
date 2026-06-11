import { Router, type Request, type Response } from 'express';

const startTime = Date.now();

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: (Date.now() - startTime) / 1000 });
  });

  return router;
}
