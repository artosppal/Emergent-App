// Local notification scheduling for per-subscription reminders (H-3 / H-1 / H-0).
// Works on native builds; safely no-ops on web / Expo Go where unsupported.

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { storage } from "@/src/utils/storage";
import { formatRupiah } from "@/src/theme";

const MAP_KEY = "notifin_reminder_ids"; // { [subId]: string[] }

async function getMap(): Promise<Record<string, string[]>> {
  return (await storage.getItem<Record<string, string[]>>(MAP_KEY, {})) || {};
}

async function saveMap(map: Record<string, string[]>) {
  await storage.setItem(MAP_KEY, map);
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export async function cancelReminders(subId: string) {
  if (Platform.OS === "web") return;
  try {
    const map = await getMap();
    const ids = map[subId] || [];
    for (const id of ids) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {}
    }
    delete map[subId];
    await saveMap(map);
  } catch {}
}

interface SubLike {
  id: string;
  name: string;
  price: number;
  next_due_date: string;
  reminders: number[];
  status: string;
}

// Schedule reminders at 09:00 local time, `days` before due date.
export async function scheduleReminders(sub: SubLike) {
  if (Platform.OS === "web") return;
  try {
    await cancelReminders(sub.id);
    const granted = await ensureNotificationPermission();
    if (!granted) return;

    const due = new Date(sub.next_due_date + "T09:00:00");
    if (isNaN(due.getTime())) return;

    const newIds: string[] = [];
    const now = new Date();

    for (const d of sub.reminders || []) {
      const trigger = new Date(due);
      trigger.setDate(trigger.getDate() - d);
      if (trigger.getTime() <= now.getTime()) continue;

      const when =
        d === 0 ? "hari ini" : d === 1 ? "besok" : `${d} hari lagi`;
      const title =
        sub.status === "trial"
          ? `⏳ Trial ${sub.name} berakhir ${when}`
          : `💳 ${sub.name} jatuh tempo ${when}`;
      const body =
        sub.status === "trial"
          ? `Cek dulu — mau lanjut atau cancel sebelum kena tagih?`
          : `Tagihan ${formatRupiah(sub.price)} akan segera ditagih.`;

      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: { action_url: "/(tabs)", subId: sub.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
        });
        newIds.push(id);
      } catch {}
    }

    const map = await getMap();
    map[sub.id] = newIds;
    await saveMap(map);
  } catch {}
}
