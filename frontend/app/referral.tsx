import React, { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { api } from "@/src/lib/api";
import { useToast } from "@/src/context/ToastContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { colors, font, fontSize, radius, spacing, shadow, webMaxWidth } from "@/src/theme";

interface ReferralEntry {
  name: string;
  status: "pending" | "completed" | "referrer_unavailable";
  created_at: string;
  completed_at?: string | null;
}

interface ReferralData {
  referral_code: string;
  completed_count: number;
  reward_days: number;
  referrals: ReferralEntry[];
}

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { t, locale } = useLanguage();

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res: any = await api.referralMe();
      setData(res);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shareLink = data ? `https://notifin.online/(auth)/login?mode=register&ref=${data.referral_code}` : "";
  const shareMessage = data
    ? t("referral.shareMessage", { code: data.referral_code, link: shareLink })
    : "";

  const copyCode = async () => {
    if (!data) return;
    if (Platform.OS === "web") {
      try {
        await (navigator as any)?.clipboard?.writeText(data.referral_code);
        toast.show(t("referral.copiedToast"), "success");
      } catch {
        toast.show(t("referral.copyFailedToast"), "error");
      }
    } else {
      await Clipboard.setStringAsync(data.referral_code);
      toast.show(t("referral.copiedToast"), "success");
    }
  };

  const share = async () => {
    if (!data) return;
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ text: shareMessage });
          return;
        } catch {
          return;
        }
      }
      await copyCode();
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({ message: shareMessage });
    } catch {}
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  };

  const statusLabel = (status: ReferralEntry["status"]) => {
    if (status === "completed") return t("referral.statusCompleted");
    if (status === "referrer_unavailable") return t("referral.statusUnavailable");
    return t("referral.statusPending");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="referral-back" onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("referral.pageTitle")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["2xl"], maxWidth: webMaxWidth, width: "100%", alignSelf: "center" }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : data ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name="gift-outline" size={28} color={colors.brand} />
              </View>
              <Text style={styles.heroTitle}>{t("referral.heroTitle")}</Text>
              <Text style={styles.heroSubtitle}>
                {t("referral.heroSubtitle", { days: data.reward_days })}
              </Text>
            </View>

            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>{t("referral.codeLabel")}</Text>
              <Text testID="referral-code-text" style={styles.codeValue}>{data.referral_code}</Text>
              <View style={styles.codeActions}>
                <Pressable testID="referral-copy-button" onPress={copyCode} style={styles.codeActionBtn}>
                  <MaterialCommunityIcons name="content-copy" size={16} color={colors.brand} />
                  <Text style={styles.codeActionText}>{t("referral.copyAction")}</Text>
                </Pressable>
                <Pressable testID="referral-share-button" onPress={share} style={[styles.codeActionBtn, styles.codeActionBtnPrimary]}>
                  <MaterialCommunityIcons name="share-variant" size={16} color="#FFFFFF" />
                  <Text style={[styles.codeActionText, { color: "#FFFFFF" }]}>{t("referral.shareAction")}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.statRow}>
              <MaterialCommunityIcons name="check-decagram" size={20} color={colors.brand} />
              <Text style={styles.statText}>
                {t("referral.completedCount", { count: data.completed_count })}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>{t("referral.historyTitle")}</Text>
            {data.referrals.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="account-multiple-plus-outline" size={28} color={colors.muted} />
                <Text style={styles.emptyText}>{t("referral.emptyHistory")}</Text>
              </View>
            ) : (
              data.referrals.map((r, i) => (
                <View key={`${r.name}-${i}`} style={styles.historyRow}>
                  <View style={styles.historyAvatar}>
                    <Text style={styles.historyAvatarText}>{(r.name || "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyName}>{r.name}</Text>
                    <Text style={styles.historyDate}>{fmtDate(r.created_at)}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      r.status === "completed" ? styles.statusPillDone : styles.statusPillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        r.status === "completed" ? styles.statusPillTextDone : styles.statusPillTextPending,
                      ]}
                    >
                      {statusLabel(r.status)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t("referral.loadError")}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { paddingVertical: spacing["3xl"], alignItems: "center" },
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

  heroCard: {
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  heroTitle: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.onSurface, textAlign: "center" },
  heroSubtitle: {
    fontFamily: font.medium,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 21,
  },

  codeCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
    ...shadow.soft,
  },
  codeLabel: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.muted },
  codeValue: {
    fontFamily: font.extrabold,
    fontSize: 36,
    letterSpacing: 4,
    color: colors.brand,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  codeActions: { flexDirection: "row", gap: spacing.md },
  codeActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  codeActionBtnPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  codeActionText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.brand },

  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    justifyContent: "center",
  },
  statText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },

  sectionLabel: {
    fontFamily: font.bold,
    fontSize: fontSize.sm,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing["2xl"],
    marginBottom: spacing.md,
  },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing["2xl"],
  },
  emptyText: { fontFamily: font.medium, fontSize: fontSize.base, color: colors.muted, textAlign: "center" },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  historyAvatarText: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.brandDark },
  historyName: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  historyDate: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  statusPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  statusPillPending: { backgroundColor: colors.surfaceTertiary },
  statusPillDone: { backgroundColor: colors.brandTertiary },
  statusPillText: { fontFamily: font.bold, fontSize: fontSize.sm },
  statusPillTextPending: { color: colors.onSurfaceTertiary },
  statusPillTextDone: { color: colors.brandDark },
});
