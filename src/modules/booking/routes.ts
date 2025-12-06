import { Router } from 'express';
import * as controller from './controller';
import { auth, isAdmin } from '../../middleware/auth';

const router = Router();

router.post('/', auth, controller.createBooking);
router.get('/all', auth, isAdmin, controller.getAllBookings);
router.get('/', auth, controller.getMyBookings);
router.get('/:id', auth, controller.getBookingById);

export default router;