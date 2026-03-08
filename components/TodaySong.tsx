import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { requireNativeModule } from 'expo-modules-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme';
import { searchAppleMusicSongs, getArtworkUrl, AppleMusicSong } from '../utils/appleMusicApi';
import { useTranslation } from 'react-i18next';

// ネイティブモジュールの読み込み
const TickemoPlayer = requireNativeModule('TickemoPlayer');

interface TodaySongProps {
  artistName?: string;
  developerToken: string; // JWT Developer Token
}

/**
 * 日付ベースのシード値から疑似乱数を生成
 * 同じ日付なら同じ曲を返す
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const normalizeArtistName = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[\s・．.‐-]/g, '')
    .trim();
};

const getHistoryKey = (artistName?: string) => {
  const normalized = normalizeArtistName(artistName || 'unknown');
  return `@today_song_history:${normalized}`;
};

const getDailyPickKey = (artistName: string, dateKey: string) => {
  const normalized = normalizeArtistName(artistName || 'unknown');
  return `@today_song_pick:${normalized}:${dateKey}`;
};

const MAX_HISTORY = 20;

export default function TodaySong({ artistName, developerToken }: TodaySongProps) {
  const { t } = useTranslation();
  const [song, setSong] = useState<AppleMusicSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (artistName && developerToken) {
      fetchRandomSongForToday();
    }
  }, [artistName, developerToken]);

  const fetchRandomSongForToday = async () => {
    try {
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const dailyPickKey = getDailyPickKey(artistName!, dateKey);

      const cachedPick = await AsyncStorage.getItem(dailyPickKey);
      if (cachedPick) {
        const parsed = JSON.parse(cachedPick) as AppleMusicSong;
        if (parsed?.id) {
          setSong(parsed);
          setLoading(false);
          return;
        }
      }

      // console.log('[TodaySong] Fetching songs for artist:', artistName);
      
      // Apple Music APIでアーティスト名から曲を検索
      const songs = await searchAppleMusicSongs(artistName!, developerToken, 20);

      // console.log('[TodaySong] Fetched songs count:', songs.length);

      if (songs.length > 0) {
        const normalizedTarget = normalizeArtistName(artistName!);
        const artistMatched = songs.filter((item) => {
          const normalizedArtist = normalizeArtistName(item.attributes.artistName || '');
          return normalizedArtist.includes(normalizedTarget) || normalizedTarget.includes(normalizedArtist);
        });

        const filteredSongs = artistMatched.length > 0 ? artistMatched : songs;

        const historyKey = getHistoryKey(artistName);
        const storedHistory = await AsyncStorage.getItem(historyKey);
        const history = storedHistory ? (JSON.parse(storedHistory) as string[]) : [];

        const freshCandidates = filteredSongs.filter((item) => !history.includes(item.id));
        const candidates = freshCandidates.length > 0 ? freshCandidates : filteredSongs;

        // 今日の日付をシードに使う（YYYY-MM-DD形式）
        const seed = parseInt(dateKey.replace(/-/g, ''), 10);

        const shuffled = [...candidates]
          .map((item, index) => ({ item, score: seededRandom(seed + index * 13) }))
          .sort((a, b) => a.score - b.score)
          .map(({ item }) => item);

        const selectedSong = shuffled[0] || candidates[0];
        // console.log('[TodaySong] Selected song:', selectedSong);
        
        setSong(selectedSong);

        if (selectedSong) {
          const nextHistory = [selectedSong.id, ...history.filter((id) => id !== selectedSong.id)].slice(0, MAX_HISTORY);
          await AsyncStorage.setItem(historyKey, JSON.stringify(nextHistory));
          await AsyncStorage.setItem(dailyPickKey, JSON.stringify(selectedSong));
        }
      } else {
        console.warn('[TodaySong] No songs found for artist:', artistName);
      }
    } catch (e) {
      console.error('[TodaySong] Error fetching song:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async () => {
    // console.log('[TodaySong] handlePlay called, song:', song?.id, 'isPlaying:', isPlaying);
    
    if (!song?.id) {
      console.warn('[TodaySong] No song ID');
      Alert.alert(t('todaySong.alerts.error'), t('todaySong.alerts.songUnavailable'));
      return;
    }

    try {
      if (isPlaying) {
        // console.log('[TodaySong] Stopping playback');
        await TickemoPlayer.stop();
        setIsPlaying(false);
      } else {
        // console.log('[TodaySong] Native Player: 再生リクエスト', song.id);
        await TickemoPlayer.play(song.id);
        setIsPlaying(true);
      }
    } catch (error: any) {
      console.error('[TodaySong] Native Player Error:', error);
      Alert.alert(t('todaySong.alerts.playbackError'), error.message || t('todaySong.alerts.playbackFailed'));
      setIsPlaying(false);
    }
  };

  const handleOpenAppleMusic = async () => {
    if (!song?.id) return;
    
    const appleMusicUrl = `https://music.apple.com/jp/song/${song.id}`;
    
    try {
      const canOpen = await Linking.canOpenURL(appleMusicUrl);
      if (canOpen) {
        await Linking.openURL(appleMusicUrl);
      }
    } catch (error) {
      console.error('[TodaySong] Failed to open Apple Music:', error);
      Alert.alert(t('todaySong.alerts.error'), t('todaySong.alerts.appleMusicOpenFailed'));
    }
  };

  if (loading) {
    return (
      <View style={{ paddingVertical: theme.spacing.lg }}>
        <ActivityIndicator color={theme.colors.text.secondary} size="small" />
      </View>
    );
  }

  if (!song) {
    return null;
  }

  // 画像を高画質化
  const artworkUrl = getArtworkUrl(song.attributes.artwork.url, 600);

  return (
    <>
      <TouchableOpacity
        onPress={handleOpenAppleMusic}
        activeOpacity={0.8}
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        style={{
          position: 'relative',
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.20)',
          borderRadius: 18,
          padding: theme.spacing.md,
          marginVertical: theme.spacing.lg,
          marginHorizontal: theme.spacing.lg,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.15)',
        }}
      >
        {/* ジャケット画像 */}
        <Image
          source={{ uri: artworkUrl }}
          style={{
            width: 68,
            height: 68,
            borderRadius: 8,
            backgroundColor: theme.colors.background.secondary,
          }}
        />

        {/* テキスト情報 */}
        <View style={{ flex: 1, marginLeft: theme.spacing.lg, justifyContent: 'center' }}>
          {/* ラベル */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <FontAwesome5 name="headphones-alt" size={13} color="#FF6B9D" />
            <Text
              style={{
                color: '#FF6B9D',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.bold,
                marginLeft: 4,
                letterSpacing: 0.5,
                shadowColor: 'rgba(0, 0, 0, 0.3)',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 8,
              }}
            >
              {t('todaySong.title')}
            </Text>
          </View>

          {/* 曲名 */}
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.bold,
              letterSpacing: 0.5,
            }}
            numberOfLines={1}
          >
            {song.attributes.name}
          </Text>

          {/* アーティスト名 */}
          <Text
            style={{
              color: '#fff',
              fontSize: theme.typography.fontSize.sm,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {song.attributes.artistName}
          </Text>
        </View>

        {/* Apple Music バッジ */}
        <View
          style={{
            width: 110,
            height: 50,
            marginLeft: theme.spacing.md,
          }}
        >
          <Image
            source={require('../assets/AppleMusic/US-UK_Apple_Music_Listen_on_Lockup_all-wht_100617.svg')}
            style={{
              width: '100%',
              height: '100%',
              opacity: 0.95,
            }}
            contentFit="contain"
          />
        </View>
      </TouchableOpacity>
    </>
  );
}