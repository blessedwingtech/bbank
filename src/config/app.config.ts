export const appConfig = () => ({
  port: parseInt(process.env.APP_PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'banking',
  },
  session: {
    secret: process.env.SESSION_SECRET || 'default_session_secret_change_me',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10),
  },
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
  },
  interest: {
    savingsRate: parseFloat(process.env.SAVINGS_INTEREST_RATE || '0.005'),
  },
});
