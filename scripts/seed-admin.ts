/**
 * Скрипт создания аккаунта администратора.
 *
 * Запуск: pnpm tsx scripts/seed-admin.ts
 *
 * Email: admin@fits.app
 * Пароль: Admin123!
 */

import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { localUsersTable } from "../lib/db/src/schema/local-users.js";
import { eq } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL не задан");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const ADMIN_EMAIL = "admin@fits.app";
const ADMIN_USERNAME = "Администратор";
const ADMIN_PASSWORD = "Admin123!";

async function seedAdmin() {
  console.log("🔐 Создание аккаунта администратора...");

  const existing = await db
    .select({ id: localUsersTable.id, isAdmin: localUsersTable.isAdmin })
    .from(localUsersTable)
    .where(eq(localUsersTable.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    if (!existing[0]!.isAdmin) {
      await db
        .update(localUsersTable)
        .set({ isAdmin: true })
        .where(eq(localUsersTable.email, ADMIN_EMAIL));
      console.log("✅ Существующий пользователь повышен до администратора");
    } else {
      console.log("✅ Администратор уже существует");
    }
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const [admin] = await db
    .insert(localUsersTable)
    .values({
      email: ADMIN_EMAIL,
      username: ADMIN_USERNAME,
      passwordHash,
      isAdmin: true,
    })
    .returning({ id: localUsersTable.id, email: localUsersTable.email });

  console.log(`✅ Администратор создан: ${admin.email} (ID: ${admin.id})`);
  console.log(`📧 Email: ${ADMIN_EMAIL}`);
  console.log(`🔑 Пароль: ${ADMIN_PASSWORD}`);

  await pool.end();
}

seedAdmin().catch((err) => {
  console.error("Ошибка:", err);
  pool.end();
  process.exit(1);
});
