import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import csurf from 'csurf';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private csrfProtection = csurf({ cookie: false });

  use(req: Request, res: Response, next: NextFunction) {
    this.csrfProtection(req, res, (err: any) => {
      if (err) {
        if (err.code === 'EBADCSRFTOKEN') {
          if (req.flash) {
            req.flash('error', 'Session expirée ou jeton CSRF invalide. Veuillez réessayer.');
          }
          return res.redirect('back');
        }
        return next(err);
      }
      next();
    });
  }
}
