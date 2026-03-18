import { Router, type IRouter } from "express";
import { db, itemsTable, likesTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

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

router.get("/categories", (_req, res) => {
  res.json(CATEGORIES);
});

router.get("/items", async (req, res) => {
  try {
    const { category, userId } = req.query;
    const currentUserId = req.user?.id;

    const items = await db
      .select({
        id: itemsTable.id,
        userId: itemsTable.userId,
        name: itemsTable.name,
        category: itemsTable.category,
        description: itemsTable.description,
        photoUrl: itemsTable.photoUrl,
        createdAt: itemsTable.createdAt,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
        userProfileImageUrl: usersTable.profileImageUrl,
        likesCount: sql<number>`CAST(COUNT(DISTINCT ${likesTable.id}) AS INTEGER)`,
        likedByMe: currentUserId
          ? sql<boolean>`BOOL_OR(${likesTable.userId} = ${currentUserId})`
          : sql<boolean>`FALSE`,
      })
      .from(itemsTable)
      .leftJoin(usersTable, eq(itemsTable.userId, usersTable.id))
      .leftJoin(likesTable, eq(itemsTable.id, likesTable.itemId))
      .where(
        and(
          category && typeof category === "string"
            ? eq(itemsTable.category, category)
            : undefined,
          userId && typeof userId === "string"
            ? eq(itemsTable.userId, userId)
            : undefined
        )
      )
      .groupBy(
        itemsTable.id,
        itemsTable.userId,
        itemsTable.name,
        itemsTable.category,
        itemsTable.description,
        itemsTable.photoUrl,
        itemsTable.createdAt,
        usersTable.firstName,
        usersTable.lastName,
        usersTable.profileImageUrl
      )
      .orderBy(desc(itemsTable.createdAt));

    res.json(items);
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

const createItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  photoUrl: z.string().min(1),
});

router.post("/items", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const [item] = await db
      .insert(itemsTable)
      .values({
        userId: req.user.id,
        name: parsed.data.name,
        category: parsed.data.category,
        description: parsed.data.description ?? null,
        photoUrl: parsed.data.photoUrl,
      })
      .returning();

    res.status(201).json(item);
  } catch (err) {
    console.error("Error creating item:", err);
    res.status(500).json({ error: "Failed to create item" });
  }
});

router.delete("/items/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [item] = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.id, id))
      .limit(1);

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    if (item.userId !== req.user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(itemsTable).where(eq(itemsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting item:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

router.post("/items/:id/like", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(likesTable)
      .where(
        and(
          eq(likesTable.userId, req.user.id),
          eq(likesTable.itemId, id)
        )
      )
      .limit(1);

    let liked: boolean;

    if (existing.length > 0) {
      await db
        .delete(likesTable)
        .where(
          and(
            eq(likesTable.userId, req.user.id),
            eq(likesTable.itemId, id)
          )
        );
      liked = false;
    } else {
      await db.insert(likesTable).values({
        userId: req.user.id,
        itemId: id,
      });
      liked = true;
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(likesTable)
      .where(eq(likesTable.itemId, id));

    res.json({ liked, likesCount: countResult?.count ?? 0 });
  } catch (err) {
    console.error("Error toggling like:", err);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

export default router;
