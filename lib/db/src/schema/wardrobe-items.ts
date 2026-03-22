/**
 * Вещи гардероба. Ссылаются на local_users (локальная авторизация).
 *
 * Поля:
 *   id          — уникальный ID
 *   localUserId — ID владельца из таблицы local_users
 *   name        — название вещи ("Чёрная куртка")
 *   category    — категория ("Куртки", "Обувь" и т.д.)
 *   description — описание (необязательно)
 *   photoUrl    — ссылка на фото
 *   createdAt   — дата добавления
 */
import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { localUsersTable } from "./local-users";

export const wardrobeItemsTable = pgTable("wardrobe_items", {
  id: serial("id").primaryKey(),
  localUserId: integer("local_user_id")
    .notNull()
    .references(() => localUsersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  photoUrl: text("photo_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Лайки. Один пользователь может лайкнуть одну вещь только один раз
 * (уникальный индекс по паре localUserId + itemId).
 */
export const wardrobeLikesTable = pgTable(
  "wardrobe_likes",
  {
    id: serial("id").primaryKey(),
    localUserId: integer("local_user_id")
      .notNull()
      .references(() => localUsersTable.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => wardrobeItemsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("wardrobe_likes_user_item_unique").on(table.localUserId, table.itemId)]
);

export const insertWardrobeItemSchema = createInsertSchema(wardrobeItemsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWardrobeItem = z.infer<typeof insertWardrobeItemSchema>;
export type WardrobeItem = typeof wardrobeItemsTable.$inferSelect;
export type WardrobeLike = typeof wardrobeLikesTable.$inferSelect;
