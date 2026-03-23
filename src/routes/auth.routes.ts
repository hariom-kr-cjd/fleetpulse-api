import { Router, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { validateRegister, validateLogin } from '../validators/auth.validator';
import { loginLimiter, registerLimiter } from '../middleware/rate-limit.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const authService = new AuthService();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

router.post('/register', registerLimiter, validateRegister, async (req, res: Response) => {
  try {
    const user = await authService.register(req.body);
    const { password: _, ...userWithoutPassword } = user.toObject();
    res.status(201).json({ data: userWithoutPassword });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    const status = message === 'Email already registered' ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

router.post('/login', loginLimiter, validateLogin, async (req, res: Response) => {
  try {
    const { accessToken, refreshToken } = await authService.login(req.body.email, req.body.password);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ data: { accessToken } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    res.status(401).json({ error: message });
  }
});

router.post('/refresh', async (req, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }
    const { accessToken, refreshToken } = await authService.refresh(token);
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ data: { accessToken } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refresh failed';
    res.status(401).json({ error: message });
  }
});

router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await authService.logout(token);
    }
    res.clearCookie('refreshToken', { path: '/' });
    res.json({ data: { message: 'Logged out successfully' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Logout failed';
    res.status(500).json({ error: message });
  }
});

export default router;
