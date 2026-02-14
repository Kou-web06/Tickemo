import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export type ViewMode = 'month' | 'year';

export interface ActivityYearData {
  value: number;
  label: string;
  year: number;
  total: number;
  busiestMonth?: { month: number; count: number };
  topVenue?: { name: string; count: number };
}

export interface ActivityMonthData {
  value: number;
  label: string;
  year: number;
  month: number;
  total: number;
  topArtist?: { name: string; count: number };
  daysActive?: number;
}

type ActivityData = ActivityYearData | ActivityMonthData;

type YearEntry = {
  total: number;
  monthCounts: number[];
  venueCounts: Map<string, number>;
  monthArtistCounts: Map<number, Map<string, number>>;
  monthDaySets: Map<number, Set<string>>;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_WINDOW = 12;
const YEAR_WINDOW = 5;

const parseDate = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, '-');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getTopEntry = (counts: Map<string, number>) => {
  let top: { name: string; count: number } | undefined;
  counts.forEach((count, name) => {
    if (!top || count > top.count) {
      top = { name, count };
    }
  });
  return top;
};

export const useActivityStats = () => {
  const lives = useAppStore((state) => state.lives);
  const [viewMode, setViewMode] = useState<ViewMode>('year');
  const [selectedData, setSelectedData] = useState<ActivityData | null>(null);

  const { yearData, rollingMonthData } = useMemo(() => {
    const yearMap = new Map<number, YearEntry>();
    let latestDate: Date | null = null;

    lives.forEach((live) => {
      const parsed = parseDate(live.date);
      if (!parsed) return;

      if (!latestDate || parsed.getTime() > latestDate.getTime()) {
        latestDate = parsed;
      }

      const year = parsed.getFullYear();
      const monthIndex = parsed.getMonth();
      const day = parsed.getDate();

      if (!yearMap.has(year)) {
        yearMap.set(year, {
          total: 0,
          monthCounts: Array.from({ length: 12 }, () => 0),
          venueCounts: new Map<string, number>(),
          monthArtistCounts: new Map<number, Map<string, number>>(),
          monthDaySets: new Map<number, Set<string>>(),
        });
      }

      const entry = yearMap.get(year);
      if (!entry) return;

      entry.total += 1;
      entry.monthCounts[monthIndex] = (entry.monthCounts[monthIndex] ?? 0) + 1;

      const venue = live.venue?.trim();
      if (venue) {
        entry.venueCounts.set(venue, (entry.venueCounts.get(venue) ?? 0) + 1);
      }

      const artist = live.artist?.trim();
      if (artist) {
        if (!entry.monthArtistCounts.has(monthIndex)) {
          entry.monthArtistCounts.set(monthIndex, new Map<string, number>());
        }
        const monthArtists = entry.monthArtistCounts.get(monthIndex);
        if (monthArtists) {
          monthArtists.set(artist, (monthArtists.get(artist) ?? 0) + 1);
        }
      }

      const dayKey = `${year}-${monthIndex + 1}-${day}`;
      if (!entry.monthDaySets.has(monthIndex)) {
        entry.monthDaySets.set(monthIndex, new Set<string>());
      }
      entry.monthDaySets.get(monthIndex)?.add(dayKey);
    });

    const today = new Date();
    const anchorDate = latestDate ?? today;
    const latestYear = anchorDate.getFullYear();

    const yearData: ActivityYearData[] = Array.from({ length: YEAR_WINDOW }, (_, index) => {
      const year = latestYear - (YEAR_WINDOW - 1 - index);
      const entry = yearMap.get(year);
      const monthCounts = entry?.monthCounts ?? Array.from({ length: 12 }, () => 0);

      const busiestMonthIndex = monthCounts.reduce(
        (bestIndex, count, monthIndex) =>
          count > monthCounts[bestIndex] ? monthIndex : bestIndex,
        0
      );
      const busiestMonthCount = monthCounts[busiestMonthIndex] ?? 0;

      return {
        year,
        total: entry?.total ?? 0,
        value: entry?.total ?? 0,
        label: `${year}`,
        busiestMonth:
          busiestMonthCount > 0
            ? { month: busiestMonthIndex, count: busiestMonthCount }
            : undefined,
        topVenue: entry ? getTopEntry(entry.venueCounts) : undefined,
      };
    });

    const rollingMonthData: ActivityMonthData[] = [];
    for (let offset = MONTH_WINDOW - 1; offset >= 0; offset -= 1) {
      const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - offset, 1);
      const year = date.getFullYear();
      const monthIndex = date.getMonth();
      const entry = yearMap.get(year);
      const monthCount = entry?.monthCounts[monthIndex] ?? 0;
      const monthArtists = entry?.monthArtistCounts.get(monthIndex) ?? new Map<string, number>();
      const topArtist = getTopEntry(monthArtists);
      const daysActive = entry?.monthDaySets.get(monthIndex)?.size ?? 0;

      rollingMonthData.push({
        year,
        month: monthIndex + 1,
        total: monthCount,
        value: monthCount,
        label: MONTH_LABELS[monthIndex],
        topArtist,
        daysActive,
      });
    }

    return { yearData, rollingMonthData };
  }, [lives]);

  const latestYearData = yearData[yearData.length - 1] ?? null;
  const latestMonthData = rollingMonthData[rollingMonthData.length - 1] ?? null;

  useEffect(() => {
    if (viewMode === 'year') {
      const yearMatch = yearData.find((item) => item.year === selectedData?.year);
      if (!yearMatch && latestYearData) {
        setSelectedData(latestYearData);
      }
      return;
    }

    if (!rollingMonthData.length) return;
    const monthMatch = rollingMonthData.find(
      (item) =>
        item.year === (selectedData as ActivityMonthData | null)?.year &&
        item.month === (selectedData as ActivityMonthData | null)?.month
    );
    if (!monthMatch && latestMonthData) {
      setSelectedData(latestMonthData);
    }
  }, [latestMonthData, rollingMonthData, selectedData, viewMode, yearData, latestYearData]);

  return {
    viewMode,
    setViewMode,
    selectedData,
    setSelectedData,
    yearData,
    monthData: rollingMonthData,
  };
};
