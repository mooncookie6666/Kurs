/**
 * Маршруты для вещей гардероба.
 *
 * Авторизация: проверяем req.session.userId (local auth)
 * Закрытые маршруты (POST, DELETE, POST /like) требуют авторизации.
 * Открытые маршруты (GET) доступны всем.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  wardrobeItemsTable,
  wardrobeLikesTable,
  localUsersTable,
} from "@workspace/db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

// Вспомогательная функция: получить авторизованного пользователя из сессии
function getSessionUserId(req: Request): number | null {
  return (req.session as any).userId ?? null;
}

// Категории одежды
const CATEGORIES = [
  "Куртки",
  "Верхняя одежда",
  "Толстовки",
  "Футболки",
  "Рубашки",
  "Платья",
  "Юбки",
  "Брюки",
  "Джинсы",
  "Шорты",
  "Обувь",
  "Аксессуары",
  "Сумки",
  "Другое",
];

// GET /api/categories — список категорий (открытый)
router.get("/categories", (_req: Request, res: Response) => {
  res.json(CATEGORIES);
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/items — лента всех вещей (открытый маршрут)
// Параметры: ?category= фильтр по категории, ?userId= фильтр по пользователю
// ──────────────────────────────────────────────────────────────────────────────
router.get("/items", async (req: Request, res: Response) => {
  try {
    const { category, userId } = req.query;
    const currentUserId = getSessionUserId(req);

    const items = await db
      .select({
        id: wardrobeItemsTable.id,
        localUserId: wardrobeItemsTable.localUserId,
        name: wardrobeItemsTable.name,
        category: wardrobeItemsTable.category,
        description: wardrobeItemsTable.description,
        photoUrl: wardrobeItemsTable.photoUrl,
        createdAt: wardrobeItemsTable.createdAt,
        username: localUsersTable.username,
        likesCount: sql<number>`CAST(COUNT(DISTINCT ${wardrobeLikesTable.id}) AS INTEGER)`,
        // Проверяем, лайкнул ли текущий авторизованный пользователь эту вещь
        likedByMe: currentUserId
          ? sql<boolean>`BOOL_OR(${wardrobeLikesTable.localUserId} = ${currentUserId})`
          : sql<boolean>`FALSE`,
      })
      .from(wardrobeItemsTable)
      .leftJoin(
        localUsersTable,
        eq(wardrobeItemsTable.localUserId, localUsersTable.id)
      )
      .leftJoin(
        wardrobeLikesTable,
        eq(wardrobeItemsTable.id, wardrobeLikesTable.itemId)
      )
      .where(
        and(
          category && typeof category === "string"
            ? eq(wardrobeItemsTable.category, category)
            : undefined,
          userId && !isNaN(Number(userId))
            ? eq(wardrobeItemsTable.localUserId, Number(userId))
            : undefined
        )
      )
      .groupBy(
        wardrobeItemsTable.id,
        wardrobeItemsTable.localUserId,
        wardrobeItemsTable.name,
        wardrobeItemsTable.category,
        wardrobeItemsTable.description,
        wardrobeItemsTable.photoUrl,
        wardrobeItemsTable.createdAt,
        localUsersTable.username
      )
      .orderBy(desc(wardrobeItemsTable.createdAt));

    res.json(items);
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ error: "Не удалось загрузить вещи" });
  }
});

const createItemSchema = z.object({
  name: z.string().min(1, "Введите название"),
  category: z.string().min(1, "Выберите категорию"),
  description: z.string().optional(),
  photoUrl: z.string().min(1, "Добавьте ссылку на фото"),
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/items — добавить вещь (только авторизованным)
// ──────────────────────────────────────────────────────────────────────────────
router.post("/items", async (req: Request, res: Response) => {
  // Проверяем авторизацию через сессию
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Необходимо войти в аккаунт" });
    return;
  }

  // Проверяем, не заблокирован ли пользователь
  const [currentUser] = await db
    .select({ isBlocked: localUsersTable.isBlocked })
    .from(localUsersTable)
    .where(eq(localUsersTable.id, userId))
    .limit(1);

  if (currentUser?.isBlocked) {
    res.status(403).json({ error: "Ваш аккаунт заблокирован. Вы не можете добавлять вещи." });
    return;
  }

  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Некорректные данные";
    res.status(400).json({ error: msg });
    return;
  }

  try {
    const [item] = await db
      .insert(wardrobeItemsTable)
      .values({
        localUserId: userId,
        name: parsed.data.name,
        category: parsed.data.category,
        description: parsed.data.description ?? null,
        photoUrl: parsed.data.photoUrl,
      })
      .returning();

    res.status(201).json(item);
  } catch (err) {
    console.error("Error creating item:", err);
    res.status(500).json({ error: "Не удалось добавить вещь" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/items/:id — удалить вещь (только владелец)
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/items/:id", async (req: Request, res: Response) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Необходимо войти в аккаунт" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Некорректный ID" });
    return;
  }

  try {
    const [item] = await db
      .select()
      .from(wardrobeItemsTable)
      .where(eq(wardrobeItemsTable.id, id))
      .limit(1);

    if (!item) {
      res.status(404).json({ error: "Вещь не найдена" });
      return;
    }

    // Только владелец может удалить свою вещь
    if (item.localUserId !== userId) {
      res.status(403).json({ error: "Нет прав для удаления" });
      return;
    }

    await db.delete(wardrobeItemsTable).where(eq(wardrobeItemsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting item:", err);
    res.status(500).json({ error: "Не удалось удалить вещь" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/items/:id/like — переключить лайк (только авторизованным)
// ──────────────────────────────────────────────────────────────────────────────
router.post("/items/:id/like", async (req: Request, res: Response) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Необходимо войти в аккаунт" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Некорректный ID" });
    return;
  }

  try {
    // Проверяем, лайкнул ли уже
    const existing = await db
      .select()
      .from(wardrobeLikesTable)
      .where(
        and(
          eq(wardrobeLikesTable.localUserId, userId),
          eq(wardrobeLikesTable.itemId, id)
        )
      )
      .limit(1);

    let liked: boolean;

    if (existing.length > 0) {
      // Убираем лайк
      await db.delete(wardrobeLikesTable).where(
        and(
          eq(wardrobeLikesTable.localUserId, userId),
          eq(wardrobeLikesTable.itemId, id)
        )
      );
      liked = false;
    } else {
      // Ставим лайк
      await db.insert(wardrobeLikesTable).values({
        localUserId: userId,
        itemId: id,
      });
      liked = true;
    }

    // Возвращаем актуальное количество лайков
    const [countResult] = await db
      .select({ count: count() })
      .from(wardrobeLikesTable)
      .where(eq(wardrobeLikesTable.itemId, id));

    res.json({ liked, likesCount: countResult?.count ?? 0 });
  } catch (err) {
    console.error("Error toggling like:", err);
    res.status(500).json({ error: "Ошибка" });
  }
});

export default router;
