/**
 * Контекст авторизации (локальная авторизация).
 *
 * Логика:
 * 1. При загрузке приложения — вызываем GET /api/auth/me
 *    Если сервер вернул пользователя → сессия активна → пользователь авторизован
 *    Если null → нужно войти
 * 2. login(email, password) — POST /api/auth/login
 *    Сервер проверяет пароль через bcrypt, создаёт сессию, устанавливает cookie
 * 3. register(email, username, password) — POST /api/auth/register
 *    Сервер хеширует пароль, создаёт пользователя, создаёт сессию
 * 4. logout() — POST /api/auth/logout
 *    Сервер удаляет сессию из БД, очищает cookie
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { apiLogin, apiLogout, apiMe, apiRegister, type User } from "./api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // При запуске — проверяем, есть ли активная сессия (GET /api/auth/me)
  useEffect(() => {
    apiMe()
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const u = await apiRegister(email, username, password);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
