/**
 * Панель администратора.
 *
 * Доступна только пользователям с isAdmin = true.
 * Позволяет:
 * - Просматривать всех пользователей с количеством их вещей
 * - Блокировать / разблокировать пользователей
 * - Удалять любые вещи из ленты (через экраны самих вещей)
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { apiAdminGetUsers, apiAdminBlockUser, type AdminUser } from "@/lib/api";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [blockingId, setBlockingId] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    data: users = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: apiAdminGetUsers,
    enabled: !!user?.isAdmin,
  });

  const handleBlock = useCallback(
    (u: AdminUser) => {
      if (u.id === user?.id) return;
      const action = u.isBlocked ? "разблокировать" : "заблокировать";
      Alert.alert(
        `${u.isBlocked ? "Разблокировать" : "Заблокировать"} пользователя?`,
        `Вы уверены, что хотите ${action} пользователя @${u.username}?`,
        [
          { text: "Отмена", style: "cancel" },
          {
            text: u.isBlocked ? "Разблокировать" : "Заблокировать",
            style: u.isBlocked ? "default" : "destructive",
            onPress: async () => {
              setBlockingId(u.id);
              try {
                const result = await apiAdminBlockUser(u.id);
                Alert.alert("Готово", result.message);
                queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
              } catch (err: any) {
                Alert.alert("Ошибка", err.message);
              } finally {
                setBlockingId(null);
              }
            },
          },
        ]
      );
    },
    [user?.id, queryClient]
  );

  if (!user?.isAdmin) {
    return (
      <View style={[styles.centered, { paddingTop: topPad }]}>
        <Feather name="lock" size={48} color={COLORS.gray300} />
        <Text style={styles.emptyTitle}>Доступ запрещён</Text>
        <Text style={styles.emptyText}>Эта страница только для администраторов</Text>
      </View>
    );
  }

  const renderUser = ({ item }: { item: AdminUser }) => (
    <View style={[styles.userCard, item.isBlocked && styles.userCardBlocked]}>
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>{item.username[0]?.toUpperCase()}</Text>
      </View>

      <View style={styles.userInfo}>
        <View style={styles.userRow}>
          <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
          {item.isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Админ</Text>
            </View>
          )}
          {item.isBlocked && (
            <View style={styles.blockedBadge}>
              <Text style={styles.blockedBadgeText}>Заблокирован</Text>
            </View>
          )}
        </View>
        <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
        <Text style={styles.userMeta}>
          {item.itemsCount} {item.itemsCount === 1 ? "вещь" : item.itemsCount < 5 ? "вещи" : "вещей"} ·{" "}
          {new Date(item.createdAt).toLocaleDateString("ru-RU")}
        </Text>
      </View>

      {!item.isAdmin && item.id !== user.id && (
        <TouchableOpacity
          style={[styles.blockBtn, item.isBlocked && styles.unblockBtn]}
          onPress={() => handleBlock(item)}
          disabled={blockingId === item.id}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {blockingId === item.id ? (
            <ActivityIndicator size="small" color={item.isBlocked ? COLORS.primary : COLORS.error} />
          ) : (
            <Feather
              name={item.isBlocked ? "user-check" : "user-x"}
              size={18}
              color={item.isBlocked ? COLORS.primary : COLORS.error}
            />
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryLight]}
          style={styles.headerIcon}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Feather name="shield" size={16} color="#fff" />
        </LinearGradient>
        <Text style={styles.headerTitle}>Администратор</Text>
        <Text style={styles.headerCount}>{users.length} пользователей</Text>
      </View>

      <View style={styles.infoBox}>
        <Feather name="info" size={14} color={COLORS.primary} />
        <Text style={styles.infoText}>
          Чтобы удалить вещь любого пользователя — откройте её в ленте и нажмите «Удалить».
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(u) => u.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Нет пользователей</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: COLORS.black, flex: 1 },
  headerCount: { fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.textTertiary },
  infoBox: {
    flexDirection: "row",
    gap: 8,
    margin: 16,
    padding: 12,
    backgroundColor: COLORS.primarySurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryLight + "44",
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.primary, lineHeight: 18 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userCardBlocked: { opacity: 0.6, borderColor: COLORS.error + "44" },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  userAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  userInfo: { flex: 1, gap: 2 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  username: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: COLORS.black },
  adminBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: COLORS.primarySurface,
    borderRadius: 6,
  },
  adminBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: COLORS.primary },
  blockedBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: COLORS.error + "22",
    borderRadius: 6,
  },
  blockedBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: COLORS.error },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.textTertiary },
  userMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.gray400, marginTop: 2 },
  blockBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.error + "11",
    alignItems: "center", justifyContent: "center",
  },
  unblockBtn: { backgroundColor: COLORS.primarySurface },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.textTertiary, textAlign: "center" },
});
