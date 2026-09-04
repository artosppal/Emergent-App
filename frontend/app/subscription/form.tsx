import React, { useCallback, useContext, useEffect, useState } from "react";
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
import { CATEGORIES, BILLING_CYCLES, STATUS_OPTIONS, getCategory } from "@/src/constants/categories";
import { PRESETS } from "@/src/constants/presets";
import { api, ApiError } from "@/src/lib/api";
import { useToast } from "@/src/context/ToastContext";
import { useUpgrade } from "@/src/context/UpgradeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { scheduleReminders, cancelReminders } from "@/src/utils/notifications";
import { colors, font, fontSize, radius, spacing, shadow } from "@/src/theme";

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function SubscriptionForm() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { showUpgrade } = useUpgrade();
  const { t, locale } = useLanguage();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = !!params.id;

  const REMINDER_OPTS = [
    { label: t("subscriptionForm.reminderD3"), value: 3 },
    { label: t("subscriptionForm.reminderD1"), value: 1 },
    { label: t("subscriptionForm.reminderDay0"), value: 0 },
  ];

  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("entertainment");
  const [price, setPrice] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [status, setStatus] = useState("paid");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toISO(d);
  });
  const [reminders, setReminders] = useState<number[]>([3, 1, 0]);
  const [notes, setNotes] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setName(p.name);
    setCategory(p.category);
    setPrice(String(p.price));
    setCycle(p.cycle);
    setSelectedPreset(p.name);
  };

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const res: any = await api.getSub(params.id as string);
        const s = res.subscription;
        setName(s.name);
        setCategory(s.category);
        setPrice(String(s.price ?? ""));
        setCycle(s.billing_cycle);
        setStatus(s.status);
        setDueDate(s.next_due_date);
        setReminders(s.reminders || []);
        setNotes(s.notes || "");
      } catch {
        toast.show(t("subscriptionForm.errLoad"), "error");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, params.id]);

  const toggleReminder = (v: number) => {
    setReminders((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const save = async () => {
    if (!name.trim()) {
      toast.show(t("subscriptionForm.errNameRequired"), "error");
      return;
    }
    const priceNum = parseFloat(price.replace(/[^0-9.]/g, "")) || 0;
    const body = {
      name: name.trim(),
      category,
      price: priceNum,
      billing_cycle: cycle,
      next_due_date: dueDate,
      status,
      reminders,
      notes: notes.trim() || null,
    };
    setSaving(true);
    try {
      let sub: any;
      if (editing) {
        const res: any = await api.updateSub(params.id as string, body);
        sub = res.subscription;
      } else {
        const res: any = await api.createSub(body);
        sub = res.subscription;
      }
      await scheduleReminders(sub);
      toast.show(editing ? t("subscriptionForm.updated") : t("subscriptionForm.created"), "success");
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        router.back();
        setTimeout(showUpgrade, 350);
        return;
      }
      toast.show(t("subscriptionForm.errSave"), "error");
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
      await api.deleteSub(params.id as string);
      await cancelReminders(params.id as string);
      toast.show(t("subscriptionForm.deleted"), "info");
      router.back();
    } catch {
      toast.show(t("subscriptionForm.errDelete"), "error");
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="close-form-button" onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {editing ? t("subscriptionForm.editTitle") : t("subscriptionForm.createTitle")}
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
            <Text style={styles.label}>{t("subscriptionForm.quickPick")}</Text>
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
                    style={[
                      styles.presetChip,
                      active && { borderColor: p.color, backgroundColor: p.color + "14" },
                    ]}
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
          testID="sub-name-input"
          label={t("subscriptionForm.nameLabel")}
          icon="tag"
          placeholder={t("subscriptionForm.namePlaceholder")}
          value={name}
          onChangeText={setName}
        />

        {/* Category */}
        <Text style={styles.label}>{t("subscriptionForm.categoryLabel")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <Pressable
                key={c.key}
                testID={`form-cat-${c.key}`}
                onPress={() => setCategory(c.key)}
                style={[styles.catChip, active && { backgroundColor: c.color + "1A", borderColor: c.color }]}
              >
                <MaterialCommunityIcons
                  name={c.icon as any}
                  size={18}
                  color={active ? c.color : colors.muted}
                />
                <Text style={[styles.catChipText, active && { color: c.color }]}>
                  {t(`categories.${c.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Price */}
        <View style={{ marginTop: spacing.lg }}>
          <Input
            testID="sub-price-input"
            label={t("subscriptionForm.priceLabel")}
            icon="cash"
            placeholder="0"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </View>

        {/* Billing cycle */}
        <Text style={styles.label}>{t("subscriptionForm.cycleLabel")}</Text>
        <View style={styles.segment}>
          {BILLING_CYCLES.map((c) => {
            const active = cycle === c.key;
            return (
              <Pressable
                key={c.key}
                testID={`cycle-${c.key}`}
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

        {/* Due date */}
        <Text style={styles.label}>{t("subscriptionForm.dueDateLabel")}</Text>
        {Platform.OS === "web" ? (
          <View style={styles.dateBox}>
            <MaterialCommunityIcons name="calendar" size={20} color={colors.brand} />
            <TextInput
              testID="due-date-input"
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={styles.dateInput}
            />
          </View>
        ) : (
          <Pressable testID="due-date-button" style={styles.dateBox} onPress={() => setShowPicker(true)}>
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

        {/* Status */}
        <Text style={styles.label}>{t("subscriptionForm.statusLabel")}</Text>
        <View style={styles.segment}>
          {STATUS_OPTIONS.map((c) => {
            const active = status === c.key;
            return (
              <Pressable
                key={c.key}
                testID={`status-${c.key}`}
                onPress={() => setStatus(c.key)}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {t(`status.${c.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Reminders */}
        <Text style={styles.label}>{t("subscriptionForm.remindMeLabel")}</Text>
        <View style={styles.reminderRow}>
          {REMINDER_OPTS.map((r) => {
            const active = reminders.includes(r.value);
            return (
              <Pressable
                key={r.value}
                testID={`reminder-${r.value}`}
                onPress={() => toggleReminder(r.value)}
                style={[styles.reminderChip, active && styles.reminderActive]}
              >
                <MaterialCommunityIcons
                  name={active ? "bell-ring" : "bell-outline"}
                  size={16}
                  color={active ? colors.onBrandPrimary : colors.muted}
                />
                <Text style={[styles.reminderText, active && { color: colors.onBrandPrimary }]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Notes */}
        <View style={{ marginTop: spacing.lg }}>
          <Input
            testID="sub-notes-input"
            label={t("subscriptionForm.notesLabel")}
            icon="note-text"
            placeholder={t("subscriptionForm.notesPlaceholder")}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {editing && (
          <Pressable testID="delete-button" style={styles.deleteBtn} onPress={doDelete}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
            <Text style={styles.deleteText}>
              {confirmDelete ? t("subscriptionForm.confirmDelete") : t("subscriptionForm.deleteButton")}
            </Text>
          </Pressable>
        )}
      </KeyboardAwareScrollView>

      {/* Sticky save */}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="save-subscription-button"
            title={editing ? t("subscriptionForm.saveChanges") : t("subscriptionForm.saveNew")}
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
  catRow: { gap: spacing.sm, paddingBottom: spacing.xs, paddingRight: spacing.lg },
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
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  dateText: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  dateInput: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.lg, color: colors.onSurface, paddingVertical: spacing.md },

  reminderRow: { flexDirection: "row", gap: spacing.sm },
  reminderChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  reminderActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  reminderText: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.muted },

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
