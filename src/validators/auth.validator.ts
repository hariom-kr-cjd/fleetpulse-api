import { Request, Response, NextFunction } from 'express';

export function validateRegister(req: Request, res: Response, next: NextFunction): void {
  const { email, password, name, phone } = req.body;

  if (!email || !password || !name || !phone) {
    res.status(400).json({ error: 'Email, password, name, and phone are required' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  next();
}

export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  next();
}
