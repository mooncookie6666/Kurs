import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { COLORS } from "@/constants/colors";
import { WardrobeItem, apiToggleLike } from "@/lib/api";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface Props {
  item: WardrobeItem;
  onPress: () => void;
  isOwner?: boolean;
  onDelete?: (id: number) => void;
}

export function ItemCard({ item, onPress, isOwner, onDelete }: Props) {
  const [liked, setLiked] = useState(item.likedByMe);
  const [likesCount, setLikesCount] = useState(item.likesCount);
  const [isLiking, setIsLiking] = useState(false);

  const scale = useSharedValue(1);
  const heartScale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    heartScale.value = withSequence(
      withSpring(1.4, { damping: 4 }),
      withSpring(1, { damping: 8 })
    );

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((c) => (wasLiked ? c - 1 : c + 1));

    try {
      const result = await apiToggleLike(item.id);
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch {
      setLiked(wasLiked);
      setLikesCount(item.likesCount);
    } finally {
      setIsLiking(false);
    }
  };

  const displayName = item.username ?? "Пользователь";

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <TouchableOpacity activeOpacity={0.95} onPress={onPress}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.photoUrl }}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          {isOwner && onDelete && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDelete(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={14} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.userRow}>
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>
                  {displayName[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <Text style={styles.userName} numberOfLines={1}>
                {displayName}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.likeBtn}
              onPress={handleLike}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.View style={heartAnimStyle}>
                <Feather
                  name="heart"
                  size={14}
                  color={liked ? COLORS.error : COLORS.gray400}
                />
              </Animated.View>
              {likesCount > 0 && (
                <Text style={[styles.likesCount, liked && styles.likesCountActive]}>
                  {likesCount}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  imageContainer: {
    width: "100%",
    height: CARD_WIDTH * 1.2,
    backgroundColor: COLORS.gray100,
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  categoryBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: COLORS.white,
  },
  deleteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { padding: 10, gap: 4 },
  itemName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
  },
  description: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  avatar: { width: 18, height: 18, borderRadius: 9 },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  userName: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    flex: 1,
  },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  likesCount: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: COLORS.gray400,
  },
  likesCountActive: { color: COLORS.error },
});
