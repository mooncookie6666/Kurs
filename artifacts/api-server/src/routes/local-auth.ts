/**
 * Маршруты локальной авторизации.
 *
 * КАК РАБОТАЕТ ЛОГИН (шаг за шагом):
 * 1. Фронтенд отправляет POST /api/auth/login с { email, password }
 * 2. Сервер ищет пользователя в таблице local_users по email
 * 3. Если не найден → 401 "Неверный email или пароль"
 * 4. Если isBlocked = true → 403 "Аккаунт заблокирован"
 * 5. bcrypt.compare() сравнивает введённый пароль с хешем из БД
 * 6. Если всё ОК → req.session.userId = user.id
 * 7. Сервер отправляет Set-Cookie: connect.sid=<session_id>
 */

import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { db, localUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

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
// POST /api/auth/register
// ──────────────────────────────────────────────────────────────────────────────
router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Некорректные данные" });
    return;
  }

  const { email, username, password } = parsed.data;

  try {
    const existing = await db
      .select({ id: localUsersTable.id })
      .from(localUsersTable)
      .where(eq(localUsersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Пользователь с таким email уже существует" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(localUsersTable)
      .values({ email: email.toLowerCase(), username, passwordHash })
      .returning({
        id: localUsersTable.id,
        email: localUsersTable.email,
        username: localUsersTable.username,
        isAdmin: localUsersTable.isAdmin,
        isBlocked: localUsersTable.isBlocked,
      });

    (req.session as any).userId = user.id;

    res.status(201).json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin, isBlocked: user.isBlocked },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Ошибка сервера при регистрации" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Некорректные данные" });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(localUsersTable)
      .where(eq(localUsersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Неверный email или пароль" });
      return;
    }

    // Проверяем блокировку ДО проверки пароля (не раскрываем это)
    if (user.isBlocked) {
      res.status(403).json({ error: "Ваш аккаунт заблокирован администратором" });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ error: "Неверный email или пароль" });
      return;
    }

    (req.session as any).userId = user.id;

    res.json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin, isBlocked: user.isBlocked },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Ошибка сервера при входе" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ──────────────────────────────────────────────────────────────────────────────
router.get("/auth/me", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;

  if (!userId) {
    res.json({ user: null });
    return;
  }

  try {
    const [user] = await db
      .select({
        id: localUsersTable.id,
        email: localUsersTable.email,
        username: localUsersTable.username,
        isAdmin: localUsersTable.isAdmin,
        isBlocked: localUsersTable.isBlocked,
        createdAt: localUsersTable.createdAt,
      })
      .from(localUsersTable)
      .where(eq(localUsersTable.id, userId))
      .limit(1);

    if (!user) {
      req.session.destroy(() => {});
      res.json({ user: null });
      return;
    }

    // Если пользователь заблокирован — завершаем сессию
    if (user.isBlocked) {
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
// POST /api/auth/logout
// ──────────────────────────────────────────────────────────────────────────────
router.post("/auth/logout", (req: Request, res: Response) => {
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
