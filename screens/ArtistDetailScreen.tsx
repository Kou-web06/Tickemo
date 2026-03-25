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
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AiMicIcon, WavingHand02Icon, Wallet01Icon, AppleMusicIcon, SpotifyIcon, LinkSquare01Icon } from '@hugeicons/core-free-icons';
import { useRecords, ChekiRecord } from '../contexts/RecordsContext';
import { TicketDetail } from '../components/TicketDetail';
import { resolveLocalImageUri } from '../lib/imageUpload';
import { getArtworkUrl } from '../utils/appleMusicApi';
import { TicketCard } from '../components/TicketCard';
import { getAppWidth } from '../utils/layout';
import { useTheme } from '../src/theme';
import { getCachedThemePreference, hydrateThemePreference } from '../lib/themePreference';

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

const StatPill: React.FC<{ label: string; value: string; icon: any; isDarkMode: boolean; palette: ArtistDetailPalette; largeValue?: boolean }> = ({ label, value, icon, isDarkMode, palette, largeValue = false }) => (
  <BlurView tint={isDarkMode ? 'dark' : 'light'} intensity={45} style={[styles.statPill, { backgroundColor: palette.statPillBackground, borderColor: palette.statPillBorder }]}>
    <View style={styles.statLabelRow}>
      <HugeiconsIcon icon={icon} size={16} color={palette.statLabel} strokeWidth={2.0} />
      <Text style={[styles.statLabel, { color: palette.statLabel }]}>{label}</Text>
    </View>
    <Text style={[styles.statValue, { color: palette.statValue }, largeValue && styles.statValueLarge]}>{value}</Text>
  </BlurView>
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
  const { isDark: isSystemDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [selectedRecord, setSelectedRecord] = useState<ChekiRecord | null>(null);
  const [manualDarkMode, setManualDarkMode] = useState<boolean | null | undefined>(() => getCachedThemePreference());
  const [musicProvider, setMusicProvider] = useState<MusicProvider>('spotify');
  const isDarkMode = manualDarkMode ?? isSystemDark;
  const palette = useMemo(() => buildArtistDetailPalette(isDarkMode), [isDarkMode]);

  const loadThemePreference = useCallback(async () => {
    const value = await hydrateThemePreference();
    setManualDarkMode(value);
  }, []);

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
    void loadThemePreference();
    void loadMusicProvider();
  }, [loadThemePreference, loadMusicProvider]);

  useFocusEffect(
    useCallback(() => {
      void loadThemePreference();
      void loadMusicProvider();
    }, [loadThemePreference, loadMusicProvider])
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

  const avatarImageUri = useMemo(() => {
    if (heroImageUri) return heroImageUri;

    for (const record of artistRecords) {
      const portraitUri = getArtistPortraitFromRecord(record);
      if (portraitUri) return portraitUri;
    }

    return null;
  }, [artistRecords, heroImageUri, getArtistPortraitFromRecord]);

  const ticketWidth = Math.min(getAppWidth() - 40, windowWidth - 40);
  const heroHeight = 500;

  const heroImageSource = useMemo(
    () => (heroImageUri ? { uri: heroImageUri } : undefined),
    [heroImageUri]
  );

  const avatarImageSource = useMemo(
    () => (avatarImageUri ? { uri: avatarImageUri } : undefined),
    [avatarImageUri]
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
        <View style={styles.avatarOuterRing}>
          <View style={styles.avatarInnerGap}>
            {avatarImageSource ? (
              <Image
                source={avatarImageSource}
                style={styles.avatarImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={28} color="#FFFFFF" />
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.artistName, { color: palette.artistName }]}>{artistName}</Text>

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
          <StatPill icon={AiMicIcon} label="LIVE" value={String(stats.totalLives)} isDarkMode={isDarkMode} palette={palette} largeValue={true} />
          <StatPill icon={WavingHand02Icon} label="FIRST" value={stats.firstLive.replace(/\./g, '/')} isDarkMode={isDarkMode} palette={palette} />
          <StatPill
            icon={Wallet01Icon}
            label="SPENT"
            value={stats.totalSpent > 0 ? `¥${stats.totalSpent.toLocaleString()}` : '¥0'}
            isDarkMode={isDarkMode}
            palette={palette}
            largeValue={true}
          />
        </View>
      </View>
    </View>
  ), [
    avatarImageSource,
    artistName,
    heroImageSource,
    insets.top,
    navigation,
    stats.firstLive,
    stats.totalLives,
    stats.totalSpent,
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

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}> 
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
  avatarOuterRing: {
    width: 126,
    height: 126,
    borderRadius: 63,
    padding: 5,
    borderWidth: 2,
    borderColor: '#FDFDFE',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarInnerGap: {
    flex: 1,
    borderRadius: 55,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 55,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 55,
    backgroundColor: '#5A5A5A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistName: {
    marginTop: 10,
    marginBottom: 5,
    fontSize: 18,
    lineHeight: 34,
    fontWeight: '800',
    color: '#0C0C0D',
    letterSpacing: -0.6,
    textAlign: 'center',
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
    gap: 10,
    width: '100%',
    justifyContent: 'space-between',
  },
  statPill: {
    flex: 1,
    minHeight: 92,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 18, 24, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.86)',
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 14,
    lineHeight: 40,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  statValueLarge: {
    fontSize: 16,
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
