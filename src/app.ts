import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./modules/auth/routes";
import bookingRoutes from "./modules/booking/routes";
import userRoutes from "./modules/user/routes";
import testRoutes from "./modules/test/routes";
import movieRoutes from "./modules/movie/routes";
import regionRoutes from "./modules/region/routes";
import cinemaRouters from "./modules/cinema/routes";
import showtimeRouters from "./modules/showtime/routes";
import paymentRouters from "./modules/payment/routes";
import reviewRoutes from "./modules/review/routes"
import voucherRoutes from "./modules/voucher/routes"
import session from "express-session";
import { setupSwagger } from "./config/swagger";
import chatbotRoutes from "./modules/chatbot/routes";

const app = express();

app.use(express.json());

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(morgan("dev"));
app.use(session({
  secret: "secret",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

setupSwagger(app);

app.get("/", (_req, res) => res.json({ message: "Ciné API running" }));
app.get("/health", (_req, res) => res.sendStatus(200));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/test", testRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/regions", regionRoutes);
app.use("/api/cinemas", cinemaRouters);
app.use("/api/showtimes", showtimeRouters);
app.use("/api/payment", paymentRouters);
app.use("/api/reviews", reviewRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/chatbot", chatbotRoutes);
export default app;
