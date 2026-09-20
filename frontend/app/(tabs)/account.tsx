import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Switch,
  Platform,
  Modal,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { useUpgrade } from "@/src/context/UpgradeContext";
import { useToast } from "@/src/context/ToastContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { api, ApiError } from "@/src/lib/api";
import { Input, Button } from "@/src/components/ui";
import { colors, font, fontSize, radius, spacing, shadow, formatRupiah, webMaxWidth } from "@/src/theme";

const WA_VERIFY_RESEND_COOLDOWN_S = 45;

export default function Account() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tabH = useContext(BottomTabBarHeightContext) ?? 64 + insets.bottom;
  const { user, logout, setUser, verifyPhoneRequest, verifyPhoneConfirm, changePassword } = useAuth();
  const { showUpgrade } = useUpgrade();
  const toast = useToast();
  const { t, language, locale, setLanguage } = useLanguage();

  const fmtLongDate = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  };

  const isPremium = user?.plan === "premium";
  const [push, setPush] = useState(user?.notify_channels?.push ?? true);
  const [wa, setWa] = useState(user?.notify_channels?.whatsapp ?? false);
  const [phoneModal, setPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState(user?.phone || "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [limitModal, setLimitModal] = useState(false);
  const [limitInput, setLimitInput] = useState(
    user?.monthly_limit ? String(user.monthly_limit) : "",
  );
  const [savingLimit, setSavingLimit] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const savePhone = async () => {
    setSavingPhone(true);
    try {
      const res: any = await api.updatePhone(phoneInput.trim());
      setUser(res.user);
      setPhoneModal(false);
      toast.show(
        phoneInput.trim() ? t("account.phoneSaved") : t("account.phoneRemoved"),
        "success",
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        toast.show(t("account.phoneInvalid"), "error");
      } else {
        toast.show(t("account.errSavePhone"), "error");
      }
    } finally {
      setSavingPhone(false);
    }
  };

  const saveLimit = async () => {
    const digits = limitInput.replace(/[^0-9]/g, "");
    const value = digits ? parseInt(digits, 10) : null;
    setSavingLimit(true);
    try {
      const res: any = await api.updateLimit(value);
      setUser(res.user);
      setLimitModal(false);
      toast.show(value ? t("account.limitSaved") : t("account.limitRemoved"), "success");
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        toast.show(t("account.limitInvalid"), "error");
      } else {
        toast.show(t("account.errSaveLimit"), "error");
      }
    } finally {
      setSavingLimit(false);
    }
  };

  const closePasswordModal = () => {
    setPasswordModal(false);
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
  };

  const savePassword = async () => {
    if (newPasswordInput.length < 6) {
      toast.show(t("auth.errPasswordLen"), "error");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      toast.show(t("auth.errPasswordMismatch"), "error");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(user?.has_password ? currentPasswordInput : null, newPasswordInput);
      closePasswordModal();
      toast.show(t("account.passwordSaved"), "success");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        toast.show(t("account.currentPasswordWrong"), "error");
      } else {
        toast.show(t("account.errSavePassword"), "error");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const saveChannels = async (nextPush: boolean, nextWa: boolean) => {
    setPush(nextPush);
    setWa(nextWa);
    try {
      const res: any = await api.updateChannels({ push: nextPush, whatsapp: nextWa });
      setUser(res.user);
    } catch {
      toast.show(t("account.errSaveSettings"), "error");
    }
  };

  // Turning WhatsApp notifications on requires a verified number first —
  // the switch stays off (and the toggle short-circuits into this modal)
  // until /auth/phone/verify/confirm proves ownership. Once verified, the
  // backend flips notify_channels.whatsapp itself, so we just mirror that.
  const [waVerifyStep, setWaVerifyStep] = useState<"closed" | "phone" | "otp">("closed");
  const [waPhoneInput, setWaPhoneInput] = useState(user?.phone || "");
  const [waPendingPhone, setWaPendingPhone] = useState("");
  const [waOtpInput, setWaOtpInput] = useState("");
  const [waVerifyBusy, setWaVerifyBusy] = useState(false);
  const [waCooldown, setWaCooldown] = useState(0);

  useEffect(() => {
    if (waCooldown <= 0) return;
    const id = setInterval(() => setWaCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [waCooldown]);

  const toggleWa = (val: boolean) => {
    if (val && !user?.phone_verified) {
      setWaPhoneInput(user?.phone || "");
      setWaOtpInput("");
      setWaVerifyStep("phone");
      return;
    }
    saveChannels(push, val);
  };

  const closeWaVerify = () => setWaVerifyStep("closed");

  const submitWaVerifyPhone = async () => {
    if (!waPhoneInput.trim()) return;
    setWaVerifyBusy(true);
    try {
      const normalized = await verifyPhoneRequest(waPhoneInput.trim());
      setWaPendingPhone(normalized);
      setWaOtpInput("");
      setWaCooldown(WA_VERIFY_RESEND_COOLDOWN_S);
      setWaVerifyStep("otp");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : t("account.errWaVerify"), "error");
    } finally {
      setWaVerifyBusy(false);
    }
  };

  const resendWaVerifyOtp = async () => {
    if (waCooldown > 0) return;
    setWaVerifyBusy(true);
    try {
      await verifyPhoneRequest(waPendingPhone);
      setWaCooldown(WA_VERIFY_RESEND_COOLDOWN_S);
      toast.show(t("auth.otpResentToast"), "info");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : t("account.errWaVerify"), "error");
    } finally {
      setWaVerifyBusy(false);
    }
  };

  const submitWaVerifyOtp = async () => {
    if (waOtpInput.trim().length !== 6) return;
    setWaVerifyBusy(true);
    try {
      await verifyPhoneConfirm(waOtpInput.trim());
      setWa(true);
      setWaVerifyStep("closed");
      toast.show(t("account.waVerifiedToast"), "success");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : t("account.errWaVerify"), "error");
    } finally {
      setWaVerifyBusy(false);
    }
  };

  const waLimit = user?.wa_notif_limit ?? 5;
  const waUsed = Math.min(user?.wa_notif_used ?? 0, waLimit);
  const waQuotaPct = waLimit > 0 ? Math.round((waUsed / waLimit) * 100) : 0;

  type DowngradeStep = "closed" | "confirm" | "reason" | "offer" | "thanks";
  const [downgradeStep, setDowngradeStep] = useState<DowngradeStep>("closed");
  const [downgradeReason, setDowngradeReason] = useState<string | null>(null);
  const [downgradeReasonOther, setDowngradeReasonOther] = useState("");
  const [downgradeBusy, setDowngradeBusy] = useState(false);
  const [offerBusy, setOfferBusy] = useState<"3m" | "6m" | "12m" | null>(null);

  const DOWNGRADE_REASONS: { code: string; label: string }[] = [
    { code: "too_expensive", label: t("downgradeFlow.reasonTooExpensive") },
    { code: "rarely_used", label: t("downgradeFlow.reasonRarelyUsed") },
    { code: "missing_features", label: t("downgradeFlow.reasonMissingFeatures") },
    { code: "switching_app", label: t("downgradeFlow.reasonSwitchingApp") },
    { code: "just_trying", label: t("downgradeFlow.reasonJustTrying") },
    { code: "other", label: t("downgradeFlow.reasonOther") },
  ];

  const closeDowngradeFlow = () => {
    setDowngradeStep("closed");
    setDowngradeReason(null);
    setDowngradeReasonOther("");
  };

  const submitDowngradeReason = async () => {
    if (!downgradeReason) {
      toast.show(t("downgradeFlow.errReason"), "error");
      return;
    }
    if (downgradeReason === "other" && !downgradeReasonOther.trim()) {
      toast.show(t("downgradeFlow.errReasonOther"), "error");
      return;
    }
    setDowngradeBusy(true);
    try {
      await api.downgradeFeedback({
        reason: downgradeReason,
        reason_other: downgradeReason === "other" ? downgradeReasonOther.trim() : null,
      });
      setDowngradeStep("offer");
    } catch {
      toast.show(t("downgradeFlow.errReason"), "error");
    } finally {
      setDowngradeBusy(false);
    }
  };

  const takeRetentionOffer = async (offer: "3m" | "6m" | "12m") => {
    setOfferBusy(offer);
    // Same popup-blocker issue as the main upgrade flow: open the tab
    // synchronously (still inside this click's user-gesture) and fill in
    // its location once the checkout URL comes back from the awaited call.
    const popup = Platform.OS === "web" ? window.open("", "_blank") : null;
    try {
      const res: any = await api.retentionOffer(offer);
      if (res.checkout_url) {
        closeDowngradeFlow();
        if (popup) {
          popup.location.href = res.checkout_url;
        } else {
          await Linking.openURL(res.checkout_url);
        }
      } else {
        popup?.close();
        toast.show(t("downgradeFlow.errOffer"), "error");
      }
    } catch (e) {
      popup?.close();
      if (e instanceof ApiError && e.status === 503) {
        toast.show(e.message, "info");
      } else {
        toast.show(t("downgradeFlow.errOffer"), "error");
      }
    } finally {
      setOfferBusy(null);
    }
  };

  const declineOfferAndDowngrade = async () => {
    setDowngradeBusy(true);
    try {
      const res: any = await api.downgrade();
      setUser(res.user);
      setDowngradeStep("thanks");
    } catch {
    } finally {
      setDowngradeBusy(false);
    }
  };

  const [resuming, setResuming] = useState(false);
  const resumeSubscription = async () => {
    setResuming(true);
    try {
      const res: any = await api.resumeSubscription();
      setUser(res.user);
      toast.show(t("account.resumedToast"), "success");
    } catch {
      toast.show(t("account.errResume"), "error");
    } finally {
      setResuming(false);
    }
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
      contentContainerStyle={{
        paddingTop: insets.top + spacing.xl,
        paddingBottom: tabH + spacing.xl,
        width: "100%",
        maxWidth: webMaxWidth,
        alignSelf: "center",
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>{t("account.title")}</Text>

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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.premiumIcon}>
              <MaterialCommunityIcons name="crown" size={22} color="#B45309" />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.premiumTitle}>{t("account.premiumTitle")}</Text>
              <Text style={styles.premiumSub}>
                {t("account.premiumActiveUntil", { date: fmtLongDate(user?.premium_expires_at) })}
              </Text>
            </View>
          </View>
          {user?.cancel_at_period_end && (
            <>
              <Text style={styles.premiumCancelledNote}>{t("account.premiumCancelledNote")}</Text>
              <Pressable
                testID="resume-subscription-button"
                style={styles.resumeBtn}
                onPress={resumeSubscription}
                disabled={resuming}
              >
                {resuming ? (
                  <ActivityIndicator color="#92400E" size="small" />
                ) : (
                  <Text style={styles.resumeBtnText}>{t("account.resumeAction")}</Text>
                )}
              </Pressable>
            </>
          )}
          <Pressable testID="compare-plans-link" onPress={() => router.push("/pricing")} style={styles.comparePlansLinkAmber}>
            <Text style={styles.comparePlansLinkAmberText}>{t("account.comparePlans")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginHorizontal: spacing.xl }}>
          <View style={styles.promoCard}>
            <LinearGradient
              colors={[colors.brand, colors.brandDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.promoBadge}>
              <MaterialCommunityIcons name="crown" size={14} color={colors.brandDark} />
              <Text style={styles.promoBadgeText}>{t("account.premiumPromoBadge")}</Text>
            </View>
            <Text style={styles.promoTitle}>{t("account.upgradeTitle")}</Text>
            <View style={styles.promoPriceRow}>
              <Text style={styles.promoPrice}>Rp19.000</Text>
              <Text style={styles.promoPriceSuffix}>{t("account.premiumPromoPriceSuffix")}</Text>
            </View>
            <Text style={styles.promoSubtitle}>{t("account.upgradeSubtitle")}</Text>

            <View style={styles.promoItems}>
              {[
                t("upgrade.benefitUnlimited"),
                t("upgrade.benefitWhatsapp"),
                t("upgrade.benefitFamily"),
                t("upgrade.benefitSummary"),
              ].map((it) => (
                <View key={it} style={styles.promoItemRow}>
                  <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.promoItemText}>{it}</Text>
                </View>
              ))}
            </View>

            <Pressable
              testID="upgrade-card"
              onPress={showUpgrade}
              style={({ pressed }) => [styles.promoCta, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.promoCtaText}>{t("upgrade.cta")}</Text>
            </Pressable>
          </View>
          <Pressable testID="compare-plans-link" onPress={() => router.push("/pricing")} style={styles.comparePlansLink}>
            <Text style={styles.comparePlansLinkText}>{t("account.comparePlans")}</Text>
          </Pressable>
        </View>
      )}

      {/* Notification channels */}
      <Text style={styles.sectionLabel}>{t("account.notificationsSection")}</Text>

      {isPremium ? (
        <View style={[styles.waCard, { marginHorizontal: spacing.xl, marginBottom: spacing.lg }]}>
          <LinearGradient
            colors={["#FDE68A", "#B45309"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.waPremiumGradient}
          >
            <View style={styles.waCardRow}>
              <View style={styles.waPremiumIconBadge}>
                <MaterialCommunityIcons name="whatsapp" size={20} color="#92400E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.waPremiumTitle}>{t("account.waCardTitlePremium")}</Text>
                <Text style={styles.waPremiumSub}>{t("account.waCardSubtitle")}</Text>
              </View>
              <Switch
                testID="toggle-whatsapp"
                value={wa}
                onValueChange={toggleWa}
                trackColor={{ true: "#FFFFFF", false: "rgba(255,255,255,0.45)" }}
                thumbColor={wa ? "#B45309" : "#FFFFFF"}
              />
            </View>
            <View style={styles.waPremiumQuotaRow}>
              <MaterialCommunityIcons name="infinity" size={14} color="#FFFBEB" />
              <Text style={styles.waPremiumQuotaText}>{t("account.waQuotaPremium")}</Text>
            </View>
          </LinearGradient>
        </View>
      ) : (
        <View style={[styles.waCard, styles.waFreeCard, { marginHorizontal: spacing.xl, marginBottom: spacing.lg }]}>
          <View style={styles.waCardRow}>
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t("account.waCardTitleFree")}</Text>
              <Text style={styles.rowSub}>{t("account.waCardSubtitle")}</Text>
            </View>
            <Switch
              testID="toggle-whatsapp"
              value={wa}
              onValueChange={toggleWa}
              trackColor={{ true: colors.brand, false: colors.border }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.waQuotaBarTrack}>
            <View style={[styles.waQuotaBarFill, { width: `${waQuotaPct}%` }]} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.waQuotaLabel}>
              {t("account.waQuotaFree", { used: waUsed, limit: waLimit })}
            </Text>
            <Text style={styles.waQuotaResetLabel}>{t("account.waQuotaResetNote")}</Text>
          </View>

          <View style={styles.waUpsellStrip}>
            <Text style={styles.waUpsellTitle}>{t("account.waUpsellTitle")}</Text>
            {[
              t("account.waUpsellBenefit1"),
              t("account.waUpsellBenefit2"),
              t("account.waUpsellBenefit3"),
            ].map((b) => (
              <View key={b} style={styles.waUpsellBenefitRow}>
                <MaterialCommunityIcons name="check-circle" size={14} color={colors.brand} />
                <Text style={styles.waUpsellBenefitText}>{b}</Text>
              </View>
            ))}
            <Pressable testID="wa-upsell-button" style={styles.waUpsellBtn} onPress={showUpgrade}>
              <Text style={styles.waUpsellBtnText}>{t("account.waUpsellCta")}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.card, !user?.phone_verified && styles.cardDanger]}>
        <Pressable
          testID="phone-row"
          style={styles.row}
          onPress={() => {
            setPhoneInput(user?.phone || "");
            setPhoneModal(true);
          }}
        >
          <View style={[styles.rowIcon, !user?.phone_verified && styles.rowIconDanger]}>
            <MaterialCommunityIcons
              name="phone"
              size={20}
              color={!user?.phone_verified ? colors.error : colors.brand}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("account.phoneRowTitle")}</Text>
            <Text style={styles.rowSub}>
              {user?.phone ? `+${user.phone}` : t("account.phoneNotSet")}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.borderStrong} />
        </Pressable>
        {!user?.phone_verified && (
          <View style={styles.dangerBanner}>
            <MaterialCommunityIcons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.dangerText}>{t("account.phoneUnverifiedCaption")}</Text>
          </View>
        )}
        {wa && !user?.wa_live && (
          <View style={styles.simulBanner}>
            <MaterialCommunityIcons name="flask-outline" size={16} color="#B45309" />
            <Text style={styles.simulText}>{t("account.simulationBanner")}</Text>
          </View>
        )}
      </View>

      {/* Budget */}
      <Text style={styles.sectionLabel}>{t("account.budgetSection")}</Text>
      <View style={[styles.card, !user?.monthly_limit && styles.cardWarning]}>
        <Pressable
          testID="limit-row"
          style={styles.row}
          onPress={() => {
            setLimitInput(user?.monthly_limit ? String(user.monthly_limit) : "");
            setLimitModal(true);
          }}
        >
          <View style={[styles.rowIcon, !user?.monthly_limit && styles.rowIconWarning]}>
            <MaterialCommunityIcons
              name="chart-donut"
              size={20}
              color={!user?.monthly_limit ? "#B45309" : colors.brand}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t("account.limitRowTitle")}</Text>
            <Text style={styles.rowSub}>
              {user?.monthly_limit ? formatRupiah(user.monthly_limit) : t("account.limitNotSet")}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.borderStrong} />
        </Pressable>
        {!user?.monthly_limit && (
          <View style={styles.warningBanner}>
            <MaterialCommunityIcons name="alert-outline" size={16} color="#B45309" />
            <Text style={styles.warningText}>{t("account.limitUnsetCaption")}</Text>
          </View>
        )}
      </View>

      {/* Language */}
      <Text style={styles.sectionLabel}>{t("account.languageSection")}</Text>
      <View style={styles.segment}>
        <Pressable
          testID="language-id-button"
          onPress={() => setLanguage("id")}
          style={[styles.segmentItem, language === "id" && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, language === "id" && styles.segmentTextActive]}>
            {t("account.languageId")}
          </Text>
        </Pressable>
        <Pressable
          testID="language-en-button"
          onPress={() => setLanguage("en")}
          style={[styles.segmentItem, language === "en" && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, language === "en" && styles.segmentTextActive]}>
            {t("account.languageEn")}
          </Text>
        </Pressable>
      </View>

      {/* Actions */}
      <Text style={styles.sectionLabel}>{t("account.otherSection")}</Text>
      <View style={styles.card}>
        <Pressable
          testID="change-password-button"
          style={styles.actionRow}
          onPress={() => setPasswordModal(true)}
        >
          <MaterialCommunityIcons name="lock-reset" size={20} color={colors.muted} />
          <Text style={styles.actionText}>
            {user?.has_password ? t("account.changePasswordAction") : t("account.setPasswordAction")}
          </Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          testID="referral-program-button"
          style={styles.actionRow}
          onPress={() => router.push("/referral")}
        >
          <MaterialCommunityIcons name="gift-outline" size={20} color={colors.muted} />
          <Text style={styles.actionText}>{t("account.referralAction")}</Text>
        </Pressable>
        <View style={styles.divider} />
        {isPremium && !user?.cancel_at_period_end && (
          <>
            <Pressable
              testID="downgrade-button"
              style={styles.actionRow}
              onPress={() => setDowngradeStep("confirm")}
            >
              <MaterialCommunityIcons name="arrow-down-circle-outline" size={20} color={colors.muted} />
              <Text style={styles.actionText}>{t("account.downgradeAction")}</Text>
            </Pressable>
            <View style={styles.divider} />
          </>
        )}
        <Pressable testID="logout-button" style={styles.actionRow} onPress={logout}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
          <Text style={[styles.actionText, { color: colors.error }]}>{t("account.logoutAction")}</Text>
        </Pressable>
      </View>

      <Text style={styles.version}>{t("account.version")}</Text>

      {/* Phone modal */}
      <Modal
        visible={phoneModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPhoneModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPhoneModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t("account.phoneModalTitle")}</Text>
            <Text style={styles.modalSub}>{t("account.phoneModalSub")}</Text>
            <Input
              testID="phone-input"
              icon="whatsapp"
              placeholder={t("account.phonePlaceholder")}
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
              autoFocus
            />
            <Button
              testID="save-phone-button"
              title={t("account.save")}
              onPress={savePhone}
              loading={savingPhone}
            />
            <Pressable style={styles.cancelBtn} onPress={() => setPhoneModal(false)}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Change/set password modal */}
      <Modal
        visible={passwordModal}
        transparent
        animationType="fade"
        onRequestClose={closePasswordModal}
      >
        <Pressable style={styles.backdrop} onPress={closePasswordModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {user?.has_password ? t("account.changePasswordAction") : t("account.setPasswordAction")}
            </Text>
            <Text style={styles.modalSub}>
              {user?.has_password ? t("account.changePasswordSub") : t("account.setPasswordSub")}
            </Text>
            {user?.has_password && (
              <Input
                testID="current-password-input"
                label={t("account.currentPasswordLabel")}
                icon="lock"
                placeholder={t("auth.passwordPlaceholder")}
                value={currentPasswordInput}
                onChangeText={setCurrentPasswordInput}
                secureTextEntry
                autoFocus
              />
            )}
            <Input
              testID="new-password-input"
              label={t("auth.newPasswordLabel")}
              icon="lock-plus"
              placeholder={t("auth.passwordPlaceholder")}
              value={newPasswordInput}
              onChangeText={setNewPasswordInput}
              secureTextEntry
              autoFocus={!user?.has_password}
            />
            <Input
              testID="confirm-new-password-input"
              label={t("auth.confirmPasswordLabel")}
              icon="lock-check"
              placeholder={t("auth.confirmPasswordPlaceholder")}
              value={confirmPasswordInput}
              onChangeText={setConfirmPasswordInput}
              secureTextEntry
              error={
                confirmPasswordInput.length > 0 && confirmPasswordInput !== newPasswordInput
                  ? t("auth.errPasswordMismatch")
                  : undefined
              }
            />
            <Button
              testID="save-password-button"
              title={t("account.save")}
              onPress={savePassword}
              loading={savingPassword}
              disabled={!newPasswordInput || newPasswordInput !== confirmPasswordInput}
            />
            <Pressable style={styles.cancelBtn} onPress={closePasswordModal}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Monthly limit modal */}
      <Modal
        visible={limitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLimitModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setLimitModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t("account.limitModalTitle")}</Text>
            <Text style={styles.modalSub}>{t("account.limitModalSub")}</Text>
            <Input
              testID="limit-input"
              icon="cash"
              placeholder={t("account.limitPlaceholder")}
              value={limitInput}
              onChangeText={setLimitInput}
              keyboardType="numeric"
              autoFocus
            />
            <Button
              testID="save-limit-button"
              title={t("account.save")}
              onPress={saveLimit}
              loading={savingLimit}
            />
            <Pressable style={styles.cancelBtn} onPress={() => setLimitModal(false)}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* WhatsApp number verification, required before the toggle can turn on */}
      <Modal
        visible={waVerifyStep !== "closed"}
        transparent
        animationType="fade"
        onRequestClose={closeWaVerify}
      >
        <Pressable style={styles.backdrop} onPress={closeWaVerify}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {waVerifyStep === "phone" && (
              <>
                <Text style={styles.modalTitle}>{t("account.waVerifyModalTitle")}</Text>
                <Text style={styles.modalSub}>{t("account.waVerifyModalSub")}</Text>
                <Input
                  testID="wa-verify-phone-input"
                  icon="whatsapp"
                  placeholder={t("account.phonePlaceholder")}
                  value={waPhoneInput}
                  onChangeText={setWaPhoneInput}
                  keyboardType="phone-pad"
                  autoFocus
                />
                <Button
                  testID="wa-verify-phone-submit"
                  title={t("account.waVerifySubmit")}
                  onPress={submitWaVerifyPhone}
                  loading={waVerifyBusy}
                />
                <Pressable style={styles.cancelBtn} onPress={closeWaVerify}>
                  <Text style={styles.cancelText}>{t("common.cancel")}</Text>
                </Pressable>
              </>
            )}
            {waVerifyStep === "otp" && (
              <>
                <Text style={styles.modalTitle}>{t("auth.otpTitle")}</Text>
                <Text style={styles.modalSub}>
                  {t("auth.otpSubWa")} +{waPendingPhone}
                </Text>
                <Input
                  testID="wa-verify-otp-input"
                  icon="shield-key"
                  placeholder={t("auth.otpPlaceholder")}
                  value={waOtpInput}
                  onChangeText={(v) => setWaOtpInput(v.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <Button
                  testID="wa-verify-otp-submit"
                  title={t("auth.otpSubmit")}
                  onPress={submitWaVerifyOtp}
                  loading={waVerifyBusy}
                  disabled={waOtpInput.trim().length !== 6}
                />
                <Pressable
                  onPress={resendWaVerifyOtp}
                  disabled={waCooldown > 0}
                  style={styles.cancelBtn}
                >
                  <Text style={[styles.cancelText, waCooldown === 0 && { color: colors.brand }]}>
                    {waCooldown > 0 ? t("auth.otpResendWait", { s: waCooldown }) : t("auth.otpResend")}
                  </Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setWaVerifyStep("phone")}>
                  <Text style={styles.cancelText}>{t("account.waVerifyBack")}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Downgrade-to-Free flow: confirm -> reason -> retention offer */}
      <Modal
        visible={downgradeStep !== "closed"}
        transparent
        animationType="fade"
        onRequestClose={closeDowngradeFlow}
      >
        <Pressable style={styles.backdrop} onPress={closeDowngradeFlow}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {downgradeStep === "confirm" && (
              <>
                <Text style={styles.modalTitle}>{t("downgradeFlow.confirmTitle")}</Text>
                <Text style={styles.modalSub}>{t("downgradeFlow.confirmSub")}</Text>
                <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                  {[
                    "downgradeFlow.loseUnlimited",
                    "downgradeFlow.loseWhatsapp",
                    "downgradeFlow.loseFamily",
                    "downgradeFlow.loseSummary",
                  ].map((key) => (
                    <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <MaterialCommunityIcons name="close-circle" size={16} color={colors.error} />
                      <Text style={{ fontFamily: font.medium, fontSize: fontSize.base, color: colors.onSurface }}>
                        {t(key)}
                      </Text>
                    </View>
                  ))}
                </View>
                <Button
                  testID="downgrade-confirm-button"
                  title={t("downgradeFlow.confirmContinue")}
                  variant="danger"
                  onPress={() => setDowngradeStep("reason")}
                />
                <Pressable style={styles.cancelBtn} onPress={closeDowngradeFlow}>
                  <Text style={styles.cancelText}>{t("downgradeFlow.confirmCancel")}</Text>
                </Pressable>
              </>
            )}

            {downgradeStep === "reason" && (
              <>
                <Text style={styles.modalTitle}>{t("downgradeFlow.reasonTitle")}</Text>
                <Text style={styles.modalSub}>{t("downgradeFlow.reasonSub")}</Text>
                <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                  {DOWNGRADE_REASONS.map((r) => {
                    const active = downgradeReason === r.code;
                    return (
                      <Pressable
                        key={r.code}
                        testID={`downgrade-reason-${r.code}`}
                        onPress={() => setDowngradeReason(r.code)}
                        style={[styles.reasonRow, active && styles.reasonRowActive]}
                      >
                        <MaterialCommunityIcons
                          name={active ? "radiobox-marked" : "radiobox-blank"}
                          size={20}
                          color={active ? colors.brand : colors.muted}
                        />
                        <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{r.label}</Text>
                      </Pressable>
                    );
                  })}
                  {downgradeReason === "other" && (
                    <Input
                      testID="downgrade-reason-other-input"
                      placeholder={t("downgradeFlow.reasonOtherPlaceholder")}
                      value={downgradeReasonOther}
                      onChangeText={setDowngradeReasonOther}
                      autoFocus
                    />
                  )}
                </View>
                <Button
                  testID="downgrade-reason-submit"
                  title={t("downgradeFlow.reasonContinue")}
                  onPress={submitDowngradeReason}
                  loading={downgradeBusy}
                />
                <Pressable style={styles.cancelBtn} onPress={() => setDowngradeStep("confirm")}>
                  <Text style={styles.cancelText}>{t("downgradeFlow.reasonBack")}</Text>
                </Pressable>
              </>
            )}

            {downgradeStep === "offer" && (
              <>
                <Text style={styles.modalTitle}>{t("downgradeFlow.offerTitle")}</Text>
                <Text style={styles.modalSub}>{t("downgradeFlow.offerSub")}</Text>

                <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
                  {(
                    [
                      { key: "3m" as const, label: t("downgradeFlow.offer3mLabel"), price: 39000, was: 57000, pct: 32 },
                      { key: "6m" as const, label: t("downgradeFlow.offer6mLabel"), price: 69000, was: 114000, pct: 40, best: true },
                      { key: "12m" as const, label: t("downgradeFlow.offer12mLabel"), price: 99000, was: 149000, pct: 34 },
                    ]
                  ).map((o) => (
                    <View key={o.key} style={[styles.offerCard, o.best && styles.offerCardBest]}>
                      {o.best && (
                        <View style={styles.offerBadge}>
                          <MaterialCommunityIcons name="star" size={12} color="#FFFFFF" />
                          <Text style={styles.offerBadgeText}>{t("downgradeFlow.offerRecommended")}</Text>
                        </View>
                      )}
                      <Text style={styles.offerLabel}>{o.label}</Text>
                      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: spacing.sm }}>
                        <Text style={styles.offerPrice}>{formatRupiah(o.price)}</Text>
                        <Text style={styles.offerWas}>{formatRupiah(o.was)}</Text>
                      </View>
                      <Text style={styles.offerSave}>{t("downgradeFlow.offerSave", { pct: o.pct })}</Text>
                      <Pressable
                        testID={`downgrade-offer-${o.key}`}
                        style={[styles.offerTakeBtn, o.best && styles.offerTakeBtnBest]}
                        onPress={() => takeRetentionOffer(o.key)}
                        disabled={offerBusy !== null}
                      >
                        {offerBusy === o.key ? (
                          <ActivityIndicator color={o.best ? colors.onBrandPrimary : colors.brand} size="small" />
                        ) : (
                          <Text style={[styles.offerTakeBtnText, o.best && styles.offerTakeBtnTextBest]}>
                            {t("downgradeFlow.offerTake")}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>

                <Pressable
                  testID="downgrade-decline-offer"
                  style={styles.cancelBtn}
                  onPress={declineOfferAndDowngrade}
                  disabled={downgradeBusy}
                >
                  <Text style={styles.cancelText}>
                    {downgradeBusy ? "..." : t("downgradeFlow.offerDecline")}
                  </Text>
                </Pressable>
              </>
            )}

            {downgradeStep === "thanks" && (
              <View style={{ alignItems: "center" }}>
                <View style={styles.thanksIconBadge}>
                  <MaterialCommunityIcons name="heart" size={30} color="#F59E0B" />
                </View>
                <Text style={[styles.modalTitle, { textAlign: "center" }]}>
                  {t("downgradeFlow.thanksTitle")}
                </Text>
                <Text style={[styles.modalSub, { textAlign: "center" }]}>
                  {t("downgradeFlow.thanksBody", { date: fmtLongDate(user?.premium_expires_at) })}
                </Text>
                <View style={{ alignSelf: "stretch" }}>
                  <Button
                    testID="downgrade-thanks-close"
                    title={t("downgradeFlow.thanksClose")}
                    onPress={closeDowngradeFlow}
                  />
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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

  promoCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    overflow: "hidden",
    ...shadow.card,
  },
  promoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  promoBadgeText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.brandDark },
  promoTitle: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: "#FFFFFF" },
  promoPriceRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs, marginTop: spacing.sm },
  promoPrice: { fontFamily: font.extrabold, fontSize: 32, lineHeight: 36, color: "#FFFFFF" },
  promoPriceSuffix: {
    fontFamily: font.semibold,
    fontSize: fontSize.base,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  promoSubtitle: {
    fontFamily: font.medium,
    fontSize: fontSize.sm,
    color: "rgba(255,255,255,0.9)",
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  promoItems: { marginTop: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm },
  promoItemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  promoItemText: { fontFamily: font.medium, fontSize: fontSize.base, color: "#FFFFFF" },
  promoCta: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBBF24",
    boxShadow: "0px 4px 10px rgba(120, 53, 15, 0.25)",
    elevation: 3,
  },
  promoCtaText: { fontFamily: font.bold, fontSize: fontSize.lg, color: "#78350F" },
  comparePlansLink: { alignItems: "center", paddingVertical: spacing.md },
  comparePlansLinkText: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.muted },
  comparePlansLinkAmber: { alignItems: "center", paddingTop: spacing.md },
  comparePlansLinkAmberText: { fontFamily: font.semibold, fontSize: fontSize.sm, color: "#B45309" },
  premiumCard: {
    marginHorizontal: spacing.xl,
    backgroundColor: "#FEF3C7",
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  premiumCancelledNote: {
    fontFamily: font.medium,
    fontSize: fontSize.sm,
    color: "#92400E",
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  resumeBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1.5,
    borderColor: "#B45309",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  resumeBtnText: { fontFamily: font.bold, fontSize: fontSize.sm, color: "#92400E" },
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
  cardDanger: {
    borderWidth: 1.5,
    borderColor: colors.error,
    backgroundColor: "#FEF2F2",
  },
  cardWarning: {
    borderWidth: 1.5,
    borderColor: colors.warning,
    backgroundColor: "#FFFBEB",
  },
  waCard: { borderRadius: radius.lg, overflow: "hidden", ...shadow.soft },
  waFreeCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
  },
  waPremiumGradient: { padding: spacing.lg },
  waCardRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  waPremiumIconBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  waPremiumTitle: { fontFamily: font.bold, fontSize: fontSize.lg, color: "#4A2A0A" },
  waPremiumSub: { fontFamily: font.medium, fontSize: fontSize.sm, color: "#7C4A0F", marginTop: 1 },
  waPremiumQuotaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.35)",
  },
  waPremiumQuotaText: { fontFamily: font.semibold, fontSize: fontSize.sm, color: "#FFFBEB" },
  waQuotaBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceTertiary,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  waQuotaBarFill: { height: "100%", backgroundColor: colors.brand, borderRadius: 3 },
  waQuotaLabel: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.onSurface, marginTop: spacing.xs },
  waQuotaResetLabel: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.xs },
  waUpsellStrip: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  waUpsellTitle: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface, marginBottom: spacing.sm },
  waUpsellBenefitRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 },
  waUpsellBenefitText: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.onSurface },
  waUpsellBtn: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  waUpsellBtnText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.onBrandPrimary },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: "center" },
  segmentActive: { backgroundColor: colors.surfaceSecondary, ...shadow.soft },
  segmentText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
  segmentTextActive: { color: colors.brand },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: "#FEE2E2" },
  rowIconWarning: { backgroundColor: "#FDE68A" },
  rowTitle: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },
  rowSub: { fontFamily: font.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 66 },
  simulBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#FEF3C7",
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
  },
  simulText: { flex: 1, fontFamily: font.medium, fontSize: fontSize.sm, color: "#92400E", lineHeight: 17 },
  dangerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#FEE2E2",
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
  },
  dangerText: { flex: 1, fontFamily: font.medium, fontSize: fontSize.sm, color: "#991B1B", lineHeight: 17 },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#FDE68A",
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
  },
  warningText: { flex: 1, fontFamily: font.medium, fontSize: fontSize.sm, color: "#92400E", lineHeight: 17 },
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
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  actionText: { fontFamily: font.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  version: {
    fontFamily: font.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xl,
  },

  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reasonRowActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  reasonText: { flex: 1, fontFamily: font.medium, fontSize: fontSize.base, color: colors.onSurface },
  reasonTextActive: { fontFamily: font.semibold, color: colors.onBrandTertiary },

  offerCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  offerCardBest: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  offerBadge: {
    position: "absolute",
    top: -14,
    left: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F59E0B",
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    boxShadow: "0px 2px 5px rgba(0, 0, 0, 0.18)",
    elevation: 3,
  },
  offerBadgeText: {
    fontFamily: font.extrabold,
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  offerLabel: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  offerPrice: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.brandDark, marginTop: 2 },
  offerWas: {
    fontFamily: font.semibold,
    fontSize: fontSize.base,
    color: colors.error,
    textDecorationLine: "line-through",
  },
  offerSave: { fontFamily: font.semibold, fontSize: fontSize.sm, color: colors.brand, marginTop: 2 },
  offerTakeBtn: {
    alignSelf: "stretch",
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: "center",
  },
  offerTakeBtnBest: { backgroundColor: colors.brand, borderColor: colors.brand },
  offerTakeBtnText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.brand },
  offerTakeBtnTextBest: { color: colors.onBrandPrimary },

  thanksIconBadge: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
});
