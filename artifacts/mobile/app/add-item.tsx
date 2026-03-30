import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { apiGetCategories, apiCreateItem, apiUploadImage } from "@/lib/api";

export default function AddItemScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoMode, setPhotoMode] = useState<"url" | "gallery">("url");
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: apiGetCategories,
  });

  const isValid =
    name.trim().length > 0 && category.length > 0 && photoUrl.trim().length > 0;

  // Выбор фото из галереи
  const handlePickGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Нет доступа", "Разрешите приложению доступ к галерее в настройках.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0]!;
    setLocalImageUri(asset.uri);
    setPhotoUrl(""); // сбрасываем URL, будет заменён после загрузки

    // Загружаем изображение на сервер
    setIsUploading(true);
    try {
      let base64: string;
      if (Platform.OS === "web") {
        // На вебе читаем через fetch
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // На мобильном через FileSystem
        const b64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const mime = asset.mimeType ?? "image/jpeg";
        base64 = `data:${mime};base64,${b64}`;
      }

      const uploadedUrl = await apiUploadImage(base64);
      setPhotoUrl(uploadedUrl);
      Alert.alert("Готово", "Фото успешно загружено!");
    } catch (err: any) {
      Alert.alert("Ошибка загрузки", err.message ?? "Не удалось загрузить фото");
      setLocalImageUri(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!isValid || isSaving || isUploading) return;
    setIsSaving(true);
    try {
      await apiCreateItem({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        photoUrl: photoUrl.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      router.back();
    } catch (err: any) {
      Alert.alert("Ошибка", err.message ?? "Не удалось добавить вещь. Попробуйте снова.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) {
    router.back();
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Новая вещь</Text>
          <TouchableOpacity
            style={[styles.saveBtn, (!isValid || isSaving || isUploading) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isValid || isSaving || isUploading}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Сохранить</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Название */}
          <View style={styles.field}>
            <Text style={styles.label}>Название *</Text>
            <TextInput
              style={styles.input}
              placeholder="Например: Чёрная куртка"
              placeholderTextColor={COLORS.gray400}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              maxLength={80}
            />
          </View>

          {/* Фото — переключатель способа */}
          <View style={styles.field}>
            <Text style={styles.label}>Фото *</Text>

            {/* Таб-переключатель */}
            <View style={styles.photoToggle}>
              <TouchableOpacity
                style={[styles.photoToggleBtn, photoMode === "url" && styles.photoToggleBtnActive]}
                onPress={() => { setPhotoMode("url"); setLocalImageUri(null); }}
                activeOpacity={0.8}
              >
                <Feather name="link" size={14} color={photoMode === "url" ? "#fff" : COLORS.textSecondary} />
                <Text style={[styles.photoToggleText, photoMode === "url" && styles.photoToggleTextActive]}>
                  Ссылка
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoToggleBtn, photoMode === "gallery" && styles.photoToggleBtnActive]}
                onPress={() => { setPhotoMode("gallery"); setPhotoUrl(""); }}
                activeOpacity={0.8}
              >
                <Feather name="image" size={14} color={photoMode === "gallery" ? "#fff" : COLORS.textSecondary} />
                <Text style={[styles.photoToggleText, photoMode === "gallery" && styles.photoToggleTextActive]}>
                  Галерея
                </Text>
              </TouchableOpacity>
            </View>

            {photoMode === "url" ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  placeholderTextColor={COLORS.gray400}
                  value={photoUrl}
                  onChangeText={setPhotoUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="next"
                />
                <Text style={styles.hint}>Вставьте прямую ссылку на изображение</Text>
              </>
            ) : (
              <TouchableOpacity
                style={styles.galleryPicker}
                onPress={handlePickGallery}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                {isUploading ? (
                  <View style={styles.galleryPickerContent}>
                    <ActivityIndicator color={COLORS.primary} />
                    <Text style={styles.galleryPickerText}>Загружаем фото...</Text>
                  </View>
                ) : localImageUri && photoUrl ? (
                  <View style={styles.galleryPickerContent}>
                    <Image source={{ uri: localImageUri }} style={styles.previewThumb} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.galleryPickerText}>Фото загружено</Text>
                      <Text style={styles.hint}>Нажмите, чтобы выбрать другое</Text>
                    </View>
                    <Feather name="check-circle" size={20} color={COLORS.success} />
                  </View>
                ) : (
                  <View style={styles.galleryPickerContent}>
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.primaryLight]}
                      style={styles.galleryPickerIcon}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Feather name="camera" size={20} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.galleryPickerText}>Выбрать из галереи</Text>
                      <Text style={styles.hint}>Нажмите, чтобы выбрать фото</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={COLORS.gray400} />
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Категория */}
          <View style={styles.field}>
            <Text style={styles.label}>Категория *</Text>
            <View style={styles.categoriesGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipSelected]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      category === cat && styles.catChipTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Описание */}
          <View style={styles.field}>
            <Text style={styles.label}>Описание</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Расскажите о вещи: бренд, материал, размер..."
              placeholderTextColor={COLORS.gray400}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={400}
            />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.gray100,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: COLORS.black },
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: COLORS.primary, borderRadius: 10,
    minWidth: 90, alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.white },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 20 },
  field: { gap: 8 },
  label: {
    fontSize: 13, fontFamily: "Inter_600SemiBold",
    color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.gray100, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: "Inter_400Regular",
    color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  textArea: { height: 100, paddingTop: 14 },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.textTertiary, marginTop: -4 },
  categoriesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.gray100, borderWidth: 1, borderColor: COLORS.border,
  },
  catChipSelected: { backgroundColor: COLORS.primarySurface, borderColor: COLORS.primary },
  catChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.textSecondary },
  catChipTextSelected: { color: COLORS.primary },
  photoToggle: {
    flexDirection: "row", gap: 8,
    backgroundColor: COLORS.gray100,
    borderRadius: 12, padding: 4,
  },
  photoToggleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10,
  },
  photoToggleBtnActive: { backgroundColor: COLORS.primary },
  photoToggleText: { fontSize: 14, fontFamily: "Inter_500Medium", color: COLORS.textSecondary },
  photoToggleTextActive: { color: "#fff" },
  galleryPicker: {
    backgroundColor: COLORS.gray100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  galleryPickerContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  galleryPickerIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  galleryPickerText: { fontSize: 15, fontFamily: "Inter_500Medium", color: COLORS.text },
  previewThumb: { width: 44, height: 44, borderRadius: 10 },
});
