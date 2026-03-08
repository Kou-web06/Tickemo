import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { BarChart } from 'react-native-gifted-charts';
import Animated, {
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme';
import { useStatistics } from '../hooks/useStatistics';
import { getArtworkUrl, searchAppleMusicArtists } from '../utils/appleMusicApi';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APPLE_MUSIC_DEVELOPER_TOKEN =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMyTVlRNk5WOTYifQ.eyJpc3MiOiJRMkxMMkI3OTJWIiwiaWF0IjoxNzY5ODQ5MDA5LCJleHAiOjE3ODU0MDEwMDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJtZWRpYS5jb20uYW5vbnltb3VzLlRpY2tlbW8ifQ.ect6vO1q3aC9XJVYCUBVLlTHaVEcZebm0-dVZ3ak6uglI33e1ra3qcwkawXaScFFcLB8sgX5TEcFEj9QGF1Z8A';

const TAB_OPTIONS = [
  { key: 'legends', labelKey: 'statistics.tabs.artists' },
  { key: 'history', labelKey: 'statistics.tabs.yearly' },
] as const;

type TabKey = (typeof TAB_OPTIONS)[number]['key'];

const RANK_COLORS = {
  1: '#F7C948',
  2: '#BFC5D2',
  3: '#C58A6A',
};

const RANK_GRADIENTS = {
  1: ['#EBDAA0', '#FFF7DD', '#B0A47C'],
  2: ['#C7D2D9', '#F4F7FA', '#A1AFBA'],
  3: ['#C58A6A', '#FFD7C5', '#776867'],
} as const;

const PODIUM_BASE_HEIGHT = 200;
const PODIUM_MAX_HEIGHT = 280;
const PODIUM_ANIM_DURATION = 1000;
const PODIUM_GAP = theme.spacing.md;
const RANK_HEIGHT_FACTOR = {
  1: 1,
  2: 0.9,
  3: 0.8,
};

const StatisticsScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { topArtists, totalLives, allArtists, yearlyReport } = useStatistics();
  const [activeTab, setActiveTab] = useState<TabKey>('legends');
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [tabLayoutWidth, setTabLayoutWidth] = useState(0);
  const tabTranslateX = useSharedValue(0);
  const chartLift = useSharedValue(0);
  const chartBarWidth = Math.min(28, Math.max(22, windowWidth * 0.07));
  const chartBarSpacing = Math.min(20, Math.max(12, windowWidth * 0.05));
  const chartWidth = windowWidth - theme.spacing.lg * 2;
  const podiumWidth = Math.min(360, windowWidth - theme.spacing.xxl * 2);
  const podiumSlotWidth = (podiumWidth - PODIUM_GAP * 2) / 3;
  const detailSheetHeight = Math.round(windowHeight * 0.45);
  const containerTopPadding = insets.top + Math.max(8, windowHeight * 0.012);
  const legendsBottomPadding = insets.bottom + Math.max(96, windowHeight * 0.12);
  const historyBottomPadding = detailSheetHeight + insets.bottom;
  const [mainValueDisplay, setMainValueDisplay] = useState(0);
  const mainValueFrame = useRef<number | null>(null);

  // 年次レポート通知からの遷移処理
  useEffect(() => {
    const { getGlobalNotification } = require('../contexts/NotificationContext');
    const notification = getGlobalNotification();
    if (notification && notification.kind === 'yearly_report') {
      console.log('[StatisticsScreen] Opening yearly report tab');
      setActiveTab('history');
      // 最新の年度を選択
      const latestYear = yearlyReport[yearlyReport.length - 1]?.year ?? null;
      if (latestYear) {
        setSelectedYear(latestYear);
      }
    }
  }, [yearlyReport]);

  const chartMaxValue = useMemo(() => {
    if (yearlyReport.length === 0) return 12;
    const maxValue = yearlyReport.reduce((max, item) => Math.max(max, item.totalLives), 0);
    const rounded = Math.max(3, Math.ceil(maxValue / 3) * 3);
    return rounded;
  }, [yearlyReport]);

  const rankOne = topArtists[0];
  const rankTwo = topArtists[1];
  const rankThree = topArtists[2];
  const backgroundImageUrl = rankOne?.name ? artistImages[rankOne.name] : null;

  const rankPercents = [rankOne?.percentage, rankTwo?.percentage, rankThree?.percentage]
    .filter((value): value is number => typeof value === 'number')
    .filter((value) => value >= 0);
  const uniquePercents = Array.from(new Set(rankPercents)).sort((a, b) => b - a);

  const getDisplayRank = (value?: number): 1 | 2 | 3 => {
    if (typeof value !== 'number' || value < 0) return 3;
    const index = uniquePercents.indexOf(value) + 1;
    if (index === 1) return 1;
    if (index === 2) return 2;
    return 3;
  };

  const rankTwoDisplayRank = getDisplayRank(rankTwo?.percentage);
  const rankThreeDisplayRank = getDisplayRank(rankThree?.percentage);

  useEffect(() => {
    let isActive = true;
    const namesToFetch = allArtists
      .map((artist) => artist.name)
      .filter((name) => name && !artistImages[name]);

    if (namesToFetch.length === 0) return undefined;

    const fetchArtistImages = async () => {
      for (const name of namesToFetch) {
        try {
          const results = await searchAppleMusicArtists(name, APPLE_MUSIC_DEVELOPER_TOKEN, 1);
          const artwork = results[0]?.attributes.artwork?.url;
          const imageUrl = artwork ? getArtworkUrl(artwork, 300) : '';

          if (isActive) {
            setArtistImages((prev) => {
              if (prev[name]) return prev;
              return {
                ...prev,
                [name]: imageUrl,
              };
            });
          }
        } catch (error) {
          console.warn('[Statistics] Failed to fetch artist image:', name, error);
        }
      }
    };

    fetchArtistImages();

    return () => {
      isActive = false;
    };
  }, [allArtists, artistImages]);

  useEffect(() => {
    if (selectedYear !== null) return;
    const latestWithData = [...yearlyReport]
      .reverse()
      .find((item) => item.totalLives > 0)?.year;
    const fallbackYear = yearlyReport[yearlyReport.length - 1]?.year ?? null;
    setSelectedYear(latestWithData ?? fallbackYear);
  }, [selectedYear, yearlyReport]);

  const tabIndex = useMemo(
    () => TAB_OPTIONS.findIndex((tab) => tab.key === activeTab),
    [activeTab]
  );

  useEffect(() => {
    if (!tabLayoutWidth) return;
    const trackWidth = tabLayoutWidth - 24;
    const tabWidth = trackWidth / TAB_OPTIONS.length;
    tabTranslateX.value = withTiming(tabWidth * tabIndex, { duration: 240 });
  }, [tabIndex, tabLayoutWidth, tabTranslateX]);

  useEffect(() => {
    chartLift.value = withSequence(
      withTiming(12, { duration: 140 }),
      withTiming(0, { duration: 260 })
    );
  }, [chartLift, selectedYear]);

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabTranslateX.value }],
  }));

  const chartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chartLift.value }],
  }));

  const focusedBarIndex = useMemo(() => {
    if (selectedYear === null) return -1;
    return yearlyReport.findIndex((item) => item.year === selectedYear);
  }, [selectedYear, yearlyReport]);

  const activityChartData = useMemo(() => {
    return yearlyReport.map((item) => {
      const isFocused = selectedYear === item.year;
      return {
        value: item.totalLives,
        label: `${item.year}`,
        frontColor: isFocused ? 'rgba(255, 255, 255, 0)' : 'rgba(0, 122, 255, 0)',
        gradientColor: isFocused ? '#FFFFFF' : 'rgba(120, 200, 255, 0.75)',
        labelTextStyle: { color: '#FFFFFF' },
        onPress: () => setSelectedYear(item.year),
      };
    });
  }, [selectedYear, yearlyReport]);

  const selectedYearData = useMemo(() => {
    if (selectedYear === null) return null;
    return yearlyReport.find((item) => item.year === selectedYear) ?? null;
  }, [selectedYear, yearlyReport]);

  const mainValueTarget = selectedYearData?.totalLives ?? 0;

  useEffect(() => {
    if (activeTab !== 'history') {
      return () => {
        if (mainValueFrame.current !== null) {
          cancelAnimationFrame(mainValueFrame.current);
          mainValueFrame.current = null;
        }
      };
    }
    if (mainValueFrame.current !== null) {
      cancelAnimationFrame(mainValueFrame.current);
      mainValueFrame.current = null;
    }
    setMainValueDisplay(0);
    const durationMs = 800;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setMainValueDisplay(Math.round(mainValueTarget * eased));
      if (progress < 1) {
        mainValueFrame.current = requestAnimationFrame(step);
      } else {
        mainValueFrame.current = null;
      }
    };
    mainValueFrame.current = requestAnimationFrame(step);
    return () => {
      if (mainValueFrame.current !== null) {
        cancelAnimationFrame(mainValueFrame.current);
        mainValueFrame.current = null;
      }
    };
  }, [activeTab, mainValueTarget]);

  const yAxisLabelTexts = useMemo(() => {
    const labels = [] as string[];
    for (let value = 0; value <= chartMaxValue; value += 3) {
      labels.push(`${value}`);
    }
    return labels;
  }, [chartMaxValue]);

  return (
    <View style={[styles.container, { paddingTop: containerTopPadding }]}> 
      {backgroundImageUrl ? (
        <>
          <Image
            source={{ uri: backgroundImageUrl }}
            style={styles.backgroundImage}
            cachePolicy="memory-disk"
            transition={0}
          />
          <BlurView intensity={50} tint="dark" style={styles.backgroundBlur} />
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.25)', 'rgba(0, 0, 0, 0.75)', 'rgba(0, 0, 0, 0.95)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.backgroundGradient}
            pointerEvents="none"
          />
        </>
      ) : null}
      <View style={[styles.header, { paddingHorizontal: Math.min(Math.max(windowWidth * 0.06, theme.spacing.lg), theme.spacing.xxl) }]}>
        <Text style={[styles.title, { fontSize: Math.min(32, windowWidth * 0.085) }]}>{t('statistics.title')}</Text>
      </View>

      <View
        style={[styles.tabRow, { width: Math.min(windowWidth * 0.82, 420) }]}
        onLayout={(event) => setTabLayoutWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: tabLayoutWidth ? (tabLayoutWidth - 8) / TAB_OPTIONS.length : 0 },
            tabIndicatorStyle,
          ]}
        />
        {TAB_OPTIONS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={styles.tabPill}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t(tab.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'legends' && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: legendsBottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {totalLives === 0 ? (
            <View style={styles.emptyContainerInline}>
              <Text style={styles.emptyTitle}>{t('statistics.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('statistics.emptySubtitle')}</Text>
            </View>
          ) : (
            <View style={styles.legendsSection}>
              <View style={styles.legendsTitleContainer}>
                <Text style={styles.legendsTitle}>{t('statistics.topArtists')}</Text>
              </View>

              <View style={[styles.podiumRow, { width: podiumWidth }]}>
                <View style={[styles.podiumSideSlot, styles.podiumSideSlotLeft]}>
                  <PodiumBar
                    rank={rankTwoDisplayRank}
                    artist={rankTwo?.name}
                    percentage={rankTwo?.percentage ?? 0}
                    imageUrl={rankTwo?.name ? artistImages[rankTwo.name] : ''}
                    highlight={rankTwoDisplayRank === 1}
                    delay={120}
                    slotWidth={podiumSlotWidth}
                  />
                </View>
                <View style={styles.podiumCenterSlot}>
                  <PodiumBar
                    rank={1}
                    artist={rankOne?.name}
                    percentage={rankOne?.percentage ?? 0}
                    imageUrl={rankOne?.name ? artistImages[rankOne.name] : ''}
                    highlight
                    delay={0}
                    slotWidth={podiumSlotWidth}
                  />
                </View>
                <View style={[styles.podiumSideSlot, styles.podiumSideSlotRight]}>
                  <PodiumBar
                    rank={rankThreeDisplayRank}
                    artist={rankThree?.name}
                    percentage={rankThree?.percentage ?? 0}
                    imageUrl={rankThree?.name ? artistImages[rankThree.name] : ''}
                    highlight={rankThreeDisplayRank === 1}
                    delay={220}
                    slotWidth={podiumSlotWidth}
                  />
                </View>
              </View>

              <Text style={styles.allArtistsTitle}>{t('statistics.allArtists')}</Text>
              <View style={styles.artistList}>
                {allArtists.map((artist, index) => (
                  <Animated.View
                    key={`${artist.name}-${artist.rank}`}
                    entering={FadeInDown.delay(240 + index * 70).duration(420)}
                  >
                    <ArtistListItem
                      name={artist.name}
                      count={artist.count}
                      imageUrl={artistImages[artist.name]}
                    />
                  </Animated.View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'history' && (
        <View style={[styles.historyLayout, { paddingBottom: historyBottomPadding }]}> 
          <View style={styles.chartArea}>
            <Animated.View style={[styles.activityChartWrapper, chartAnimatedStyle]}>
              <BarChart
                data={activityChartData}
                width={chartWidth}
                barWidth={chartBarWidth}
                spacing={chartBarSpacing}
                initialSpacing={12}
                endSpacing={12}
                yAxisLabelWidth={32}
                noOfSections={Math.max(1, Math.floor(chartMaxValue / 3))}
                maxValue={chartMaxValue}
                stepValue={3}
                yAxisLabelTexts={yAxisLabelTexts}
                isAnimated
                animationDuration={700}
                barBorderRadius={4}
                yAxisThickness={0}
                xAxisThickness={0}
                xAxisLabelTextStyle={styles.chartLabelYear}
                yAxisTextStyle={styles.chartLabelYear}
                yAxisTextNumberOfLines={1}
                showGradient
                scrollToEnd
                showScrollIndicator={false}
                rulesType="dashed"
                rulesColor="rgba(255, 255, 255, 0.2)"
                dashWidth={6}
                dashGap={6}
              />
            </Animated.View>
          </View>

          <View
            style={[
              styles.detailSheet,
              {
                height: detailSheetHeight + insets.bottom,
                paddingBottom: theme.spacing.xl + insets.bottom,
              },
            ]}
          >
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailTitle}>{t('statistics.details.title')}</Text>
                <Text style={styles.detailSubtitle}>{selectedYear ?? '--'}</Text>
              </View>
            </View>

            <View style={styles.detailContentRow}>
              <View style={styles.detailMainColumn}>
                <View style={styles.detailMainValueGradient}>
                  <Svg width="100%" height="100%">
                    <Defs>
                      <SvgLinearGradient id="detailMainValueGradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#0A78FF" />
                        <Stop offset="1" stopColor="#FFFFFF" />
                      </SvgLinearGradient>
                    </Defs>
                    <SvgText
                      x="0"
                      y="84"
                      fill="url(#detailMainValueGradient)"
                      fontSize={88}
                      fontWeight="900"
                      letterSpacing={-1}
                    >
                      {mainValueDisplay}
                    </SvgText>
                  </Svg>
                </View>
                <Text style={styles.detailMainLabel}>{t('statistics.details.lives')}</Text>
              </View>
              <View style={styles.detailSideColumn}>
                <View style={styles.detailSideItem}>
                  <Text style={styles.detailSideValue}>
                    {selectedYearData?.activeDays ?? 0} <Text style={styles.detailSideUnit}>{t('statistics.details.days')}</Text>
                  </Text>
                  <Text style={styles.detailSideLabel}>{t('statistics.details.dayActive')}</Text>
                </View>
                <View style={styles.detailSideItem}>
                  <Text style={styles.detailSideValueEmphasis}>
                    {selectedYearData?.topArtist ?? '--'}
                  </Text>
                  <Text style={styles.detailSideLabel}>{t('statistics.details.top')}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

interface PodiumCardProps {
  rank: 1 | 2 | 3;
  artist?: string;
  percentage: number;
  imageUrl?: string;
  highlight?: boolean;
  delay?: number;
  slotWidth: number;
}

const PodiumBar: React.FC<PodiumCardProps> = ({
  rank,
  artist,
  percentage,
  imageUrl,
  highlight,
  delay = 0,
  slotWidth,
}) => {
  const rankColor = RANK_COLORS[rank];
  const isEmpty = !artist;
  const clampedShare = Math.min(100, Math.max(0, percentage));
  const heightFactor = RANK_HEIGHT_FACTOR[rank];
  const targetHeight =
    (PODIUM_BASE_HEIGHT + (PODIUM_MAX_HEIGHT - PODIUM_BASE_HEIGHT) * (clampedShare / 100)) *
    heightFactor;
  const animatedHeight = useSharedValue(0);

  useEffect(() => {
    animatedHeight.value = withDelay(
      delay,
      withTiming(targetHeight, {
        duration: PODIUM_ANIM_DURATION,
        easing: Easing.out(Easing.exp),
      })
    );
  }, [animatedHeight, delay, targetHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  const imageSizeByRank = {
    1: 94,
    2: 68,
    3: 68,
  } as const;
  const imageSize = imageSizeByRank[rank];
  const contentPaddingTop = imageSize + theme.spacing.md;

  return (
    <View
      style={[
        styles.podiumSlot,
        { width: highlight ? slotWidth + theme.spacing.xs : slotWidth },
        highlight && styles.podiumSlotHighlight,
      ]}
    >
      <Text style={styles.podiumArtistLabel} numberOfLines={2}>
        {isEmpty ? '---' : artist}
      </Text>
      <Animated.View
        style={[
          styles.podiumPill,
          rank === 2 && styles.podiumPillRank2,
          rank === 3 && styles.podiumPillRank3,
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {!isEmpty && (
          <View
            style={[
              styles.podiumImageAnchor,
              rank === 2 && styles.podiumImageAnchorRank2,
              rank === 3 && styles.podiumImageAnchorRank3,
              highlight && styles.podiumImageAnchorHighlight,
            ]}
          >
            <LinearGradient
              colors={RANK_GRADIENTS[rank]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.artistImageFrameGradient,
                rank === 1 && styles.artistImageFrameGradientRank1,
                rank === 2 && styles.artistImageFrameGradientRank2,
                rank === 3 && styles.artistImageFrameGradientRank3,
                highlight && styles.artistImageFrameHighlight,
              ]}
            >
              <View
                style={[
                  styles.artistImageFrame,
                  rank === 1 && styles.artistImageFrameRank1,
                  rank === 2 && styles.artistImageFrameRank2,
                  rank === 3 && styles.artistImageFrameRank3,
                ]}
              >
                <View
                  style={[
                    styles.artistImageRing,
                    rank === 1 && styles.artistImageRingRank1,
                    rank === 2 && styles.artistImageRingRank2,
                    rank === 3 && styles.artistImageRingRank3,
                  ]}
                >
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={[
                        styles.artistImage,
                        rank === 1 && styles.artistImageRank1,
                        rank === 2 && styles.artistImageRank2,
                        rank === 3 && styles.artistImageRank3,
                      ]}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.artistImagePlaceholder,
                        rank === 1 && styles.artistImagePlaceholderRank1,
                        rank === 2 && styles.artistImagePlaceholderRank2,
                        rank === 3 && styles.artistImagePlaceholderRank3,
                      ]}
                    />
                  )}
                </View>
                <LinearGradient
                  colors={RANK_GRADIENTS[rank]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.rankBadge,
                    rank === 1 && styles.rankBadgeRank1,
                    rank === 2 && styles.rankBadgeRank2,
                    rank === 3 && styles.rankBadgeRank3,
                  ]}
                >
                  <Text
                    style={[
                      styles.rankText,
                      rank === 1 && styles.rankTextRank1,
                      rank === 2 && styles.rankTextRank2,
                      rank === 3 && styles.rankTextRank3,
                    ]}
                  >
                    {rank}
                  </Text>
                </LinearGradient>
              </View>
            </LinearGradient>
          </View>
        )}
        <View style={[styles.podiumContent, { paddingTop: contentPaddingTop }]}>
          <AnimatedCountText value={clampedShare} delay={delay} highlight={highlight} />
        </View>
      </Animated.View>
    </View>
  );
};

interface AnimatedCountTextProps {
  value: number;
  delay?: number;
  highlight?: boolean;
}

const AnimatedCountText: React.FC<AnimatedCountTextProps> = ({ value, delay = 0, highlight }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    setDisplayValue(0);
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: PODIUM_ANIM_DURATION,
        easing: Easing.out(Easing.exp),
      })
    );
  }, [delay, progress, value]);

  const derivedValue = useDerivedValue(() => Math.round(progress.value * value));

  useAnimatedReaction(
    () => derivedValue.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayValue)(current);
      }
    }
  );

  return (
    <Text style={[styles.podiumPercentage, highlight && styles.podiumPercentageHighlight]}>
      {displayValue}
      <Text style={styles.podiumPercentSymbol}>%</Text>
    </Text>
  );
};

interface AnimatedNumberProps {
  value: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    setDisplayValue(0);
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.exp),
    });
  }, [progress, value]);

  const derivedValue = useDerivedValue(() => Math.round(progress.value * value));

  useAnimatedReaction(
    () => derivedValue.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayValue)(current);
      }
    }
  );

  return <Text style={styles.summaryValue}>{displayValue}</Text>;
};

interface ArtistListItemProps {
  name: string;
  count: number;
  imageUrl?: string;
}

const ArtistListItem: React.FC<ArtistListItemProps> = ({ name, count, imageUrl }) => {
  return (
    <View style={styles.artistRow}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.artistThumb} contentFit="cover" />
      ) : (
        <View style={[styles.artistThumb, styles.artistThumbPlaceholder]} />
      )}
      <View style={styles.artistNamePill}>
        <Text style={styles.artistNameText} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text style={styles.artistLiveCount}>{count} Live</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    paddingTop: 0,
  },
  backgroundImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  backgroundBlur: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  header: {
    paddingHorizontal: theme.spacing.xxl,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.text.primary,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
  },
  tabRow: {
    flexDirection: 'row',
    width: '80%',
    alignSelf: 'center',
    padding: 4,
    paddingHorizontal: 8,
    marginBottom: theme.spacing.lg,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    width: '30%',
    top: 4,
    bottom: 4,
    left: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  tabPill: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  tabTextActive: {
    color: 'rgba(0, 0, 0, 0.85)',
    fontWeight: theme.typography.fontWeight.bold,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.xxl,
    paddingBottom: 0,
    gap: theme.spacing.xxl,
  },
  legendsSection: {
    gap: theme.spacing.xl,
  },
  historyLayout: {
    flex: 1,
    paddingBottom: 0,
  },
  chartArea: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    justifyContent: 'flex-start',
  },
  activityChartWrapper: {
    width: '100%',
  },
  detailSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 0,
    backgroundColor: '#1b1b1b',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: theme.spacing.xl,
    shadowColor: '#6a6a6a',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 18,
  },
  detailTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: theme.colors.text.primary,
  },
  detailSubtitle: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: 600,
    color: theme.colors.text.secondary,
  },
  detailContentRow: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  detailMainColumn: {
    flex: 1,
    marginLeft: 18,
  },
  detailMainValue: {
    fontSize: 88,
    fontWeight: 900,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  detailMainValueGradient: {
    height: 96,
    width: '100%',
  },
  detailMainLabel: {
    marginTop: 3,
    fontSize: theme.typography.fontSize.lg,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: theme.typography.fontWeight.semibold,
  },
  detailSideColumn: {
    flex: 1,
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  detailSideItem: {
    gap: 6,
    marginLeft: -18,
  },
  detailSideValue: {
    fontSize: 38,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  detailSideUnit: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  detailSideValueEmphasis: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  detailSideLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  yearlyChartCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...theme.shadows.card,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  sectionSubtitle: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  chartWrapper: {
    marginTop: theme.spacing.xl,
    alignSelf: 'center',
  },
  chartLabelYear: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSize.xs,
  },
  chartTooltip: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: 'rgba(10, 10, 14, 0.9)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  chartTooltipValue: {
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: theme.typography.fontSize.base,
    textAlign: 'center',
  },
  chartTooltipLabel: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  summaryMainCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
  },
  summarySideColumn: {
    flex: 1,
    gap: theme.spacing.lg,
  },
  summarySmallCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minHeight: 92,
    justifyContent: 'center',
  },
  summaryLabel: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.xs,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  summaryValue: {
    fontSize: 40,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.black,
    letterSpacing: 1,
  },
  summarySubLabel: {
    marginTop: theme.spacing.xs,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
  },
  summaryValueSmall: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  legendsTitleContainer: {
    position: 'relative',
    height: 55,
    justifyContent: 'center',
  },
  legendsTitle: {
    fontSize: 50,
    fontWeight: theme.typography.fontWeight.black,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
    textAlign: 'center',
  },
  legendsTitleGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  legendsHeadline: {
    fontSize: 22,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  sectionCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...theme.shadows.card,
  },
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: PODIUM_GAP,
    paddingHorizontal: theme.spacing.sm,
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  podiumSideSlot: {
    position: 'absolute',
    bottom: 0,
  },
  podiumSideSlotLeft: {
    left: 0,
  },
  podiumSideSlotRight: {
    right: 0,
  },
  podiumCenterSlot: {
    alignItems: 'center',
  },
  podiumSlot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  podiumSlotHighlight: {
    opacity: 1,
  },
  podiumPill: {
    width: '100%',
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  podiumPillRank2: {
    width: '84%',
    alignSelf: 'center',
  },
  podiumPillRank3: {
    width: '84%',
    alignSelf: 'center',
  },
  podiumContent: {
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  podiumArtistLabel: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '900',
    color: theme.colors.text.primary,
    textAlign: 'center',
    minHeight: 32,
    marginBottom: theme.spacing.sm,
  },
  podiumImageAnchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  podiumImageAnchorRank2: {
    top: theme.spacing.sm,
  },
  podiumImageAnchorRank3: {
    top: theme.spacing.sm,
  },
  podiumImageAnchorHighlight: {
    top: theme.spacing.sm,
  },
  artistImageFrameGradient: {
    padding: 2,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistImageFrameGradientRank1: {
    padding: 3,
    borderRadius: 32,
  },
  artistImageFrameGradientRank2: {
    padding: 2,
    borderRadius: 26,
  },
  artistImageFrameGradientRank3: {
    padding: 2,
    borderRadius: 26,
  },
  artistImageFrameRank1: {
    width: 94,
    height: 94,
    borderRadius: 32,
  },
  artistImageFrameRank2: {
    width: 68,
    height: 68,
    borderRadius: 26,
  },
  artistImageFrameRank3: {
    width: 68,
    height: 68,
    borderRadius: 26,
  },
  artistImageFrameHighlight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  artistImageFrame: {
    width: 68,
    height: 68,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistImageRing: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    padding: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  artistImageRingRank1: {
    borderRadius: 32,
    padding: 3,
  },
  artistImageRingRank2: {
    borderRadius: 24,
    padding: 3,
  },
  artistImageRingRank3: {
    borderRadius: 24,
    padding: 3,
  },
  artistImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  artistImageRank1: {
    borderRadius: 28,
  },
  artistImageRank2: {
    borderRadius: 20,
  },
  artistImageRank3: {
    borderRadius: 20,
  },
  artistImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  artistImagePlaceholderRank1: {
    borderRadius: 28,
  },
  artistImagePlaceholderRank2: {
    borderRadius: 20,
  },
  artistImagePlaceholderRank3: {
    borderRadius: 20,
  },
  rankBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  rankBadgeRank1: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  rankBadgeRank2: {
    width: 25,
    height: 25,
    borderRadius: 13,
  },
  rankBadgeRank3: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  rankText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 1,
    fontFamily: 'Anton_400Regular',
    color: '#000',
    textAlign: 'center',
  },
  rankTextRank1: {
    fontSize: 12,
  },
  rankTextRank2: {
    fontSize: 11,
  },
  rankTextRank3: {
    fontSize: 10,
  },
  podiumPercentage: {
    fontSize: 34,
    fontWeight: theme.typography.fontWeight.black,
    fontFamily: 'Anton_400Regular',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1,
    marginTop: theme.spacing.md,
  },
  podiumPercentageHighlight: {
    fontSize: 42,
    color: theme.colors.text.primary,
    fontFamily: 'Anton_400Regular',
  },
  podiumPercentSymbol: {
    fontSize: 20,
    marginLeft: 3,
  },
  allArtistsTitle: {
    fontSize: theme.typography.fontSize.xxxl,
    fontWeight: theme.typography.fontWeight.black,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
    marginTop: theme.spacing.md,
  },
  artistList: {
    gap: theme.spacing.md,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  artistThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: theme.colors.background.secondary,
  },
  artistThumbPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  artistNamePill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  artistNameText: {
    fontSize: 15,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  artistLiveCount: {
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  emptyContainerInline: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default StatisticsScreen;
