import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "auth_session_token";

export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

export async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${base}${path}`, {
    ...options,
    headers,
  });
}

export interface ItemWithUser {
  id: number;
  userId: string;
  name: string;
  category: string;
  description: string | null;
  photoUrl: string;
  createdAt: string;
  userFirstName: string | null;
  userLastName: string | null;
  userProfileImageUrl: string | null;
  likesCount: number;
  likedByMe: boolean;
}

export async function fetchItems(params?: { category?: string; userId?: string }): Promise<ItemWithUser[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.userId) query.set("userId", params.userId);
  const qs = query.toString();

  const res = await apiFetch(`/api/items${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch items");
  return res.json();
}

export async function fetchCategories(): Promise<string[]> {
  const res = await apiFetch("/api/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function createItem(data: {
  name: string;
  category: string;
  description?: string;
  photoUrl: string;
}): Promise<void> {
  const res = await apiFetch("/api/items", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create item");
}

export async function deleteItem(id: number): Promise<void> {
  const res = await apiFetch(`/api/items/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete item");
}

export async function toggleLike(id: number): Promise<{ liked: boolean; likesCount: number }> {
  const res = await apiFetch(`/api/items/${id}/like`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to toggle like");
  return res.json();
}
