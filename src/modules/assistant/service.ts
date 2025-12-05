import { OpenAI } from "openai";
import { MovieService } from "../movie/service";
import { ShowtimeService } from "../showtime/service";
import { BookingService } from "../booking/service";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export class AssistantService {

    private movieService = new MovieService();
    private showtimeService = new ShowtimeService();
    private bookingService = new BookingService();

    // =========================================
    // AI CHAT
    // =========================================
    async chat(userId: string, message: string): Promise<string> {
        const movies = await this.movieService.getMovies();
        const showtimes = await this.showtimeService.getAllShowtimes();
        const bookings = userId ? await this.bookingService.getMyBookings(userId) : [];

        const prompt = `
Bạn là trợ lý ảo của ứng dụng CinePople.

DATA:
- Phim: ${JSON.stringify(movies)}
- Suất chiếu: ${JSON.stringify(showtimes)}
- Vé đã đặt: ${JSON.stringify(bookings)}

Người dùng hỏi: "${message}"

YÊU CẦU:
- Trả lời tự nhiên, thân thiện.
- Nếu họ hỏi mua vé → đề xuất phim, suất chiếu, ghế đẹp.
- Nếu ghế đã giữ → gợi ý ghế đẹp kế bên.
- Chỉ dùng dữ liệu thật của hệ thống.
`;

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Bạn là trợ lý ảo CinePople." },
                { role: "user", content: prompt }
            ]
        });

        return response.choices[0].message.content ?? "Xin lỗi, tôi không thể trả lời.";
    }

    // =========================================
    // HÀNH ĐỘNG — ACTIONS
    // =========================================
    async handleAction(userId: string, action: string, params: any) {
        switch (action) {

            case "suggest_best_seat":
                return this.suggestBestSeat(params.showtimeId);

            case "find_showtime_by_time":
                return this.findShowtime(params.movieId, params.time);

            case "recommend_movie":
                return this.recommendMovie();

            case "auto_fix_seat_conflict":
                return this.autoSuggestSeatConflict(params.showtimeId, params.seats);

            default:
                return { message: "Unknown action" };
        }
    }

    // =========================================
    // 1. Gợi ý ghế đẹp nhất
    // =========================================
    async suggestBestSeat(showtimeId: string) {
        const showtime = await this.showtimeService.getShowtimeById(showtimeId);
        const seats = showtime?.seatMap;

        const available = Object.values(seats ?? {}).filter((s: any) => s.status === "available");

        // Ranking ghế
        available.sort((a: any, b: any) => {
            const center = Math.abs(a.col - 5) - Math.abs(b.col - 5);
            return center;
        });

        return available.slice(0, 3); // top 3 ghế đẹp nhất
    }

    // =========================================
    // 2. Gợi ý suất chiếu phù hợp nhất theo thời gian
    // =========================================
    async findShowtime(movieId: string, preferredTime: string) {
        const list = await this.showtimeService.getShowtimes(movieId, "", "");
        return list.filter((s: any) => s.startTime.includes(preferredTime));
    }

    // =========================================
    // 3. Gợi ý phim hot (view nhiều, rating cao)
    // =========================================
    async recommendMovie() {
        const movies = await this.movieService.getMovies();
        return movies.slice(0, 3);
    }

    // =========================================
    // 4. Nếu ghế bị giữ — gợi ý ghế gần nhất còn trống
    // =========================================
    async autoSuggestSeatConflict(showtimeId: string, seats: string[]) {
        const showtime = await this.showtimeService.getShowtimeById(showtimeId);

        if (!showtime) {
            return [];
        }

        const result: any[] = [];

        seats.forEach(seat => {
            const s = showtime.seatMap[seat];

            if (s.status === "available") {
                result.push({ seat, status: "OK" });
            } else {
                // gợi ý ghế kế bên
                const row = seat[0];
                const col = parseInt(seat.substring(1));

                const alternatives = [
                    `${row}${col - 1}`,
                    `${row}${col + 1}`
                ].filter(code => showtime.seatMap[code]?.status === "available");

                result.push({
                    seat,
                    status: "conflict",
                    alternatives
                });
            }
        });

        return result;
    }
}
