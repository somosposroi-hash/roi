import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';

const router = Router();
const authController = new AuthController();

// Brute-force rate limiting: max 5 attempts per IP every 15 minutes for security
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per login window
  message: {
    success: false,
    error: 'Demasiados intentos fallidos de inicio de sesión. Por favor, intente de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

// User Management Routes
router.get('/users', (req, res, next) => authController.listUsers(req, res, next));
router.post('/users', (req, res, next) => authController.createUser(req, res, next));
router.put('/users/:id', (req, res, next) => authController.updateUser(req, res, next));
router.delete('/users/:id', (req, res, next) => authController.deleteUser(req, res, next));

export default router;
