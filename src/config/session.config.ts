import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { Pool } from 'pg';

export function createSessionConfig() {
  const PgSessionStore = pgSession(session);

  let sessionStore: any;
  try {
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'banking',
    });

    sessionStore = new PgSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      ttl: Math.floor(parseInt(process.env.SESSION_MAX_AGE || '86400000', 10) / 1000),
    });
  } catch (err) {
    console.warn('PostgreSQL Session Store fallback to MemoryStore:', err);
    sessionStore = new session.MemoryStore();
  }

  const isProduction = process.env.NODE_ENV === 'production';

  return session({
    secret: process.env.SESSION_SECRET || 'bbank_default_fallback_session_secret_1234567890_abcdef',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    name: 'bbank.sid',
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10),
    },
  });
}
