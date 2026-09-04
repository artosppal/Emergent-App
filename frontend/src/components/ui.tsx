import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, font, fontSize, radius, spacing, shadow } from "@/src/theme";

// ---------------- Button ----------------
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  testID?: string;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isGhost = variant === "ghost";
  const bg =
    isPrimary ? colors.brand : isDanger ? "#FEE2E2" : isGhost ? "transparent" : colors.surfaceTertiary;
  const fg =
    isPrimary ? colors.onBrandPrimary : isDanger ? colors.error : colors.onSurfaceTertiary;

  const handle = () => {
    if (disabled || loading) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        isPrimary && shadow.soft,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon && <MaterialCommunityIcons name={icon as any} size={20} color={fg} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------- Input ----------------
interface InputProps extends TextInputProps {
  label?: string;
  icon?: string;
  error?: string;
  hint?: string;
  testID?: string;
}

export function Input({ label, icon, error, hint, style, testID, ...rest }: InputProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={styles.inputWrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputBox,
          focused && { borderColor: colors.brand, backgroundColor: colors.surfaceSecondary },
          !!error && { borderColor: colors.error },
        ]}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon as any}
            size={20}
            color={focused ? colors.brand : colors.muted}
          />
        )}
        <TextInput
          testID={testID}
          placeholderTextColor={colors.muted}
          style={[styles.input, style]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
}

// ---------------- Chip (filter) ----------------
export function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------- Section title ----------------
export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

// ---------------- Empty state ----------------
export function EmptyState({
  icon = "inbox",
  title,
  subtitle,
  cta,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  cta?: React.ReactNode;
}) {
  return (
    <View style={styles.empty} testID="empty-state">
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon as any} size={54} color={colors.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySub}>{subtitle}</Text>}
      {cta && <View style={{ marginTop: spacing.lg, width: "100%" }}>{cta}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: { fontFamily: font.bold, fontSize: fontSize.lg },

  inputWrap: { marginBottom: spacing.lg },
  label: {
    fontFamily: font.semibold,
    fontSize: fontSize.base,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 54,
  },
  input: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    paddingVertical: 14,
    // The browser's own focus outline sits right on the text with no offset —
    // the green border on `inputBox` above already shows focus state.
    outlineWidth: 0,
  },
  errorText: {
    fontFamily: font.medium,
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  hintText: {
    fontFamily: font.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: spacing.xs,
  },

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

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: fontSize.xl,
    color: colors.onSurface,
  },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["3xl"],
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 110,
    height: 110,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: font.bold,
    fontSize: fontSize.xl,
    color: colors.onSurface,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: font.regular,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 21,
    maxWidth: 300,
  },
});
