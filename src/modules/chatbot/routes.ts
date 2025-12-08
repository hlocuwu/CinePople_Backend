import express from 'express';
import { chatController } from './controller';

const router = express.Router();

router.post('/', chatController);

export default router;
