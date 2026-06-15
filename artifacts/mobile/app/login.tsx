/**
 * Экран входа и регистрации.
 *
 * Форма имеет два режима: "Вход" и "Регистрация" (переключается одной кнопкой).
 *
 * Шаг за шагом (ВХОД):
 * 1. Пользователь вводит email + пароль → нажимает "Войти"
 * 2. Вызывается apiLogin(email, password) → POST /api/auth/login
 * 3. Если сервер вернул ошибку → показываем сообщение (например "Неверный email или пароль")
 * 4. Если успех → сервер установил cookie с session_id
 * 5. AuthContext сохраняет user → приложение перенаправляет на главную страницу
 *
 * Шаг за шагом (РЕГИСТРАЦИЯ):
 * 1. Пользователь вводит email + имя + пароль → нажимает "Зарегистрироваться"
 * 2. Вызывается apiRegister() → POST /api/auth/register
 * 3. Сервер хеширует пароль через bcrypt и создаёт пользователя в БД
 * 4. Сервер сразу создаёт сессию → cookie установлен
 * 5. Пользователь авторизован
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSubmit = async () => {
    // Валидация на клиенте (быстрая проверка перед отправкой)
    if (!email.trim() || !password.trim()) {
      setError("Заполните все обязательные поля");
      return;
    }
    if (isRegister && !username.trim()) {
      setError("Введите имя пользователя");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        // POST /api/auth/register → сервер хеширует пароль → создаёт сессию
        await register(email.trim(), username.trim(), password);
      } else {
        // POST /api/auth/login → bcrypt.compare → создаёт сессию
        await login(email.trim(), password);
      }
      // Успех: AuthContext обновил user → перенаправляем
      router.replace("/(tabs)");
    } catch (err: any) {
      // Ошибка приходит с сервера: "Неверный email или пароль" и т.д.
      setError(err.message ?? "Произошла ошибка. Попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <LinearGradient colors={["#F0EEFF", "#FAFAFA"]} style={StyleSheet.absoluteFill} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Логотип и название */}
          <View style={styles.logoRow}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryLight]}
              style={styles.logoBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Feather name="shopping-bag" size={28} color="#fff" />
            </LinearGradient>
            <Text style={styles.appName}>Fits</Text>
          </View>

          <Text style={styles.title}>
            {isRegister ? "Создать аккаунт" : "Добро пожаловать"}
          </Text>
          <Text style={styles.subtitle}>
            {isRegister
              ? "Зарегистрируйтесь, чтобы добавлять вещи"
              : "Войдите, чтобы управлять гардеробом"}
          </Text>

          {/* Форма */}
          <View style={styles.form}>
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Feather name="mail" size={16} color={COLORS.gray400} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="example@mail.com"
                  placeholderTextColor={COLORS.gray400}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(null); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Имя пользователя (только для регистрации) */}
            {isRegister && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Имя пользователя</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="user" size={16} color={COLORS.gray400} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Как вас называть?"
                    placeholderTextColor={COLORS.gray400}
                    value={username}
                    onChangeText={(t) => { setUsername(t); setError(null); }}
                    autoCorrect={false}
                    returnKeyType="next"
                    maxLength={50}
                  />
                </View>
              </View>
            )}

            {/* Пароль */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Пароль {isRegister && "(мин. 6 символов)"}</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={16} color={COLORS.gray400} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.gray400}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={16}
                    color={COLORS.gray400}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Сообщение об ошибке (от сервера или клиентская валидация) */}
            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color="#D93025" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Кнопка отправки */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isRegister ? "Зарегистрироваться" : "Войти"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Переключение режима */}
            <TouchableOpacity
              style={styles.switchModeBtn}
              onPress={() => {
                setIsRegister(!isRegister);
                setError(null);
                setPassword("");
              }}
            >
              <Text style={styles.switchModeText}>
                {isRegister ? "Уже есть аккаунт? " : "Нет аккаунта? "}
                <Text style={styles.switchModeLink}>
                  {isRegister ? "Войти" : "Зарегистрироваться"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Пояснение про безопасность */}
          <View style={styles.securityNote}>
            <Feather name="shield" size={13} color={COLORS.textTertiary} />
            <Text style={styles.securityText}>
              Пароль хранится в виде bcrypt-хеша — никто, включая нас, не знает ваш пароль
            </Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    minHeight: "100%",
    justifyContent: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
    marginTop: 20,
  },
  logoBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  appName: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: COLORS.black,
    letterSpacing: -2,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: COLORS.black,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    marginBottom: 32,
    lineHeight: 22,
  },
  form: {
    gap: 18,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.textSecondary,
    letterSpacing: 0.1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: COLORS.text,
  },
  passwordInput: {
    flex: 1,
    paddingRight: 8,
  },
  eyeBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#D93025",
    flex: 1,
    lineHeight: 18,
  },
  submitBtn: {
    height: 54,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  switchModeBtn: {
    alignItems: "center",
    paddingVertical: 4,
  },
  switchModeText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
  },
  switchModeLink: {
    fontFamily: "Inter_600SemiBold",
    color: COLORS.primary,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 32,
    paddingHorizontal: 4,
  },
  securityText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: COLORS.textTertiary,
    flex: 1,
    lineHeight: 17,
  },
});
