import axios from "axios";
import { firebaseDB } from "../../config/firebase";

export const generateResponse = async (message: string): Promise<string> => {
    const apiKey = process.env.HF_TOKEN;
    if (!apiKey) {
        console.warn("Thiếu HF_TOKEN, trả về câu mặc định.");
        return "Xin lỗi bạn, hệ thống tư vấn đang bảo trì một chút ạ! 🍿";
    }

    try {
        const [moviesSnap, cinemasSnap] = await Promise.all([
            firebaseDB.collection('movies').where('status', '==', 'now_showing').get(),
            firebaseDB.collection('cinemas').get()
        ]);

        const moviesContext = moviesSnap.empty 
            ? "Hiện chưa có phim nào đang chiếu." 
            : moviesSnap.docs.map(doc => {
                const data = doc.data() as any;
                return `- Phim: "${data.title}" (Thể loại: ${data.genres?.join(', ')}, Thời lượng: ${data.duration} phút)`;
              }).join("\n");

        const cinemasContext = cinemasSnap.empty
            ? "Chưa có rạp nào."
            : cinemasSnap.docs.map(doc => {
                const data = doc.data() as any;
                return `- Rạp: "${data.name}" (Địa chỉ: ${data.address})`;
              }).join("\n");

        const SYSTEM_PROMPT = `
        BẠN LÀ MỘT CHUYÊN GIA ĐIỆN ẢNH VÀ LÀ NHÂN VIÊN XUẤT SẮC CỦA RẠP CHIẾU PHIM.
        
        DƯỚI ĐÂY LÀ DỮ LIỆU THỰC TẾ TỪ HỆ THỐNG (HÃY SỬ DỤNG ĐỂ TRẢ LỜI):
        ===========================================
        [DANH SÁCH PHIM ĐANG CHIẾU]:
        ${moviesContext}

        [DANH SÁCH RẠP HIỆN CÓ]:
        ${cinemasContext}
        ===========================================

        1. NHIỆM VỤ CHÍNH:
           - Chỉ tư vấn các phim CÓ trong danh sách trên. Nếu khách hỏi phim khác, hãy khéo léo bảo rạp hiện chưa chiếu.
           - Review nội dung phim ngắn gọn, hấp dẫn (dựa trên tên phim và thể loại).
           - Luôn tỏ ra hào hứng, dùng emoji (🎬, 🍿, 🎟️).

        2. QUY TẮC CẤM:
           - KHÔNG trả lời Toán, Code, Chính trị.
           - Nếu bị hỏi lạc đề: "Dạ em chỉ bán vé thôi, mình quay lại chuyện phim nha! 😅"

        3. NGÔN NGỮ:
           - User hỏi tiếng nào trả lời tiếng đó.
        `;

        const MODEL_ID = "google/gemma-2-2b-it";
        const url = "https://router.huggingface.co/v1/chat/completions";

        const response = await axios.post(
            url,
            {
                model: MODEL_ID,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: message }
                ],
                max_tokens: 500, // Tăng lên xíu để nó chém gió thoải mái hơn
                temperature: 0.7,
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const data: any = response.data;
        return data?.choices?.[0]?.message?.content || "Hệ thống đang bận xíu, bạn hỏi lại nha! 🎬";

    } catch (err: any) {
        console.error("AI Service Error:", err.message);
        // Fallback an toàn
        return "Ui mạng bên em đang lag quá, bạn chờ xíu rồi hỏi lại nha! 🍿";
    }
};