import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChekiRecord } from '../types/record';

const REMINDER_TYPE = 'live_reminder';
const TIMECAPSULE_TYPE = 'timecapsule';
const YEARLY_REPORT_TYPE = 'yearly_report';
const NOTIFICATION_TITLE_PREP = 'チケットとタオル、持った？';
const NOTIFICATION_TITLE_HYPE = '会場盛り上がってきたね❤️‍🔥';
const NOTIFICATION_TITLE_FINAL = 'そろそろスマホしまっておいて🤫';
const NOTIFICATION_TITLE_AFTER = 'ライブお疲れ様！！';
const NOTIFICATION_TITLE_TIMECAPSULE = '去年の今日、何してたか覚えてる？😎';
const NOTIFICATION_TITLE_YEARLY = '今年の推し活レポートが届いたよ！私たち、今年も頑張ったね✨';
const LAST_SCHEDULE_KEY = '@last_live_notification_schedule';
const SCHEDULE_LOCK_KEY = '@notification_schedule_lock';
const MAX_SCHEDULED = 64;

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

const parseEndTime = (value?: string) => {
  if (!value) return { hour: 20, minute: 0 };
  const [hourStr, minuteStr] = value.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return { hour: 20, minute: 0 };
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return { hour: 20, minute: 0 };
  return { hour, minute };
};

const getStartDateTime = (baseDate: Date, startTime?: string) => {
  const { hour, minute } = parseStartTime(startTime);
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const getEndDateTime = (baseDate: Date, startTime?: string, endTime?: string) => {
  const start = getStartDateTime(baseDate, startTime);
  const { hour, minute } = parseEndTime(endTime);
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= start.getTime()) {
    d.setDate(d.getDate() + 1);
  }
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
  const endDateTime = getEndDateTime(base, record.startTime, record.endTime);

  const dayBefore = {
    kind: 'day_before',
    title: NOTIFICATION_TITLE_PREP,
    body: `いよいよ明日は ${liveName} ！忘れ物ない？もう一回チェックしてね！`,
    date: dateAt(base, 19, 0, -1),
  };

  const oneHourBefore = {
    kind: 'one_hour_before',
    title: NOTIFICATION_TITLE_HYPE,
    body: `もうすぐ ${artistName} に会える！！楽しむ準備はできてる？？`,
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
    body: '魔法が解ける前に、今日の『最高』をメモに残しておかない？🥹',
    date: addMinutes(endDateTime, 30),
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
    .map((record) => `${record.id}|${record.date}|${record.startTime}|${record.endTime}|${record.liveName}|${record.artist}`)
    .sort()
    .join('||');
};

const cancelLiveReminders = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const targets = scheduled.filter((item) => {
    const type = item.content.data?.type;
    return type === REMINDER_TYPE || type === TIMECAPSULE_TYPE || type === YEARLY_REPORT_TYPE;
  });
  await Promise.all(targets.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
};

const getTimeCapsuleTargets = (records: ChekiRecord[]) => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const targets: Array<{
    record: ChekiRecord;
    title: string;
    body: string;
    date: Date;
    kind: string;
  }> = [];

  for (const record of records) {
    if (!record.date) continue;
    const base = parseLiveDate(record.date);
    if (!base) continue;

    const recordYear = base.getFullYear();
    if (recordYear >= currentYear) continue; // 過去の公演のみ対象

    // 来年以降の同じ月日に通知をスケジュール
    for (let yearOffset = 1; yearOffset <= 2; yearOffset++) {
      const targetYear = currentYear + yearOffset;
      const yearsAgo = targetYear - recordYear;
      
      const notificationDate = new Date(targetYear, base.getMonth(), base.getDate(), 10, 0, 0, 0);
      
      if (notificationDate.getTime() <= today.getTime()) continue;

      const liveName = record.liveName || 'ライブ';
      const artistName = record.artist || 'あの日';

      targets.push({
        record,
        title: NOTIFICATION_TITLE_TIMECAPSULE,
        body: `${yearsAgo}年前の今日は「${liveName}」だったよ！${artistName}との思い出、振り返ってみよう💫`,
        date: notificationDate,
        kind: 'timecapsule',
      });
    }
  }

  return targets;
};

const getYearlyReportTargets = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const targets: Array<{
    title: string;
    body: string;
    date: Date;
    kind: string;
  }> = [];

  // 今年と来年の12月28日をスケジュール
  for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
    const targetYear = currentYear + yearOffset;
    const reportDate = new Date(targetYear, 11, 28, 21, 0, 0, 0); // 12月28日21時

    if (reportDate.getTime() <= today.getTime()) continue;

    targets.push({
      title: NOTIFICATION_TITLE_YEARLY,
      body: `${targetYear}年の推し活を振り返ってみよう！素敵な思い出がたくさん詰まっているはず🎉`,
      date: reportDate,
      kind: 'yearly_report',
    });
  }

  return targets;
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

    // ライブリマインダー
    const liveTargets = records.flatMap((record) =>
      getScheduleTargets(record).map((target) => ({
        record,
        target,
      }))
    );

    const futureLiveTargets = liveTargets
      .map(({ record, target }) => ({
        type: REMINDER_TYPE,
        recordId: record.id,
        title: target.title,
        body: target.body,
        scheduledDate: target.date,
        kind: target.kind,
      }))
      .filter((item) => item.scheduledDate.getTime() > now);

    // タイムカプセル通知
    const timeCapsuleTargets = getTimeCapsuleTargets(records).map((item) => ({
      type: TIMECAPSULE_TYPE,
      recordId: item.record.id,
      title: item.title,
      body: item.body,
      scheduledDate: item.date,
      kind: item.kind,
    }));

    // 年次レポート通知
    const yearlyReportTargets = getYearlyReportTargets().map((item) => ({
      type: YEARLY_REPORT_TYPE,
      recordId: undefined,
      title: item.title,
      body: item.body,
      scheduledDate: item.date,
      kind: item.kind,
    }));

    // 全ての通知を結合してソート
    const allTargets = [
      ...futureLiveTargets,
      ...timeCapsuleTargets,
      ...yearlyReportTargets,
    ]
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
      .slice(0, MAX_SCHEDULED);

    // スケジュール実行
    for (const item of allTargets) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          data: {
            type: item.type,
            recordId: item.recordId,
            kind: item.kind,
          },
        },
        trigger: {
          type: 'calendar',
          year: item.scheduledDate.getFullYear(),
          month: item.scheduledDate.getMonth() + 1,
          date: item.scheduledDate.getDate(),
          hour: item.scheduledDate.getHours(),
          minute: item.scheduledDate.getMinutes(),
          second: item.scheduledDate.getSeconds(),
        } as any,
      });
    }

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
