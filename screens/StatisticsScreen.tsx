import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  MedalFirstPlaceIcon,
  MedalSecondPlaceIcon,
  MedalThirdPlaceIcon,
  Medal06Icon,
  Wallet03Icon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { BarChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useRecords } from '../contexts/RecordsContext';
import { useAppStore } from '../store/useAppStore';
import { useFonts, LINESeedJP_400Regular, LINESeedJP_700Bold } from '@expo-google-fonts/line-seed-jp';
import { getArtworkUrl, searchAppleMusicArtists, searchAppleMusicSongs } from '../utils/appleMusicApi';
import { resolveLocalImageUri } from '../lib/imageUpload';
import { getCachedThemePreference, hydrateThemePreference } from '../lib/themePreference';
import { useTheme } from '../src/theme';

const PRIMARY_COLOR = '#a328dd';
const APPLE_MUSIC_DEVELOPER_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMyTVlRNk5WOTYifQ.eyJpc3MiOiJRMkxMMkI3OTJWIiwiaWF0IjoxNzY5ODQ5MDA5LCJleHAiOjE3ODU0MDEwMDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJtZWRpYS5jb20uYW5vbnltb3VzLlRpY2tlbW8ifQ.ect6vO1q3aC9XJVYCUBVLlTHaVEcZebm0-dVZ3ak6uglI33e1ra3qcwkawXaScFFcLB8sgX5TEcFEj9QGF1Z8A';

const buildPalette = (isDarkMode: boolean) => ({
  screenBackground: isDarkMode ? '#121212' : '#F8F8F8',
  headerBackground: isDarkMode ? 'rgba(18, 18, 18, 0.74)' : 'rgba(248, 248, 248, 0.62)',
  headerBorder: isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.45)',
  primaryText: isDarkMode ? '#F5F5F7' : '#414141',
  secondaryText: isDarkMode ? '#A1A1AA' : '#A1A1A1',
  cardBackground: isDarkMode ? '#1A1A1A' : '#FFFFFF',
  cardShadow: isDarkMode ? '#000000' : '#D2D2D2',
  yearButtonBackground: isDarkMode ? '#24242A' : '#FFFFFF',
  yearButtonBorder: isDarkMode ? '#3A3A42' : '#E0E0E0',
  yearButtonDisabledIcon: isDarkMode ? '#4A4A55' : '#DDDDDD',
  thumbBackground: isDarkMode ? '#2B2B33' : '#EFEFEF',
  spendingToggle: isDarkMode ? '#B7B7C2' : '#A1A1A1',
});

type StatisticsPalette = ReturnType<typeof buildPalette>;

type SummaryData = {
  totalLives: number;
  totalArtists: number;
  totalVenues: number;
};

type MonthlyData = {
  month: string;
  count: number;
};

type TopItem = {
  name: string;
  count: number;
  imageUrl?: string;
};

const parseRecordDateTime = (date: string, startTime?: string) => {
  const [y, m, d] = date.split('.').map((value) => Number(value));
  if (!y || !m || !d) {
    return null;
  }

  const parsed = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (startTime) {
    const [h, min] = startTime.split(':').map((value) => Number(value));
    if (!Number.isNaN(h)) {
      parsed.setHours(h, Number.isNaN(min) ? 0 : min, 0, 0);
    }
  }

  return parsed;
};

const resolveArtistThumbUrl = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//.test(trimmed)) {
    return getArtworkUrl(trimmed, 160);
  }

  return resolveLocalImageUri(trimmed) || '';
};

const StatisticsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { isDark: isSystemDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { records } = useRecords();
  const setlists = useAppStore((state) => state.setlists);
  const [manualDarkMode, setManualDarkMode] = useState<boolean | null | undefined>(() => getCachedThemePreference());
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});
  const [songImages, setSongImages] = useState<Record<string, string>>({});
  const [fontsLoaded] = useFonts({
    LINESeedJP_400Regular,
    LINESeedJP_700Bold,
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [priceHidden, setPriceHidden] = useState(false);

  const loadThemePreference = React.useCallback(async () => {
    const value = await hydrateThemePreference();
    setManualDarkMode(value);
  }, []);

  useEffect(() => {
    void loadThemePreference();
  }, [loadThemePreference]);

  useFocusEffect(
    React.useCallback(() => {
      void loadThemePreference();
    }, [loadThemePreference])
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('theme:changed', (nextValue?: boolean) => {
      if (typeof nextValue === 'boolean') {
        setManualDarkMode(nextValue);
      } else {
        void loadThemePreference();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadThemePreference]);

  const isDarkMode = manualDarkMode ?? false;
  const palette = useMemo(() => buildPalette(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const attendedRecords = useMemo(() => {
    const now = new Date();
    return records.filter((record) => {
      const parsed = parseRecordDateTime(record.date, record.startTime);
      return parsed ? parsed.getTime() <= now.getTime() : false;
    });
  }, [records]);

  const availableYears = useMemo(() => {
    const years = attendedRecords
      .map((record) => parseInt(record.date.split('.')[0] || '0', 10))
      .filter((year) => Number.isFinite(year) && year > 0)
      .sort((a, b) => a - b);

    if (years.length === 0) {
      const currentYear = new Date().getFullYear();
      return {
        minYear: currentYear,
        maxYear: currentYear,
      };
    }

    return {
      minYear: years[0],
      maxYear: years[years.length - 1],
    };
  }, [attendedRecords]);

  useEffect(() => {
    setSelectedYear((currentYear) => {
      if (currentYear < availableYears.minYear) return availableYears.minYear;
      if (currentYear > availableYears.maxYear) return availableYears.maxYear;
      return currentYear;
    });
  }, [availableYears]);

  const totalSpending = useMemo((): number => {
    return attendedRecords
      .filter((r) => {
        const year = parseInt(r.date.split('.')[0] || '0');
        return year === selectedYear;
      })
      .reduce((sum, r) => {
        const price = typeof r.ticketPrice === 'number' && Number.isFinite(r.ticketPrice) ? r.ticketPrice : 0;
        return sum + price;
      }, 0);
  }, [attendedRecords, selectedYear]);

  const summaryData = useMemo((): SummaryData => {
    const filtered = attendedRecords.filter((r) => {
      const year = parseInt(r.date.split('.')[0] || '0');
      return year === selectedYear;
    });

    const uniqueArtists = new Set<string>();
    const uniqueVenues = new Set<string>();

    filtered.forEach((r) => {
      if (r.artist) uniqueArtists.add(r.artist);
      if (r.venue) uniqueVenues.add(r.venue);
    });

    return {
      totalLives: filtered.length,
      totalArtists: uniqueArtists.size,
      totalVenues: uniqueVenues.size,
    };
  }, [attendedRecords, selectedYear]);

  const monthlyData = useMemo((): MonthlyData[] => {
    const filtered = attendedRecords.filter((r) => {
      const year = parseInt(r.date.split('.')[0] || '0');
      return year === selectedYear;
    });

    const monthCounts: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) {
      monthCounts[i] = 0;
    }

    filtered.forEach((r) => {
      const month = parseInt(r.date.split('.')[1] || '0');
      if (month >= 1 && month <= 12) {
        monthCounts[month]++;
      }
    });

    return Array.from({ length: 12 }, (_, i) => ({
      month: `${i + 1}月`,
      count: monthCounts[i + 1],
    }));
  }, [attendedRecords, selectedYear]);

  const topArtists = useMemo((): TopItem[] => {
    const filtered = attendedRecords.filter((r) => {
      const year = parseInt(r.date.split('.')[0] || '0');
      return year === selectedYear;
    });

    const artistMap: Record<string, { count: number; imageUrl: string }> = {};
    filtered.forEach((r) => {
      const artistName = r.artist?.trim();
      if (artistName) {
        const savedImageUrl = resolveArtistThumbUrl(r.artistImageUrl || r.artistImageUrls?.[0] || '');
        const current = artistMap[artistName];

        if (current) {
          current.count += 1;
          if (!current.imageUrl && savedImageUrl) {
            current.imageUrl = savedImageUrl;
          }
        } else {
          artistMap[artistName] = {
            count: 1,
            imageUrl: savedImageUrl,
          };
        }
      }
    });

    return Object.entries(artistMap)
      .map(([name, value]) => ({ name, count: value.count, imageUrl: value.imageUrl }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [attendedRecords, selectedYear]);

  const topVenues = useMemo((): TopItem[] => {
    const filtered = attendedRecords.filter((r) => {
      const year = parseInt(r.date.split('.')[0] || '0');
      return year === selectedYear;
    });

    const counts: Record<string, number> = {};
    filtered.forEach((r) => {
      if (r.venue) {
        counts[r.venue] = (counts[r.venue] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [attendedRecords, selectedYear]);

  const topSongs = useMemo((): TopItem[] => {
    const filteredRecords = attendedRecords.filter((record) => {
      const year = parseInt(record.date.split('.')[0] || '0', 10);
      return year === selectedYear;
    });

    const songMap: Record<string, { name: string; count: number; imageUrl: string }> = {};

    filteredRecords.forEach((record) => {
      const items = setlists[record.id] || [];

      items.forEach((item) => {
        if (item.type !== 'song' || !item.songName?.trim()) {
          return;
        }

        const key = item.songId || item.songName.trim().toLowerCase();
        const existing = songMap[key];

        if (existing) {
          existing.count += 1;
          if (!existing.imageUrl && item.artworkUrl) {
            existing.imageUrl = item.artworkUrl;
          }
          return;
        }

        songMap[key] = {
          name: item.songName.trim(),
          count: 1,
          imageUrl: item.artworkUrl || '',
        };
      });
    });

    return Object.values(songMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((song) => ({
        name: song.name,
        count: song.count,
        imageUrl: song.imageUrl,
      }));
  }, [attendedRecords, selectedYear, setlists]);

  useEffect(() => {
    let isActive = true;
    const artistNames = topArtists
      .filter((artist) => !artist.imageUrl)
      .map((artist) => artist.name)
      .filter((name) => name && !artistImages[name]);

    if (artistNames.length === 0) {
      return undefined;
    }

    const fetchArtistImages = async () => {
      for (const name of artistNames) {
        const results = await searchAppleMusicArtists(name, APPLE_MUSIC_DEVELOPER_TOKEN, 1);
        const artworkUrl = results[0]?.attributes.artwork?.url;
        const imageUrl = artworkUrl ? getArtworkUrl(artworkUrl, 160) : '';

        if (!isActive) {
          return;
        }

        setArtistImages((current) => {
          if (current[name]) {
            return current;
          }

          return {
            ...current,
            [name]: imageUrl,
          };
        });
      }
    };

    void fetchArtistImages();

    return () => {
      isActive = false;
    };
  }, [artistImages, topArtists]);

  useEffect(() => {
    let isActive = true;
    const songNames = topSongs
      .filter((song) => !song.imageUrl)
      .map((song) => song.name)
      .filter((name) => name && !songImages[name]);

    if (songNames.length === 0) {
      return undefined;
    }

    const fetchSongImages = async () => {
      for (const name of songNames) {
        const results = await searchAppleMusicSongs(name, APPLE_MUSIC_DEVELOPER_TOKEN, 1);
        const artworkUrl = results[0]?.attributes.artwork?.url;
        const imageUrl = artworkUrl ? getArtworkUrl(artworkUrl, 160) : '';

        if (!isActive) {
          return;
        }

        setSongImages((current) => {
          if (current[name]) {
            return current;
          }

          return {
            ...current,
            [name]: imageUrl,
          };
        });
      }
    };

    void fetchSongImages();

    return () => {
      isActive = false;
    };
  }, [songImages, topSongs]);

  const chartData = monthlyData.map((m) => ({
    value: m.count,
    label: m.month,
    labelWidth: 30,
    labelTextStyle: { color: palette.secondaryText, fontSize: 8 },
  }));

  const handlePrevYear = () => {
    setSelectedYear(Math.max(availableYears.minYear, selectedYear - 1));
  };

  const handleNextYear = () => {
    setSelectedYear(Math.min(availableYears.maxYear, selectedYear + 1));
  };

  if (!fontsLoaded) {
    return null;
  }

  const maxMonthValue = Math.max(...monthlyData.map((m) => m.count), 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BlurView tint={isDarkMode ? 'dark' : 'light'} intensity={80} style={styles.glassHeaderShell}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Report</Text>
        </View>

        <View style={styles.yearSelector}>
          <TouchableOpacity
            style={[styles.yearButton, selectedYear <= availableYears.minYear && styles.yearButtonDisabled]}
            onPress={handlePrevYear}
            disabled={selectedYear <= availableYears.minYear}
          >
            <MaterialIcons
              name="chevron-left"
              size={20}
              color={selectedYear <= availableYears.minYear ? palette.yearButtonDisabledIcon : palette.primaryText}
            />
          </TouchableOpacity>
          <Text style={styles.yearDisplay}>{selectedYear}</Text>
          <TouchableOpacity
            style={[styles.yearButton, selectedYear >= availableYears.maxYear && styles.yearButtonDisabled]}
            onPress={handleNextYear}
            disabled={selectedYear >= availableYears.maxYear}
          >
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={selectedYear >= availableYears.maxYear ? palette.yearButtonDisabledIcon : palette.primaryText}
            />
          </TouchableOpacity>
        </View>
      </BlurView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryGrid}>
          <SummaryCard label="live" value={summaryData.totalLives} styles={styles} />
          <SummaryCard label="artists" value={summaryData.totalArtists} styles={styles} />
          <SummaryCard label="venues" value={summaryData.totalVenues} styles={styles} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TOTAL SPENDING</Text>
          <View style={styles.spendingCard}>
            <HugeiconsIcon icon={Wallet03Icon} size={28} color={PRIMARY_COLOR} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={styles.spendingLabel}>{t('statistics.yearlyTotal')}</Text>
              <Text style={styles.spendingAmount}>
                {priceHidden ? '¥ ••••••' : `¥ ${totalSpending.toLocaleString()}`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPriceHidden((v) => !v)} style={styles.spendingToggle}>
              <HugeiconsIcon
                icon={priceHidden ? ViewOffIcon : ViewIcon}
                size={22}
                color={palette.spendingToggle}
                strokeWidth={1.8}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MONTHLY LIVES</Text>
          <View style={styles.chartCard}>
            <BarChart
              data={chartData}
              width={windowWidth - 100}
              barWidth={24}
              spacing={12}
              initialSpacing={8}
              endSpacing={8}
              height={120}
              yAxisLabelWidth={0}
              yAxisThickness={0}
              xAxisThickness={0}
              noOfSections={Math.max(1, Math.ceil(maxMonthValue / 3))}
              maxValue={Math.max(1, Math.ceil(maxMonthValue / 3) * 3)}
              frontColor={PRIMARY_COLOR}
              barBorderRadius={4}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.rankingHeader}>
            <Text style={styles.sectionTitle}>TOP ARTISTS</Text>
          </View>
          <View style={styles.rankingCard}>
            {topArtists.length === 0 ? (
              <Text style={styles.emptyText}>No data</Text>
            ) : (
              topArtists.map((item, idx) => {
                const actualRank = calculateActualRank(topArtists, item.count);
                return (
                  <RankingItem
                    key={idx}
                    rank={actualRank}
                    name={item.name}
                    count={item.count}
                    imageUrl={item.imageUrl || artistImages[item.name]}
                    imageShape="circle"
                    styles={styles}
                  />
                );
              })
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.rankingHeader}>
            <Text style={styles.sectionTitle}>TOP VENUES</Text>
          </View>
          <View style={styles.rankingCard}>
            {topVenues.length === 0 ? (
              <Text style={styles.emptyText}>No data</Text>
            ) : (
              topVenues.map((item, idx) => {
                const actualRank = calculateActualRank(topVenues, item.count);
                return (
                  <RankingItem key={idx} rank={actualRank} name={item.name} count={item.count} styles={styles} />
                );
              })
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.rankingHeader}>
            <Text style={styles.sectionTitle}>TOP SONGS</Text>
          </View>
          <View style={styles.rankingCard}>
            {topSongs.length === 0 ? (
              <Text style={styles.emptyText}>No data</Text>
            ) : (
              topSongs.map((item, idx) => {
                const actualRank = calculateActualRank(topSongs, item.count);
                return (
                  <RankingItem
                    key={`${item.name}-${idx}`}
                    rank={actualRank}
                    name={item.name}
                    count={item.count}
                    imageUrl={item.imageUrl || songImages[item.name]}
                    styles={styles}
                  />
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

interface SummaryCardProps {
  label: string;
  value: number;
  styles: ReturnType<typeof createStyles>;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, styles }) => {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const duration = 900;
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setAnimatedValue(Math.round(value * eased));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    setAnimatedValue(0);
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{animatedValue}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
};

const calculateActualRank = (items: TopItem[], count: number): number => {
  const uniqueCounts = Array.from(new Set(items.map((i) => i.count))).sort((a, b) => b - a);
  const rankIndex = uniqueCounts.indexOf(count);
  return rankIndex + 1;
};

interface RankingItemProps {
  rank: number;
  name: string;
  count: number;
  imageUrl?: string;
  imageShape?: 'circle' | 'square';
  styles: ReturnType<typeof createStyles>;
}

const RankingItem: React.FC<RankingItemProps> = ({ rank, name, count, imageUrl, imageShape = 'square', styles }) => {
  const getRankIcon = (r: number) => {
    if (r === 1) return MedalFirstPlaceIcon;
    if (r === 2) return MedalSecondPlaceIcon;
    if (r === 3) return MedalThirdPlaceIcon;
    return Medal06Icon;
  };

  const getRankIconColor = (r: number) => {
    if (r === 1) return '#A328DD';
    if (r === 2) return '#C06BEA';
    if (r === 3) return '#D39AEF';
    return '#B7B7B7';
  };

  return (
    <View style={styles.rankingItem}>
      <HugeiconsIcon icon={getRankIcon(rank)} size={24} color={getRankIconColor(rank)} strokeWidth={2} />
      {imageUrl !== undefined &&
        (imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.artistThumb, imageShape === 'circle' ? styles.artistThumbCircle : styles.artistThumbSquare]}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.artistThumbPlaceholder,
              imageShape === 'circle' ? styles.artistThumbCircle : styles.artistThumbSquare,
            ]}
          />
        ))}
      <Text style={styles.rankingName}>{name}</Text>
      <Text style={styles.rankingCount}>{count}</Text>
    </View>
  );
};

const createStyles = (palette: StatisticsPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.screenBackground,
  },
  glassHeaderShell: {
    backgroundColor: palette.headerBackground,
    borderBottomWidth: 1,
    borderBottomColor: palette.headerBorder,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 30,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    color: palette.primaryText,
    fontFamily: 'LINESeedJP_800ExtraBold',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 16,
    gap: 20,
  },
  yearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.yearButtonBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.yearButtonBorder,
  },
  yearButtonDisabled: {
    opacity: 0.5,
  },
  yearDisplay: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.primaryText,
    minWidth: 80,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 12,
    gap: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: palette.cardBackground,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '900',
    color: palette.primaryText,
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.secondaryText,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: palette.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  chartCard: {
    backgroundColor: palette.cardBackground,
    borderRadius: 20,
    padding: 20,
    shadowColor: palette.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  rankingCard: {
    backgroundColor: palette.cardBackground,
    borderRadius: 20,
    padding: 20,
    shadowColor: palette.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    gap: 12,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  artistThumb: {
    width: 30,
    height: 30,
    backgroundColor: palette.thumbBackground,
  },
  artistThumbPlaceholder: {
    width: 30,
    height: 30,
    backgroundColor: palette.thumbBackground,
  },
  artistThumbCircle: {
    borderRadius: 15,
  },
  artistThumbSquare: {
    borderRadius: 8,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '900',
  },
  rankingName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: palette.primaryText,
  },
  rankingCount: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.primaryText,
  },
  emptyText: {
    fontSize: 14,
    color: palette.secondaryText,
    textAlign: 'center',
    paddingVertical: 20,
  },
  spendingCard: {
    backgroundColor: palette.cardBackground,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: palette.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  spendingLabel: {
    fontSize: 11,
    color: palette.secondaryText,
    fontWeight: '500',
    marginBottom: 4,
  },
  spendingAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.primaryText,
  },
  spendingToggle: {
    padding: 6,
  },
});

export default StatisticsScreen;
