/**
 * Маршрут загрузки фотографий.
 *
 * POST /api/upload/image — принимает изображение в формате base64 от мобильного приложения,
 * сохраняет в Object Storage и возвращает публичный URL.
 *
 * Формат запроса: { data: "data:image/jpeg;base64,..." }
 * Формат ответа:  { url: "https://..." }
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService } from "../lib/objectStorage";
import { Readable } from "stream";

const router: IRouter = Router();
const storage = new ObjectStorageService();

router.post("/upload/image", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Необходимо войти в аккаунт" });
    return;
  }

  const { data } = req.body as { data?: string };
  if (!data) {
    res.status(400).json({ error: "Поле data обязательно" });
    return;
  }

  try {
    // data — строка вида "data:image/jpeg;base64,<base64>"
    const match = data.match(/^data:([a-zA-Z0-9+/]+\/[a-zA-Z0-9+/]+);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: "Неверный формат изображения (ожидается base64 data URL)" });
      return;
    }

    const contentType = match[1]!;
    const base64 = match[2]!;
    const buffer = Buffer.from(base64, "base64");

    // Получаем presigned URL для загрузки
    const uploadUrl = await storage.getObjectEntityUploadURL();

    // Загружаем напрямую в GCS через presigned URL
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: buffer,
    });

    if (!uploadRes.ok) {
      throw new Error(`GCS upload failed: ${uploadRes.status}`);
    }

    // Нормализуем путь к объекту
    const objectPath = storage.normalizeObjectEntityPath(uploadUrl.split("?")[0]!);
    // Формируем URL для доступа к файлу через наш API
    const publicUrl = `/api/storage${objectPath}`;

    res.json({ url: publicUrl, objectPath });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Не удалось загрузить изображение" });
  }
});

export default router;
