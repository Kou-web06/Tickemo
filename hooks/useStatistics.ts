import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

export interface TopArtistStat {
  name: string;
  count: number;
  rank: number;
  percentage: number;
}

export interface YearlyReportStat {
  year: number;
  totalLives: number;
  activeDays: number;
  topArtist?: string;
}

const parseDate = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, '-');
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
};

export const useStatistics = () => {
  const lives = useAppStore((state) => state.lives);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendedLives = lives.filter((live) => {
    const parsed = parseDate(live.date);
    if (!parsed) return false;
    parsed.setHours(0, 0, 0, 0);
    return parsed.getTime() <= today.getTime();
  });
  const totalLives = attendedLives.length;

  const allArtists = useMemo<TopArtistStat[]>(() => {
    const counts = new Map<string, number>();
    attendedLives.forEach((live) => {
      const name = live.artist?.trim();
      if (!name) return;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });

    const sorted = [...counts.entries()]
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalLives > 0 ? Math.round((count / totalLives) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    let currentRank = 0;
    let previousCount: number | null = null;

    return sorted.map((item, index) => {
      if (previousCount === null || item.count !== previousCount) {
        currentRank = index + 1;
        previousCount = item.count;
      }

      return {
        ...item,
        rank: currentRank,
      };
    });
  }, [attendedLives, totalLives]);

  const topArtists = useMemo(() => allArtists.slice(0, 3), [allArtists]);

  const yearlyReport = useMemo<YearlyReportStat[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const defaultStartYear = currentYear - 4;
    const endYear = currentYear + 1;

    const yearMap = new Map<
      number,
      {
        totalLives: number;
        daySet: Set<string>;
        artistCounts: Map<string, number>;
      }
    >();

    let minYearInData: number | null = null;

    attendedLives.forEach((live) => {
      const parsed = parseDate(live.date);
      if (!parsed) return;
      const year = parsed.getFullYear();
      if (year > endYear) return;
      if (minYearInData === null || year < minYearInData) {
        minYearInData = year;
      }

      if (!yearMap.has(year)) {
        yearMap.set(year, {
          totalLives: 0,
          daySet: new Set<string>(),
          artistCounts: new Map<string, number>(),
        });
      }

      const entry = yearMap.get(year);
      if (!entry) return;

      entry.totalLives += 1;
      const dayKey = `${year}-${parsed.getMonth() + 1}-${parsed.getDate()}`;
      entry.daySet.add(dayKey);

      const artist = live.artist?.trim();
      if (artist) {
        entry.artistCounts.set(artist, (entry.artistCounts.get(artist) ?? 0) + 1);
      }
    });

    const startYear = Math.min(defaultStartYear, minYearInData ?? defaultStartYear);

    const result: YearlyReportStat[] = [];
    for (let year = startYear; year <= endYear; year += 1) {
      const entry = yearMap.get(year);
      let topArtist: string | undefined;
      if (entry) {
        let topCount = 0;
        entry.artistCounts.forEach((count, name) => {
          if (count > topCount) {
            topCount = count;
            topArtist = name;
          }
        });
      }

      result.push({
        year,
        totalLives: entry?.totalLives ?? 0,
        activeDays: entry?.daySet.size ?? 0,
        topArtist,
      });
    }

    return result;
  }, [attendedLives]);

  return {
    topArtists,
    allArtists,
    yearlyReport,
    totalLives,
  };
};
