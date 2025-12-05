import { Router } from "express";
import { chatWithAssistant, doAssistantAction } from "./controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/chat", auth, chatWithAssistant);
router.post("/action", auth, doAssistantAction); // NEW: xử lý hành động

export default router;
