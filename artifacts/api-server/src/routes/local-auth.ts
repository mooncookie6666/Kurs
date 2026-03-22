/**
 * Маршруты локальной авторизации.
 *
 * КАК РАБОТАЕТ ЛОГИН (шаг за шагом):
 * 1. Фронтенд отправляет POST /api/auth/login с { email, password }
 * 2. Сервер ищет пользователя в таблице local_users по email
 * 3. Если не найден → 401 "Неверный email или пароль"
 * 4. bcrypt.compare() сравнивает введённый пароль с хешем из БД
 *    - bcrypt хранит алгоритм + соль + хеш в одной строке
 *    - при проверке он извлекает соль из хеша и хеширует введённый пароль с той же солью
 *    - сравнивает результат с сохранённым хешем
 * 5. Если хеш не совпадает → 401 "Неверный email или пароль"
 * 6. Если всё ОК → req.session.userId = user.id (сессия сохраняется в БД)
 * 7. Сервер отправляет Set-Cookie: connect.sid=<session_id>
 * 8. Фронтенд сохраняет cookie автоматически (credentials: "include")
 *
 * КАК РАБОТАЕТ ХЕШИРОВАНИЕ (bcrypt):
 * - bcrypt генерирует случайную "соль" (salt) — уникальную для каждого пользователя
 * - смешивает соль + пароль и прогоняет через сложный алгоритм N раз (cost factor = 12)
 * - результат: "$2b$12$<22_символа_соли><31_символ_хеша>"
 * - НЕЛЬЗЯ обратно получить пароль из хеша — только проверить совпадение
 * - даже одинаковые пароли дают разные хеши из-за разных солей
 *
 * КАК ХРАНИТСЯ СЕССИЯ:
 * - express-session генерирует случайный session_id
 * - сохраняет { userId, createdAt } в таблице user_sessions в PostgreSQL
 * - session_id отправляется клиенту в cookie (httpOnly, secure в продакшн)
 * - при каждом запросе: cookie → session_id → загружается данные из БД → req.session.userId
 */

import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { db, localUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

// Схемы валидации входных данных
const registerSchema = z.object({
  email: z.string().email("Некорректный email"),
  username: z.string().min(2, "Имя минимум 2 символа").max(50),
  password: z.string().min(6, "Пароль минимум 6 символов"),
});

const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register — регистрация нового пользователя
// ──────────────────────────────────────────────────────────────────────────────
router.post("/auth/register", async (req: Request, res: Response) => {
  // 1. Валидируем входные данные
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Некорректные данные";
    res.status(400).json({ error: message });
    return;
  }

  const { email, username, password } = parsed.data;

  try {
    // 2. Проверяем, существует ли уже пользователь с таким email
    const existing = await db
      .select({ id: localUsersTable.id })
      .from(localUsersTable)
      .where(eq(localUsersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Пользователь с таким email уже существует" });
      return;
    }

    // 3. Хешируем пароль с помощью bcrypt (cost factor = 12)
    //    Чем выше cost factor, тем медленнее подбор перебором
    //    12 = оптимальный баланс безопасности и скорости (~300ms)
    const passwordHash = await bcrypt.hash(password, 12);

    // 4. Сохраняем пользователя в БД (пароль НЕ хранится, только хеш)
    const [user] = await db
      .insert(localUsersTable)
      .values({
        email: email.toLowerCase(),
        username,
        passwordHash,
      })
      .returning({
        id: localUsersTable.id,
        email: localUsersTable.email,
        username: localUsersTable.username,
      });

    // 5. Создаём сессию — сохраняем userId в session store (PostgreSQL)
    (req.session as any).userId = user.id;

    res.status(201).json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Ошибка сервера при регистрации" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login — вход существующего пользователя
// ──────────────────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req: Request, res: Response) => {
  // 1. Валидируем входные данные
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Некорректные данные";
    res.status(400).json({ error: message });
    return;
  }

  const { email, password } = parsed.data;

  try {
    // 2. Ищем пользователя в БД по email (нечувствительно к регистру)
    const [user] = await db
      .select()
      .from(localUsersTable)
      .where(eq(localUsersTable.email, email.toLowerCase()))
      .limit(1);

    // 3. ВАЖНО: одинаковое сообщение для "не найден" и "неверный пароль"
    //    Это предотвращает утечку информации о существовании email
    if (!user) {
      res.status(401).json({ error: "Неверный email или пароль" });
      return;
    }

    // 4. Сравниваем введённый пароль с хешем из БД
    //    bcrypt.compare() сама извлекает соль из хеша и проверяет
    //    Никогда НЕ делать: user.passwordHash === bcrypt.hash(password, ...)
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      res.status(401).json({ error: "Неверный email или пароль" });
      return;
    }

    // 5. Пароль верный — создаём новую сессию
    //    req.session — объект, который express-session автоматически
    //    сохраняет в таблицу user_sessions в PostgreSQL
    (req.session as any).userId = user.id;

    res.json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Ошибка сервера при входе" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me — получить текущего авторизованного пользователя
//
// Как работает: клиент отправляет cookie с session_id → express-session
// находит запись в user_sessions → загружает userId → мы ищем юзера в БД
// ──────────────────────────────────────────────────────────────────────────────
router.get("/auth/me", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;

  if (!userId) {
    // Нет сессии — пользователь не авторизован
    res.json({ user: null });
    return;
  }

  try {
    const [user] = await db
      .select({
        id: localUsersTable.id,
        email: localUsersTable.email,
        username: localUsersTable.username,
        createdAt: localUsersTable.createdAt,
      })
      .from(localUsersTable)
      .where(eq(localUsersTable.id, userId))
      .limit(1);

    if (!user) {
      // Сессия есть, но пользователь удалён из БД
      req.session.destroy(() => {});
      res.json({ user: null });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error("Auth me error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout — выход
// ──────────────────────────────────────────────────────────────────────────────
router.post("/auth/logout", (req: Request, res: Response) => {
  // Удаляем сессию из БД и очищаем cookie
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Ошибка при выходе" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

export default router;
