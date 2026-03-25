import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AppleMusicIcon, Delete01Icon, Edit01Icon, NewReleasesIcon, QuoteUpIcon, Share06Icon, SpotifyIcon, Ticket01Icon, Wallet03Icon } from '@hugeicons/core-free-icons';
import QRCode from 'react-native-qrcode-svg';
import { ChekiRecord, useRecords } from '../contexts/RecordsContext';
import LiveEditScreen from '../screens/LiveEditScreen';
import { deleteImage, uploadMultipleImages } from '../lib/imageUpload';
import { getSetlist, saveSetlist } from '../lib/setlistDb';
import { buildSpotifyCommunityFallbackUrl, searchSpotifyTrackId } from '../utils/spotifyApi';
import { getAppleMusicSongUrl, searchAppleMusicSongs } from '../utils/appleMusicApi';
import { LIVE_TYPE_ICON_MAP, normalizeLiveType } from '../utils/liveType';
import ShareImageGenerator from './ShareImageGenerator';
import type { SetlistItem } from '../types/setlist';

interface TicketDetailProps {
  record: ChekiRecord;
  onBack?: () => void;
}

interface LiveInfo {
  name: string;
  artists: string[];
  artist?: string;
  artistImageUrls?: string[];
  liveType?: string;
  artistImageUrl?: string;
  date: Date;
  venue: string;
  seat?: string;
  ticketPrice?: number;
  startTime: string;
  endTime: string;
  imageUrls?: string[];
  qrCode?: string;
  memo?: string;
  detail?: string;
  setlistSongs?: SetlistItem[];
}

const FALLBACK_PRICE = '¥15,000';
const COLLAPSED_TRACK_COUNT = 5;
const MUSIC_PROVIDER_KEY = '@music_provider';
const SEEN_NEW_SETLIST_TRACKS_KEY = '@seen_new_setlist_tracks';
const APPLE_MUSIC_DEVELOPER_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMyTVlRNk5WOTYifQ.eyJpc3MiOiJRMkxMMkI3OTJWIiwiaWF0IjoxNzY5ODQ5MDA5LCJleHAiOjE3ODU0MDEwMDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJtZWRpYS5jb20uYW5vbnltb3VzLlRpY2tlbW8ifQ.ect6vO1q3aC9XJVYCUBVLlTHaVEcZebm0-dVZ3ak6uglI33e1ra3qcwkawXaScFFcLB8sgX5TEcFEj9QGF1Z8A';

type MusicProvider = 'spotify' | 'apple';

const parseDateParts = (dateText?: string) => {
  const [year = '----', month = '--', day = '--'] = (dateText || '').split('.');

  let weekday = '';
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  if (Number.isFinite(numericYear) && Number.isFinite(numericMonth) && Number.isFinite(numericDay)) {
    const date = new Date(numericYear, numericMonth - 1, numericDay);
    const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    weekday = WEEKDAYS[date.getDay()] || '';
  }

  return {
    year,
    monthDay: `${Number(month) || '--'}.${Number(day) || '--'}`,
    weekday,
  };
};

const getSetlistLabel = (item: SetlistItem) => {
  if (item.type === 'song') {
    return item.songName;
  }
  return item.title;
};

const SETLIST_MARKER_KEYWORDS = ['SE', 'MC', 'ENCORE', 'SETTION', 'SECTION'];

const isSetlistMarkerLabel = (label: string) => {
  const normalized = label.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return SETLIST_MARKER_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const isSetlistMarkerItem = (item: SetlistItem) => {
  if (item.type !== 'song') {
    return true;
  }
  return isSetlistMarkerLabel(getSetlistLabel(item));
};

const getDisplayPrice = (record: ChekiRecord) => {
  const source = `${record.detail || ''} ${record.memo || ''}`;
  const matched = source.match(/([¥$€]\s?\d{1,3}(?:[,\.]\d{3})*)/);
  return matched?.[1] || FALLBACK_PRICE;
};

const toUrlLikeValue = (value?: string) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
};

const toSetlistSongKey = (songName: string, artistName?: string) => {
  return `${songName.trim().toLowerCase()}::${(artistName || '').trim().toLowerCase()}`;
};

const LIVE_TYPE_EN_LABEL_MAP: Record<string, string> = {
  'one-man': 'One-man',
  'two-man': 'Two-man',
  festival: 'Festival',
  'fc-only': 'FC Only',
  streaming: 'Streaming',
};

export const TicketDetail: React.FC<TicketDetailProps> = ({ record, onBack }) => {
  const { updateRecord, deleteRecord } = useRecords();
  const [setlistSongs, setSetlistSongs] = useState<SetlistItem[]>([]);
  const [isSetlistExpanded, setIsSetlistExpanded] = useState(false);
  const [showEditScreen, setShowEditScreen] = useState(false);
  const [showShareGenerator, setShowShareGenerator] = useState(false);
  const [musicProvider, setMusicProvider] = useState<MusicProvider>('spotify');
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [seenNewSongKeys, setSeenNewSongKeys] = useState<Set<string>>(new Set());
  const [hasLoadedSeenNewSongKeys, setHasLoadedSeenNewSongKeys] = useState(false);
  const sheetTranslateY = useState(new Animated.Value(Dimensions.get('window').height))[0];
  const pendingSeenSongKeysRef = useRef<Set<string>>(new Set());

  const memoText = (record.memo || '').trim();
  const imageUri = record.imageUrls?.[0] || '';
  const qrValue = useMemo(() => toUrlLikeValue(record.qrCode), [record.qrCode]);
  const displayArtists = useMemo(() => {
    const source = record.artists && record.artists.length > 0
      ? record.artists
      : [record.artist || '-'];

    const unique: string[] = [];
    for (const name of source) {
      const trimmed = (name || '').trim();
      if (!trimmed) continue;
      if (!unique.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        unique.push(trimmed);
      }
    }

    return unique.length > 0 ? unique : ['-'];
  }, [record.artist, record.artists]);
  const liveTypeKey = useMemo(() => normalizeLiveType(record.liveType), [record.liveType]);
  const liveTypeLabel = LIVE_TYPE_EN_LABEL_MAP[liveTypeKey] || LIVE_TYPE_EN_LABEL_MAP['one-man'];

  const { year, monthDay, weekday } = useMemo(() => parseDateParts(record.date), [record.date]);
  const priceText = useMemo(() => getDisplayPrice(record), [record]);

  const openTime = record.startTime || '--:--';
  const startTime = record.endTime || record.startTime || '--:--';

  const sortedSetlist = useMemo(
    () => [...setlistSongs].sort((a, b) => a.orderIndex - b.orderIndex),
    [setlistSongs]
  );

  const songCount = useMemo(
    () => sortedSetlist.filter((item) => !isSetlistMarkerItem(item)).length,
    [sortedSetlist]
  );

  const visibleSetlist = useMemo(() => {
    if (isSetlistExpanded) {
      return sortedSetlist;
    }

    let countedSongs = 0;
    const clipped: SetlistItem[] = [];

    for (const item of sortedSetlist) {
      const isMarker = isSetlistMarkerItem(item);
      if (!isMarker) {
        if (countedSongs >= COLLAPSED_TRACK_COUNT) {
          break;
        }
        countedSongs += 1;
      }
      clipped.push(item);
    }

    return clipped;
  }, [isSetlistExpanded, sortedSetlist]);

  const setlistArtistNames = useMemo(() => {
    const base = record.artists && record.artists.length > 0
      ? record.artists
      : [record.artist || ''];

    const unique: string[] = [];
    for (const name of base) {
      const trimmed = (name || '').trim();
      if (!trimmed) continue;
      if (!unique.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        unique.push(trimmed);
      }
    }

    return unique;
  }, [record.artist, record.artists]);

  const groupedVisibleSetlist = useMemo(() => {
    if (setlistArtistNames.length <= 1) {
      return null;
    }

    const grouped = new Map<string, SetlistItem[]>();
    for (const artistName of setlistArtistNames) {
      grouped.set(artistName, []);
    }

    const normalize = (value: string) => value.trim().toLowerCase();
    let currentArtist = setlistArtistNames[0];

    for (const item of visibleSetlist) {
      if (item.type === 'song') {
        const itemArtist = (item.artistName || '').trim();
        const matchedArtist = setlistArtistNames.find((name) => normalize(name) === normalize(itemArtist));
        const targetArtist = matchedArtist || currentArtist;
        currentArtist = targetArtist;
        grouped.get(targetArtist)?.push(item);
      } else {
        grouped.get(currentArtist)?.push(item);
      }
    }

    return setlistArtistNames
      .map((artistName) => ({
        artistName,
        items: grouped.get(artistName) || [],
      }))
      .filter((group) => group.items.length > 0);
  }, [setlistArtistNames, visibleSetlist]);

  const lastVisibleSongId = useMemo(() => {
    for (let i = visibleSetlist.length - 1; i >= 0; i -= 1) {
      const item = visibleSetlist[i];
      if (!isSetlistMarkerItem(item)) {
        return item.id;
      }
    }
    return null;
  }, [visibleSetlist]);

  const firstAppearanceSongIdToKey = useMemo(() => {
    const seenKeys = new Set<string>();
    const firstIdToKey = new Map<string, string>();

    for (const item of sortedSetlist) {
      if (item.type !== 'song' || isSetlistMarkerItem(item)) {
        continue;
      }

      const key = toSetlistSongKey(item.songName, item.artistName);
      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      firstIdToKey.set(item.id, key);
    }

    return firstIdToKey;
  }, [sortedSetlist]);

  const newBadgeSongIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, key] of firstAppearanceSongIdToKey.entries()) {
      if (!seenNewSongKeys.has(key)) {
        ids.add(id);
      }
    }
    return ids;
  }, [firstAppearanceSongIdToKey, seenNewSongKeys]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 42,
      friction: 9,
    }).start();
  }, [sheetTranslateY]);

  useEffect(() => {
    let mounted = true;

    const loadSetlist = async () => {
      try {
        const songs = await getSetlist(record.id);
        if (mounted) {
          setSetlistSongs(songs);
        }
      } catch (error) {
        console.error('[TicketDetail] セットリスト読み込みエラー:', error);
        if (mounted) {
          setSetlistSongs([]);
        }
      }
    };

    loadSetlist();

    return () => {
      mounted = false;
    };
  }, [record.id]);

  useEffect(() => {
    let mounted = true;

    const loadSeenNewSongKeys = async () => {
      try {
        const stored = await AsyncStorage.getItem(SEEN_NEW_SETLIST_TRACKS_KEY);
        if (!mounted) return;

        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          setSeenNewSongKeys(new Set(parsed));
        }
      } catch (error) {
        console.warn('[TicketDetail] Failed to load seen new setlist tracks:', error);
      } finally {
        if (mounted) {
          setHasLoadedSeenNewSongKeys(true);
        }
      }
    };

    void loadSeenNewSongKeys();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSeenNewSongKeys) return;

    for (const id of newBadgeSongIds) {
      const key = firstAppearanceSongIdToKey.get(id);
      if (!key) continue;
      pendingSeenSongKeysRef.current.add(key);
    }
  }, [firstAppearanceSongIdToKey, hasLoadedSeenNewSongKeys, newBadgeSongIds]);

  useEffect(() => {
    return () => {
      const pending = pendingSeenSongKeysRef.current;
      if (pending.size === 0) return;

      const persistSeenNewSongKeys = async () => {
        try {
          const stored = await AsyncStorage.getItem(SEEN_NEW_SETLIST_TRACKS_KEY);
          const existing = stored ? (JSON.parse(stored) as string[]) : [];
          const merged = new Set(existing);
          for (const key of pending) {
            merged.add(key);
          }
          await AsyncStorage.setItem(SEEN_NEW_SETLIST_TRACKS_KEY, JSON.stringify(Array.from(merged)));
        } catch (error) {
          console.warn('[TicketDetail] Failed to persist seen new setlist tracks:', error);
        }
      };

      void persistSeenNewSongKeys();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadMusicProvider = async () => {
      try {
        const stored = await AsyncStorage.getItem(MUSIC_PROVIDER_KEY);
        if (!mounted) return;
        if (stored === 'spotify' || stored === 'apple') {
          setMusicProvider(stored);
          return;
        }
        setMusicProvider('spotify');
      } catch (error) {
        if (mounted) {
          setMusicProvider('spotify');
        }
      }
    };

    loadMusicProvider();

    return () => {
      mounted = false;
    };
  }, []);

  const handleClosePress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Hapticsが失敗しても画面遷移は継続
    }

    Animated.timing(sheetTranslateY, {
      toValue: Dimensions.get('window').height,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onBack?.();
    });
  };

  const handleUnpackPress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Hapticsが失敗しても展開は継続
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSetlistExpanded(true);
  };

  const handleDeletePress = () => {
    Alert.alert(
      '本当に削除しますか？',
      `${record.liveName || 'このライブ'}を記録から削除します。この操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (error) {
              // Hapticsが失敗しても削除は継続
            }
            await deleteRecord(record.id);
            handleClosePress();
          },
        },
      ]
    );
  };

  const handleEditPress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Hapticsが失敗しても編集遷移は継続
    }
    setShowEditScreen(true);
  };

  const handleSharePress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Hapticsが失敗しても共有遷移は継続
    }
    setShowShareGenerator(true);
  };

  const handleSaveLiveInfo = async (info: LiveInfo) => {
    try {
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}.${month}.${day}`;
      };

      const userId = 'local-user';
      let uploadedImageUrls: string[] = [];

      if (info.imageUrls && info.imageUrls.length > 0) {
        uploadedImageUrls.push(...info.imageUrls.filter((uri) => !uri.startsWith('file://')));
        const newImageFileUris = info.imageUrls.filter((uri) => uri.startsWith('file://'));
        if (newImageFileUris.length > 0) {
          const uploadResult = await uploadMultipleImages(newImageFileUris, userId, record.id);
          uploadedImageUrls.push(...uploadResult.imageUrls);
        }
      }

      if (uploadedImageUrls.length > 0 && record.imageUrls?.length) {
        for (const oldImageUrl of record.imageUrls) {
          try {
            await deleteImage(oldImageUrl);
          } catch (error) {
            // 画像削除失敗時も更新処理は継続
          }
        }
      }

      const updatedRecord: ChekiRecord = {
        ...record,
        artist: info.artist,
        artists: info.artists ?? record.artists,
        artistImageUrl: info.artistImageUrl || record.artistImageUrl,
        artistImageUrls: info.artistImageUrls ?? record.artistImageUrls,
        liveType: info.liveType || record.liveType,
        liveName: info.name,
        date: formatDate(info.date),
        venue: info.venue,
        seat: info.seat,
        ticketPrice: info.ticketPrice ?? record.ticketPrice,
        startTime: info.startTime,
        endTime: info.endTime,
        imageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : (info.imageUrls || record.imageUrls || []),
        memo: info.memo ?? record.memo,
        detail: info.detail ?? record.detail,
        qrCode: info.qrCode ?? record.qrCode,
      };

      await updateRecord(record.id, updatedRecord);

      if (info.setlistSongs) {
        await saveSetlist(record.id, info.setlistSongs);
      }
    } catch (error) {
      console.error('[TicketDetail] ライブ情報保存エラー:', error);
      Alert.alert('エラー', 'ライブ情報の保存に失敗しました。もう一度お試しください。');
    }
  };

  const handleOpenSongWithProvider = async (item: SetlistItem) => {
    if (item.type !== 'song') {
      return;
    }

    if (loadingTrackId) {
      return;
    }

    const songName = item.songName?.trim();
    const artistName = (item.artistName || record.artist || '').trim();
    if (!songName) {
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Hapticsが失敗しても処理は継続
    }

    setLoadingTrackId(item.id);

    try {
      if (musicProvider === 'spotify') {
        try {
          const trackId = await searchSpotifyTrackId(songName, artistName);
          if (trackId) {
            const appUrl = `spotify:track:${trackId}`;
            const webUrl = buildSpotifyCommunityFallbackUrl(trackId);

            try {
              const canOpenApp = await Linking.canOpenURL(appUrl);
              await Linking.openURL(canOpenApp ? appUrl : webUrl);
            } catch {
              await Linking.openURL(webUrl);
            }
            return;
          }
        } catch (searchError) {
          console.warn('[TicketDetail] Spotify search failed, using web search fallback:', searchError);
          // Fall through to web search fallback
        }

        // Fallback: Open Spotify web search with song + artist name
        const searchQuery = `${songName} ${artistName}`.trim();
        const webSearchUrl = `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}/songs`;
        await Linking.openURL(webSearchUrl);
      } else {
        // Apple Music API doesn't support "artist:" prefix syntax; use simple full-text search
        const query = `${songName} ${artistName}`.trim();
        const songs = await searchAppleMusicSongs(query, APPLE_MUSIC_DEVELOPER_TOKEN, 1);
        const first = songs[0];
        const songId = first?.id;
        const webUrl = songId ? getAppleMusicSongUrl(songId) : first?.attributes?.url;
        if (webUrl) {
          await Linking.openURL(webUrl);
          return;
        }

        // Fallback: Open Apple Music web search
        const webSearchUrl = `https://music.apple.com/search?term=${encodeURIComponent(query)}`;
        await Linking.openURL(webSearchUrl);
      }
    } catch (error) {
      console.error('[TicketDetail] 曲リンクオープンエラー:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      Alert.alert('SYSTEM ERROR', `[ // TRACK LINK ABORTED ]\n${errorMessage}`);
    } finally {
      setLoadingTrackId(null);
    }
  };

  const handleOpenQrLink = async () => {
    if (!qrValue) {
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Hapticsが失敗してもリンク遷移は継続
    }

    try {
      const canOpen = await Linking.canOpenURL(qrValue);
      if (!canOpen) {
        Alert.alert('Unable to open', 'QR code URL is invalid.');
        return;
      }

      await Linking.openURL(qrValue);
    } catch (error) {
      console.error('[TicketDetail] QRリンクオープンエラー:', error);
      Alert.alert('SYSTEM ERROR', '[ // QR LINK ABORTED ]');
    }
  };

  return (
    <Animated.View
      style={[
        styles.sheetShell,
        {
          transform: [{ translateY: sheetTranslateY }],
        },
      ]}
    >
      <View style={styles.root}>
        <TouchableOpacity style={styles.closeButton} activeOpacity={0.82} onPress={handleClosePress}>
          <Ionicons name="close" size={34} color="#B7B7B7" />
        </TouchableOpacity>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <View style={[styles.coverImage, styles.emptyCover]}>
              <Text style={styles.emptyCoverText}>NO IMAGE</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.qrBox}
            activeOpacity={qrValue ? 0.75 : 1}
            disabled={!qrValue}
            onPress={() => {
              void handleOpenQrLink();
            }}
          >
            {qrValue ? (
              <QRCode value={qrValue} size={56} color="#1A1A1A" backgroundColor="#FFFFFF" />
            ) : (
              <Image source={require('../assets/no-qr.png')} style={styles.qrFallback} contentFit="contain" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.liveName}>{record.liveName || '-'}</Text>

          <View style={styles.artistPriceRow}>
            <View style={styles.artistMetaBlock}>
              <Text style={styles.artistName} numberOfLines={2}>
                {displayArtists.join(' / ')}
              </Text>
              <View style={styles.liveTypeBadge}>
                <MaterialCommunityIcons
                  name={LIVE_TYPE_ICON_MAP[liveTypeKey] as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={14}
                  color="#7C7C84"
                />
                <Text style={styles.liveTypeBadgeText}>{liveTypeLabel}</Text>
              </View>
            </View>
            <View style={styles.priceWrap}>
              <HugeiconsIcon icon={Wallet03Icon} size={22} color="#9D9D9D" strokeWidth={1.8} />
              <Text style={styles.priceText}>{priceText}</Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.leftCol}>
              <Text style={styles.yearText}>{year}</Text>
              <View style={styles.monthDayRow}>
                <Text style={styles.monthDayText}>{monthDay}</Text>
                {weekday ? <Text style={styles.weekdayText}>{weekday}</Text> : null}
              </View>
              <Text style={styles.venueText}>{record.venue || '-'}</Text>
            </View>

            <View style={styles.rightCol}>
              <View style={styles.timeLine}>
                <Text style={styles.timeLabel}>OPEN</Text>
                <Text style={styles.timeValue}>{openTime}</Text>
              </View>
              <View style={styles.timeLine}>
                <Text style={styles.timeLabel}>START</Text>
                <Text style={styles.timeValue}>{startTime}</Text>
              </View>
            </View>
          </View>

          {sortedSetlist.length > 0 && (() => {
            const renderSetlistItems = (items: SetlistItem[], keyPrefix = '') => {
              let songIndex = 0;

              return items.map((item) => {
                const label = getSetlistLabel(item);
                const isMarker = isSetlistMarkerItem(item);

                if (isMarker) {
                  return (
                    <Text key={`${keyPrefix}${item.id}`} style={styles.trackMarkerText}>
                      {label}
                    </Text>
                  );
                }

                songIndex += 1;
                const isFirstAppearance = newBadgeSongIds.has(item.id);

                return (
                  <View key={`${keyPrefix}${item.id}`} style={styles.trackItem}>
                    <Text style={styles.trackNo}>{String(songIndex).padStart(2, '0')}</Text>
                    <View style={styles.trackInfoWrap}>
                      <Text style={styles.trackName} numberOfLines={1}>
                        {label}
                      </Text>
                      {isFirstAppearance ? (
                        <View style={styles.trackNewBadge}>
                          <Text style={styles.trackNewBadgeText}>new</Text>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.trackOpenButton}
                      activeOpacity={0.7}
                      disabled={loadingTrackId !== null}
                      onPress={() => {
                        void handleOpenSongWithProvider(item);
                      }}
                    >
                      {loadingTrackId === item.id ? (
                        <ActivityIndicator size="small" color="#8A8A8F" />
                      ) : (
                        <HugeiconsIcon
                          icon={musicProvider === 'spotify' ? SpotifyIcon : AppleMusicIcon}
                          size={18}
                          color={musicProvider === 'spotify' ? '#1DB954' : '#FA243C'}
                          strokeWidth={2}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              });
            };

            if (groupedVisibleSetlist && groupedVisibleSetlist.length > 0) {
              return groupedVisibleSetlist.map((group, index) => (
                <View key={group.artistName} style={[styles.sectionBlock, index > 0 && styles.sectionBlockCompact]}>
                  <View style={styles.sectionTitleGroup}>
                    <Text style={styles.sectionTitle}>#set list</Text>
                    <Text style={styles.setlistSectionArtist}>{group.artistName}</Text>
                  </View>

                  <View style={styles.setlistContainer}>
                    {renderSetlistItems(group.items, `${group.artistName}-`)}

                    {!isSetlistExpanded && songCount > COLLAPSED_TRACK_COUNT && group.items.some((item) => item.id === lastVisibleSongId) && (
                      <TouchableOpacity style={styles.unpackButton} activeOpacity={0.75} onPress={handleUnpackPress}>
                        <Text style={styles.unpackButtonText}>
                          [ + UNPACK ALL {songCount} TRACKS ]
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ));
            }

            return (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>#set list</Text>
                </View>

                <View style={styles.setlistContainer}>
                  {renderSetlistItems(visibleSetlist)}

                  {!isSetlistExpanded && songCount > COLLAPSED_TRACK_COUNT && (
                    <TouchableOpacity style={styles.unpackButton} activeOpacity={0.75} onPress={handleUnpackPress}>
                      <Text style={styles.unpackButtonText}>
                        [ + UNPACK ALL {songCount} TRACKS ]
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}

          {memoText.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>#memo</Text>
              <View style={styles.memoRow}>
                <HugeiconsIcon icon={QuoteUpIcon} size={20} color="#9B9B9B" strokeWidth={1.8} />
                <Text style={styles.memoText}>{memoText}</Text>
              </View>
            </View>
          )}
        </View>
        </ScrollView>

        <View style={styles.footerTab}>
          <TouchableOpacity style={styles.footerButton} activeOpacity={0.8} onPress={handleSharePress}>
            <HugeiconsIcon icon={Share06Icon} size={22} color="#5D5D62" strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerButton} activeOpacity={0.8} onPress={handleEditPress}>
            <HugeiconsIcon icon={Edit01Icon} size={22} color="#5D5D62" strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerButton} activeOpacity={0.8} onPress={handleDeletePress}>
            <HugeiconsIcon icon={Delete01Icon} size={22} color="#f55632" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showEditScreen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditScreen(false)}
      >
        <LiveEditScreen
          initialData={{
            name: record.liveName,
            artists: record.artists && record.artists.length > 0 ? record.artists : [record.artist || ''],
            artist: record.artist || '',
            artistImageUrls: record.artistImageUrls,
            liveType: record.liveType,
            artistImageUrl: record.artistImageUrl,
            date: new Date(record.date.replace(/\./g, '-')),
            venue: record.venue || '',
            seat: record.seat,
            ticketPrice: record.ticketPrice,
            startTime: record.startTime || '18:00',
            endTime: record.endTime || '20:00',
            imageUrls: record.imageUrls,
            qrCode: record.qrCode,
            memo: record.memo,
            detail: record.detail,
            setlistSongs,
          }}
          onSave={handleSaveLiveInfo}
          onCancel={() => setShowEditScreen(false)}
        />
      </Modal>

      <ShareImageGenerator
        record={record}
        visible={showShareGenerator}
        onClose={() => setShowShareGenerator(false)}
      />
    </Animated.View>
  );
};

export default TicketDetail;

const styles = StyleSheet.create({
  sheetShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '95%',
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    overflow: 'hidden',
  },
  root: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  headerWrap: {
    width: '100%',
    aspectRatio: 1.11,
    backgroundColor: '#D6D6D6',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  emptyCover: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCoverText: {
    fontSize: 16,
    color: '#7F7F7F',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  qrBox: {
    position: 'absolute',
    right: 12,
    bottom: 14,
    padding: 8,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  qrFallback: {
    width: 56,
    height: 56,
  },
  body: {
    paddingHorizontal: 22,
    paddingTop: 26,
  },
  liveName: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '900',
    color: '#2B2B2E',
    letterSpacing: 0.1,
  },
  artistPriceRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  artistMetaBlock: {
    flex: 1,
    paddingRight: 8,
  },
  artistName: {
    color: '#8E8E93',
    fontSize: 17,
    fontWeight: '600',
  },
  liveTypeBadge: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveTypeBadgeText: {
    color: '#7C7C84',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  priceText: {
    color: '#8A8A8A',
    fontSize: 17,
    fontWeight: '800',
  },
  gridRow: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  leftCol: {
    flex: 1,
  },
  yearText: {
    color: '#8F8F95',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontVariant: ['tabular-nums'],
  },
  monthDayText: {
    marginTop: 2,
    color: '#303036',
    fontSize: 52,
    lineHeight: 56,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  monthDayRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  weekdayText: {
    marginTop: 10,
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  venueText: {
    marginTop: 4,
    color: '#2F2F34',
    fontSize: 16,
    lineHeight: 30,
    fontWeight: '800',
  },
  rightCol: {
    justifyContent: 'center',
    minWidth: 144,
    paddingTop: 10,
    gap: 16,
  },
  timeLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 14,
  },
  timeLabel: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timeValue: {
    color: '#2E2E33',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  sectionBlock: {
    marginTop: 60,
  },
  sectionBlockCompact: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#2E2E32',
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  setlistSectionArtist: {
    fontSize: 12,
    color: '#5D5D62',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontWeight: '800',
    marginTop: 4,
  },
  sectionTitleGroup: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  setlistContainer: {
    marginTop: 12,
    backgroundColor: '#ededed',
    borderRadius: 14,
    padding: 12,
  },
  trackItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  trackNo: {
    width: 36,
    color: '#8b8b94',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  trackInfoWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  trackName: {
    flex: 1,
    color: '#343439',
    fontSize: 15,
    fontWeight: '800',
  },
  trackNewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f5e9fa',
  },
  trackNewBadgeText: {
    color: '#A328DD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  trackOpenButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  trackMarkerText: {
    color: '#6D6D72',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  unpackButton: {
    marginTop: 4,
    paddingVertical: 8,
    alignItems: 'center',
  },
  unpackButtonText: {
    color: '#5A5A5F',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  memoRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingRight: 8,
  },
  memoText: {
    flex: 1,
    color: '#3C3C40',
    fontSize: 16,
    lineHeight: 27,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  footerTab: {
    position: 'absolute',
    right: 12,
    bottom: 28,
    width: 150,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(136,136,142,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  footerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  footerLabel: {
    color: '#6D6D72',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
