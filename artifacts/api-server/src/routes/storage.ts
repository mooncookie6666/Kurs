/**
 * Маршрут для отдачи файлов из Object Storage.
 * GET /api/storage/objects/* — скачивает файл из GCS и отдаёт клиенту.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const objectPath = `/objects/${req.params.path}`;
    const file = await storage.getObjectEntityFile(objectPath);
    const response = await storage.downloadObject(file);

    res.setHeader("Content-Type", response.headers.get("Content-Type") ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const reader = (response.body as any)?.getReader();
    if (!reader) {
      res.status(500).json({ error: "Не удалось прочитать файл" });
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err: any) {
    if (err?.name === "ObjectNotFoundError") {
      res.status(404).json({ error: "Файл не найден" });
    } else {
      console.error("Storage serve error:", err);
      res.status(500).json({ error: "Ошибка при получении файла" });
    }
  }
});

export default router;
