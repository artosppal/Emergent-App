import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Input, Button } from "@/src/components/ui";
import { CATEGORIES, BILLING_CYCLES } from "@/src/constants/categories";
import { PRESETS } from "@/src/constants/presets";
import { api } from "@/src/lib/api";
import { useToast } from "@/src/context/ToastContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { colors, font, fontSize, radius, spacing, shadow, formatRupiah } from "@/src/theme";

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Style for the real HTML <input type="date"> used on web — a raw DOM node,
// so it needs plain CSS (not an RN StyleSheet), with the browser's own
// border/outline reset so it matches the app's input look instead of the
// browser's default control chrome.
const webDateInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  fontFamily: font.semibold,
  fontSize: fontSize.lg,
  color: colors.onSurface,
  paddingTop: 14,
  paddingBottom: 14,
  paddingLeft: 0,
  paddingRight: 0,
};

interface Member {
  user_id: string;
  name: string;
}

export default function GroupSubForm() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { t, locale } = useLanguage();
  const params = useLocalSearchParams<{ groupId: string; subId?: string }>();
  const gid = params.groupId as string;
  const editing = !!params.subId;

  const SPLIT_TYPES = [
    { key: "equal", label: t("groupDetail.splitEqual") },
    { key: "custom", label: t("groupDetail.splitCustom") },
  ];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("entertainment");
  const [price, setPrice] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toISO(d);
  });
  const [splitType, setSplitType] = useState("equal");
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [showPicker, setShowPicker] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await api.getGroup(gid);
        setMembers(res.group.members);
        if (editing) {
          const s = res.group.subscriptions.find((x: any) => x.id === params.subId);
          if (s) {
            setName(s.name);
            setCategory(s.category);
            setPrice(String(s.price ?? ""));
            setCycle(s.billing_cycle);
            setDueDate(s.next_due_date);
            setSplitType(s.split_type || "equal");
            if (s.custom_splits) {
              const cs: Record<string, string> = {};
              Object.entries(s.custom_splits).forEach(([k, v]) => (cs[k] = String(v)));
              setCustomSplits(cs);
            }
          }
        }
      } catch {
        toast.show(t("groupSubForm.errLoadGroup"), "error");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [gid, editing, params.subId]);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setName(p.name);
    setCategory(p.category);
    setPrice(String(p.price));
    setCycle(p.cycle);
    setSelectedPreset(p.name);
  };

  const priceNum = parseFloat(price.replace(/[^0-9.]/g, "")) || 0;
  const equalShare = members.length > 0 ? priceNum / members.length : 0;
  const customTotal = members.reduce(
    (sum, m) => sum + (parseFloat((customSplits[m.user_id] || "0").replace(/[^0-9.]/g, "")) || 0),
    0,
  );

  const save = async () => {
    if (!name.trim()) {
      toast.show(t("groupSubForm.errNameRequired"), "error");
      return;
    }
    const body: any = {
      name: name.trim(),
      category,
      price: priceNum,
      billing_cycle: cycle,
      next_due_date: dueDate,
      split_type: splitType,
      custom_splits:
        splitType === "custom"
          ? members.reduce((acc: Record<string, number>, m) => {
              acc[m.user_id] =
                parseFloat((customSplits[m.user_id] || "0").replace(/[^0-9.]/g, "")) || 0;
              return acc;
            }, {})
          : null,
    };
    setSaving(true);
    try {
      if (editing) {
        await api.updateGroupSub(gid, params.subId as string, body);
      } else {
        await api.createGroupSub(gid, body);
      }
      toast.show(editing ? t("groupSubForm.updated") : t("groupSubForm.created"), "success");
      router.back();
    } catch {
      toast.show(t("groupSubForm.errSave"), "error");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await api.deleteGroupSub(gid, params.subId as string);
      toast.show(t("groupSubForm.deleted"), "info");
      router.back();
    } catch {
      toast.show(t("groupSubForm.errDelete"), "error");
    }
  };

  const dueDisplay = (() => {
    const d = new Date(dueDate + "T00:00:00");
    if (isNaN(d.getTime())) return dueDate;
    return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  })();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="close-group-sub-form" onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {editing ? t("groupSubForm.editTitle") : t("groupSubForm.createTitle")}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
      >
        {!editing && (
          <>
            <Text style={styles.label}>{t("groupSubForm.quickPick")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetRow}
            >
              {PRESETS.map((p) => {
                const active = selectedPreset === p.name && name === p.name;
                return (
                  <Pressable
                    key={p.name}
                    testID={`preset-${p.name}`}
                    onPress={() => applyPreset(p)}
                    style={[styles.presetChip, active && { borderColor: p.color, backgroundColor: p.color + "14" }]}
                  >
                    <MaterialCommunityIcons name={p.icon as any} size={18} color={p.color} />
                    <Text style={[styles.presetText, active && { color: p.color }]}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ height: spacing.lg }} />
          </>
        )}

        <Input
          testID="group-sub-name-input"
          label={t("groupSubForm.nameLabel")}
          icon="tag"
          placeholder={t("groupSubForm.namePlaceholder")}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>{t("groupSubForm.categoryLabel")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <Pressable
                key={c.key}
                testID={`gform-cat-${c.key}`}
                onPress={() => setCategory(c.key)}
                style={[styles.catChip, active && { backgroundColor: c.color + "1A", borderColor: c.color }]}
              >
                <MaterialCommunityIcons name={c.icon as any} size={18} color={active ? c.color : colors.muted} />
                <Text style={[styles.catChipText, active && { color: c.color }]}>
                  {t(`categories.${c.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ marginTop: spacing.lg }}>
          <Input
            testID="group-sub-price-input"
            label={t("groupSubForm.priceLabel")}
            icon="cash"
            placeholder="0"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </View>

        <Text style={styles.label}>{t("groupSubForm.cycleLabel")}</Text>
        <View style={styles.segment}>
          {BILLING_CYCLES.map((c) => {
            const active = cycle === c.key;
            return (
              <Pressable
                key={c.key}
                testID={`gcycle-${c.key}`}
                onPress={() => setCycle(c.key)}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {t(`cycles.${c.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t("groupSubForm.dueDateLabel")}</Text>
        {Platform.OS === "web" ? (
          <View style={styles.dateBox}>
            <MaterialCommunityIcons name="calendar" size={20} color={colors.brand} />
            {/* Real HTML date input (not RN's TextInput) so Chrome/Android shows its
                native calendar picker — RN Web can't force TextInput into type="date". */}
            <input
              data-testid="group-due-date-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={webDateInputStyle}
            />
          </View>
        ) : (
          <Pressable testID="group-due-date-button" style={styles.dateBox} onPress={() => setShowPicker(true)}>
            <MaterialCommunityIcons name="calendar" size={20} color={colors.brand} />
            <Text style={styles.dateText}>{dueDisplay}</Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.muted} />
          </Pressable>
        )}
        {showPicker && Platform.OS !== "web" && (
          <DateTimePicker
            value={new Date(dueDate + "T00:00:00")}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(event, date) => {
              setShowPicker(Platform.OS === "ios");
              if (date) setDueDate(toISO(date));
            }}
          />
        )}

        {/* Split */}
        <Text style={styles.label}>{t("groupSubForm.splitLabel")}</Text>
        <View style={styles.segment}>
          {SPLIT_TYPES.map((s) => {
            const active = splitType === s.key;
            return (
              <Pressable
                key={s.key}
                testID={`split-type-${s.key}`}
                onPress={() => setSplitType(s.key)}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {splitType === "equal" ? (
          <View style={styles.equalCard}>
            <MaterialCommunityIcons name="account-multiple" size={20} color={colors.brand} />
            <Text style={styles.equalText}>
              {t("groupSubForm.equalShare", { count: members.length, amount: formatRupiah(equalShare) })}
            </Text>
          </View>
        ) : (
          <View style={styles.customCard}>
            {members.map((m) => (
              <View key={m.user_id} style={styles.customRow}>
                <Text style={styles.customName} numberOfLines={1}>
                  {m.name}
                </Text>
                <View style={styles.customInputBox}>
                  <Text style={styles.rpPrefix}>Rp</Text>
                  <TextInput
                    testID={`custom-split-${m.user_id}`}
                    value={customSplits[m.user_id] || ""}
                    onChangeText={(t) => setCustomSplits((prev) => ({ ...prev, [m.user_id]: t }))}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    style={styles.customInput}
                  />
                </View>
              </View>
            ))}
            <View style={styles.customTotalRow}>
              <Text style={styles.customTotalLabel}>{t("groupSubForm.totalSplit")}</Text>
              <Text
                style={[
                  styles.customTotalValue,
                  { color: Math.round(customTotal) === Math.round(priceNum) ? colors.success : colors.warning },
                ]}
              >
                {formatRupiah(customTotal)} / {formatRupiah(priceNum)}
              </Text>
            </View>
          </View>
        )}

        {editing && (
          <Pressable testID="delete-group-sub-button" style={styles.deleteBtn} onPress={doDelete}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
            <Text style={styles.deleteText}>
              {confirmDelete ? t("groupSubForm.confirmDelete") : t("groupSubForm.deleteButton")}
            </Text>
          </Pressable>
        )}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="save-group-sub-button"
            title={editing ? t("groupSubForm.saveChanges") : t("groupSubForm.saveNew")}
            onPress={save}
            loading={saving}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
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

  label: {
    fontFamily: font.semibold,
    fontSize: fontSize.base,
    color: colors.onSurface,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

  presetRow: { gap: spacing.sm, paddingRight: spacing.lg },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    flexShrink: 0,
  },
  presetText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },

  catRow: { gap: spacing.sm, paddingBottom: spacing.xs, paddingRight: spacing.lg },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    flexShrink: 0,
  },
  catChipText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },

  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: "center" },
  segmentActive: { backgroundColor: colors.surfaceSecondary, ...shadow.soft },
  segmentText: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
  segmentTextActive: { color: colors.brand },

  dateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 54,
  },
  dateText: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },

  equalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  equalText: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onBrandTertiary },

  customCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  customRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  customName: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  customInputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    width: 140,
    height: 44,
  },
  rpPrefix: { fontFamily: font.semibold, fontSize: fontSize.base, color: colors.muted },
  customInput: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: fontSize.base,
    color: colors.onSurface,
    outlineWidth: 0,
  },
  customTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  customTotalLabel: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted },
  customTotalValue: { fontFamily: font.bold, fontSize: fontSize.sm },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: "#FEE2E2",
  },
  deleteText: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.error },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
