import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? 'root',
  name: process.env.DB_NAME ?? 'dev',
  // DB_SYNCHRONIZE=true|false overrides the default (on everywhere except production)
  synchronize: process.env.DB_SYNCHRONIZE
    ? process.env.DB_SYNCHRONIZE === 'true'
    : process.env.NODE_ENV !== 'production',
}));
