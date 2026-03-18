import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { fetchItems, toggleLike, ItemWithUser } from "@/lib/api";

const { width } = Dimensions.get("window");

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [liked, setLiked] = useState<boolean | null>(null);
  const [likesCount, setLikesCount] = useState<number | null>(null);
  const [isLiking, setIsLiking] = useState(false);

  const heartScale = useSharedValue(1);
  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });

  const item: ItemWithUser | undefined = items.find((i) => i.id === Number(id));

  const effectiveLiked = liked !== null ? liked : item?.likedByMe ?? false;
  const effectiveLikesCount = likesCount !== null ? likesCount : item?.likesCount ?? 0;

  const handleLike = async () => {
    if (!item || isLiking) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    heartScale.value = withSequence(
      withSpring(1.5, { damping: 4 }),
      withSpring(1, { damping: 8 })
    );

    const wasLiked = effectiveLiked;
    setLiked(!wasLiked);
    setLikesCount(effectiveLikesCount + (wasLiked ? -1 : 1));
    setIsLiking(true);

    try {
      const result = await toggleLike(item.id);
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch {
      setLiked(wasLiked);
      setLikesCount(effectiveLikesCount);
    } finally {
      setIsLiking(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPad }]}>
        <Feather name="alert-circle" size={40} color={COLORS.gray300} />
        <Text style={styles.notFoundText}>Вещь не найдена</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = item.userFirstName
    ? `${item.userFirstName}${item.userLastName ? ` ${item.userLastName}` : ""}`
    : "Пользователь";

  const createdDate = new Date(item.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 32 }}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.photoUrl }}
            style={styles.image}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={[styles.backBtn, { top: topPad + 8 }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color={COLORS.black} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleGroup}>
              <Text style={styles.itemName}>{item.name}</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.likeBtn} onPress={handleLike}>
              <Animated.View style={heartAnimStyle}>
                <Feather
                  name="heart"
                  size={22}
                  color={effectiveLiked ? COLORS.error : COLORS.gray400}
                />
              </Animated.View>
              {effectiveLikesCount > 0 && (
                <Text
                  style={[
                    styles.likesCount,
                    effectiveLiked && styles.likesCountActive,
                  ]}
                >
                  {effectiveLikesCount}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {item.description ? (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionLabel}>Описание</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          ) : null}

          <View style={styles.metaSection}>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={15} color={COLORS.textTertiary} />
              <Text style={styles.metaText}>Добавлено {createdDate}</Text>
            </View>
          </View>

          <View style={styles.userSection}>
            <Text style={styles.sectionLabel}>Добавил</Text>
            <View style={styles.userCard}>
              {item.userProfileImageUrl ? (
                <Image
                  source={{ uri: item.userProfileImageUrl }}
                  style={styles.userAvatar}
                />
              ) : (
                <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                  <Feather name="user" size={20} color={COLORS.gray400} />
                </View>
              )}
              <View>
                <Text style={styles.userName}>{displayName}</Text>
                {item.userId === user?.id && (
                  <Text style={styles.userTagline}>Это ваша вещь</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  imageContainer: {
    width: "100%",
    height: width * 1.1,
    backgroundColor: COLORS.gray100,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  titleGroup: {
    flex: 1,
    gap: 8,
  },
  itemName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: COLORS.black,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: COLORS.primarySurface,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: COLORS.primary,
  },
  likeBtn: {
    alignItems: "center",
    gap: 4,
    paddingTop: 4,
    paddingLeft: 16,
  },
  likesCount: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.gray400,
  },
  likesCountActive: {
    color: COLORS.error,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  descriptionSection: {
    gap: 0,
  },
  description: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: COLORS.text,
    lineHeight: 24,
  },
  metaSection: {
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
  },
  userSection: {
    gap: 0,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: COLORS.gray100,
    borderRadius: 14,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    backgroundColor: COLORS.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.black,
  },
  userTagline: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: COLORS.primary,
    marginTop: 2,
  },
  notFoundText: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    color: COLORS.text,
  },
  backLink: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: COLORS.primary,
  },
});
