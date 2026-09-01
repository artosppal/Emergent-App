import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, ApiError } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { useUpgrade } from "@/src/context/UpgradeContext";
import { SubscriptionCard, Subscription } from "@/src/components/SubscriptionCard";
import { EmptyState } from "@/src/components/ui";
import { CATEGORIES } from "@/src/constants/categories";
import { colors, font, fontSize, radius, spacing, shadow } from "@/src/theme";

const CAT_FILTERS = [{ key: "all", label: "Semua" }, ...CATEGORIES.map((c) => ({ key: c.key, label: c.label }))];
const STATUS_FILTERS = [
  { key: "all", label: "Semua status" },
  { key: "paid", label: "Sudah Bayar" },
  { key: "trial", label: "Trial" },
];

export default function Subscriptions() {
  const insets = useSafeAreaInsets();
  const tabH = useContext(BottomTabBarHeightContext) ?? 64 + insets.bottom;
  const router = useRouter();
  const { user } = useAuth();
  const { showUpgrade } = useUpgrade();

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [activeCount, setActiveCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res: any = await api.listSubs(cat, status);
      setSubs(res.subscriptions);
      // total active (unfiltered) for gating
      if (cat === "all" && status === "all") {
        setActiveCount(res.subscriptions.length);
      } else {
        const all: any = await api.listSubs("all", "all");
        setActiveCount(all.subscriptions.length);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [cat, status]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const headerHeight = insets.top + 118;

  const onAdd = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (user?.plan === "free" && activeCount >= 3) {
      showUpgrade();
      return;
    }
    router.push("/subscription/form");
  };

  return (
    <View style={styles.root}>
      {/* Sticky glass header */}
      <View style={[styles.header, { height: headerHeight, paddingTop: insets.top + spacing.sm }]}>
        {Platform.OS === "web" ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
        ) : (
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.headerTop}>
          <Text style={styles.title}>Langganan</Text>
          {user?.plan === "free" && (
            <Text style={styles.countText}>{activeCount}/3 aktif</Text>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CAT_FILTERS.map((c) => {
            const active = cat === c.key;
            return (
              <Pressable
                key={c.key}
                testID={`cat-chip-${c.key}`}
                onPress={() => setCat(c.key)}
                style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : (
        <FlatList
          data={subs}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            paddingTop: headerHeight + spacing.md,
            paddingHorizontal: spacing.xl,
            paddingBottom: tabH + 90,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusRow}
            >
              {STATUS_FILTERS.map((s) => {
                const active = status === s.key;
                return (
                  <Pressable
                    key={s.key}
                    testID={`status-chip-${s.key}`}
                    onPress={() => setStatus(s.key)}
                    style={[styles.statusChip, active && styles.statusChipActive]}
                  >
                    <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <SubscriptionCard
              sub={item}
              onPress={() => router.push({ pathname: "/subscription/form", params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="magnify"
              title={cat !== "all" || status !== "all" ? "Gak ada yang cocok" : "Belum ada langganan"}
              subtitle={
                cat !== "all" || status !== "all"
                  ? "Coba ubah filter kategori atau status."
                  : "Tap tombol + untuk menambah langganan pertamamu."
              }
            />
          }
        />
      )}

      {/* FAB */}
      <Pressable
        testID="add-subscription-fab"
        onPress={onAdd}
        style={({ pressed }) => [
          styles.fab,
          { bottom: tabH + spacing.md },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
      >
        <MaterialCommunityIcons name="plus" size={28} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    justifyContent: "flex-end",
    paddingBottom: spacing.sm,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: font.extrabold, fontSize: fontSize["2xl"], color: colors.onSurface },
  countText: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.muted },
  chipRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1.5,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipIdle: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
  chipText: { fontFamily: font.semibold, fontSize: fontSize.base },
  chipTextActive: { color: colors.onBrandPrimary },
  chipTextIdle: { color: colors.muted },

  statusRow: { gap: spacing.sm, paddingBottom: spacing.md },
  statusChip: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    flexShrink: 0,
  },
  statusChipActive: { backgroundColor: colors.onSurface },
  statusChipText: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  statusChipTextActive: { color: "#FFFFFF" },

  fab: {
    position: "absolute",
    right: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
});
