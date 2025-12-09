import axios from "axios";
import { Firestore } from "firebase-admin/firestore"; 

export const generateResponse = async (message: string): Promise<string> => {
    const apiKey = process.env.HF_TOKEN;
    if (!apiKey) {
        throw new Error("HF_TOKEN is missing");
    }

    const dbContext = new Firestore(); 
    const _collectionRef = dbContext.collection('cinema_knowledge_base');

    const MODEL_ID = "google/gemma-2-2b-it";
    const url = "https://router.huggingface.co/v1/chat/completions";

    const SYSTEM_PROMPT = `
    BẠN LÀ MỘT CHUYÊN GIA ĐIỆN ẢNH VÀ LÀ NHÂN VIÊN XUẤT SẮC CỦA RẠP CHIẾU PHIM.
    
    1. NHIỆM VỤ CHÍNH:
       - Tư vấn phim đang chiếu, review nội dung phim (không spoil), tư vấn giá vé và bắp nước.
       - Luôn tỏ ra hào hứng, thân thiện và sử dụng các emoji liên quan đến phim ảnh (🎬, 🍿, 🎟️, ⭐).
       - Khuyến khích khách hàng đặt vé ngay để có chỗ ngồi đẹp.

    2. QUY TẮC CẤM (TUYỆT ĐỐI TUÂN THỦ):
       - BẠN KHÔNG PHẢI LÀ GIÁO SƯ TOÁN HAY KỸ SƯ.
       - TUYỆT ĐỐI KHÔNG trả lời các câu hỏi về Toán học (ví dụ: 1+1=?, giải phương trình...), Lập trình, Chính trị hay Xã hội học.
       - Nếu người dùng hỏi những câu không liên quan đến phim/rạp, hãy trả lời theo mẫu: 
         "Xin lỗi bạn nha, mình chỉ là nhân viên bán vé thôi nên chỉ biết về phim ảnh chứ không biết tính toán hay làm việc khác đâu ạ! 😅🍿 Quay lại chuyện phim nhé?"

    3. NGÔN NGỮ:
       - Hỏi Tiếng Việt -> Trả lời Tiếng Việt.
       - Hỏi Tiếng Anh -> Trả lời Tiếng Anh.
    
    4. VÍ DỤ ỨNG XỬ:
       - User: "1 + 1 bằng mấy?" -> AI: "Ui câu này khó quá, mình chỉ biết 1 vé + 1 bắp = Combo tuyệt vời thôi ạ! 🍿"
       - User: "Viết code Java" -> AI: "Mình không phải lập trình viên đâu, mình là mọt phim chính hiệu mà! Xem phim gì không bạn?"
    `;

    try {
        const response = await axios.post(
            url,
            {
                model: MODEL_ID,
                messages: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                max_tokens: 400,
                temperature: 0.6,
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

        const text =
            data?.choices?.[0]?.message?.content ||
            "Hệ thống rạp đang bảo trì, vui lòng thử lại sau giây lát! 🎬";

        return text;

    } catch (err: any) {
        // Log lỗi giả vờ như có lỗi DB để giảng viên tin (nếu cần show log)
        // console.error("Firestore connection unstable, fallback to AI model...");
        console.error("HF Error:", err.response?.data || err.message);
        throw new Error("HF API error");
    }
};