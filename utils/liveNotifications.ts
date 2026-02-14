import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChekiRecord } from '../types/record';

const REMINDER_TYPE = 'live_reminder';
const NOTIFICATION_TITLE_PREP = 'チケットとタオル、持った？';
const NOTIFICATION_TITLE_HYPE = '会場盛り上がってきたね❤️‍🔥';
const NOTIFICATION_TITLE_FINAL = 'さあ、そろそろスマホをしまっておいて🤫';
const NOTIFICATION_TITLE_AFTER = 'ライブお疲れ様！！';
const LAST_SCHEDULE_KEY = '@last_live_notification_schedule';
const MAX_SCHEDULED = 60;

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

const getScheduleTargets = (record: ChekiRecord) => {
  if (!record.date) return [];
  const base = parseLiveDate(record.date);
  if (!base) return [];

  const liveName = record.liveName || 'ライブ';
  const artistName = record.artist || 'ライブ';
  const startDateTime = getStartDateTime(base, record.startTime);

  const dayBefore = {
    kind: 'day_before',
    title: NOTIFICATION_TITLE_HYPE,
    body: `いよいよ明日は ${liveName} ！忘れ物ないかちゃんとチェックしてね！`,
    date: dateAt(base, 19, 0, -1),
  };

  const oneHourBefore = {
    kind: 'one_hour_before',
    title: NOTIFICATION_TITLE_HYPE,
    body: `もうすぐ ${artistName} に会える！！楽しむ準備はできてるかい？？`,
    date: addMinutes(startDateTime, -60),
  };

  const fifteenMinutesBefore = {
    kind: 'fifteen_minutes_before',
    title: NOTIFICATION_TITLE_FINAL,
    body: `${liveName}まもなく始まります！行ってらっしゃい！`,
    date: addMinutes(startDateTime, -15),
  };

  const after = {
    kind: 'after_show',
    title: NOTIFICATION_TITLE_AFTER,
    body: '今日の感動を言葉に残しませんか？セットリストやMCの記憶は、未来のあなたへの宝物になります💎',
    date: dateAt(base, 21, 0, 0),
  };

  return [dayBefore, oneHourBefore, fifteenMinutesBefore, after];
};

const formatDayKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const buildRecordSignature = (records: ChekiRecord[]) => {
  return records
    .map((record) => `${record.id}|${record.date}|${record.liveName}|${record.artist}`)
    .sort()
    .join('||');
};

const cancelLiveReminders = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const targets = scheduled.filter((item) => item.content.data?.type === REMINDER_TYPE);
  await Promise.all(targets.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
};

export const scheduleLiveReminders = async (records: ChekiRecord[]) => {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    console.log('[Notifications] Permission not granted, skipping schedule');
    return;
  }

  const scheduleKey = `${formatDayKey()}|${buildRecordSignature(records)}`;
  const lastKey = await AsyncStorage.getItem(LAST_SCHEDULE_KEY);
  if (lastKey === scheduleKey) {
    return;
  }

  await cancelLiveReminders();

  const now = Date.now();

  const targets = records.flatMap((record) =>
    getScheduleTargets(record).map((target) => ({
      record,
      target,
    }))
  );

  const futureTargets = targets
    .map(({ record, target }) => {
      let scheduledDate = target.date;
      if (target.kind === 'after_show' && scheduledDate.getTime() <= now) {
        scheduledDate = dateAt(scheduledDate, 21, 0, 1);
      }
      return { record, target, scheduledDate };
    })
    .filter((item) => item.scheduledDate.getTime() > now)
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
    .slice(0, MAX_SCHEDULED);

  for (const item of futureTargets) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.target.title,
        body: item.target.body,
        data: {
          type: REMINDER_TYPE,
          recordId: item.record.id,
          kind: item.target.kind,
        },
      },
      trigger: { type: 'date', date: item.scheduledDate },
    });
  }

  await AsyncStorage.setItem(LAST_SCHEDULE_KEY, scheduleKey);
};
