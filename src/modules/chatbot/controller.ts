// src/modules/chatbot/controller.ts

import { Request, Response } from 'express';
import { generateResponse } from './service';

/**
 * @swagger
 * /api/chatbot:
 *   post:
 *     summary: Gửi tin nhắn tới chatbot và nhận phản hồi
 *     description: "Gửi một tin nhắn tới chatbot và nhận phản hồi từ AI"
 *     tags: [Chatbot]
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
 *                 description: Tin nhắn người dùng gửi tới chatbot
 *                 example: "Chào chatbot!"
 *             required:
 *               - message
 *     responses:
 *       200:
 *         description: Chatbot trả lời thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                   description: Phản hồi từ chatbot
 *                   example: "Chào bạn! Tôi là chatbot của CinéPople."
 *       400:
 *         description: Lỗi yêu cầu không hợp lệ
 *       500:
 *         description: Lỗi server
 */

export const chatController = async (req: Request, res: Response) => {
    const { message } = req.body;  // Lấy câu hỏi từ người dùng

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const response = await generateResponse(message);  // Gọi service để lấy phản hồi từ AI
        return res.json({ response });  // Trả lời cho frontend
    } catch (error) {
        return res.status(500).json({ error: 'Failed to generate response' });
    }
};
