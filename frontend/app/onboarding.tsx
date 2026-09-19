import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useToast } from "@/src/context/ToastContext";
import { api, ApiError } from "@/src/lib/api";
import { colors, font, fontSize, radius, spacing, webFormMaxWidth } from "@/src/theme";

type Option = { value: string; label: string };

const TOTAL_STEPS = 4;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();

  const [step, setStep] = useState(0); // 0-3 = questions, 4 = tour
  const [useCase, setUseCase] = useState<string | null>(null);
  const [subRange, setSubRange] = useState<string | null>(null);
  const [referral, setReferral] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  const questions: {
    required: boolean;
    title: string;
    sub: string;
    options: Option[];
    value: string | null;
    onSelect: (v: string) => void;
  }[] = [
    {
      required: true,
      title: t("onboarding.step1Title"),
      sub: t("onboarding.step1Sub"),
      value: useCase,
      onSelect: setUseCase,
      options: [
        { value: "personal", label: t("onboarding.step1Personal") },
        { value: "shared", label: t("onboarding.step1Shared") },
        { value: "exploring", label: t("onboarding.step1Exploring") },
      ],
    },
    {
      required: true,
      title: t("onboarding.step2Title"),
      sub: t("onboarding.step2Sub"),
      value: subRange,
      onSelect: setSubRange,
      options: [
        { value: "1-3", label: t("onboarding.step2Range1") },
        { value: "4-6", label: t("onboarding.step2Range2") },
        { value: "7-10", label: t("onboarding.step2Range3") },
        { value: "10+", label: t("onboarding.step2Range4") },
      ],
    },
    {
      required: false,
      title: t("onboarding.step3Title"),
      sub: t("onboarding.step3Sub"),
      value: referral,
      onSelect: setReferral,
      options: [
        { value: "instagram", label: t("onboarding.step3Instagram") },
        { value: "tiktok", label: t("onboarding.step3Tiktok") },
        { value: "google", label: t("onboarding.step3Google") },
        { value: "friend", label: t("onboarding.step3Friend") },
        { value: "play_store", label: t("onboarding.step3PlayStore") },
        { value: "app_store", label: t("onboarding.step3AppStore") },
        { value: "other", label: t("onboarding.step3Other") },
      ],
    },
    {
      required: false,
      title: t("onboarding.step4Title"),
      sub: t("onboarding.step4Sub"),
      value: goal,
      onSelect: setGoal,
      options: [
        { value: "avoid_forgotten_trials", label: t("onboarding.step4AvoidTrials") },
        { value: "track_spending", label: t("onboarding.step4TrackSpending") },
        { value: "split_with_family", label: t("onboarding.step4SplitFamily") },
        { value: "other", label: t("onboarding.step4Other") },
      ],
    },
  ];

  const tourSlides = [
    { icon: "credit-card-plus", title: t("onboarding.tour1Title"), body: t("onboarding.tour1Body") },
    { icon: "bell-ring", title: t("onboarding.tour2Title"), body: t("onboarding.tour2Body") },
    { icon: "view-dashboard", title: t("onboarding.tour3Title"), body: t("onboarding.tour3Body") },
    ...(useCase === "shared"
      ? [{ icon: "account-group", title: t("onboarding.tour4Title"), body: t("onboarding.tour4Body") }]
      : []),
  ];

  const submit = async () => {
    if (!useCase || !subRange) return;
    setSubmitting(true);
    try {
      await api.submitOnboarding({
        use_case: useCase,
        sub_range: subRange,
        referral_source: referral,
        primary_goal: goal,
      });
      if (user) setUser({ ...user, onboarding_completed: true });
      setStep(4);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : t("auth.errGeneric"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const finishTour = () => router.replace("/(tabs)");

  const next = () => {
    if (step === TOTAL_STEPS - 1) {
      submit();
    } else {
      setStep((s) => s + 1);
    }
  };

  // ---------------- Tour (after the survey) ----------------
  if (step === 4) {
    const slide = tourSlides[tourIndex];
    const isLast = tourIndex === tourSlides.length - 1;
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.tourTop}>
          <Text style={styles.tourHeading}>{t("onboarding.tourTitle")}</Text>
          <Pressable testID="onboarding-tour-skip" onPress={finishTour}>
            <Text style={styles.skipText}>{t("onboarding.tourSkip")}</Text>
          </Pressable>
        </View>

        <View style={styles.tourBody}>
          <View style={styles.tourIcon}>
            <MaterialCommunityIcons name={slide.icon as any} size={44} color={colors.brand} />
          </View>
          <Text style={styles.tourSlideTitle}>{slide.title}</Text>
          <Text style={styles.tourSlideBody}>{slide.body}</Text>
        </View>

        <View style={styles.tourFooter}>
          <View style={styles.dotsRow}>
            {tourSlides.map((_, i) => (
              <View key={i} style={[styles.dot, i === tourIndex && styles.dotActive]} />
            ))}
          </View>
          <Button
            testID="onboarding-tour-next"
            title={isLast ? t("onboarding.tourStart") : t("onboarding.continue")}
            onPress={() => (isLast ? finishTour() : setTourIndex((i) => i + 1))}
          />
        </View>
      </View>
    );
  }

  // ---------------- Survey (steps 0-3) ----------------
  const q = questions[step];
  const canContinue = q.required ? !!q.value : true;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.progressSeg, i <= step && styles.progressSegDone]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{q.title}</Text>
        <Text style={styles.sub}>{q.sub}</Text>

        <View style={styles.options}>
          {q.options.map((opt) => {
            const active = q.value === opt.value;
            return (
              <Pressable
                key={opt.value}
                testID={`onboarding-option-${opt.value}`}
                onPress={() => q.onSelect(opt.value)}
                style={[styles.optionRow, active && styles.optionRowActive]}
              >
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <MaterialCommunityIcons name="check" size={14} color={colors.onBrandPrimary} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <Pressable testID="onboarding-back" onPress={() => setStep((s) => s - 1)} style={styles.backBtn}>
            <Text style={styles.backText}>{t("onboarding.back")}</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {!q.required && (
          <Pressable testID="onboarding-skip" onPress={next} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
          </Pressable>
        )}
        <Button
          testID="onboarding-continue"
          title={t("onboarding.continue")}
          onPress={next}
          disabled={!canContinue}
          loading={submitting}
          style={{ paddingHorizontal: spacing["2xl"] }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  progressRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressSegDone: { backgroundColor: colors.brand },

  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing["2xl"],
    paddingBottom: spacing["2xl"],
    width: "100%",
    maxWidth: webFormMaxWidth,
    alignSelf: "center",
  },
  title: { fontFamily: font.extrabold, fontSize: fontSize["2xl"], color: colors.onSurface },
  sub: { fontFamily: font.regular, fontSize: fontSize.base, color: colors.muted, marginTop: spacing.xs },

  options: { marginTop: spacing.xl, gap: spacing.md },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  optionRowActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  optionLabel: { fontFamily: font.semibold, fontSize: fontSize.lg, color: colors.onSurface, flex: 1 },
  optionLabelActive: { color: colors.brandDark },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.md,
  },
  radioActive: { backgroundColor: colors.brand, borderColor: colors.brand },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    width: "100%",
    maxWidth: webFormMaxWidth,
    alignSelf: "center",
  },
  backBtn: { paddingVertical: spacing.sm, paddingRight: spacing.md },
  backText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
  skipBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  skipText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },

  tourTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    width: "100%",
    maxWidth: webFormMaxWidth,
    alignSelf: "center",
  },
  tourHeading: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },
  tourBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    width: "100%",
    maxWidth: webFormMaxWidth,
    alignSelf: "center",
  },
  tourIcon: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  tourSlideTitle: {
    fontFamily: font.extrabold,
    fontSize: fontSize.xl,
    color: colors.onSurface,
    textAlign: "center",
  },
  tourSlideBody: {
    fontFamily: font.regular,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 21,
  },
  tourFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    width: "100%",
    maxWidth: webFormMaxWidth,
    alignSelf: "center",
  },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.xs, marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.brand, width: 20 },
});
