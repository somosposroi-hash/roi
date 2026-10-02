import { Request, Response, NextFunction } from 'express';

export function responseTiming(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  // Patch res.writeHead to set timing before headers are sent
  const originalWriteHead = res.writeHead;
  res.writeHead = function (this: Response, statusCode: number, ...args: any[]): Response {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time-Ms', durationMs.toFixed(3));
    }
    return originalWriteHead.call(this, statusCode, ...args);
  };

  next();
}
