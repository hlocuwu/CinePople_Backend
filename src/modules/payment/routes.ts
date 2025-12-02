import { Router } from 'express';
import * as controller from './controller';
import { auth } from '../../middleware/auth';

const router = Router();

// API Thanh toán (Cần đăng nhập)
router.post('/', auth, controller.processPayment);
router.post('/webhook/momo', controller.handleMomoWebhook);
export default router;