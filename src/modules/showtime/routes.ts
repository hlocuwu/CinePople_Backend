import { Router } from 'express';
import * as controller from './controller';
import { auth, isAdmin } from "../../middleware/auth";

const router = Router();

// Public
router.get('/', controller.getShowtimes);
router.get('/:id', controller.getShowtimeById);

// Admin
router.post('/', auth, isAdmin, controller.createShowtime);
router.put('/:id', auth, isAdmin, controller.updateShowtime);
router.delete('/:id', auth, isAdmin, controller.deleteShowtime);

export default router;