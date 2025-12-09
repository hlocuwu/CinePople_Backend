import { Router } from "express";
import { loginAndSync } from "./controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/login", auth, loginAndSync);

export default router;