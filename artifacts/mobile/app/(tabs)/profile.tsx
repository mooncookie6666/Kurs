import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { apiGetItems, apiDeleteItem } from "@/lib/api";
import { ItemCard } from "@/components/ItemCard";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const queryClient = useQueryClient();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    data: items = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["items", "profile", user?.id],
    queryFn: () => apiGetItems({ userId: user!.id }),
    enabled: !!user,
  });

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert("Удалить вещь?", "Это действие нельзя отменить.", [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              await apiDeleteItem(id);
              queryClient.invalidateQueries({ queryKey: ["items"] });
            } catch {
              Alert.alert("Ошибка", "Не удалось удалить вещь");
            }
          },
        },
      ]);
    },
    [queryClient]
  );

  const renderItem = useCallback(
    ({ item, index }: any) => {
      const isLeft = index % 2 === 0;
      return (
        <View style={[styles.cardWrapper, isLeft ? styles.leftCard : styles.rightCard]}>
          <ItemCard
            item={item}
            onPress={() =>
              router.push({ pathname: "/item/[id]", params: { id: item.id } })
            }
            isOwner
            onDelete={handleDelete}
          />
        </View>
      );
    },
    [handleDelete]
  );

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Не авторизован — показываем приглашение войти
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.notLoggedIn}>
          <View style={styles.avatarLarge}>
            <Feather name="user" size={40} color={COLORS.gray400} />
          </View>
          <Text style={styles.notLoggedInTitle}>Войдите в аккаунт</Text>
          <Text style={styles.notLoggedInText}>
            Чтобы добавлять вещи и управлять своим гардеробом
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginBtnText}>Войти / Зарегистрироваться</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Профиль</Text>
        <TouchableOpacity
          onPress={logout}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Feather name="log-out" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View>
            <View style={styles.profileSection}>
              <LinearGradient
                colors={[COLORS.primarySurface, COLORS.white]}
                style={styles.profileCard}
              >
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarLetter}>
                    {user?.username?.[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{user?.username}</Text>
                  <Text style={styles.profileEmail}>{user?.email}</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statNumber}>{items.length}</Text>
                    <Text style={styles.statLabel}>вещей</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statNumber}>
                      {items.reduce((s, i) => s + i.likesCount, 0)}
                    </Text>
                    <Text style={styles.statLabel}>лайков</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Мой гардероб</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => router.push("/add-item")}
              >
                <Feather name="plus" size={16} color={COLORS.primary} />
                <Text style={styles.addBtnText}>Добавить</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="shopping-bag" size={40} color={COLORS.gray300} />
              <Text style={styles.emptyText}>Гардероб пока пуст</Text>
              <Text style={styles.emptySubtext}>Добавьте первую вещь</Text>
            </View>
          )
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        refreshing={isRefetching}
        onRefresh={refetch}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: COLORS.black,
    letterSpacing: -1,
  },
  profileSection: { paddingHorizontal: 16, marginBottom: 20 },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 12 },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarLetter: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  profileInfo: { marginBottom: 16 },
  profileName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: COLORS.black,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
  },
  statsRow: { flexDirection: "row", alignItems: "center" },
  stat: { alignItems: "center", flex: 1 },
  statNumber: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.black,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primarySurface,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: COLORS.primary,
  },
  listContent: { paddingHorizontal: 16 },
  row: { justifyContent: "space-between" },
  cardWrapper: { flex: 1 },
  leftCard: { marginRight: 8 },
  rightCard: { marginLeft: 8 },
  loadingContainer: { paddingTop: 40, alignItems: "center" },
  emptyContainer: { paddingTop: 40, alignItems: "center", gap: 8 },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
  },
  notLoggedIn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  notLoggedInTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: COLORS.black,
  },
  notLoggedInText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  loginBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  loginBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.white,
  },
});
