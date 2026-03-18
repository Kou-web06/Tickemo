import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AiMicIcon, WavingHand02Icon, Wallet01Icon } from '@hugeicons/core-free-icons';
import { useRecords, ChekiRecord } from '../contexts/RecordsContext';
import { TicketDetail } from '../components/TicketDetail';
import { resolveLocalImageUri } from '../lib/imageUpload';
import { getArtworkUrl } from '../utils/appleMusicApi';
import { TicketCard } from '../components/TicketCard';
import { getAppWidth } from '../utils/layout';

const StatPill: React.FC<{ label: string; value: string; icon: any; largeValue?: boolean }> = ({ label, value, icon, largeValue = false }) => (
  <BlurView tint="dark" intensity={45} style={styles.statPill}>
    <View style={styles.statLabelRow}>
      <HugeiconsIcon icon={icon} size={16} color="rgba(255,255,255,0.86)" strokeWidth={2.0} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
    <Text style={[styles.statValue, largeValue && styles.statValueLarge]}>{value}</Text>
  </BlurView>
);

const ArtistDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { artistName } = route.params as { artistName: string };
  const { records } = useRecords();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [selectedRecord, setSelectedRecord] = useState<ChekiRecord | null>(null);

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

  const stats = useMemo(() => {
    const totalLives = artistRecords.length;
    const oldest = [...artistRecords].sort((a, b) => {
      const tA = new Date(a.date.replace(/\./g, '-')).getTime();
      const tB = new Date(b.date.replace(/\./g, '-')).getTime();
      return tA - tB;
    })[0];
    const firstLive = oldest?.date ?? '-';
    const totalSpent = artistRecords.reduce((sum, r) => sum + (r.ticketPrice ?? 0), 0);
    const yearLabel = (artistRecords[0]?.date || new Date().toISOString().slice(0, 4)).slice(0, 4);

    return {
      totalLives,
      firstLive,
      totalSpent,
      yearLabel,
    };
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

        <Text style={styles.artistName}>{artistName}</Text>

        <View style={styles.statsRow}>
          <StatPill icon={AiMicIcon} label="LIVE" value={String(stats.totalLives)} largeValue={true} />
          <StatPill icon={WavingHand02Icon} label="FIRST" value={stats.firstLive.replace(/\./g, '/')} />
          <StatPill
            icon={Wallet01Icon}
            label="SPENT"
            value={stats.totalSpent > 0 ? `¥${stats.totalSpent.toLocaleString()}` : '¥0'}
            largeValue={true}
          />
        </View>

        <View style={styles.yearDividerRow}>
          <View style={styles.yearDividerLine} />
          <View style={styles.yearChip}>
            <Text style={styles.yearChipText}>{stats.yearLabel}</Text>
          </View>
          <View style={styles.yearDividerLine} />
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
    stats.yearLabel,
    heroHeight,
  ]);

  const handleSelectRecord = useCallback((record: ChekiRecord) => {
    setSelectedRecord(record);
  }, []);

  const renderTicketItem = useCallback(
    ({ item }: { item: ChekiRecord }) => (
      <TouchableOpacity
        style={styles.ticketItemWrap}
        activeOpacity={0.92}
        onPress={() => handleSelectRecord(item)}
      >
        <TicketCard record={item} width={ticketWidth} />
      </TouchableOpacity>
    ),
    [handleSelectRecord, ticketWidth]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.heroWrap, { height: heroHeight }]}>
        {heroImageSource ? (
          <Image
            source={heroImageSource}
            style={styles.heroImage}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.heroFallback} />
        )}

        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.92)', '#F3F3F6']}
          locations={[0.44, 0.82, 1]}
          style={styles.heroFade}
        />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}> 
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={artistRecords}
        keyExtractor={(item) => item.id}
        renderItem={renderTicketItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tickets found for this artist.</Text>
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + 110,
        }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    marginTop: -280,
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
    fontSize: 18,
    lineHeight: 34,
    fontWeight: '800',
    color: '#0C0C0D',
    letterSpacing: -0.6,
    textAlign: 'center',
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
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  yearDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CECED4',
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
