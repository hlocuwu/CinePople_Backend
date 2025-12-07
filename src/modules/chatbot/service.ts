// src/modules/chatbot/service.ts
import axios from "axios";

export const generateResponse = async (message: string): Promise<string> => {
    const apiKey = process.env.HF_TOKEN;
    if (!apiKey) {
        throw new Error("HF_TOKEN is missing");
    }

    const MODEL_ID = "google/gemma-2-2b-it";
    const url = "https://router.huggingface.co/v1/chat/completions";

    try {
        const response = await axios.post(
            url,
            {
                model: MODEL_ID,
                messages: [
                    {
                        role: "system",
                        content: "You are a friendly, concise assistant. Keep replies short and clear."
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                max_tokens: 300,
                temperature: 0.7,
                top_p: 0.9
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const data: any = response.data;

        // ✅ Format đúng với router HF
        const text =
            data?.choices?.[0]?.message?.content ||
            "Không nhận được phản hồi từ AI";

        return text;

    } catch (err: any) {
        console.error("HF Error:", err.response?.data || err.message);
        throw new Error("HF API error");
    }
};
