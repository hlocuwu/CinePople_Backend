import { Request, Response, NextFunction } from "express";
import { AssistantService } from "./service";
import { AuthRequest } from "../../middleware/auth";

let assistantService: AssistantService | null = null;

const getService = () => assistantService ?? (assistantService = new AssistantService());

/**
 * @swagger
 * tags:
 *   name: Assistant
 *   description: Trợ lý ảo CinePople (Chat + Action AI)
 */

/**
 * @swagger
 * /api/assistant/chat:
 *   post:
 *     summary: Trò chuyện với trợ lý ảo CinePople
 *     description: Trợ lý AI giúp tìm phim, gợi ý suất chiếu, ghế đẹp, hỗ trợ đặt vé.
 *     tags: [Assistant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Gợi ý phim hay cho tôi"
 *     responses:
 *       200:
 *         description: Trả lời từ trợ lý ảo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 reply:
 *                   type: string
 */

export const chatWithAssistant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const service = getService();
        const text = req.body.message;
        const userId = (req as AuthRequest).user?.uid || "";

        if (!text) return res.status(400).json({ success: false, message: "Missing message" });

        const reply = await service.chat(userId, text);

        res.json({ success: true, reply });

    } catch (e) {
        next(e);
    }
};

export const doAssistantAction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const service = getService();
        const { action, params } = req.body;
        const userId = (req as AuthRequest).user?.uid || "";

        const result = await service.handleAction(userId, action, params);

        res.json({ success: true, result });
    } catch (e) {
        next(e);
    }
};
