import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Switch,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { useUpgrade } from "@/src/context/UpgradeContext";
import { useToast } from "@/src/context/ToastContext";
import { api } from "@/src/lib/api";
import { colors, font, fontSize, radius, spacing, shadow } from "@/src/theme";

export default function Account() {
  const insets = useSafeAreaInsets();
  const tabH = useContext(BottomTabBarHeightContext) ?? 64 + insets.bottom;
  const { user, logout, setUser } = useAuth();
  const { showUpgrade } = useUpgrade();
  const toast = useToast();

  const isPremium = user?.plan === "premium";
  const [push, setPush] = useState(user?.notify_channels?.push ?? true);
  const [wa, setWa] = useState(user?.notify_channels?.whatsapp ?? false);

  const saveChannels = async (nextPush: boolean, nextWa: boolean) => {
    setPush(nextPush);
    setWa(nextWa);
    try {
      const res: any = await api.updateChannels({ push: nextPush, whatsapp: nextWa });
      setUser(res.user);
    } catch {
      toast.show("Gagal menyimpan pengaturan", "error");
    }
  };

  const toggleWa = (val: boolean) => {
    if (!isPremium && val) {
      showUpgrade();
      return;
    }
    saveChannels(push, val);
  };

  const downgrade = async () => {
    try {
      const res: any = await api.downgrade();
      setUser(res.user);
      toast.show("Paket kembali ke Free", "info");
    } catch {}
  };

  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: tabH + spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Akun</Text>

      {/* Profile */}
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{user?.name}</Text>
          <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
        </View>
      </View>

      {/* Plan card */}
      {isPremium ? (
        <View style={styles.premiumCard}>
          <View style={styles.premiumIcon}>
            <MaterialCommunityIcons name="crown" size={22} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle}>Kamu Premium 🎉</Text>
            <Text style={styles.premiumSub}>Langganan tanpa batas & notifikasi WhatsApp aktif.</Text>
          </View>
        </View>
      ) : (
        <Pressable testID="upgrade-card" onPress={showUpgrade} style={{ marginHorizontal: spacing.xl }}>
          <LinearGradient
            colors={[colors.brand, colors.brandDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.upgradeCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeTitle}>Upgrade ke Premium</Text>
              <Text style={styles.upgradeSub}>
                Langganan tak terbatas, WhatsApp reminder & Family Sharing.
              </Text>
            </View>
            <View style={styles.upgradeArrow}>
              <MaterialCommunityIcons name="crown" size={22} color={colors.brand} />
            </View>
          </LinearGradient>
        </Pressable>
      )}

      {/* Notification channels */}
      <Text style={styles.sectionLabel}>Notifikasi</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <MaterialCommunityIcons name="cellphone" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Push HP</Text>
            <Text style={styles.rowSub}>Reminder H-3, H-1 & hari-H</Text>
          </View>
          <Switch
            testID="toggle-push"
            value={push}
            onValueChange={(v) => saveChannels(v, wa)}
            trackColor={{ true: colors.brand, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={styles.rowTitle}>WhatsApp</Text>
              {!isPremium && (
                <View style={styles.lockPill}>
                  <MaterialCommunityIcons name="lock" size={10} color="#B45309" />
                  <Text style={styles.lockText}>Premium</Text>
                </View>
              )}
            </View>
            <Text style={styles.rowSub}>Kirim reminder juga ke WhatsApp</Text>
          </View>
          <Switch
            testID="toggle-whatsapp"
            value={wa}
            onValueChange={toggleWa}
            trackColor={{ true: colors.brand, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Actions */}
      <Text style={styles.sectionLabel}>Lainnya</Text>
      <View style={styles.card}>
        {isPremium && (
          <>
            <Pressable testID="downgrade-button" style={styles.actionRow} onPress={downgrade}>
              <MaterialCommunityIcons name="arrow-down-circle-outline" size={20} color={colors.muted} />
              <Text style={styles.actionText}>Kembali ke paket Free</Text>
            </Pressable>
            <View style={styles.divider} />
          </>
        )}
        <Pressable testID="logout-button" style={styles.actionRow} onPress={logout}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
          <Text style={[styles.actionText, { color: colors.error }]}>Keluar</Text>
        </Pressable>
      </View>

      <Text style={styles.version}>Notifin v1.0 · Fase 1</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  screenTitle: {
    fontFamily: font.extrabold,
    fontSize: fontSize["2xl"],
    color: colors.onSurface,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.onBrandSecondary },
  name: { fontFamily: font.bold, fontSize: fontSize.xl, color: colors.onSurface },
  email: { fontFamily: font.regular, fontSize: fontSize.base, color: colors.muted },

  upgradeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  upgradeTitle: { fontFamily: font.extrabold, fontSize: fontSize.lg, color: "#fff" },
  upgradeSub: { fontFamily: font.medium, fontSize: fontSize.sm, color: "rgba(255,255,255,0.9)", marginTop: 2, lineHeight: 18 },
  upgradeArrow: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    backgroundColor: "#FEF3C7",
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  premiumIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumTitle: { fontFamily: font.bold, fontSize: fontSize.lg, color: "#92400E" },
  premiumSub: { fontFamily: font.medium, fontSize: fontSize.sm, color: "#B45309", marginTop: 2 },

  sectionLabel: {
    fontFamily: font.bold,
    fontSize: fontSize.base,
    color: colors.muted,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    marginHorizontal: spacing.xl,
  },
  card: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    ...shadow.soft,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },
  rowSub: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  lockText: { fontFamily: font.bold, fontSize: 10, color: "#B45309" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 66 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  actionText: { fontFamily: font.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  version: {
    fontFamily: font.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
