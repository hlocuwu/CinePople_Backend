import express from 'express';
import { chatController } from './controller';

const router = express.Router();

// đường chuẩn
router.post('/', chatController);

export default router;
