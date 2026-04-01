import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  useWindowDimensions,
  DeviceEventEmitter,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AiMicIcon, WavingHand02Icon, Wallet01Icon, AppleMusicIcon, SpotifyIcon, LinkSquare01Icon } from '@hugeicons/core-free-icons';
import { useRecords, ChekiRecord } from '../contexts/RecordsContext';
import { TicketDetail } from '../components/TicketDetail';
import { resolveLocalImageUri } from '../lib/imageUpload';
import { getArtworkUrl } from '../utils/appleMusicApi';
import { TicketCard } from '../components/TicketCard';
import { getAppWidth } from '../utils/layout';

const buildArtistDetailPalette = (isDarkMode: boolean) => ({
  screenBackground: isDarkMode ? '#0F1013' : '#F3F3F6',
  heroBackground: isDarkMode ? '#171A1F' : '#222222',
  heroFallback: isDarkMode ? '#232833' : '#381616',
  artistName: isDarkMode ? '#ECEEF2' : '#0C0C0D',
  backButtonBackground: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.34)',
  backIcon: '#FFFFFF',
  statPillBackground: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(18, 18, 24, 0.58)',
  statPillBorder: isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255, 255, 255, 0.18)',
  statLabel: isDarkMode ? 'rgba(242,244,247,0.9)' : 'rgba(255,255,255,0.86)',
  statValue: '#FFFFFF',
  yearDividerLine: isDarkMode ? '#3A3F49' : '#CECED4',
  yearChipBackground: isDarkMode ? '#2B313B' : '#DEDEE2',
  yearChipText: isDarkMode ? '#D1D7E1' : '#5F5F66',
  emptyText: isDarkMode ? '#A5ADBB' : '#8A8A94',
});

type ArtistDetailPalette = ReturnType<typeof buildArtistDetailPalette>;
type MusicProvider = 'spotify' | 'apple';
const MUSIC_PROVIDER_KEY = '@music_provider';

const StatColumn: React.FC<{
  label: string;
  mainValue: string;
  subValue: string;
  showDivider?: boolean;
}> = ({ label, mainValue, subValue, showDivider = false }) => (
  <View style={[styles.statColumn, showDivider && styles.statColumnWithDivider]}>
    <Text style={styles.statColumnLabel}>{label.toUpperCase()}</Text>
    <Text style={styles.statColumnMainValue}>{mainValue}</Text>
    <Text style={styles.statColumnSubValue}>{subValue}</Text>
  </View>
);

type ArtistDetailListItem =
  | { type: 'divider'; id: string; year: string }
  | { type: 'ticket'; id: string; record: ChekiRecord };

const ArtistDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { artistName } = route.params as { artistName: string };
  const { records } = useRecords();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [selectedRecord, setSelectedRecord] = useState<ChekiRecord | null>(null);
  const [musicProvider, setMusicProvider] = useState<MusicProvider>('spotify');
  const isDarkMode = true;
  const palette = useMemo(() => buildArtistDetailPalette(isDarkMode), [isDarkMode]);

  const loadMusicProvider = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(MUSIC_PROVIDER_KEY);
      if (stored === 'spotify' || stored === 'apple') {
        setMusicProvider(stored);
      }
    } catch {
      setMusicProvider('spotify');
    }
  }, []);

  useEffect(() => {
    void loadMusicProvider();
  }, [loadMusicProvider]);

  useFocusEffect(
    useCallback(() => {
      void loadMusicProvider();
    }, [loadMusicProvider])
  );



  const artistRecords = useMemo(() => {
    return records
      .filter((record) => {
        const names =
          record.artists && record.artists.filter(Boolean).length > 0
            ? record.artists
            : [record.artist ?? ''];
        return names.some((n) => n.trim().toLowerCase() === artistName.toLowerCase());
      })
      .sort((a, b) => {
        const tA = new Date(a.date.replace(/\./g, '-')).getTime();
        const tB = new Date(b.date.replace(/\./g, '-')).getTime();
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });
  }, [records, artistName]);

  const pastArtistRecords = useMemo(() => {
    const now = Date.now();

    return artistRecords.filter((record) => {
      const liveDate = new Date(record.date.replace(/\./g, '-'));
      const [hour, minute] = (record.startTime || '').split(':').map((value) => Number(value));

      if (!Number.isNaN(hour)) {
        liveDate.setHours(hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
      } else {
        // 開演時刻がない場合は当日終了まで未来扱いにして誤集計を防ぐ
        liveDate.setHours(23, 59, 59, 999);
      }

      const timestamp = liveDate.getTime();
      return Number.isFinite(timestamp) && timestamp < now;
    });
  }, [artistRecords]);

  const stats = useMemo(() => {
    const totalLives = pastArtistRecords.length;
    const oldest = [...pastArtistRecords].sort((a, b) => {
      const tA = new Date(a.date.replace(/\./g, '-')).getTime();
      const tB = new Date(b.date.replace(/\./g, '-')).getTime();
      return tA - tB;
    })[0];
    const firstLive = oldest?.date ?? '-';
    const totalSpent = pastArtistRecords.reduce((sum, r) => sum + (r.ticketPrice ?? 0), 0);

    return {
      totalLives,
      firstLive,
      totalSpent,
    };
  }, [pastArtistRecords]);

  const firstLiveDateParts = useMemo(() => {
    if (!stats.firstLive || stats.firstLive === '-') {
      return { main: '-- --', sub: '----' };
    }

    const parsed = new Date(stats.firstLive.replace(/\./g, '-'));
    if (Number.isNaN(parsed.getTime())) {
      return { main: stats.firstLive.replace(/\./g, '/'), sub: 'DATE' };
    }

    const main = parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    });

    return {
      main,
      sub: String(parsed.getFullYear()),
    };
  }, [stats.firstLive]);

  const listData = useMemo<ArtistDetailListItem[]>(() => {
    const items: ArtistDetailListItem[] = [];
    let prevYear: string | null = null;

    artistRecords.forEach((record) => {
      const year = (record.date || '').slice(0, 4) || '-';
      if (year !== prevYear) {
        items.push({ type: 'divider', id: `divider-${year}`, year });
        prevYear = year;
      }

      items.push({
        type: 'ticket',
        id: `ticket-${record.id}`,
        record,
      });
    });

    return items;
  }, [artistRecords]);

  const resolveArtistImageUri = useCallback((rawUri: string, size: number) => {
    const trimmed = rawUri.trim();
    if (!trimmed) return null;

    const sizedUri = /^https?:\/\//.test(trimmed)
      ? getArtworkUrl(trimmed, size)
      : trimmed;

    const resolved = resolveLocalImageUri(sizedUri);
    return resolved || null;
  }, []);

  const getArtistPortraitFromRecord = useCallback((record: ChekiRecord) => {
    const normalizedArtistName = artistName.trim().toLowerCase();
    const artists = (record.artists && record.artists.length > 0
      ? record.artists
      : [record.artist ?? ''])
      .map((name) => name.trim().toLowerCase());

    const matchedIndex = artists.findIndex((name) => name === normalizedArtistName);
    const indexedArtistUri = matchedIndex >= 0
      ? record.artistImageUrls?.[matchedIndex]
      : undefined;

    const candidates = [
      indexedArtistUri,
      record.artistImageUrl,
      record.artistImageUrls?.find((uri) => Boolean(uri && uri.trim())),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const resolved = resolveArtistImageUri(candidate, 900);
      if (resolved) return resolved;
    }

    return null;
  }, [artistName, resolveArtistImageUri]);

  const heroImageUri = useMemo(() => {
    for (const record of artistRecords) {
      const portraitUri = getArtistPortraitFromRecord(record);
      if (portraitUri) return portraitUri;
    }

    return null;
  }, [artistRecords, getArtistPortraitFromRecord]);

  const ticketWidth = Math.min(getAppWidth() - 40, windowWidth - 40);
  const heroHeight = 500;

  const heroImageSource = useMemo(
    () => (heroImageUri ? { uri: heroImageUri } : undefined),
    [heroImageUri]
  );

  const handleSelectRecord = useCallback((record: ChekiRecord) => {
    setSelectedRecord(record);
  }, []);

  const handleOpenProviderPage = useCallback(async () => {
    const searchQuery = encodeURIComponent(artistName);
    let url: string;

    if (musicProvider === 'spotify') {
      url = `spotify:search:${searchQuery}`;
      // Fallback to web URL
      if (!(await Linking.canOpenURL(url))) {
        url = `https://open.spotify.com/search/${searchQuery}`;
      }
    } else {
      url = `https://music.apple.com/search?term=${searchQuery}&entity=artist`;
    }

    try {
      await Linking.openURL(url);
    } catch (_error) {
      // Fallback to web URL if deep link fails
      if (musicProvider === 'spotify') {
        void Linking.openURL(`https://open.spotify.com/search/${searchQuery}`);
      }
    }
  }, [musicProvider, artistName]);

  const listHeader = useMemo(() => (
    <View>
      <View style={[styles.heroSpacer, { height: heroHeight }]} />

      <View style={styles.profileWrap}>
        <Text style={[styles.artistName, { color: palette.artistName }]} numberOfLines={2}>{artistName}</Text>

        <TouchableOpacity
          style={styles.providerCreditBadge}
          onPress={handleOpenProviderPage}
          activeOpacity={0.8}
        >
          <HugeiconsIcon
            icon={musicProvider === 'spotify' ? SpotifyIcon : AppleMusicIcon}
            size={15}
            color="rgba(255,255,255,0.92)"
            strokeWidth={2}
          />
          <Text style={styles.providerCreditText}>{musicProvider === 'spotify' ? 'Spotify' : 'Apple Music'}</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <StatColumn
            label="LIVE"
            mainValue={String(stats.totalLives)}
            subValue="SHOWS"
            showDivider={true}
          />
          <StatColumn
            label="FIRST"
            mainValue={firstLiveDateParts.main}
            subValue={firstLiveDateParts.sub}
            showDivider={true}
          />
          <StatColumn
            label="SPENT"
            mainValue={stats.totalSpent > 0 ? `¥${stats.totalSpent.toLocaleString()}` : '¥0'}
            subValue="JPY"
          />
        </View>
      </View>
    </View>
  ), [
    artistName,
    heroImageSource,
    insets.top,
    navigation,
    stats.firstLive,
    stats.totalLives,
    stats.totalSpent,
    firstLiveDateParts.main,
    firstLiveDateParts.sub,
    isDarkMode,
    palette,
    heroHeight,
    musicProvider,
    handleOpenProviderPage,
  ]);

  const renderListItem = useCallback(
    ({ item }: { item: ArtistDetailListItem }) => {
      if (item.type === 'divider') {
        return (
          <View style={styles.yearDividerRow}>
            <View style={[styles.yearDividerLine, { backgroundColor: palette.yearDividerLine }]} />
            <View style={[styles.yearChip, { backgroundColor: palette.yearChipBackground }]}>
              <Text style={[styles.yearChipText, { color: palette.yearChipText }]}>{item.year}</Text>
            </View>
            <View style={[styles.yearDividerLine, { backgroundColor: palette.yearDividerLine }]} />
          </View>
        );
      }

      return (
        <TouchableOpacity
          style={styles.ticketItemWrap}
          activeOpacity={0.92}
          onPress={() => handleSelectRecord(item.record)}
        >
          <TicketCard record={item.record} width={ticketWidth} />
        </TouchableOpacity>
      );
    },
    [handleSelectRecord, ticketWidth, palette]
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.screenBackground }]}>
      <View style={[styles.heroWrap, { height: heroHeight, backgroundColor: palette.heroBackground }]}>
        {heroImageSource ? (
          <Image
            source={heroImageSource}
            style={styles.heroImage}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.heroFallback, { backgroundColor: palette.heroFallback }]} />
        )}

        <LinearGradient
          colors={
            isDarkMode
              ? (['rgba(15,16,19,0)', 'rgba(15,16,19,0.9)', '#0F1013'] as const)
              : (['rgba(255,255,255,0)', 'rgba(255,255,255,0.92)', '#F3F3F6'] as const)
          }
          locations={[0.44, 0.82, 1]}
          style={styles.heroFade}
        />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top }]}> 
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: palette.backButtonBackground }]}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={palette.backIcon} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderListItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: palette.emptyText }]}>No tickets found for this artist.</Text>
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + 110,
        }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
      />

      {selectedRecord && (
        <Modal
          animationType="fade"
          transparent
          visible
          onRequestClose={() => setSelectedRecord(null)}
        >
          <View style={styles.modalOverlay}>
            <TicketDetail record={selectedRecord} onBack={() => setSelectedRecord(null)} />
          </View>
        </Modal>
      )}
    </View>
  );
};

export default ArtistDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F6',
  },
  heroWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 500,
    backgroundColor: '#222',
    overflow: 'hidden',
    zIndex: 0,
  },
  heroSpacer: {
    width: '100%',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#381616',
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 30,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileWrap: {
    marginTop: -300,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 20,
  },
  artistName: {
    marginTop: 114,
    marginBottom: 12,
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '600',
    color: '#0C0C0D',
    letterSpacing: -0.8,
    textAlign: 'left',
  },
  providerCreditBadge: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(12,12,12,0.38)',
    marginBottom: 10,
    alignSelf: 'center',
  },
  providerCreditText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontFamily: 'LINESeedJP_700Bold',
    letterSpacing: 0.2,
    marginLeft: 6,
  },
  providerCreditActionIcon: {
    marginLeft: 6,
  },
  statsRow: {
    marginTop: 18,
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 16,
  },
  statColumn: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 20,
    paddingRight: 10,
    justifyContent: 'space-between',
    minHeight: 88,
  },
  statColumnWithDivider: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.24)',
  },
  statColumnLabel: {
    fontSize: 11,
    color: '#8C8C8F',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: 'LINESeedJP_700Bold',
  },
  statColumnMainValue: {
    marginTop: 10,
    fontSize: 21,
    color: '#eaeaea',
    fontWeight: '900',
    letterSpacing: -0.2,
    fontFamily: 'LINESeedJP_700Bold',
  },
  statColumnSubValue: {
    marginTop: 8,
    fontSize: 13,
    color: '#8C8C8F',
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: 'LINESeedJP_700Bold',
  },
  yearDividerRow: {
    marginTop: 30,
    marginBottom: 20,
    width: '86%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  yearDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CECED4',
    borderRadius: 999,
  },
  yearChip: {
    paddingHorizontal: 12,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DEDEE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearChipText: {
    fontSize: 13,
    color: '#5F5F66',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ticketItemWrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  separator: {
    height: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 30,
    color: '#8A8A94',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
