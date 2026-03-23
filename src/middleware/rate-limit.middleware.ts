import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many registration attempts, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});
