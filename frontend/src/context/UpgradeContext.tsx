import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, font, fontSize, radius, spacing, shadow } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { useToast } from "@/src/context/ToastContext";

const UpgradeContext = createContext<{ showUpgrade: () => void } | undefined>(
  undefined,
);

const BENEFITS = [
  { icon: "infinity", text: "Langganan tanpa batas" },
  { icon: "whatsapp", text: "Notifikasi via WhatsApp" },
  { icon: "account-group", text: "Family & Team Sharing" },
  { icon: "chart-box", text: "Ringkasan bulanan otomatis" },
];

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const toast = useToast();

  const showUpgrade = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ref.current?.present();
  }, []);

  const doUpgrade = useCallback(async () => {
    try {
      const res: any = await api.upgrade();
      setUser(res.user);
      ref.current?.dismiss();
      toast.show("Selamat! Kamu sekarang Premium 🎉", "success");
    } catch {
      toast.show("Gagal upgrade, coba lagi", "error");
    }
  }, [setUser, toast]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.5}
      />
    ),
    [],
  );

  const value = useMemo(() => ({ showUpgrade }), [showUpgrade]);

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
      >
        <BottomSheetView style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name="crown" size={34} color="#F59E0B" />
          </View>
          <Text style={styles.title}>Upgrade ke Premium</Text>
          <Text style={styles.subtitle}>
            Sudah 3 langganan aktif di paket gratis. Buka semua fitur biar gak ada
            yang kelewat.
          </Text>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.text} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <MaterialCommunityIcons name={b.icon as any} size={18} color={colors.brand} />
                </View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>Rp19.000</Text>
            <Text style={styles.priceUnit}>/bulan</Text>
            <View style={styles.yearPill}>
              <Text style={styles.yearPillText}>atau Rp149rb/tahun</Text>
            </View>
          </View>

          <Pressable
            testID="upgrade-confirm-button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            onPress={doUpgrade}
          >
            <Text style={styles.ctaText}>Upgrade Sekarang</Text>
          </Pressable>
          <Pressable
            testID="upgrade-dismiss-button"
            style={styles.dismiss}
            onPress={() => ref.current?.dismiss()}
          >
            <Text style={styles.dismissText}>Nanti aja</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error("useUpgrade must be used within UpgradeProvider");
  return ctx;
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    alignItems: "center",
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: font.extrabold,
    fontSize: fontSize["2xl"],
    color: colors.onSurface,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 21,
  },
  benefits: {
    alignSelf: "stretch",
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    fontFamily: font.semibold,
    fontSize: fontSize.lg,
    color: colors.onSurface,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: spacing.xl,
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
  },
  price: {
    fontFamily: font.extrabold,
    fontSize: fontSize["3xl"],
    color: colors.brand,
  },
  priceUnit: { fontFamily: font.medium, fontSize: fontSize.lg, color: colors.muted },
  yearPill: {
    marginLeft: spacing.sm,
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  yearPillText: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.onBrandSecondary },
  cta: {
    alignSelf: "stretch",
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.xl,
    ...shadow.soft,
  },
  ctaText: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onBrandPrimary },
  dismiss: { paddingVertical: spacing.md, marginTop: spacing.xs },
  dismissText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
});
