import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, TouchableOpacity, DeviceEventEmitter } from 'react-native';
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
import Svg, { Defs, ClipPath, Path, Image as SvgImage } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
  chipInactiveBackground: isDarkMode ? '#26262C' : '#FFFFFF',
  chipInactiveText: isDarkMode ? '#ECECF1' : '#303030',
  chipShadow: isDarkMode ? '#000000' : '#4D4D4D',
  statsDivider: isDarkMode ? 'rgba(255,255,255,0.20)' : '#D0D0D0',
  statsLabel: isDarkMode ? '#A9A9B2' : '#8C8C8C',
  statsValue: isDarkMode ? '#F5F5F7' : '#333333',
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

type YearFilter = number | 'all';

type TopItem = {
  name: string;
  count: number;
  imageUrl?: string;
};

type ArtistCardItem = {
  name: string;
  imageUrl: string;
  lastLiveAt: Date;
  formattedLastLiveDate: string;
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
    return getArtworkUrl(trimmed, 800);
  }

  return resolveLocalImageUri(trimmed) || '';
};

const formatEnglishDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const StatisticsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
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
  const [selectedYear, setSelectedYear] = useState<YearFilter>('all');
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

  const isDarkMode = manualDarkMode ?? isSystemDark;
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
    const years = Array.from(
      new Set(
        attendedRecords
      .map((record) => parseInt(record.date.split('.')[0] || '0', 10))
          .filter((year) => Number.isFinite(year) && year > 0)
      )
    ).sort((a, b) => b - a);

    return years;
  }, [attendedRecords]);

  useEffect(() => {
    if (selectedYear !== 'all' && !availableYears.includes(selectedYear)) {
      setSelectedYear('all');
    }
  }, [availableYears]);

  const filteredRecords = useMemo(() => {
    if (selectedYear === 'all') {
      return attendedRecords;
    }

    return attendedRecords.filter((record) => {
      const year = parseInt(record.date.split('.')[0] || '0', 10);
      return year === selectedYear;
    });
  }, [attendedRecords, selectedYear]);

  const totalSpending = useMemo((): number => {
    return filteredRecords
      .reduce((sum, r) => {
        const price = typeof r.ticketPrice === 'number' && Number.isFinite(r.ticketPrice) ? r.ticketPrice : 0;
        return sum + price;
      }, 0);
  }, [filteredRecords]);

  const summaryData = useMemo((): SummaryData => {
    const uniqueArtists = new Set<string>();
    const uniqueVenues = new Set<string>();

    filteredRecords.forEach((r) => {
      if (r.artist) uniqueArtists.add(r.artist);
      if (r.venue) uniqueVenues.add(r.venue);
    });

    return {
      totalLives: filteredRecords.length,
      totalArtists: uniqueArtists.size,
      totalVenues: uniqueVenues.size,
    };
  }, [filteredRecords]);

  const monthlyData = useMemo((): MonthlyData[] => {
    const monthCounts: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) {
      monthCounts[i] = 0;
    }

    filteredRecords.forEach((r) => {
      const month = parseInt(r.date.split('.')[1] || '0');
      if (month >= 1 && month <= 12) {
        monthCounts[month]++;
      }
    });

    return Array.from({ length: 12 }, (_, i) => ({
      month: `${i + 1}月`,
      count: monthCounts[i + 1],
    }));
  }, [filteredRecords]);

  const topArtists = useMemo((): TopItem[] => {
    const artistMap: Record<string, { count: number; imageUrl: string }> = {};
    filteredRecords.forEach((r) => {
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
  }, [filteredRecords]);

  const topVenues = useMemo((): TopItem[] => {
    const counts: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      if (r.venue) {
        counts[r.venue] = (counts[r.venue] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [filteredRecords]);

  const topSongs = useMemo((): TopItem[] => {
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
  }, [filteredRecords, setlists]);

  const allArtistCards = useMemo((): ArtistCardItem[] => {
    const artistMap: Record<string, { imageUrl: string; lastLiveAt: Date }> = {};

    filteredRecords.forEach((record) => {
      const artistName = record.artist?.trim();
      if (!artistName) {
        return;
      }

      const parsedDate = parseRecordDateTime(record.date, record.startTime);
      if (!parsedDate) {
        return;
      }

      const savedImageUrl = resolveArtistThumbUrl(record.artistImageUrl || record.artistImageUrls?.[0] || '');
      const existing = artistMap[artistName];

      if (!existing || parsedDate.getTime() > existing.lastLiveAt.getTime()) {
        artistMap[artistName] = {
          imageUrl: savedImageUrl || existing?.imageUrl || '',
          lastLiveAt: parsedDate,
        };
        return;
      }

      if (!existing.imageUrl && savedImageUrl) {
        existing.imageUrl = savedImageUrl;
      }
    });

    return Object.entries(artistMap)
      .map(([name, value]) => ({
        name,
        imageUrl: value.imageUrl,
        lastLiveAt: value.lastLiveAt,
        formattedLastLiveDate: formatEnglishDate(value.lastLiveAt),
      }))
      .sort((a, b) => b.lastLiveAt.getTime() - a.lastLiveAt.getTime());
  }, [filteredRecords]);

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
        const imageUrl = artworkUrl ? getArtworkUrl(artworkUrl, 800) : '';

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

  useEffect(() => {
    let isActive = true;

    const artistNames = allArtistCards
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
        const imageUrl = artworkUrl ? getArtworkUrl(artworkUrl, 800) : '';

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
  }, [allArtistCards, artistImages]);

  const chartData = monthlyData.map((m) => ({
    value: m.count,
    label: m.month,
    labelWidth: 30,
    labelTextStyle: { color: palette.secondaryText, fontSize: 8 },
  }));

  const yearFilterOptions: YearFilter[] = ['all', ...availableYears];

  if (!fontsLoaded) {
    return null;
  }

  const maxMonthValue = Math.max(...monthlyData.map((m) => m.count), 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Report</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {yearFilterOptions.map((option) => {
            const isActive = selectedYear === option;
            const label = option === 'all' ? 'All-Time' : String(option);

            return (
              <TouchableOpacity
                key={String(option)}
                style={[styles.yearChip, isActive && styles.yearChipActive]}
                onPress={() => setSelectedYear(option)}
                activeOpacity={0.86}
              >
                <Text style={[styles.yearChipLabel, isActive && styles.yearChipLabelActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsStrip}>
          <View style={styles.statsColumn}>
            <Text style={styles.statsLabel}>Live</Text>
            <Text style={styles.statsValue}>{summaryData.totalLives}</Text>
            <View style={styles.statsDividerLine} />
          </View>
          <View style={styles.statsColumn}>
            <Text style={styles.statsLabel}>Artists</Text>
            <Text style={styles.statsValue}>{summaryData.totalArtists}</Text>
            <View style={styles.statsDividerLine} />
          </View>
          <View style={styles.statsColumn}>
            <Text style={styles.statsLabel}>Venues</Text>
            <Text style={styles.statsValue}>{summaryData.totalVenues}</Text>
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
            <Text style={styles.sectionTitle}>ALL ARTISTS</Text>
          </View>
          {allArtistCards.length === 0 ? (
            <Text style={styles.emptyText}>No data</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.allArtistsScrollContent}
            >
              {allArtistCards.map((artist) => (
                <ArtistArchiveCard
                  key={artist.name}
                  name={artist.name}
                  dateLabel={artist.formattedLastLiveDate}
                  imageUrl={artist.imageUrl || artistImages[artist.name]}
                  onPress={() => navigation.navigate('ArtistDetail', { artistName: artist.name })}
                />
              ))}
            </ScrollView>
          )}
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
      </ScrollView>
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

interface ArtistArchiveCardProps {
  name: string;
  dateLabel: string;
  imageUrl?: string;
  onPress?: () => void;
}

const RankingItem: React.FC<RankingItemProps> = ({ rank, name, count, imageUrl, imageShape = 'square', styles }) => {
  const getRankIcon = (r: number) => {
    if (r === 1) return MedalFirstPlaceIcon;
    if (r === 2) return MedalSecondPlaceIcon;
    if (r === 3) return MedalThirdPlaceIcon;
    return Medal06Icon;
  };

  const getRankIconColor = (r: number) => {
    if (r === 1) return '#E8D490';
    if (r === 2) return '#C5D1D8';
    if (r === 3) return '#C58A6A';
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

const ArtistArchiveCard: React.FC<ArtistArchiveCardProps> = ({ name, dateLabel, imageUrl, onPress }) => {
  const clipPathId = `artistClipPath-${name.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <TouchableOpacity style={stylesLocal.artistCardWrap} activeOpacity={0.88} onPress={onPress}>
      <Svg width={118} height={121} viewBox="0 0 118 121">
        <Defs>
          <ClipPath id={clipPathId}>
            <Path d="M118 117.37C115.916 117.37 114.205 118.965 114.018 121H108.982C108.795 118.965 107.084 117.37 105 117.37C102.916 117.37 101.205 118.965 101.018 121H95.9824C95.7955 118.965 94.0842 117.37 92 117.37C89.9158 117.37 88.2045 118.965 88.0176 121H82.9824C82.7955 118.965 81.0842 117.37 79 117.37C76.9158 117.37 75.2045 118.965 75.0176 121H69.9824C69.7955 118.965 68.0842 117.37 66 117.37C63.9158 117.37 62.2045 118.965 62.0176 121H56.9824C56.7955 118.965 55.0842 117.37 53 117.37C50.9158 117.37 49.2045 118.965 49.0176 121H43.9824C43.7955 118.965 42.0842 117.37 40 117.37C37.9158 117.37 36.2045 118.965 36.0176 121H30.9824C30.7955 118.965 29.0842 117.37 27 117.37C24.9158 117.37 23.2045 118.965 23.0176 121H17.9824C17.7955 118.965 16.0842 117.37 14 117.37C11.9158 117.37 10.2045 118.965 10.0176 121H4.98242C4.79549 118.965 3.08422 117.37 1 117.37C0.654731 117.37 0.319595 117.414 0 117.496L0 9.98633C5.01428 9.71264 9 5.3463 9 0L108.014 0C108.005 0.165593 108 0.33227 108 0.5C108 5.74671 112.253 10 117.5 10C117.668 10 117.834 9.99492 118 9.98633L118 117.37Z" />
          </ClipPath>
        </Defs>

        <SvgImage
          href={imageUrl || 'https://dummyimage.com/256x256/1f1f24/707070'}
          x={0}
          y={0}
          width={118}
          height={121}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipPathId})`}
        />

        <Path
          d="M118 117.37C115.916 117.37 114.205 118.965 114.018 121H108.982C108.795 118.965 107.084 117.37 105 117.37C102.916 117.37 101.205 118.965 101.018 121H95.9824C95.7955 118.965 94.0842 117.37 92 117.37C89.9158 117.37 88.2045 118.965 88.0176 121H82.9824C82.7955 118.965 81.0842 117.37 79 117.37C76.9158 117.37 75.2045 118.965 75.0176 121H69.9824C69.7955 118.965 68.0842 117.37 66 117.37C63.9158 117.37 62.2045 118.965 62.0176 121H56.9824C56.7955 118.965 55.0842 117.37 53 117.37C50.9158 117.37 49.2045 118.965 49.0176 121H43.9824C43.7955 118.965 42.0842 117.37 40 117.37C37.9158 117.37 36.2045 118.965 36.0176 121H30.9824C30.7955 118.965 29.0842 117.37 27 117.37C24.9158 117.37 23.2045 118.965 23.0176 121H17.9824C17.7955 118.965 16.0842 117.37 14 117.37C11.9158 117.37 10.2045 118.965 10.0176 121H4.98242C4.79549 118.965 3.08422 117.37 1 117.37C0.654731 117.37 0.319595 117.414 0 117.496L0 9.98633C5.01428 9.71264 9 5.3463 9 0L108.014 0C108.005 0.165593 108 0.33227 108 0.5C108 5.74671 112.253 10 117.5 10C117.668 10 117.834 9.99492 118 9.98633L118 117.37Z"
          fill="rgba(0,0,0,0.2)"
        />
      </Svg>

      <View style={stylesLocal.artistCardOverlay}>
        <Text numberOfLines={2} style={stylesLocal.artistCardName}>
          {name}
        </Text>
        <Text numberOfLines={1} style={stylesLocal.artistCardDate}>
          {dateLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const stylesLocal = StyleSheet.create({
  artistCardWrap: {
    width: 118,
    height: 121,
    marginRight: 10,
  },
  artistCardOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 12,
    gap: 2,
  },
  artistCardName: {
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  artistCardDate: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.95,
  },
});

const createStyles = (palette: StatisticsPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.screenBackground,
  },
  headerArea: {
    paddingBottom: 8,
  },
  header: {
    paddingHorizontal: 30,
    paddingTop: 18,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'LINESeedJP_800ExtraBold',
    color: palette.primaryText,
    letterSpacing: 0.2,
  },
  chipsScroll: {
    paddingLeft: 30,
  },
  chipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 30,
    gap: 10,
  },
  yearChip: {
    borderRadius: 999,
    backgroundColor: palette.chipInactiveBackground,
    paddingVertical: 9,
    paddingHorizontal: 18,
    shadowColor: palette.chipShadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  yearChipActive: {
    backgroundColor: '#8B22E2',
  },
  yearChipLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.chipInactiveText,
  },
  yearChipLabelActive: {
    color: '#FFFFFF',
  },
  statsStrip: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 10,
  },
  statsColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
    position: 'relative',
  },
  statsDividerLine: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -20,
    height: 58,
    width: 1,
    backgroundColor: palette.statsDivider,
  },
  statsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.statsLabel,
  },
  statsValue: {
    fontSize: 50,
    fontWeight: '800',
    fontFamily: 'LINESeedJP_800ExtraBold',
    color: palette.statsValue,
    lineHeight: 58,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 8,
    gap: 24,
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
  allArtistsScrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 2,
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
