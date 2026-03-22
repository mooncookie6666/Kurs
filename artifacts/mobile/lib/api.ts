/**
 * Базовый API клиент.
 *
 * КАК ФРОНТЕНД ВЗАИМОДЕЙСТВУЕТ С СЕРВЕРОМ:
 * 1. При входе сервер отправляет Set-Cookie: connect.sid=<session_id> (httpOnly)
 * 2. Браузер автоматически сохраняет cookie и отправляет при каждом запросе
 * 3. credentials: "include" — обязательный параметр для cross-origin запросов
 * 4. Сервер по session_id находит userId → выполняет запрос как авторизованный
 *
 * httpOnly cookie недоступен из JS (защита от XSS).
 * Сессия живёт 7 дней.
 */

function getBase(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${getBase()}/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    },
  });
}

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  username: string;
  createdAt?: string;
}

export interface WardrobeItem {
  id: number;
  localUserId: number;
  name: string;
  category: string;
  description?: string | null;
  photoUrl: string;
  createdAt: string;
  username?: string;
  likesCount: number;
  likedByMe: boolean;
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<User> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Ошибка входа");
  return data.user as User;
}

export async function apiRegister(
  email: string,
  username: string,
  password: string
): Promise<User> {
  const res = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Ошибка регистрации");
  return data.user as User;
}

export async function apiMe(): Promise<User | null> {
  try {
    const res = await apiFetch("/auth/me");
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function apiLogout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {}
}

// ─── Items API ───────────────────────────────────────────────────────────────

export async function apiGetItems(params?: {
  category?: string;
  userId?: number;
}): Promise<WardrobeItem[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.userId) q.set("userId", String(params.userId));
  const qs = q.toString();
  const res = await apiFetch(`/items${qs ? `?${qs}` : ""}`);
  if (!res.ok) return [];
  return res.json();
}

export async function apiCreateItem(data: {
  name: string;
  category: string;
  description?: string;
  photoUrl: string;
}): Promise<WardrobeItem> {
  const res = await apiFetch("/items", {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Ошибка при добавлении");
  return json;
}

export async function apiDeleteItem(id: number): Promise<void> {
  const res = await apiFetch(`/items/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error ?? "Ошибка при удалении");
  }
}

export async function apiToggleLike(
  id: number
): Promise<{ liked: boolean; likesCount: number }> {
  const res = await apiFetch(`/items/${id}/like`, { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Ошибка");
  return json;
}

export async function apiGetCategories(): Promise<string[]> {
  const res = await apiFetch("/categories");
  if (!res.ok) return [];
  return res.json();
}
