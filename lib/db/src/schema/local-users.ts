/**
 * Локальная таблица пользователей с хешированными паролями.
 * Полностью независима от OAuth/Replit Auth.
 *
 * Поля:
 *   id           — уникальный числовой ID (автоинкремент)
 *   email        — уникальный email (используется как логин)
 *   username     — отображаемое имя пользователя
 *   passwordHash — хеш пароля (bcrypt, NOT открытый текст)
 *   createdAt    — дата регистрации
 */
import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const localUsersTable = pgTable("local_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLocalUserSchema = createInsertSchema(localUsersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertLocalUser = z.infer<typeof insertLocalUserSchema>;
export type LocalUser = typeof localUsersTable.$inferSelect;
