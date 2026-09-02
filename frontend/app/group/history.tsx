import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/src/lib/api";
import { useToast } from "@/src/context/ToastContext";
import { CategoryLogo } from "@/src/components/SubscriptionCard";
import { cycleLabel } from "@/src/constants/categories";
import { colors, font, fontSize, radius, spacing, shadow, formatRupiah } from "@/src/theme";

interface Split {
  user_id: string;
  name: string;
  amount: number;
  paid: boolean;
}

interface Period {
  period: string;
  splits: Split[];
  paid_count: number;
  member_count: number;
}

interface HistoryItem {
  subscription: {
    id: string;
    name: string;
    category: string;
    price: number;
    billing_cycle: string;
  };
  periods: Period[];
}

function periodLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function GroupHistory() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ groupId: string }>();
  const gid = params.groupId as string;

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res: any = await api.groupHistory(gid);
      setHistory(res.history);
    } catch {
      toast.show("Gagal memuat riwayat", "error");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [gid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="history-back-button" onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Riwayat Pembayaran</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="history" size={48} color={colors.brand} />
          </View>
          <Text style={styles.emptyTitle}>Belum ada riwayat</Text>
          <Text style={styles.emptySub}>
            Riwayat muncul setelah langganan grup melewati minimal satu periode tagihan.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["2xl"] }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: spacing.lg }}>
            {history.map((h) => (
              <View key={h.subscription.id} style={styles.subCard}>
                <View style={styles.subHead}>
                  <CategoryLogo category={h.subscription.category} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subName} numberOfLines={1}>
                      {h.subscription.name}
                    </Text>
                    <Text style={styles.subMeta}>
                      {formatRupiah(h.subscription.price)} · {cycleLabel(h.subscription.billing_cycle)}
                    </Text>
                  </View>
                </View>
                {h.periods.map((p) => {
                  const allPaid = p.paid_count === p.member_count && p.member_count > 0;
                  return (
                    <View key={p.period} style={styles.periodBlock}>
                      <View style={styles.periodHead}>
                        <MaterialCommunityIcons name="calendar-month" size={15} color={colors.muted} />
                        <Text style={styles.periodDate}>{periodLabel(p.period)}</Text>
                        <View
                          style={[
                            styles.countPill,
                            { backgroundColor: allPaid ? colors.brandSecondary : "#FEF3C7" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.countText,
                              { color: allPaid ? colors.onBrandSecondary : "#B45309" },
                            ]}
                          >
                            {p.paid_count}/{p.member_count} bayar
                          </Text>
                        </View>
                      </View>
                      {p.splits.map((sp) => (
                        <View key={sp.user_id} style={styles.splitRow}>
                          <MaterialCommunityIcons
                            name={sp.paid ? "check-circle" : "close-circle-outline"}
                            size={18}
                            color={sp.paid ? colors.success : colors.error}
                          />
                          <Text style={styles.splitName} numberOfLines={1}>
                            {sp.name}
                          </Text>
                          <Text style={[styles.splitAmount, !sp.paid && { color: colors.error }]}>
                            {formatRupiah(sp.amount)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },

  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontFamily: font.bold, fontSize: fontSize.xl, color: colors.onSurface },
  emptySub: {
    fontFamily: font.regular,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 21,
  },

  subCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  subHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  subName: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },
  subMeta: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },

  periodBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  periodHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  periodDate: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  countPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  countText: { fontFamily: font.bold, fontSize: 11 },

  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  splitName: { flex: 1, fontFamily: font.medium, fontSize: fontSize.base, color: colors.onSurface },
  splitAmount: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.onSurface },
});
