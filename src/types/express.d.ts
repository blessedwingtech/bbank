import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      csrfToken?: () => string;
      flash?: (type?: string, message?: string) => any;
    }
  }
}
