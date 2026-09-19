import React, { useCallback, useContext, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { useUpgrade } from "@/src/context/UpgradeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useToast } from "@/src/context/ToastContext";
import { SubscriptionCard, Subscription, CategoryLogo } from "@/src/components/SubscriptionCard";
import { SectionTitle, EmptyState, Button } from "@/src/components/ui";
import { getCategory } from "@/src/constants/categories";
import { colors, font, fontSize, radius, spacing, shadow, formatRupiah, webMaxWidth } from "@/src/theme";

interface PromoItem {
  id: string;
  title: string;
  description: string;
  app_name?: string | null;
  has_link?: boolean;
}

// "YYYY-MM-DDTHH:mm" in LOCAL time, the format <input type="datetime-local">
// needs — toISOString() would shift to UTC and desync the min= guard from
// what the picker itself is showing.
function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Style for the real HTML <input type="datetime-local"> used on web to pick
// a custom reminder time — a raw DOM node, so it needs plain CSS.
const webDateTimeInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  fontFamily: font.semibold,
  fontSize: fontSize.base,
  color: colors.onSurface,
  padding: 0,
};

interface DashboardData {
  total_this_month: number;
  projection_next_month: number;
  active_count: number;
  plan: string;
  free_limit: number;
  upcoming: Subscription[];
  most_expensive?: (Subscription & { monthly_cost: number }) | null;
  ending_trials?: Subscription[];
  by_category: { category: string; total: number; count: number }[];
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const tabH = useContext(BottomTabBarHeightContext) ?? 64 + insets.bottom;
  const router = useRouter();
  const { user } = useAuth();
  const { showUpgrade } = useUpgrade();
  const { t } = useLanguage();
  const toast = useToast();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promos, setPromos] = useState<PromoItem[] | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const [remindPromoId, setRemindPromoId] = useState<string | null>(null);
  const [remindCustomValue, setRemindCustomValue] = useState("");
  const [remindNativeStep, setRemindNativeStep] = useState<"date" | "time" | null>(null);
  const [remindNativeDate, setRemindNativeDate] = useState(new Date());

  const openPromo = (id: string) => {
    Linking.openURL(api.promoGoUrl(id));
  };

  const scheduleRemind = async (promoId: string, when: Date) => {
    setRemindPromoId(null);
    setRemindCustomValue("");
    try {
      await api.promoRemind(promoId, when.toISOString());
      toast.show(t("dashboard.promoRemindSet"), "success");
    } catch (e: any) {
      toast.show(
        e?.status === 422 ? t("dashboard.promoRemindErrPast") : t("dashboard.promoRemindErr"),
        "error",
      );
    }
  };

  const remindInHours = (hours: number) => {
    if (!remindPromoId) return;
    scheduleRemind(remindPromoId, new Date(Date.now() + hours * 3600 * 1000));
  };

  const remindTomorrowAt = (hour: number) => {
    if (!remindPromoId) return;
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(hour, 0, 0, 0);
    scheduleRemind(remindPromoId, when);
  };

  const remindCustomWeb = () => {
    if (!remindPromoId || !remindCustomValue) return;
    scheduleRemind(remindPromoId, new Date(remindCustomValue));
  };

  const shareSpending = async () => {
    const message = t("dashboard.shareMessage", {
      total: formatRupiah(data?.total_this_month || 0),
      count: data?.active_count || 0,
    });
    if (Platform.OS === "web") {
      // react-native-web's Share.share() throws when navigator.share isn't
      // available (most desktop browsers) instead of falling back — copy
      // to clipboard instead of failing with no feedback at all.
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ text: message });
          return;
        } catch {
          return;
        }
      }
      try {
        await nav?.clipboard?.writeText(message);
        toast.show(t("dashboard.shareCopied"), "success");
      } catch {
        toast.show(t("dashboard.shareFailed"), "error");
      }
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({ message });
    } catch {}
  };

  const togglePromo = async () => {
    const next = !promoOpen;
    setPromoOpen(next);
    if (next && promos === null) {
      setPromoLoading(true);
      try {
        const res: any = await api.promos();
        setPromos(res.promos || []);
      } catch {
        setPromos([]);
      } finally {
        setPromoLoading(false);
      }
    }
  };

  const load = useCallback(async () => {
    try {
      const res: any = await api.dashboard();
      setData(res);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return t("dashboard.greetingMorning");
    if (h < 15) return t("dashboard.greetingAfternoon");
    if (h < 19) return t("dashboard.greetingEvening");
    return t("dashboard.greetingNight");
  };

  const firstName = (user?.name || "").split(" ")[0] || t("dashboard.you");
  const maxCat = data?.by_category?.[0]?.total || 1;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  const isEmpty = !data || data.active_count === 0;

  const monthlyLimit = user?.monthly_limit || null;
  const limitPct = monthlyLimit ? Math.round(((data?.total_this_month || 0) / monthlyLimit) * 100) : null;
  const limitStatus: "safe" | "warning" | "over" | null =
    limitPct === null ? null : limitPct >= 100 ? "over" : limitPct >= 85 ? "warning" : "safe";
  const totalCardColors: [string, string] =
    limitStatus === "over"
      ? ["#EF4444", "#B91C1C"]
      : limitStatus === "warning"
        ? ["#F59E0B", "#B45309"]
        : [colors.brand, colors.brandDark];

  return (
    <>
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: tabH + spacing.xl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{firstName} 👋</Text>
        </View>
        {data?.plan === "premium" ? (
          <View style={styles.premiumPill}>
            <MaterialCommunityIcons name="crown" size={14} color="#B45309" />
            <Text style={styles.premiumPillText}>{t("dashboard.premium")}</Text>
          </View>
        ) : (
          <View style={styles.freePill}>
            <Text style={styles.freePillText}>
              {data?.active_count}/{data?.free_limit}
            </Text>
          </View>
        )}
      </View>

      {/* Total spend card */}
      <View style={styles.section}>
        <Pressable
          testID="total-spend-card"
          onPress={() => router.push("/spending-history")}
          style={({ pressed }) => pressed && { opacity: 0.92 }}
        >
        <LinearGradient
          colors={totalCardColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.totalCard}
        >
          <View style={styles.totalTopRow}>
            <Text style={styles.totalLabel}>{t("dashboard.totalLabel")}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Pressable
                testID="share-spending-button"
                hitSlop={8}
                onPress={(e: any) => {
                  e.stopPropagation?.();
                  shareSpending();
                }}
              >
                <MaterialCommunityIcons name="share-variant" size={19} color="rgba(255,255,255,0.85)" />
              </Pressable>
              <MaterialCommunityIcons name="wallet" size={20} color="rgba(255,255,255,0.85)" />
            </View>
          </View>
          <Text style={styles.totalValue}>{formatRupiah(data?.total_this_month || 0)}</Text>
          <View style={styles.projRow}>
            <MaterialCommunityIcons name="chart-line" size={15} color="rgba(255,255,255,0.85)" />
            <Text style={styles.projText}>
              {t("dashboard.projection", { value: formatRupiah(data?.projection_next_month || 0) })}
            </Text>
          </View>
          {limitPct !== null && (
            <View testID="limit-progress-row" style={styles.projRow}>
              <MaterialCommunityIcons
                name={
                  limitStatus === "over"
                    ? "alert-octagon"
                    : limitStatus === "warning"
                      ? "alert"
                      : "shield-check"
                }
                size={15}
                color="rgba(255,255,255,0.85)"
              />
              <Text style={styles.projText}>
                {t("dashboard.limitProgress", { pct: limitPct, limit: formatRupiah(monthlyLimit || 0) })}
              </Text>
            </View>
          )}
          <View style={styles.chartHintRow}>
            <MaterialCommunityIcons name="chart-bar" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.chartHintText}>{t("dashboard.viewChart")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={15} color="rgba(255,255,255,0.85)" />
          </View>
        </LinearGradient>
        </Pressable>
      </View>

      {/* Promo recommendations — Premium-only, admin-curated */}
      <View style={styles.section}>
        {data?.plan === "premium" ? (
          <View style={styles.promoCard}>
            <Pressable testID="promo-card-toggle" onPress={togglePromo} style={styles.promoHeaderRow}>
              <View style={styles.promoIconWrap}>
                <MaterialCommunityIcons name="gift-outline" size={18} color="#92400E" />
              </View>
              <Text style={styles.promoTitle}>{t("dashboard.promoCardTitle")}</Text>
              <MaterialCommunityIcons
                name={promoOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color="#92400E"
              />
            </Pressable>
            {promoOpen && (
              <View style={styles.promoBody}>
                {promoLoading ? (
                  <ActivityIndicator color="#B45309" style={{ marginVertical: spacing.lg }} />
                ) : promos && promos.length > 0 ? (
                  promos.map((p) => (
                    <View key={p.id} style={styles.promoItem}>
                      <View style={styles.promoItemTitleRow}>
                        <Text style={styles.promoItemTitle}>
                          {p.title}
                          {p.app_name ? ` · ${p.app_name}` : ""}
                        </Text>
                        <View style={styles.promoSponsoredBadge}>
                          <Text style={styles.promoSponsoredBadgeText}>{t("dashboard.promoLabel")}</Text>
                        </View>
                      </View>
                      <Text style={styles.promoItemDesc}>{p.description}</Text>
                      <View style={styles.promoActionRow}>
                        {!!p.has_link && (
                          <Pressable
                            testID={`promo-join-${p.id}`}
                            style={styles.promoJoinBtn}
                            onPress={() => openPromo(p.id)}
                          >
                            <MaterialCommunityIcons name="open-in-new" size={14} color="#fff" />
                            <Text style={styles.promoJoinBtnText}>{t("dashboard.promoJoinAction")}</Text>
                          </Pressable>
                        )}
                        <Pressable
                          testID={`promo-remind-${p.id}`}
                          style={styles.promoRemindBtn}
                          onPress={() => setRemindPromoId(p.id)}
                        >
                          <MaterialCommunityIcons name="bell-outline" size={14} color="#B45309" />
                          <Text style={styles.promoRemindBtnText}>{t("dashboard.promoRemindAction")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                    <Text style={styles.promoEmptyTitle}>{t("dashboard.promoEmptyTitle")}</Text>
                    <Text style={styles.promoEmptySub}>{t("dashboard.promoEmptySubtitle")}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          <Pressable testID="promo-card-locked" onPress={showUpgrade} style={styles.promoLockedCard}>
            <View style={styles.promoLockIconWrap}>
              <MaterialCommunityIcons name="lock" size={18} color="#6B7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoLockedTitle}>{t("dashboard.promoCardTitle")}</Text>
              <Text style={styles.promoLockedSub}>{t("dashboard.promoCardLockedSub")}</Text>
            </View>
            <View style={styles.promoUnlockPill}>
              <MaterialCommunityIcons name="crown" size={11} color="#B45309" />
              <Text style={styles.promoUnlockPillText}>{t("dashboard.promoCardUnlock")}</Text>
            </View>
          </Pressable>
        )}
      </View>

      {isEmpty ? (
        <View style={{ marginTop: spacing.lg }}>
          <EmptyState
            icon="rocket-launch"
            title={t("dashboard.emptyTitle")}
            subtitle={t("dashboard.emptySubtitle")}
            cta={
              <Button
                testID="empty-add-button"
                title={t("dashboard.addButton")}
                icon="plus"
                onPress={() => router.push("/subscription/form")}
              />
            }
          />
        </View>
      ) : (
        <>
          {/* Ringkasan boros */}
          {(data?.most_expensive || (data?.ending_trials && data.ending_trials.length > 0)) && (
            <View style={styles.section}>
              <SectionTitle title={t("dashboard.highlightSection")} />
              <View style={{ gap: spacing.md }}>
                {data?.most_expensive && (
                  <Pressable
                    testID="most-expensive-card"
                    onPress={() =>
                      router.push({
                        pathname: "/subscription/form",
                        params: { id: data.most_expensive!.id },
                      })
                    }
                    style={({ pressed }) => [styles.borosCard, pressed && { opacity: 0.9 }]}
                  >
                    <CategoryLogo category={data.most_expensive.category} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.borosLabel}>{t("dashboard.mostExpensiveLabel")}</Text>
                      <Text style={styles.borosName} numberOfLines={1}>
                        {data.most_expensive.name}
                        {data.most_expensive.registered_with
                          ? ` (${data.most_expensive.registered_with})`
                          : ""}
                      </Text>
                      <Text style={styles.borosMeta}>
                        {t("dashboard.mostExpensiveMeta", {
                          price: formatRupiah(data.most_expensive.monthly_cost),
                          pct: Math.round(
                            (data.most_expensive.monthly_cost / (data.total_this_month || 1)) * 100,
                          ),
                        })}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.borderStrong} />
                  </Pressable>
                )}
                {data?.ending_trials?.map((tr) => (
                  <Pressable
                    key={tr.id}
                    testID={`trial-warning-${tr.id}`}
                    onPress={() =>
                      router.push({ pathname: "/subscription/form", params: { id: tr.id } })
                    }
                    style={({ pressed }) => [styles.trialWarnCard, pressed && { opacity: 0.9 }]}
                  >
                    <MaterialCommunityIcons name="timer-sand" size={22} color="#B45309" />
                    <Text style={styles.trialWarnText} numberOfLines={2}>
                      {t("dashboard.trialWarning", {
                        name: tr.registered_with ? `${tr.name} (${tr.registered_with})` : tr.name,
                        ending:
                          tr.days_left === 0
                            ? t("dashboard.trialEndsToday")
                            : tr.days_left === 1
                              ? t("dashboard.trialEndsTomorrow")
                              : t("dashboard.trialEndsIn", { days: tr.days_left ?? 0 }),
                      })}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#B45309" />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Upcoming */}
          <View style={styles.section}>
            <SectionTitle title={t("dashboard.upcomingSection")} />
            {data && data.upcoming.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {data.upcoming.map((s) => (
                  <SubscriptionCard
                    key={s.id}
                    sub={s}
                    onPress={() => router.push({ pathname: "/subscription/form", params: { id: s.id } })}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.calmCard}>
                <MaterialCommunityIcons name="check-circle" size={22} color={colors.success} />
                <Text style={styles.calmText}>{t("dashboard.calmText")}</Text>
              </View>
            )}
          </View>

          {/* By category */}
          {data && data.by_category.length > 0 && (
            <View style={styles.section}>
              <SectionTitle title={t("dashboard.categorySection")} />
              <View style={styles.chartCard}>
                {data.by_category.map((c) => {
                  const cat = getCategory(c.category);
                  const pct = Math.max(0.06, c.total / maxCat);
                  return (
                    <View key={c.category} style={styles.chartRow}>
                      <View style={styles.chartHead}>
                        <View style={[styles.catDot, { backgroundColor: cat.color }]}>
                          <MaterialCommunityIcons name={cat.icon as any} size={13} color="#fff" />
                        </View>
                        <Text style={styles.chartLabel}>{t(`categories.${cat.key}`)}</Text>
                        <Text style={styles.chartValue}>{formatRupiah(c.total)}</Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: cat.color }]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>

    {/* Promo reminder time picker */}
    <Modal
      visible={!!remindPromoId}
      transparent
      animationType="fade"
      onRequestClose={() => setRemindPromoId(null)}
    >
      <Pressable style={styles.backdrop} onPress={() => setRemindPromoId(null)}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{t("dashboard.promoRemindTitle")}</Text>
          <Text style={styles.modalSub}>{t("dashboard.promoRemindSub")}</Text>

          <Pressable testID="remind-1h" style={styles.remindOption} onPress={() => remindInHours(1)}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.brand} />
            <Text style={styles.remindOptionText}>{t("dashboard.promoRemind1h")}</Text>
          </Pressable>
          <Pressable testID="remind-3h" style={styles.remindOption} onPress={() => remindInHours(3)}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.brand} />
            <Text style={styles.remindOptionText}>{t("dashboard.promoRemind3h")}</Text>
          </Pressable>
          <Pressable testID="remind-6h" style={styles.remindOption} onPress={() => remindInHours(6)}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.brand} />
            <Text style={styles.remindOptionText}>{t("dashboard.promoRemind6h")}</Text>
          </Pressable>
          <Pressable
            testID="remind-tomorrow-morning"
            style={styles.remindOption}
            onPress={() => remindTomorrowAt(8)}
          >
            <MaterialCommunityIcons name="weather-sunset-up" size={18} color={colors.brand} />
            <Text style={styles.remindOptionText}>{t("dashboard.promoRemindTomorrowMorning")}</Text>
          </Pressable>
          <Pressable
            testID="remind-tomorrow-night"
            style={styles.remindOption}
            onPress={() => remindTomorrowAt(20)}
          >
            <MaterialCommunityIcons name="weather-night" size={18} color={colors.brand} />
            <Text style={styles.remindOptionText}>{t("dashboard.promoRemindTomorrowNight")}</Text>
          </Pressable>

          {Platform.OS === "web" ? (
            <View style={styles.remindCustomWebRow}>
              <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.brand} />
              {/* Real HTML datetime input (not RN's TextInput) — same reason
                  as the due-date picker in subscription/form.tsx. */}
              <input
                data-testid="remind-custom-input"
                type="datetime-local"
                value={remindCustomValue}
                min={toLocalDateTimeInput(new Date())}
                onChange={(e) => setRemindCustomValue(e.target.value)}
                style={webDateTimeInputStyle}
              />
              <Pressable
                testID="remind-custom-go"
                style={styles.remindCustomGo}
                onPress={remindCustomWeb}
              >
                <MaterialCommunityIcons name="check" size={18} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              testID="remind-custom"
              style={styles.remindOption}
              onPress={() => {
                setRemindNativeDate(new Date());
                setRemindNativeStep("date");
              }}
            >
              <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.brand} />
              <Text style={styles.remindOptionText}>{t("dashboard.promoRemindCustom")}</Text>
            </Pressable>
          )}

          <Pressable style={styles.cancelBtn} onPress={() => setRemindPromoId(null)}>
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    {Platform.OS !== "web" && remindNativeStep === "date" && (
      <DateTimePicker
        value={remindNativeDate}
        mode="date"
        display={Platform.OS === "ios" ? "inline" : "default"}
        minimumDate={new Date()}
        onChange={(event, date) => {
          setRemindNativeStep(null);
          if (event.type === "dismissed" || !date) return;
          setRemindNativeDate(date);
          setRemindNativeStep("time");
        }}
      />
    )}
    {Platform.OS !== "web" && remindNativeStep === "time" && (
      <DateTimePicker
        value={remindNativeDate}
        mode="time"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={(event, time) => {
          setRemindNativeStep(null);
          if (event.type === "dismissed" || !time || !remindPromoId) return;
          const combined = new Date(remindNativeDate);
          combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
          scheduleRemind(remindPromoId, combined);
        }}
      />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    width: "100%",
    maxWidth: webMaxWidth,
    alignSelf: "center",
  },
  greeting: { fontFamily: font.medium, fontSize: fontSize.base, color: colors.muted },
  userName: { fontFamily: font.extrabold, fontSize: fontSize["2xl"], color: colors.onSurface },
  premiumPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  premiumPillText: { fontFamily: font.bold, fontSize: fontSize.sm, color: "#B45309" },
  freePill: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  freePillText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },

  section: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    width: "100%",
    maxWidth: webMaxWidth,
    alignSelf: "center",
  },
  totalCard: { borderRadius: radius.lg, padding: spacing.xl, ...shadow.card },
  totalTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: font.semibold, fontSize: fontSize.base, color: "rgba(255,255,255,0.9)" },
  totalValue: { fontFamily: font.extrabold, fontSize: 40, color: "#FFFFFF", marginTop: spacing.sm },
  projRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  projText: { fontFamily: font.medium, fontSize: fontSize.base, color: "rgba(255,255,255,0.9)" },
  chartHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.25)",
  },
  chartHintText: { fontFamily: font.bold, fontSize: fontSize.sm, color: "rgba(255,255,255,0.95)" },

  calmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  calmText: { flex: 1, fontFamily: font.medium, fontSize: fontSize.base, color: colors.onBrandTertiary },

  borosCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  borosLabel: { fontFamily: font.semibold, fontSize: 11, color: colors.muted },
  borosName: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface, marginTop: 1 },
  borosMeta: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.error, marginTop: 1 },
  trialWarnCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#FEF3C7",
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  trialWarnText: { flex: 1, fontFamily: font.medium, fontSize: fontSize.base, color: "#92400E", lineHeight: 20 },

  chartCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg, ...shadow.soft },
  chartRow: { gap: spacing.sm },
  chartHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catDot: { width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  chartLabel: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  chartValue: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  track: { height: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fill: { height: 9, borderRadius: radius.pill },

  promoCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#FDE68A",
    overflow: "hidden",
  },
  promoHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  promoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  promoTitle: { flex: 1, fontFamily: font.bold, fontSize: fontSize.base, color: "#92400E" },
  promoBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  promoItem: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  promoItemTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  promoItemTitle: { flex: 1, fontFamily: font.bold, fontSize: fontSize.base, color: "#78350F" },
  promoSponsoredBadge: {
    backgroundColor: "rgba(146,64,14,0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  promoSponsoredBadgeText: {
    fontFamily: font.bold,
    fontSize: 10,
    color: "#92400E",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  promoItemDesc: { fontFamily: font.regular, fontSize: fontSize.sm, color: "#92400E", marginTop: 2, lineHeight: 19 },
  promoEmptyTitle: { fontFamily: font.bold, fontSize: fontSize.base, color: "#92400E" },
  promoEmptySub: {
    fontFamily: font.regular,
    fontSize: fontSize.sm,
    color: "#B45309",
    marginTop: 2,
    textAlign: "center",
  },
  promoActionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  promoJoinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#B45309",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  promoJoinBtnText: { fontFamily: font.bold, fontSize: fontSize.sm, color: "#fff" },
  promoRemindBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  promoRemindBtnText: { fontFamily: font.bold, fontSize: fontSize.sm, color: "#B45309" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(24,41,36,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.onSurface },
  modalSub: {
    fontFamily: font.regular,
    fontSize: fontSize.base,
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  cancelBtn: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
  remindOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceTertiary,
  },
  remindOptionText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  remindCustomWebRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  remindCustomGo: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },

  promoLockedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  promoLockIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  promoLockedTitle: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  promoLockedSub: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2, lineHeight: 18 },
  promoUnlockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  promoUnlockPillText: { fontFamily: font.bold, fontSize: 10, color: "#B45309" },
});
