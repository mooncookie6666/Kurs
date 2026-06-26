import { Router, type IRouter, type Request, type Response } from "express";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const UPLOADS_DIR = join(process.cwd(), "uploads");

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

  const match = data.match(/^data:([a-zA-Z0-9+/]+\/[a-zA-Z0-9+/]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: "Неверный формат изображения (ожидается base64 data URL)" });
    return;
  }

  const contentType = match[1]!;
  const base64 = match[2]!;
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const filename = `${randomUUID()}.${ext}`;

  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
    const buffer = Buffer.from(base64, "base64");
    await writeFile(join(UPLOADS_DIR, filename), buffer);

    const url = `/api/uploads/${filename}`;
    res.json({ url });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Не удалось сохранить изображение" });
  }
});

export default router;
