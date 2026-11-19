import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { winstonLogger } from '../../config/winston.config';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    // Clean body of sensitive keys
    const sanitizeBody = (body: any): string => {
      if (!body || typeof body !== 'object') return '{}';
      const clean = { ...body };
      const sensitiveKeys = ['password', 'currentpassword', 'newpassword', 'confirmpassword', '_csrf', 'token'];
      for (const k of Object.keys(clean)) {
        if (sensitiveKeys.includes(k.toLowerCase())) {
          clean[k] = '***REDACTED***';
        }
      }
      return JSON.stringify(clean);
    };

    res.on('finish', async () => {
      // Don't log static files
      if (req.originalUrl.startsWith('/static') || req.originalUrl.startsWith('/public') || req.originalUrl.includes('.')) {
        return;
      }

      const userId = req.session?.user?.id || 0;
      const username = req.session?.user?.username || 'anonymous';
      const action = `${req.method} ${req.route?.path || req.originalUrl}`;
      const method = req.method;
      const url = req.originalUrl.substring(0, 500);
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const details = sanitizeBody(req.body);

      try {
        await this.prisma.auditLog.create({
          data: {
            userId,
            username,
            action,
            method,
            url,
            ip: ip.substring(0, 45),
            details,
          },
        });
      } catch (err) {
        winstonLogger.warn('AuditLog creation failed:', err);
      }
    });

    next();
  }
}
