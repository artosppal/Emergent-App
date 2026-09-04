import React, { useCallback, useContext, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, ApiError } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { useUpgrade } from "@/src/context/UpgradeContext";
import { useToast } from "@/src/context/ToastContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { EmptyState, Button, Input } from "@/src/components/ui";
import { colors, font, fontSize, radius, spacing, shadow, formatRupiah } from "@/src/theme";

interface GroupItem {
  id: string;
  name: string;
  invite_code: string;
  is_owner: boolean;
  member_count: number;
  sub_count: number;
  my_share: number;
  total_price: number;
}

export default function Groups() {
  const insets = useSafeAreaInsets();
  const tabH = useContext(BottomTabBarHeightContext) ?? 64 + insets.bottom;
  const router = useRouter();
  const { user } = useAuth();
  const { showUpgrade } = useUpgrade();
  const toast = useToast();
  const { t } = useLanguage();

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | "join">(null);
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await api.listGroups();
      setGroups(res.groups);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onCreate = () => {
    if (user?.plan !== "premium") {
      showUpgrade();
      return;
    }
    setNameInput("");
    setModal("create");
  };

  const submitCreate = async () => {
    if (!nameInput.trim()) {
      toast.show(t("groups.errNameRequired"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await api.createGroup(nameInput.trim());
      setModal(null);
      toast.show(t("groups.createdToast"), "success");
      await load();
      router.push({ pathname: "/group/[id]", params: { id: res.group.id } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setModal(null);
        setTimeout(showUpgrade, 300);
      } else {
        toast.show(t("groups.errCreate"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitJoin = async () => {
    if (!codeInput.trim()) {
      toast.show(t("groups.errCodeRequired"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await api.joinGroup(codeInput.trim());
      setModal(null);
      toast.show(t("groups.joinedToast", { name: res.name }), "success");
      setCodeInput("");
      load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast.show(t("groups.errCodeNotFound"), "error");
      } else if (e instanceof ApiError && e.status === 409) {
        toast.show(t("groups.errAlreadyMember"), "info");
      } else {
        toast.show(t("groups.errJoin"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + spacing.xl }}>
        <Text style={styles.title}>{t("groups.title")}</Text>
        <View style={styles.actionRow}>
          <Pressable testID="create-group-button" style={styles.actionBtn} onPress={onCreate}>
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons name="plus-circle" size={22} color={colors.brand} />
            </View>
            <Text style={styles.actionText}>{t("groups.createButton")}</Text>
            {user?.plan !== "premium" && (
              <View style={styles.lockPill}>
                <MaterialCommunityIcons name="crown" size={10} color="#B45309" />
              </View>
            )}
          </Pressable>
          <Pressable
            testID="join-group-button"
            style={styles.actionBtn}
            onPress={() => {
              setCodeInput("");
              setModal("join");
            }}
          >
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons name="ticket-confirmation" size={22} color={colors.brand} />
            </View>
            <Text style={styles.actionText}>{t("groups.joinButton")}</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: tabH + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`group-card-${item.id}`}
              onPress={() => router.push({ pathname: "/group/[id]", params: { id: item.id } })}
              style={({ pressed }) => [styles.groupCard, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.groupIcon}>
                <MaterialCommunityIcons name="account-group" size={26} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Text style={styles.groupName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.is_owner && (
                    <View style={styles.ownerPill}>
                      <Text style={styles.ownerPillText}>{t("groups.coordinator")}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.groupMeta}>
                  {t("groups.meta", { members: item.member_count, subs: item.sub_count })}
                </Text>
                <Text style={styles.groupShare}>
                  {t("groups.share", { amount: formatRupiah(item.my_share) })}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.borderStrong} />
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="account-group"
              title={t("groups.emptyTitle")}
              subtitle={t("groups.emptySubtitle")}
            />
          }
        />
      )}

      {/* Create / Join modal */}
      <Modal
        visible={modal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModal(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {modal === "create" ? t("groups.modalCreateTitle") : t("groups.modalJoinTitle")}
            </Text>
            <Text style={styles.modalSub}>
              {modal === "create" ? t("groups.modalCreateSub") : t("groups.modalJoinSub")}
            </Text>
            {modal === "create" ? (
              <Input
                testID="group-name-input"
                icon="account-group"
                placeholder={t("groups.namePlaceholder")}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
              />
            ) : (
              <Input
                testID="group-code-input"
                icon="ticket-confirmation"
                placeholder={t("groups.codePlaceholder")}
                value={codeInput}
                onChangeText={(val) => setCodeInput(val.toUpperCase())}
                autoCapitalize="characters"
                autoFocus
              />
            )}
            <Button
              testID="modal-submit-button"
              title={modal === "create" ? t("groups.submitCreate") : t("groups.submitJoin")}
              onPress={modal === "create" ? submitCreate : submitJoin}
              loading={submitting}
            />
            <Pressable style={styles.cancelBtn} onPress={() => setModal(null)}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    fontFamily: font.extrabold,
    fontSize: fontSize["2xl"],
    color: colors.onSurface,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  actionRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.soft,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1, fontFamily: font.bold, fontSize: fontSize.base, color: colors.onSurface },
  lockPill: {
    backgroundColor: "#FEF3C7",
    padding: 4,
    borderRadius: radius.pill,
  },

  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  groupName: { fontFamily: font.bold, fontSize: fontSize.lg, color: colors.onSurface, flexShrink: 1 },
  ownerPill: {
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  ownerPillText: { fontFamily: font.semibold, fontSize: 10, color: colors.onBrandSecondary },
  groupMeta: { fontFamily: font.medium, fontSize: fontSize.sm, color: colors.muted },
  groupShare: { fontFamily: font.bold, fontSize: fontSize.sm, color: colors.brand },

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
});
