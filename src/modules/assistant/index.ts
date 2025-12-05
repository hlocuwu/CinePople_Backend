import { Router } from "express";
import { chatWithAssistant } from "./controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/chat", auth, chatWithAssistant);

export default router;
