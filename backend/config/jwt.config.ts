import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  return {
    secret: secret ?? 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    bcryptSaltRounds: Number.parseInt(
      process.env.BCRYPT_SALT_ROUNDS ?? '10',
      10,
    ),
  };
});
