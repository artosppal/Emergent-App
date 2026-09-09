import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View, Pressable, Linking } from "react-native";
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
import { api, ApiError } from "@/src/lib/api";
import { useToast } from "@/src/context/ToastContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/context/AuthContext";
import { Input } from "@/src/components/ui";

const UpgradeContext = createContext<{ showUpgrade: () => void } | undefined>(
  undefined,
);

const RESEND_COOLDOWN_S = 45;

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t } = useLanguage();
  const { user, verifyPhoneRequest, verifyPhoneConfirm } = useAuth();
  const [tier, setTier] = useState<"monthly" | "yearly">("monthly");
  const [upgrading, setUpgrading] = useState(false);
  const [step, setStep] = useState<"plan" | "phone" | "otp">("plan");
  const [phoneInput, setPhoneInput] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const BENEFITS = [
    { icon: "infinity", text: t("upgrade.benefitUnlimited") },
    { icon: "whatsapp", text: t("upgrade.benefitWhatsapp") },
    { icon: "account-group", text: t("upgrade.benefitFamily") },
    { icon: "chart-box", text: t("upgrade.benefitSummary") },
  ];

  const showUpgrade = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("plan");
    setOtpInput("");
    ref.current?.present();
  }, []);

  const doUpgrade = useCallback(async () => {
    setUpgrading(true);
    try {
      const res: any = await api.upgrade(tier);
      if (res.checkout_url) {
        ref.current?.dismiss();
        await Linking.openURL(res.checkout_url);
      } else {
        toast.show(t("upgrade.errToast"), "error");
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && (e.detail as any)?.code === "phone_not_verified") {
        setPhoneInput(user?.phone || "");
        setStep("phone");
      } else if (e instanceof ApiError && e.status === 503) {
        // KYC/Mayar not configured yet — a friendlier message than the
        // generic error, since it's an expected state until the API key is set.
        toast.show(e.message, "info");
      } else {
        toast.show(t("upgrade.errToast"), "error");
      }
    } finally {
      setUpgrading(false);
    }
  }, [tier, toast, t, user]);

  const submitPhone = useCallback(async () => {
    if (!phoneInput.trim()) return;
    setUpgrading(true);
    try {
      const normalized = await verifyPhoneRequest(phoneInput.trim());
      setPendingPhone(normalized);
      setOtpInput("");
      setCooldown(RESEND_COOLDOWN_S);
      setStep("otp");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : t("upgrade.errToast"), "error");
    } finally {
      setUpgrading(false);
    }
  }, [phoneInput, verifyPhoneRequest, toast, t]);

  const resendPhoneOtp = useCallback(async () => {
    if (cooldown > 0) return;
    setUpgrading(true);
    try {
      await verifyPhoneRequest(pendingPhone);
      setCooldown(RESEND_COOLDOWN_S);
      toast.show(t("auth.otpResentToast"), "info");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : t("upgrade.errToast"), "error");
    } finally {
      setUpgrading(false);
    }
  }, [cooldown, pendingPhone, verifyPhoneRequest, toast, t]);

  const submitPhoneOtp = useCallback(async () => {
    if (otpInput.trim().length !== 6) return;
    setUpgrading(true);
    try {
      await verifyPhoneConfirm(otpInput.trim());
      setStep("plan");
      await doUpgrade();
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : t("upgrade.errToast"), "error");
    } finally {
      setUpgrading(false);
    }
  }, [otpInput, verifyPhoneConfirm, doUpgrade, toast, t]);

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
          {step === "plan" && (
            <>
              <Text style={styles.title}>{t("upgrade.title")}</Text>
              <Text style={styles.subtitle}>{t("upgrade.subtitle")}</Text>

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

              <View style={styles.tierRow}>
                <Pressable
                  testID="upgrade-tier-monthly"
                  onPress={() => setTier("monthly")}
                  style={[styles.tierCard, tier === "monthly" && styles.tierCardActive]}
                >
                  <Text style={[styles.tierPrice, tier === "monthly" && styles.tierPriceActive]}>
                    Rp19.000
                  </Text>
                  <Text style={[styles.tierLabel, tier === "monthly" && styles.tierLabelActive]}>
                    {t("upgrade.perMonth")}
                  </Text>
                </Pressable>
                <Pressable
                  testID="upgrade-tier-yearly"
                  onPress={() => setTier("yearly")}
                  style={[styles.tierCard, tier === "yearly" && styles.tierCardActive]}
                >
                  <View style={styles.savePill}>
                    <Text style={styles.savePillText}>{t("upgrade.yearlyPill")}</Text>
                  </View>
                  <Text style={[styles.tierPrice, tier === "yearly" && styles.tierPriceActive]}>
                    Rp149.000
                  </Text>
                  <Text style={[styles.tierLabel, tier === "yearly" && styles.tierLabelActive]}>
                    {t("upgrade.perYear")}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                testID="upgrade-confirm-button"
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }, upgrading && { opacity: 0.7 }]}
                onPress={doUpgrade}
                disabled={upgrading}
              >
                {upgrading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.ctaText}>{t("upgrade.cta")}</Text>
                )}
              </Pressable>
              <Pressable
                testID="upgrade-dismiss-button"
                style={styles.dismiss}
                onPress={() => ref.current?.dismiss()}
              >
                <Text style={styles.dismissText}>{t("upgrade.dismiss")}</Text>
              </Pressable>
            </>
          )}

          {step === "phone" && (
            <>
              <View style={styles.iconBadge}>
                <MaterialCommunityIcons name="whatsapp" size={30} color="#25D366" />
              </View>
              <Text style={styles.title}>{t("upgrade.phoneNeededTitle")}</Text>
              <Text style={styles.subtitle}>{t("upgrade.phoneNeededSub")}</Text>

              <View style={{ alignSelf: "stretch", marginTop: spacing.xl }}>
                <Input
                  testID="upgrade-phone-input"
                  label={t("auth.phoneLabel")}
                  icon="whatsapp"
                  placeholder={t("auth.phonePlaceholder")}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  keyboardType="phone-pad"
                />
              </View>

              <Pressable
                testID="upgrade-phone-submit"
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }, upgrading && { opacity: 0.7 }]}
                onPress={submitPhone}
                disabled={upgrading}
              >
                {upgrading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.ctaText}>{t("upgrade.phoneSubmit")}</Text>
                )}
              </Pressable>
              <Pressable style={styles.dismiss} onPress={() => setStep("plan")}>
                <Text style={styles.dismissText}>{t("upgrade.phoneBack")}</Text>
              </Pressable>
            </>
          )}

          {step === "otp" && (
            <>
              <View style={styles.iconBadge}>
                <MaterialCommunityIcons name="shield-key" size={30} color="#25D366" />
              </View>
              <Text style={styles.title}>{t("auth.otpTitle")}</Text>
              <Text style={styles.subtitle}>
                {t("auth.otpSubWa")} +{pendingPhone}
              </Text>

              <View style={{ alignSelf: "stretch", marginTop: spacing.xl }}>
                <Input
                  testID="upgrade-otp-input"
                  label={t("auth.otpTitle")}
                  icon="shield-key"
                  placeholder={t("auth.otpPlaceholder")}
                  value={otpInput}
                  onChangeText={(v) => setOtpInput(v.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <Pressable
                testID="upgrade-otp-submit"
                style={({ pressed }) => [
                  styles.cta,
                  pressed && { opacity: 0.9 },
                  (upgrading || otpInput.trim().length !== 6) && { opacity: 0.7 },
                ]}
                onPress={submitPhoneOtp}
                disabled={upgrading || otpInput.trim().length !== 6}
              >
                {upgrading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.ctaText}>{t("auth.otpSubmit")}</Text>
                )}
              </Pressable>
              <Pressable style={styles.dismiss} onPress={resendPhoneOtp} disabled={cooldown > 0}>
                <Text style={[styles.dismissText, cooldown === 0 && { color: colors.brand }]}>
                  {cooldown > 0 ? t("auth.otpResendWait", { s: cooldown }) : t("auth.otpResend")}
                </Text>
              </Pressable>
              <Pressable style={styles.dismiss} onPress={() => setStep("phone")}>
                <Text style={styles.dismissText}>{t("upgrade.phoneBack")}</Text>
              </Pressable>
            </>
          )}
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
  tierRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  tierCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary,
  },
  tierCardActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTertiary,
  },
  tierPrice: {
    fontFamily: font.extrabold,
    fontSize: fontSize.xl,
    color: colors.onSurface,
    marginTop: spacing.xs,
  },
  tierPriceActive: { color: colors.brandDark },
  tierLabel: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  tierLabelActive: { color: colors.onBrandTertiary },
  savePill: {
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  savePillText: { fontFamily: font.bold, fontSize: 10, color: colors.onBrandSecondary },
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
