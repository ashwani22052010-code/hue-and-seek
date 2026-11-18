import 'dotenv/config';

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  pgliteDir: process.env.PGLITE_DIR ?? './data/pglite',
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  /** Shorter phases for automated tests / quick local play. Never enable in production. */
  fastTimers: process.env.FAST_TIMERS === 'true',
  /** Multiplier for phase durations (FAST_TIMERS defaults it to 0.25). */
  timerScale: num(process.env.TIMER_SCALE, process.env.FAST_TIMERS === 'true' ? 0.25 : 1),
  sessionDays: num(process.env.SESSION_DAYS, 60),
  trustProxy: process.env.TRUST_PROXY === 'true',
};
