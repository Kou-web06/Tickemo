import React, { useCallback, useMemo } from 'react';
import { DeviceEventEmitter, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { CalendarList, DateData } from 'react-native-calendars';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowTurnBackwardIcon } from '@hugeicons/core-free-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useRecords } from '../contexts/RecordsContext';
import { DummyJacket } from '../components/DummyJacket';
import { getCachedThemePreference, hydrateThemePreference } from '../lib/themePreference';
import { useTheme } from '../src/theme';

type EventType = 'past' | 'future';

interface CalendarEvent {
  type: EventType;
  imageUrl?: string;
}

const SCRIBBLE_IMAGE = require('../assets/shareCard/cardParts/scribble.png');
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const buildPalette = (isDarkMode: boolean) => ({
  background: isDarkMode ? '#121212' : '#F8F8F8',
  headerBackground: isDarkMode ? 'rgba(18, 18, 18, 0.74)' : 'rgba(248, 248, 248, 0.62)',
  headerBorder: isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.45)',
  weekdayBorder: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.4)',
  weekdayBackground: isDarkMode ? 'rgba(24, 24, 24, 0.45)' : 'rgba(248, 248, 248, 0.18)',
  title: isDarkMode ? '#F5F5F7' : '#333333',
  weekday: isDarkMode ? '#B7B7C2' : '#7A7A7A',
  weekdayWeekend: isDarkMode ? '#8F8F9A' : '#A9A9A9',
  monthHeader: isDarkMode ? '#BCBCC8' : '#626262',
  dayText: isDarkMode ? '#F5F5F7' : '#333333',
  dayWeekend: isDarkMode ? '#8F8F9A' : '#A9A9A9',
  daySelected: '#A226D9',
  daySelectedBackground: isDarkMode ? '#2A2234' : '#F3E5FA',
  calendarDisabled: isDarkMode ? '#4A4A55' : '#C4C4C4',
  coverFallback: isDarkMode ? '#34343B' : '#EAEAEA',
  modalBackdrop: 'rgba(0, 0, 0, 0.32)',
  modalCard: isDarkMode ? '#1A1A1A' : '#FFFFFF',
  modalItem: isDarkMode ? '#26262C' : '#F7F7F7',
  modalCoverFallback: isDarkMode ? '#32323A' : '#E7E7E7',
  modalTitle: isDarkMode ? '#F5F5F7' : '#333333',
  modalTextStrong: isDarkMode ? '#ECECF3' : '#2F2F2F',
  modalText: isDarkMode ? '#B7B7C2' : '#666666',
  modalCloseIcon: isDarkMode ? '#B7B7C2' : '#7A7A7A',
  backToCurrentButton: '#A226D9',
  backToCurrentIcon: '#FFFFFF',
  buttonShadow: isDarkMode ? '#000000' : '#6C3A8D',
});

type CalendarPalette = ReturnType<typeof buildPalette>;

const toIsoDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const isWeekend = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  return day === 0 || day === 6;
};

const parseRecordDate = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, '-');
  const [year, month, day] = normalized.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export default function CalendarScreen() {
  const { isDark: isSystemDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { records } = useRecords();
  const [manualDarkMode, setManualDarkMode] = React.useState<boolean | null | undefined>(() => getCachedThemePreference());
  const today = useMemo(() => toIsoDate(new Date()), []);
  const todayMonthKey = useMemo(() => today.slice(0, 7), [today]);
  const initialMonthLabel = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}年 ${now.getMonth() + 1}月`;
  }, []);
  const calendarRef = React.useRef<any>(null);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [visibleMonthKey, setVisibleMonthKey] = React.useState(todayMonthKey);
  const [currentMonth, setCurrentMonth] = React.useState(initialMonthLabel);

  const loadThemePreference = React.useCallback(async () => {
    const value = await hydrateThemePreference();
    setManualDarkMode(value);
  }, []);

  React.useEffect(() => {
    void loadThemePreference();
  }, [loadThemePreference]);

  useFocusEffect(
    React.useCallback(() => {
      void loadThemePreference();
    }, [loadThemePreference])
  );

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('theme:changed', (nextValue?: boolean) => {
      if (typeof nextValue === 'boolean') {
        setManualDarkMode(nextValue);
      } else {
        void loadThemePreference();
      }
    });

    return () => subscription.remove();
  }, [loadThemePreference]);

  const isDarkMode = manualDarkMode ?? false;
  const palette = useMemo(() => buildPalette(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const eventsByDate = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const map: Record<string, CalendarEvent> = {};

    records.forEach((record) => {
      const parsed = parseRecordDate(record.date);
      if (!parsed) return;

      const key = toIsoDate(parsed);
      const eventType: EventType = parsed.getTime() < todayStart.getTime() ? 'past' : 'future';
      const cover = record.imageUrls?.[0] || undefined;

      if (!map[key]) {
        map[key] = {
          type: eventType,
          imageUrl: cover,
        };
        return;
      }

      if (map[key].type !== 'past' && eventType === 'past') {
        map[key].type = 'past';
      }

      if (!map[key].imageUrl && cover) {
        map[key].imageUrl = cover;
      }
    });

    return map;
  }, [records]);

  const recordsByDate = useMemo(() => {
    const map: Record<string, typeof records> = {};
    records.forEach((record) => {
      const parsed = parseRecordDate(record.date);
      if (!parsed) return;
      const key = toIsoDate(parsed);
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(record);
    });
    return map;
  }, [records]);

  const selectedDateRecords = selectedDate ? recordsByDate[selectedDate] ?? [] : [];
  const modalCoverSize = useMemo(() => Math.min(Math.max(windowWidth * 0.18, 64), 84), [windowWidth]);
  const modalCoverRadius = useMemo(() => Math.round(modalCoverSize * 0.18), [modalCoverSize]);
  const modalCoverIconSize = useMemo(() => Math.round(modalCoverSize * 0.4), [modalCoverSize]);

  const calendarTheme = useMemo(() => ({
    calendarBackground: palette.background,
    monthTextColor: palette.title,
    textMonthFontWeight: '800' as const,
    textMonthFontSize: 19,
    textDayHeaderFontSize: 12,
    textSectionTitleColor: palette.weekday,
    dayTextColor: palette.dayText,
    textDisabledColor: palette.calendarDisabled,
    'stylesheet.calendar.main': {
      week: {
        marginTop: 2,
        marginBottom: 2,
        flexDirection: 'row',
        flexWrap: 'wrap' as const,
      },
      dayContainer: {
        width: '14.2857%',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 0,
      },
    },
  }), [palette.background, palette.calendarDisabled, palette.dayText, palette.title, palette.weekday]);

  const scrollToToday = React.useCallback(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
    const centerOffset = 0;

    if (calendarRef.current?.scrollToDay) {
      calendarRef.current.scrollToDay(firstDayOfMonth, centerOffset, true);
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const showBackToCurrentMonth = visibleMonthKey !== todayMonthKey;
  const calendarRenderKey = `calendar-${isDarkMode ? 'dark' : 'light'}`;

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('calendar:scrollToToday', () => {
      scrollToToday();
    });

    return () => subscription.remove();
  }, [scrollToToday]);

  const renderDay = useCallback(({ date }: { date?: DateData }) => {
    if (!date) {
      return (
        <View style={styles.dayCellSlot}>
          <View style={styles.dayCell} />
        </View>
      );
    }

    const key = date.dateString;
    const event = eventsByDate[key];
    const hasEvent = Boolean(recordsByDate[key]?.length);
    const todaySelected = key === today;
    const weekend = isWeekend(key);
    const defaultDayColor = weekend ? palette.dayWeekend : palette.dayText;

    let dayContent: React.ReactNode;

    if (event?.type === 'past') {
      dayContent = (
        <View style={styles.dayCell}>
          <View style={[styles.todayCircle, todaySelected && styles.todayCircleActive]}>
            <Text style={[styles.dayNumber, { color: todaySelected ? palette.daySelected : defaultDayColor }]}>{date.day}</Text>
          </View>
          {event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} style={styles.coverArt} contentFit="cover" />
          ) : (
            <DummyJacket style={styles.coverFallback} iconSize={14} />
          )}
        </View>
      );
    } else if (event?.type === 'future') {
      dayContent = (
        <View style={styles.dayCell}>
          <View style={[styles.todayCircle, styles.futureDateWrap, todaySelected && styles.todayCircleActive]}>
            <Image source={SCRIBBLE_IMAGE} style={styles.dateScribble} contentFit="contain" />
            <Text style={[styles.dayNumber, { color: todaySelected ? palette.daySelected : defaultDayColor }]}>{date.day}</Text>
          </View>
          <View style={styles.futureWrap}>
            {event.imageUrl ? (
              <Image source={{ uri: event.imageUrl }} style={styles.coverArt} contentFit="cover" />
            ) : (
              <DummyJacket style={styles.coverFallback} iconSize={14} />
            )}
          </View>
        </View>
      );
    } else {
      dayContent = (
        <View style={styles.dayCell}>
          <View style={[styles.todayCircle, todaySelected && styles.todayCircleActive]}>
            <Text style={[styles.dayNumber, { color: todaySelected ? palette.daySelected : defaultDayColor }]}>{date.day}</Text>
          </View>
        </View>
      );
    }

    if (!hasEvent) {
      return <View style={styles.dayCellSlot}>{dayContent}</View>;
    }

    return (
      <View style={styles.dayCellSlot}>
        <TouchableOpacity style={styles.dayPressable} activeOpacity={0.75} onPress={() => setSelectedDate(key)}>
          {dayContent}
        </TouchableOpacity>
      </View>
    );
  }, [eventsByDate, palette.daySelected, palette.dayText, palette.dayWeekend, recordsByDate, styles, today]);

  const renderMonthHeader = useCallback((date?: string) => {
    if (!date) {
      return <View style={styles.monthHeaderWrap} />;
    }
    const parsed = new Date(date);
    const month = Number.isNaN(parsed.getTime()) ? '' : `${parsed.getMonth() + 1}月`;

    return (
      <View style={styles.monthHeaderWrap}>
        <Text style={styles.monthHeaderText}>{month}</Text>
      </View>
    );
  }, [styles.monthHeaderText, styles.monthHeaderWrap]);

  return (
    <View style={styles.container}>
      <BlurView tint={isDarkMode ? 'dark' : 'light'} intensity={80} style={[styles.fixedHeader, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>{currentMonth}</Text>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((weekday, index) => {
            const isWeekendDay = index === 0 || index === 6;
            return (
              <Text key={weekday} style={[styles.weekdayText, isWeekendDay && styles.weekendWeekdayText]}>
                {weekday}
              </Text>
            );
          })}
        </View>
      </BlurView>

      <View style={[styles.calendarWrap, { paddingBottom: Math.max(96, insets.bottom + 86) }]}>
        <CalendarList
          key={calendarRenderKey}
          ref={calendarRef}
          current={today}
          pastScrollRange={72}
          futureScrollRange={72}
          pagingEnabled={false}
          hideDayNames
          renderHeader={renderMonthHeader}
          showSixWeeks
          scrollEnabled
          calendarStyle={styles.calendarBody}
          showScrollIndicator={false}
          theme={calendarTheme}
          onVisibleMonthsChange={(months) => {
            const firstVisible = months[0];
            if (!firstVisible) return;
            const next = `${firstVisible.year}-${String(firstVisible.month).padStart(2, '0')}`;
            const nextLabel = `${firstVisible.year}年 ${firstVisible.month}月`;
            setVisibleMonthKey((prev) => (prev === next ? prev : next));
            setCurrentMonth((prev) => (prev === nextLabel ? prev : nextLabel));
          }}
          dayComponent={renderDay}
        />
      </View>

      {showBackToCurrentMonth ? (
        <TouchableOpacity
          style={[styles.backToCurrentButton, { bottom: Math.max(108, insets.bottom + 90) }]}
          activeOpacity={0.9}
          onPress={scrollToToday}
        >
          <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={18} color={palette.backToCurrentIcon} strokeWidth={2.1} />
        </TouchableOpacity>
      ) : null}

      <Modal visible={Boolean(selectedDate)} transparent animationType="fade" onRequestClose={() => setSelectedDate(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedDate ? selectedDate.replace(/-/g, '.') : ''}</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedDate(null)}>
                <Ionicons name="close" size={22} color={palette.modalCloseIcon} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
              {selectedDateRecords.map((record) => {
                const cover = record.imageUrls?.[0];
                const artists = record.artists?.filter((name) => name.trim().length > 0);
                const artistLabel = artists && artists.length > 0 ? artists.join(' / ') : record.artist || '-';
                const timeLabel = record.startTime || '--:--';

                return (
                  <View key={record.id} style={styles.modalItem}>
                    {cover ? (
                      <Image
                        source={{ uri: cover }}
                        style={[styles.modalCover, { width: modalCoverSize, height: modalCoverSize, borderRadius: modalCoverRadius }]}
                        contentFit="cover"
                      />
                    ) : (
                      <DummyJacket
                        style={[styles.modalCoverFallback, { width: modalCoverSize, height: modalCoverSize, borderRadius: modalCoverRadius }]}
                        iconSize={modalCoverIconSize}
                      />
                    )}
                    <View style={styles.modalInfo}>
                      <Text style={styles.modalLiveName} numberOfLines={1}>{record.liveName || '-'}</Text>
                      <Text style={styles.modalMeta} numberOfLines={1}>{artistLabel}</Text>
                      <Text style={styles.modalMeta} numberOfLines={1}>{record.venue || '-'}</Text>
                      <Text style={styles.modalMeta}>{timeLabel}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (palette: CalendarPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  fixedHeader: {
    backgroundColor: palette.headerBackground,
    borderBottomWidth: 1,
    borderBottomColor: palette.headerBorder,
    overflow: 'hidden',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.title,
    marginLeft: 20,
    marginBottom: 10,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.weekdayBorder,
    backgroundColor: palette.weekdayBackground,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.weekday,
  },
  weekendWeekdayText: {
    color: palette.weekdayWeekend,
  },
  calendarWrap: {
    flex: 1,
  },
  calendarBody: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  dayCell: {
    width: '100%',
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingHorizontal: 1,
  },
  dayCellSlot: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dayPressable: {
    width: '100%',
    alignItems: 'center',
  },
  monthHeaderWrap: {
    paddingTop: 2,
    paddingBottom: 4,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  monthHeaderText: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.monthHeader,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.dayText,
  },
  coverArt: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginTop: 6,
  },
  coverFallback: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginTop: 6,
    backgroundColor: palette.coverFallback,
  },
  futureWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  futureDateWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  dateScribble: {
    position: 'absolute',
    width: 48,
    height: 48,
    opacity: 0.95,
    zIndex: 1,
  },
  futureDayNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#333333',
  },
  todayCircle: {
    width: 28,
    height: 28,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircleActive: {
    backgroundColor: palette.daySelectedBackground,
    borderRadius: 30,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: palette.modalBackdrop,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: palette.modalCard,
    borderRadius: 18,
    maxHeight: '75%',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.modalTitle,
  },
  modalClose: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A226D9',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  modalList: {
    paddingBottom: 8,
    gap: 10,
  },
  modalItem: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: palette.modalItem,
  },
  modalCover: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  modalCoverFallback: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: palette.modalCoverFallback,
  },
  modalInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  modalLiveName: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.modalTextStrong,
  },
  modalMeta: {
    fontSize: 12,
    color: palette.modalText,
    marginTop: 2,
  },
  backToCurrentButton: {
    position: 'absolute',
    right: 18,
    width: 44,
    height: 44,
    backgroundColor: palette.backToCurrentButton,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.buttonShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
});
