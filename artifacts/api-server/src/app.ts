/**
 * Express приложение.
 *
 * ПОРЯДОК MIDDLEWARE ВАЖЕН:
 * 1. cors — должен быть первым, чтобы обрабатывать preflight запросы
 * 2. cookieParser — парсит cookies (нужен для express-session)
 * 3. session — загружает сессию по cookie → req.session.userId доступен в роутах
 * 4. json/urlencoded — парсит тело запроса
 * 5. роуты — обрабатывают запросы
 *
 * КАК РАБОТАЕТ СЕССИЯ:
 * - При первом запросе express-session генерирует уникальный session_id
 * - session_id → отправляется клиенту в cookie "connect.sid" (httpOnly)
 * - данные сессии (userId и т.д.) → сохраняются в таблице user_sessions в PostgreSQL
 * - при следующем запросе: cookie → session_id → загружаем данные из БД → req.session
 * - httpOnly cookie НЕДОСТУПЕН из JavaScript (защита от XSS)
 * - sameSite: "lax" защищает от CSRF атак
 */

import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { join } from "path";
import { pool } from "@workspace/db";
import router from "./routes";

const app: Express = express();

const PgStore = connectPgSimple(session);

// credentials: true + origin: true необходимо для отправки cookies в cross-origin запросах
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
// limit увеличен до 20mb для загрузки base64-изображений из галереи
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Статические файлы загруженных изображений
app.use("/api/uploads", express.static(join(process.cwd(), "uploads")));

// Сессии хранятся в PostgreSQL таблице user_sessions
// SESSION_SECRET должен быть длинной случайной строкой в продакшне
app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
    secret: process.env.SESSION_SECRET ?? "fits-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,      // недоступен из JS (защита от XSS)
      secure: process.env.NODE_ENV === "production",  // только HTTPS в продакшне
      sameSite: "lax",     // защита от CSRF
      maxAge: 1000 * 60 * 60 * 24 * 7,  // 7 дней
    },
  })
);

app.use("/api", router);

export default app;
