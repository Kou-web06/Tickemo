import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChekiRecord } from '../types/record';
import { useAppStore } from '../store/useAppStore';

const REMINDER_TYPE = 'live_reminder';

export interface NotificationSettingsState {
  beforeLive: boolean;
  onDay: boolean;
  nextDayReview: boolean;
  campaigns: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsState = {
  beforeLive: true,
  onDay: true,
  nextDayReview: false,
  campaigns: false,
};

const NOTIFICATION_SETTINGS_KEY = '@notification_settings';

export async function getNotificationSettings(): Promise<NotificationSettingsState> {
  try {
    const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.log('[NotificationSettings] Load failed:', error);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettingsState): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.log('[NotificationSettings] Save failed:', error);
  }
}
const LEGACY_TIMECAPSULE_TYPE = 'timecapsule';
const LEGACY_YEARLY_REPORT_TYPE = 'yearly_report';
const NOTIFICATION_TITLE_PREP = 'チケットとタオル、持った？';
const NOTIFICATION_TITLE_FINAL = 'そろそろスマホしまっておいて🤫';
const NOTIFICATION_TITLE_NEXT_DAY = 'あのライブどうだった？';
const LAST_SCHEDULE_KEY = '@last_live_notification_schedule';
const SCHEDULE_LOCK_KEY = '@notification_schedule_lock';
const SCHEDULE_SCHEMA_VERSION = 'v2';
const MAX_SCHEDULED = 64;
const REMINDER_VALIDATION_TOLERANCE_MS = 90 * 1000;

const parseLiveDate = (date: string) => {
  const parts = date.split('.').map((value) => Number(value));
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;

  // Use local noon to reduce timezone/DST shifts
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const dateAt = (baseDate: Date, hour: number, minute: number, dayOffset: number) => {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const parseStartTime = (value?: string) => {
  if (!value) return { hour: 18, minute: 0 };
  const [hourStr, minuteStr] = value.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return { hour: 18, minute: 0 };
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return { hour: 18, minute: 0 };
  return { hour, minute };
};

const getStartDateTime = (baseDate: Date, startTime?: string) => {
  const { hour, minute } = parseStartTime(startTime);
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const addMinutes = (baseDate: Date, minutes: number) => {
  return new Date(baseDate.getTime() + minutes * 60 * 1000);
};

const buildReminderSnapshot = (record: ChekiRecord) => {
  return `${record.id}|${record.date}|${record.startTime || ''}|${record.endTime || ''}|${record.liveName || ''}|${record.artist || ''}`;
};

const getScheduleTargets = (record: ChekiRecord) => {
  if (!record.date) return [];
  const base = parseLiveDate(record.date);
  if (!base) return [];

  const liveName = record.liveName || 'ライブ';
  const startDateTime = getStartDateTime(base, record.startTime);

  const dayBefore = {
    kind: 'beforeLive',
    title: NOTIFICATION_TITLE_PREP,
    body: `いよいよ明日は ${liveName} ！忘れ物ない？もう一回チェックしてね！`,
    date: dateAt(base, 19, 0, -1),
  };

  const onDay = {
    kind: 'onDay',
    title: NOTIFICATION_TITLE_FINAL,
    body: `${liveName}まもなく始まります！行ってらっしゃい！`,
    date: addMinutes(startDateTime, -15),
  };

  const nextDay = {
    kind: 'nextDayReview',
    title: NOTIFICATION_TITLE_NEXT_DAY,
    body: `${liveName}の思い出、チケットに保存しましたか？`,
    date: dateAt(base, 10, 0, 1),
  };

  return [dayBefore, onDay, nextDay];
};

const getTargetDateByKind = (record: ChekiRecord, kind?: string) => {
  if (!kind) return null;
  const target = getScheduleTargets(record).find((item) => item.kind === kind);
  return target?.date ?? null;
};

export const shouldDeliverNotificationNow = async (rawData: Record<string, unknown> | undefined) => {
  console.log('[Notifications] shouldDeliverNotificationNow rawData:', rawData);
  const type = rawData?.type;
  if (type !== REMINDER_TYPE) {
    console.log('[Notifications] Not a live reminder, allow delivery');
    return true;
  }

  const recordId = typeof rawData?.recordId === 'string' ? rawData.recordId : '';
  const kind = typeof rawData?.kind === 'string' ? rawData.kind : '';
  const scheduledAt = typeof rawData?.scheduledAt === 'string' ? rawData.scheduledAt : '';
  const reminderSnapshot = typeof rawData?.reminderSnapshot === 'string' ? rawData.reminderSnapshot : '';
  if (!recordId || !kind || !scheduledAt || !reminderSnapshot) {
    console.log('[Notifications] Missing required fields, suppressing', { recordId, kind, scheduledAt, reminderSnapshot });
    return false;
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    console.log('[Notifications] scheduledAt is invalid:', scheduledAt);
    return false;
  }

  const lives = useAppStore.getState().lives;
  const currentRecord = lives.find((item) => item.id === recordId);
  if (!currentRecord) {
    console.log('[Notifications] No matching record in store for id:', recordId);
    return false;
  }

  const expectedSnapshot = buildReminderSnapshot(currentRecord);
  if (expectedSnapshot !== reminderSnapshot) {
    console.log('[Notifications] Reminder snapshot mismatch', { expectedSnapshot, reminderSnapshot });
    return false;
  }

  const expectedDate = getTargetDateByKind(currentRecord, kind);
  if (!expectedDate) {
    console.log('[Notifications] Unable to compute expected date for kind:', kind);
    return false;
  }

  const diff = Math.abs(expectedDate.getTime() - scheduledDate.getTime());
  const ok = diff <= REMINDER_VALIDATION_TOLERANCE_MS;
  console.log('[Notifications] scheduledAt vs expected diff(ms):', diff, 'tolerance:', REMINDER_VALIDATION_TOLERANCE_MS, 'deliver:', ok);
  return ok;
};

const formatDayKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const buildRecordSignature = (records: ChekiRecord[]) => {
  return records
    .map((record) => `${record.id}|${record.date}|${record.startTime}|${record.endTime}|${record.liveName}|${record.artist}`)
    .sort()
    .join('||');
};

const cancelLiveReminders = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const targets = scheduled.filter((item) => {
    const type = item.content.data?.type;
    return type === REMINDER_TYPE || type === LEGACY_TIMECAPSULE_TYPE || type === LEGACY_YEARLY_REPORT_TYPE;
  });
  if (!targets || targets.length === 0) {
    console.log('[Notifications] No scheduled reminders to cancel');
    return;
  }

  console.log('[Notifications] Cancelling scheduled reminders:', targets.map((t) => ({ id: t.identifier, data: t.content.data })));
  await Promise.all(targets.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  console.log('[Notifications] Cancel complete');
};

export const scheduleLiveReminders = async (records: ChekiRecord[]) => {
  // ロック取得を試みる（重複実行防止）
  const lockValue = Date.now().toString();
  const existingLock = await AsyncStorage.getItem(SCHEDULE_LOCK_KEY);
  
  if (existingLock) {
    const lockTime = parseInt(existingLock, 10);
    const now = Date.now();
    // 5秒以内のロックは有効とみなす
    if (now - lockTime < 5000) {
      console.log('[Notifications] Schedule in progress, skipping');
      return;
    }
  }

  // ロックを取得
  await AsyncStorage.setItem(SCHEDULE_LOCK_KEY, lockValue);

  try {
    const permission = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Permissions status:', permission?.status ?? permission);
    if (permission.status !== 'granted') {
      console.log('[Notifications] Permission not granted, skipping schedule');
      return;
    }

    const notificationSettings = await getNotificationSettings();
    console.log('[Notifications] Notification settings:', notificationSettings);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || String(new Date().getTimezoneOffset());
    const scheduleKey = `${SCHEDULE_SCHEMA_VERSION}|${formatDayKey()}|${tz}|${buildRecordSignature(records)}`;
    const lastKey = await AsyncStorage.getItem(LAST_SCHEDULE_KEY);
    if (lastKey === scheduleKey) {
      console.log('[Notifications] Schedule key unchanged, skipping re-schedule');
      return;
    }

    await cancelLiveReminders();

    const now = Date.now();
    console.log('[Notifications] Now timestamp:', new Date(now).toISOString());

    // ライブリマインダー
    const liveTargets = records.flatMap((record) =>
      getScheduleTargets(record).map((target) => ({
        record,
        target,
      }))
    );
    console.log('[Notifications] Computed liveTargets count:', liveTargets.length);

    const futureLiveTargets = liveTargets
      .map(({ record, target }) => ({
        type: REMINDER_TYPE,
        recordId: record.id,
        title: target.title,
        body: target.body,
        scheduledDate: target.date,
        kind: target.kind,
        reminderSnapshot: buildReminderSnapshot(record),
      }))
      .filter((item) => item.scheduledDate.getTime() > now)
      // 通知設定に基づいてフィルター
      .filter((item) => {
        switch (item.kind) {
          case 'beforeLive':
            return notificationSettings.beforeLive;
          case 'onDay':
            return notificationSettings.onDay;
          case 'nextDayReview':
            return notificationSettings.nextDayReview;
          case 'campaigns':
            return notificationSettings.campaigns;
          default:
            return false;
        }
      });

    // ライブ通知のみをスケジュール
    const allTargets = futureLiveTargets
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
      .slice(0, MAX_SCHEDULED);

    // スケジュール実行 — Date を直接渡して絶対時刻で指定する
    for (const item of allTargets) {
      console.log(
        `[Notifications] Scheduling ${item.kind} for ${item.recordId} at ${item.scheduledDate.toISOString()} (local: ${item.scheduledDate.toString()})`
      );
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          data: {
            type: item.type,
            recordId: item.recordId,
            kind: item.kind,
            scheduledAt: item.scheduledDate.toISOString(),
            reminderSnapshot: 'reminderSnapshot' in item ? item.reminderSnapshot : undefined,
          },
        },
        trigger: item.scheduledDate,
      } as any);
    }

    console.log('[Notifications] futureLiveTargets count:', futureLiveTargets.length, 'allTargets after trim:', allTargets.length);
    await AsyncStorage.setItem(LAST_SCHEDULE_KEY, scheduleKey);
    console.log(`[Notifications] Scheduled ${allTargets.length} notifications`);
  } finally {
    // ロック解放
    const currentLock = await AsyncStorage.getItem(SCHEDULE_LOCK_KEY);
    if (currentLock === lockValue) {
      await AsyncStorage.removeItem(SCHEDULE_LOCK_KEY);
    }
  }
};
