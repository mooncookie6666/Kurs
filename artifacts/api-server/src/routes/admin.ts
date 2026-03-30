/**
 * Маршруты администратора.
 *
 * Все маршруты требуют: авторизации + прав администратора (isAdmin = true).
 *
 * GET  /api/admin/users          — список всех пользователей
 * POST /api/admin/users/:id/block — заблокировать/разблокировать пользователя
 * DELETE /api/admin/items/:id    — удалить любую вещь (включая чужие)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, localUsersTable, wardrobeItemsTable, wardrobeLikesTable } from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";

const router: IRouter = Router();

// Middleware: проверяем, что пользователь — администратор
async function requireAdmin(req: Request, res: Response, next: Function) {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Необходима авторизация" });
    return;
  }

  const [user] = await db
    .select({ isAdmin: localUsersTable.isAdmin })
    .from(localUsersTable)
    .where(eq(localUsersTable.id, userId))
    .limit(1);

  if (!user?.isAdmin) {
    res.status(403).json({ error: "Доступ запрещён: требуются права администратора" });
    return;
  }

  next();
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users — список всех пользователей с количеством вещей
// ──────────────────────────────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await db
      .select({
        id: localUsersTable.id,
        email: localUsersTable.email,
        username: localUsersTable.username,
        isAdmin: localUsersTable.isAdmin,
        isBlocked: localUsersTable.isBlocked,
        createdAt: localUsersTable.createdAt,
        itemsCount: sql<number>`CAST(COUNT(DISTINCT ${wardrobeItemsTable.id}) AS INTEGER)`,
      })
      .from(localUsersTable)
      .leftJoin(wardrobeItemsTable, eq(localUsersTable.id, wardrobeItemsTable.localUserId))
      .groupBy(
        localUsersTable.id,
        localUsersTable.email,
        localUsersTable.username,
        localUsersTable.isAdmin,
        localUsersTable.isBlocked,
        localUsersTable.createdAt
      )
      .orderBy(desc(localUsersTable.createdAt));

    res.json(users);
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ error: "Ошибка при получении пользователей" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/block — заблокировать или разблокировать пользователя
// ──────────────────────────────────────────────────────────────────────────────
router.post("/admin/users/:id/block", requireAdmin, async (req: Request, res: Response) => {
  const targetId = Number(req.params.id);
  const currentUserId = (req.session as any).userId;

  if (isNaN(targetId)) {
    res.status(400).json({ error: "Некорректный ID пользователя" });
    return;
  }

  if (targetId === currentUserId) {
    res.status(400).json({ error: "Нельзя заблокировать самого себя" });
    return;
  }

  try {
    const [target] = await db
      .select({ id: localUsersTable.id, isBlocked: localUsersTable.isBlocked, isAdmin: localUsersTable.isAdmin })
      .from(localUsersTable)
      .where(eq(localUsersTable.id, targetId))
      .limit(1);

    if (!target) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }

    if (target.isAdmin) {
      res.status(400).json({ error: "Нельзя заблокировать другого администратора" });
      return;
    }

    const newBlocked = !target.isBlocked;
    await db
      .update(localUsersTable)
      .set({ isBlocked: newBlocked })
      .where(eq(localUsersTable.id, targetId));

    res.json({
      success: true,
      isBlocked: newBlocked,
      message: newBlocked ? "Пользователь заблокирован" : "Пользователь разблокирован",
    });
  } catch (err) {
    console.error("Block user error:", err);
    res.status(500).json({ error: "Ошибка при блокировке" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/items/:id — удалить любую вещь (без проверки владельца)
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/admin/items/:id", requireAdmin, async (req: Request, res: Response) => {
  const itemId = Number(req.params.id);

  if (isNaN(itemId)) {
    res.status(400).json({ error: "Некорректный ID вещи" });
    return;
  }

  try {
    const [item] = await db
      .select({ id: wardrobeItemsTable.id })
      .from(wardrobeItemsTable)
      .where(eq(wardrobeItemsTable.id, itemId))
      .limit(1);

    if (!item) {
      res.status(404).json({ error: "Вещь не найдена" });
      return;
    }

    await db.delete(wardrobeItemsTable).where(eq(wardrobeItemsTable.id, itemId));

    res.json({ success: true, message: "Вещь удалена" });
  } catch (err) {
    console.error("Admin delete item error:", err);
    res.status(500).json({ error: "Ошибка при удалении" });
  }
});

export default router;
