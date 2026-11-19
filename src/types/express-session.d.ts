import 'express-session';

declare module 'express-mysql-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      email: string;
      role: 'admin' | 'manager' | 'user';
      firstName?: string | null;
      lastName?: string | null;
    };
    flash?: { [key: string]: string[] };
  }
}
