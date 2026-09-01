import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/context/ToastContext";
import { CategoryLogo } from "@/src/components/SubscriptionCard";
import { getCategory, cycleLabel } from "@/src/constants/categories";
import { colors, font, fontSize, radius, spacing, shadow, formatRupiah } from "@/src/theme";

interface Split {
  user_id: string;
  name: string;
  amount: number;
  paid: boolean;
}

interface GroupSub {
  id: string;
  name: string;
  category: string;
  price: number;
  billing_cycle: string;
  next_due_date: string;
  split_type: string;
  splits: Split[];
  unpaid_count: number;
}

interface GroupDetail {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  is_owner: boolean;
  members: { user_id: string; name: string; is_owner: boolean }[];
  subscriptions: GroupSub[];
  unpaid_members: string[];
  total_price: number;
  my_total: number;
}

function initials(name?: string) {
  return (name || "A")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function dueText(dateStr: string) {
  const due = new Date(dateStr + "T00:00:00");
  if (isNaN(due.getTime())) return dateStr;
  return due.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const gid = params.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await api.getGroup(gid);
      setGroup(res.group);
    } catch {
      toast.show("Gagal memuat grup", "error");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [gid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shareCode = async () => {
    if (!group) return;
    try {
      await Share.share({
        message: `Yuk gabung grup "${group.name}" di Notifin buat patungan langganan! Pakai kode: ${group.invite_code}`,
      });
    } catch {}
  };

  const togglePaid = async (sub: GroupSub, split: Split) => {
    if (!group) return;
    const isSelf = split.user_id === user?.user_id;
    if (!isSelf && !group.is_owner) {
      toast.show("Hanya koordinator yang bisa ubah status anggota lain", "info");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Optimistic update
    setGroup((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subscriptions: prev.subscriptions.map((s) =>
          s.id === sub.id
            ? {
                ...s,
                splits: s.splits.map((sp) =>
                  sp.user_id === split.user_id ? { ...sp, paid: !sp.paid } : sp,
                ),
              }
            : s,
        ),
      };
    });
    try {
      await api.payGroupSub(gid, sub.id, { user_id: split.user_id, paid: !split.paid });
      load();
    } catch {
      toast.show("Gagal menyimpan status", "error");
      load();
    }
  };

  const leaveOrDelete = async () => {
    if (!group) return;
    if (!confirmAction) {
      setConfirmAction(true);
      setTimeout(() => setConfirmAction(false), 3000);
      return;
    }
    try {
      if (group.is_owner) {
        await api.deleteGroup(gid);
        toast.show("Grup dihapus", "info");
      } else {
        await api.leaveGroup(gid);
        toast.show("Kamu keluar dari grup", "info");
      }
      router.back();
    } catch {
      toast.show("Gagal, coba lagi", "error");
    }
  };

  if (loading || !group) {
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
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {group.name}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Invite code */}
        <View style={styles.inviteCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inviteLabel}>Kode undangan</Text>
            <Text testID="invite-code" style={styles.inviteCode}>
              {group.invite_code}
            </Text>
          </View>
          <Pressable testID="share-code-button" style={styles.shareBtn} onPress={shareCode}>
            <MaterialCommunityIcons name="share-variant" size={18} color={colors.onBrandPrimary} />
            <Text style={styles.shareText}>Bagikan</Text>
          </Pressable>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total grup</Text>
            <Text style={styles.summaryValue}>{formatRupiah(group.total_price)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Bagianmu</Text>
            <Text style={[styles.summaryValue, { color: colors.brand }]}>
              {formatRupiah(group.my_total)}
            </Text>
          </View>
        </View>

        {/* Coordinator unpaid overview */}
        {group.is_owner && group.subscriptions.length > 0 && (
          <View
            style={[
              styles.unpaidCard,
              group.unpaid_members.length === 0 && { backgroundColor: colors.brandTertiary },
            ]}
          >
            <MaterialCommunityIcons
              name={group.unpaid_members.length === 0 ? "check-circle" : "alert-circle"}
              size={22}
              color={group.unpaid_members.length === 0 ? colors.success : "#B45309"}
            />
            <Text
              style={[
                styles.unpaidText,
                { color: group.unpaid_members.length === 0 ? colors.onBrandTertiary : "#92400E" },
              ]}
            >
              {group.unpaid_members.length === 0
                ? "Semua anggota sudah bayar periode ini 🎉"
                : `Belum bayar: ${group.unpaid_members.join(", ")}`}
            </Text>
          </View>
        )}

        {/* Members */}
        <Text style={styles.sectionLabel}>Anggota ({group.members.length})</Text>
        <View style={styles.card}>
          {group.members.map((m, i) => (
            <View key={m.user_id}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(m.name)}</Text>
                </View>
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.name}
                  {m.user_id === user?.user_id ? " (kamu)" : ""}
                </Text>
                {m.is_owner && (
                  <View style={styles.ownerPill}>
                    <Text style={styles.ownerPillText}>Koordinator</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Shared subscriptions */}
        <View style={styles.subsHeader}>
          <Text style={styles.sectionLabel}>Langganan bersama</Text>
          {group.is_owner && (
            <Pressable
              testID="add-group-sub-button"
              style={styles.addSubBtn}
              onPress={() =>
                router.push({ pathname: "/group/add-sub", params: { groupId: gid } })
              }
            >
              <MaterialCommunityIcons name="plus" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.addSubText}>Tambah</Text>
            </Pressable>
          )}
        </View>

        {group.subscriptions.length === 0 ? (
          <View style={styles.emptySubs}>
            <MaterialCommunityIcons name="credit-card-plus-outline" size={40} color={colors.brand} />
            <Text style={styles.emptySubsText}>
              {group.is_owner
                ? "Belum ada langganan bersama. Tap Tambah untuk mulai patungan!"
                : "Koordinator belum menambahkan langganan bersama."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {group.subscriptions.map((s) => {
              const cat = getCategory(s.category);
              return (
                <View key={s.id} style={styles.subCard}>
                  <Pressable
                    testID={`group-sub-${s.id}`}
                    style={styles.subTop}
                    onPress={() => {
                      if (group.is_owner) {
                        router.push({
                          pathname: "/group/add-sub",
                          params: { groupId: gid, subId: s.id },
                        });
                      }
                    }}
                  >
                    <CategoryLogo category={s.category} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subName} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={styles.subMeta}>
                        {cat.label} · {cycleLabel(s.billing_cycle)} · jatuh tempo {dueText(s.next_due_date)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.subPrice}>{formatRupiah(s.price)}</Text>
                      <Text style={styles.subSplitType}>
                        {s.split_type === "custom" ? "Custom" : "Bagi rata"}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.splitDivider} />
                  {s.splits.map((sp) => {
                    const canToggle = sp.user_id === user?.user_id || group.is_owner;
                    return (
                      <Pressable
                        key={sp.user_id}
                        testID={`split-${s.id}-${sp.user_id}`}
                        style={styles.splitRow}
                        onPress={() => togglePaid(s, sp)}
                        disabled={!canToggle}
                      >
                        <MaterialCommunityIcons
                          name={sp.paid ? "check-circle" : "circle-outline"}
                          size={22}
                          color={sp.paid ? colors.success : canToggle ? colors.borderStrong : colors.border}
                        />
                        <Text
                          style={[styles.splitName, sp.paid && styles.splitPaid]}
                          numberOfLines={1}
                        >
                          {sp.name}
                          {sp.user_id === user?.user_id ? " (kamu)" : ""}
                        </Text>
                        <Text style={[styles.splitAmount, sp.paid && styles.splitPaid]}>
                          {formatRupiah(sp.amount)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {s.unpaid_count > 0 && (
                    <View style={styles.subUnpaidPill}>
                      <Text style={styles.subUnpaidText}>
                        {s.unpaid_count} belum bayar
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Leave / delete */}
        <Pressable testID="leave-delete-button" style={styles.dangerBtn} onPress={leaveOrDelete}>
          <MaterialCommunityIcons
            name={group.is_owner ? "trash-can-outline" : "exit-to-app"}
            size={20}
            color={colors.error}
          />
          <Text style={styles.dangerText}>
            {confirmAction
              ? "Tap lagi untuk konfirmasi"
              : group.is_owner
                ? "Hapus grup"
                : "Keluar dari grup"}
          </Text>
        </Pressable>
      </ScrollView>
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
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: font.bold,
    fontSize: fontSize.lg,
    color: colors.onSurface,
  },

  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  inviteLabel: { fontFamily: font.medium, fontSize: fontSize.sm, color: "rgba(255,255,255,0.7)" },
  inviteCode: {
    fontFamily: font.extrabold,
    fontSize: 28,
    color: colors.onSurfaceInverse,
    letterSpacing: 4,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.pill,
  },
  shareText: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onBrandPrimary },

  summaryRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  summaryLabel: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted },
  summaryValue: { fontFamily: font.extrabold, fontSize: fontSize.xl, color: colors.onSurface, marginTop: 2 },

  unpaidCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#FEF3C7",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  unpaidText: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base },

  sectionLabel: {
    fontFamily: font.bold,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    ...shadow.soft,
    overflow: "hidden",
  },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.onBrandSecondary },
  memberName: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  ownerPill: {
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  ownerPillText: { fontFamily: font.semibold, fontSize: 10, color: colors.onBrandSecondary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 62 },

  subsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addSubBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  addSubText: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.onBrandPrimary },

  emptySubs: {
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  emptySubsText: {
    fontFamily: font.medium,
    fontSize: fontSize.base,
    color: colors.onBrandTertiary,
    textAlign: "center",
    lineHeight: 21,
  },

  subCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  subTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  subName: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface },
  subMeta: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  subPrice: { fontFamily: font.extrabold, fontSize: fontSize.lg, color: colors.onSurface },
  subSplitType: { fontFamily: font.medium, fontSize: 11, color: colors.muted },
  splitDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  splitName: { flex: 1, fontFamily: font.semibold, fontSize: fontSize.base, color: colors.onSurface },
  splitAmount: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  splitPaid: { color: colors.muted, textDecorationLine: "line-through" },
  subUnpaidPill: {
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  subUnpaidText: { fontFamily: font.bold, fontSize: 11, color: "#B45309" },

  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing["2xl"],
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: "#FEE2E2",
  },
  dangerText: { fontFamily: font.bold, fontSize: fontSize.base, color: colors.error },
});
