import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, font, fontSize, spacing, radius } from "@/src/theme";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

// CSS conic-gradient donut for web (react-native-web passes arbitrary style
// through), with a plain stacked-bar fallback on native where conic-gradient
// isn't available and pulling in a full SVG lib just for this one chart isn't
// worth it.
export function DonutChart({
  slices,
  size = 168,
  thickness = 26,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;

  if (Platform.OS === "web") {
    let acc = 0;
    const stops: string[] = [];
    for (const s of slices) {
      const from = (acc / total) * 360;
      acc += s.value;
      const to = (acc / total) * 360;
      stops.push(`${s.color} ${from}deg ${to}deg`);
    }
    const gradient = stops.length ? `conic-gradient(${stops.join(", ")})` : colors.surfaceTertiary;
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View
          // @ts-expect-error web-only CSS background not in RN's style typing
          style={{ width: size, height: size, borderRadius: size / 2, background: gradient }}
        />
        <View
          style={[
            styles.centerHole,
            {
              width: size - thickness * 2,
              height: size - thickness * 2,
              borderRadius: (size - thickness * 2) / 2,
            },
          ]}
        >
          {!!centerValue && (
            <Text style={styles.centerValue} numberOfLines={1}>
              {centerValue}
            </Text>
          )}
          {!!centerLabel && (
            <Text style={styles.centerLabel} numberOfLines={1}>
              {centerLabel}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Native fallback: horizontal stacked bar, same colors/proportions.
  return (
    <View style={{ width: "100%", gap: spacing.sm }}>
      <View style={styles.stackTrack}>
        {slices.map((s) => (
          <View key={s.key} style={{ flex: Math.max(s.value, 0.001), backgroundColor: s.color }} />
        ))}
      </View>
      {!!centerValue && <Text style={styles.centerValue}>{centerValue}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  centerHole: {
    position: "absolute",
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  centerValue: { fontFamily: font.extrabold, fontSize: fontSize.lg, color: colors.onSurface },
  centerLabel: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  stackTrack: {
    flexDirection: "row",
    height: 14,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
  },
});
