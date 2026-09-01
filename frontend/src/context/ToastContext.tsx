import React, { createContext, useContext, useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, font, fontSize, radius, spacing, shadow } from "@/src/theme";

type ToastType = "success" | "error" | "info";
interface ToastData {
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{ show: (m: string, t?: ToastType) => void } | undefined>(
  undefined,
);

const ICONS: Record<ToastType, string> = {
  success: "check-circle",
  error: "alert-circle",
  info: "information",
};
const TINTS: Record<ToastType, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.info,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastData | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const timer = useRef<any>(null);

  const clear = useCallback(() => setToast(null), []);

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type });
      opacity.value = withTiming(1, { duration: 220 });
      translateY.value = withTiming(0, { duration: 220 });
      timer.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(-20, { duration: 220 }, (finished) => {
          if (finished) runOnJS(clear)();
        });
      }, 2600);
    },
    [opacity, translateY, clear],
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { top: insets.top + spacing.sm },
            animStyle,
          ]}
        >
          <View style={styles.toast} testID="toast">
            <MaterialCommunityIcons
              name={ICONS[toast.type] as any}
              size={20}
              color={TINTS[toast.type]}
            />
            <Text style={styles.text} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    ...shadow.card,
    maxWidth: 520,
  },
  text: {
    flex: 1,
    color: colors.onSurface,
    fontFamily: font.semibold,
    fontSize: fontSize.base,
  },
});
