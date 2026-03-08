import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Linking,
  Modal,
  Share,
  Switch,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Clipboard,
  ImageSourcePropType,
  DeviceEventEmitter,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Asset } from 'expo-asset';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, AntDesign, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Defs, Rect, RadialGradient, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
// import changeIcon from 'react-native-change-icon';
import { theme } from '../theme';
import { useRecords } from '../contexts/RecordsContext';
import { useAppStore } from '../store/useAppStore';
import { getShareCardSource } from '../utils/statusSvgs';
import { isTestflightMode } from '../utils/appMode';
import { normalizeStoredImageUri, resolveLocalImageUri, resolveStoredImageUri } from '../lib/imageUpload';
import { pullImageFromCloud } from '../lib/icloudImageSync';

interface SettingItem {
  id: string;
  label: string;
  value?: string;
  destructive?: boolean;
}

interface SettingSection {
  title: string;
  data: SettingItem[];
}

type ShareStats = {
  fanLevel: 'ROOKIE' | 'EXPERT' | 'MASTER' | 'LEGEND';
  totalCheckIns: number;
  nextLevel: string;
  remainingLives: number;
  progressPercentage: number;
  sinceDate: string;
  topArtist: string;
  topArtistCount: number;
  topArtistImageUrl?: string;
  lastSeenLiveName: string;
  pastRecords?: Array<{ date: string; [key: string]: any }>;
};

interface MyPageShareModalProps {
  visible: boolean;
  onClose: () => void;
  shareCardSource: ImageSourcePropType;
  shareText: string;
  stats: ShareStats;
  profile: {
    displayName: string;
    avatarUrl: string;
    joinedAt: string;
  };
  xHandle: string;
  instagramHandle: string;
  onUpdateXHandle: (value: string) => void;
  onUpdateInstagramHandle: (value: string) => void;
}

// SVGアセットルート
// Note: statusSvgUrisをはcontent内のuseMemoで管理し、レンダリング時の总次訴がその時だけならうえで

const APP_STORE_URL = 'https://apps.apple.com/ja/app/tickemo-%E3%83%A9%E3%82%A4%E3%83%96%E3%81%AE%E6%80%9D%E3%81%84%E5%87%BA%E3%82%92%E8%A8%98%E9%8C%B2/id6758604980';
const APP_STORE_REVIEW_URL = `${APP_STORE_URL}?action=write-review`;

export default function SettingsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { records, clearRecords } = useRecords();
  const userProfile = useAppStore((state) => state.userProfile);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const membershipType = useAppStore((state) => state.membershipType);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [xHandle, setXHandle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [firstLaunchAt, setFirstLaunchAt] = useState('');
  const [resolvedProfileAvatarUri, setResolvedProfileAvatarUri] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const sections: SettingSection[] = [
    {
      title: t('settings.sections.general'),
      data: [
        { id: 'icloud-sync', label: t('settings.items.icloudSync') },
      ],
    },
    {
      title: t('settings.sections.notifications'),
      data: [{ id: 'notifications', label: t('settings.items.notifications') }],
    },
    {
      title: t('settings.sections.aboutApp'),
      data: [
        { id: 'apple-music', label: t('settings.items.appleMusic'), value: '' },
        { id: 'terms', label: t('settings.items.terms') },
        { id: 'privacy', label: t('settings.items.privacy') },
      ],
    },
    {
      title: t('settings.sections.support'),
      data: [
        { id: 'review', label: t('settings.items.review') },
        { id: 'faq', label: t('settings.items.faq') },
        { id: 'feedback', label: t('settings.items.feedback') },
      ],
    },
    {
      title: t('settings.sections.account'),
      data: [{ id: 'delete', label: t('settings.items.deleteAllData'), destructive: true }],
    },
  ];

  const contentHorizontalPadding = Math.max(16, Math.min(28, windowWidth * 0.05));
  const contentTopPadding = Math.max(24, Math.min(68, windowHeight * 0.015));
  const contentBottomPadding = Math.max(insets.bottom + 60, Math.min(140, windowHeight * 0.14));
  const titleFontSize = Math.max(26, Math.min(34, windowWidth * 0.08));
  const shareButtonSize = Math.max(40, Math.min(48, windowWidth * 0.11));
  const paywallBannerMinHeight = Math.max(110, Math.min(150, windowHeight * 0.16));
  const paywallBannerImageWidth = Math.max(120, Math.min(170, windowWidth * 0.36));
  const paywallBannerImageHeight = paywallBannerImageWidth * 0.8;
  const sectionTopSpacing = Math.max(24, Math.min(30, windowHeight * 0.04));
  const rowVerticalPadding = Math.max(16, Math.min(22, windowHeight * 0.022));
  const footerTopMargin = Math.max(56, Math.min(100, windowHeight * 0.1));

  const resolveProfileAvatar = useCallback(async () => {
    if (!hasHydrated) return;

    const avatarUri = userProfile?.avatarUri || '';
    if (!avatarUri) {
      setResolvedProfileAvatarUri('');
      return;
    }

    const normalized = normalizeStoredImageUri(avatarUri) || avatarUri;
    let restored = await resolveStoredImageUri(normalized, null);

    if (!restored && normalized.startsWith('Tickemo/')) {
      try {
        const pulled = await pullImageFromCloud(normalized);
        if (pulled) {
          restored = resolveLocalImageUri(normalized) || '';
        }
      } catch (error) {
        console.log('[Settings] Failed to pull profile avatar from iCloud:', error);
      }
    }

    const fallback = resolveLocalImageUri(normalized) || normalized;
    setResolvedProfileAvatarUri(restored || fallback || '');
  }, [hasHydrated, userProfile?.avatarUri]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!isMounted) return;
      await resolveProfileAvatar();
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [resolveProfileAvatar]);

  useFocusEffect(
    useCallback(() => {
      void resolveProfileAvatar();
    }, [resolveProfileAvatar])
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('settings:scrollToTop', () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const profile = useMemo(() => {
    const displayName = userProfile?.name || 'User';
    const rawUsername = userProfile?.username || 'user';
    const username = rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`;
    return {
      displayName,
      username,
      avatarUrl: resolvedProfileAvatarUri,
      joinedAt: userProfile?.joinedAt || firstLaunchAt || '',
    };
  }, [firstLaunchAt, resolvedProfileAvatarUri, userProfile]);

  // 統計情報
  const stats = useMemo(() => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const parsed = new Date(dateStr.replace(/\./g, '-'));
      if (Number.isNaN(parsed.getTime())) return dateStr;
      const y = parsed.getFullYear();
      const m = `${parsed.getMonth() + 1}`.padStart(2, '0');
      const d = `${parsed.getDate()}`.padStart(2, '0');
      return `${y}.${m}.${d}`;
    };

    const parseDate = (dateStr: string) => new Date(dateStr.replace(/\./g, '-'));

    // 全てのレコードをカウント（過去・未来含む）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // ヒートマップ/参戦済み判定：過去のレコードのみ
    const pastRecords = records.filter((record) => {
      const recordDate = new Date(record.date.replace(/\./g, '-'));
      recordDate.setHours(0, 0, 0, 0);
      return recordDate <= today;
    });

    // 統計計算用：参戦済みレコードのみ
    const totalCheckIns = pastRecords.length;
    let daysSinceStart = 0;
    let sinceDate = '';
    if (records.length > 0) {
      // 日付順にソートして最古のレコードを取得
      const sortedRecords = [...records].sort((a, b) => {
        const dateA = new Date(a.date.replace(/\./g, '-'));
        const dateB = new Date(b.date.replace(/\./g, '-'));
        return dateA.getTime() - dateB.getTime();
      });
      const oldestRecord = sortedRecords[0];
      sinceDate = formatDate(oldestRecord.date);
      const startDate = new Date(formatDate(oldestRecord.date).replace(/\./g, '-'));
      const diffTime = Math.abs(today.getTime() - startDate.getTime());
      daysSinceStart = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    let fanLevel: ShareStats['fanLevel'] = 'ROOKIE';
    let nextLevel = 'EXPERT';
    let remainingLives = 5;
    let progressPercentage = 0;
    
    if (totalCheckIns >= 15) {
      fanLevel = 'LEGEND';
      nextLevel = 'LEGEND';
      remainingLives = 0;
      progressPercentage = 100;
    } else if (totalCheckIns >= 10) {
      fanLevel = 'MASTER';
      nextLevel = 'LEGEND';
      remainingLives = 15 - totalCheckIns;
      progressPercentage = ((totalCheckIns - 10) / 5) * 100;
    } else if (totalCheckIns >= 5) {
      fanLevel = 'EXPERT';
      nextLevel = 'MASTER';
      remainingLives = 10 - totalCheckIns;
      progressPercentage = ((totalCheckIns - 5) / 5) * 100;
    } else {
      fanLevel = 'ROOKIE';
      nextLevel = 'EXPERT';
      remainingLives = 5 - totalCheckIns;
      progressPercentage = (totalCheckIns / 5) * 100;
    }

    // アーティストごとの参戦回数を集計（参戦済みのみ）
    const artistCounts: { [key: string]: number } = {};
    pastRecords.forEach((record) => {
      const artist = record.artist || t('settings.common.unknown');
      artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    });

    // 最多参戦アーティストを特定
    let topArtist = '';
    let topArtistCount = 0;
    let topArtistImageUrl = '';
    Object.entries(artistCounts).forEach(([artist, count]) => {
      if (count > topArtistCount) {
        topArtist = artist;
        topArtistCount = count;
        // そのアーティストの参戦済みレコードから画像URLを取得
        const artistRecord = pastRecords.find(r => r.artist === artist);
        topArtistImageUrl = artistRecord?.artistImageUrl || '';
      }
    });

    const validRecords = records.filter((record) => !Number.isNaN(parseDate(record.date).getTime()));
    const lastSeenRecord = [...validRecords]
      .filter((record) => {
        const recordDate = parseDate(record.date);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate <= today;
      })
      .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())[0]
      ?? [...validRecords].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())[0];

    return {
      totalCheckIns,
      days: daysSinceStart,
      sinceDate,
      fanLevel,
      nextLevel,
      remainingLives,
      progressPercentage,
      pastRecords,
      topArtist,
      topArtistCount,
      topArtistImageUrl,
      lastSeenLiveName: lastSeenRecord?.liveName || '',
    };
  }, [records]);

  const shareCardSource = useMemo(
    () => getShareCardSource(stats.fanLevel),
    [stats.fanLevel]
  );

  const shareSummary = useMemo(
    () => t('settings.share.profileSummary'),
    [t]
  );

  useEffect(() => {
    loadSocialHandles();
    loadFirstLaunchDate();
  }, []);

  useEffect(() => {
    Asset.loadAsync([
      require('../assets/paywall/paywallBackground.png'),
      require('../assets/paywall/Plus.logo.png'),
    ]).catch(() => {
      // noop
    });
  }, []);

  useEffect(() => {
    if (profile.avatarUrl) {
      ExpoImage.prefetch(profile.avatarUrl, 'memory-disk').catch(() => {});
    }
  }, [profile.avatarUrl]);

  const loadSocialHandles = async () => {
    try {
      const entries = await AsyncStorage.multiGet(['@sns_x', '@sns_instagram']);
      const map = Object.fromEntries(entries);
      setXHandle(map['@sns_x'] || '');
      setInstagramHandle(map['@sns_instagram'] || '');
    } catch (error) {
      console.log('Failed to load social handles:', error);
    }
  };

  const loadFirstLaunchDate = async () => {
    try {
      const stored = await AsyncStorage.getItem('@has_launched');
      if (stored && !Number.isNaN(Date.parse(stored))) {
        setFirstLaunchAt(stored);
      }
    } catch (error) {
      console.log('Failed to load first launch date:', error);
    }
  };


  const updateSocialHandle = async (key: '@sns_x' | '@sns_instagram', value: string) => {
    try {
      // ローカル状態を更新
      if (key === '@sns_x') {
        setXHandle(value);
      } else {
        setInstagramHandle(value);
      }
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.log('Failed to save social handle:', error);
      // フォールバック：ローカルに保存
      await AsyncStorage.setItem(key, value);
    }
  };

  const handleAccountDelete = () => {
    Alert.alert(
      t('settings.alerts.deleteAllDataTitle'),
      t('settings.alerts.deleteAllDataMessage'),
      [
        { text: t('settings.alerts.cancel'), style: 'cancel' },
        {
          text: t('settings.alerts.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await clearRecords();
              await AsyncStorage.multiRemove([
                '@records',
                '@has_launched',
                '@sns_x',
                '@sns_instagram',
                '@profile_display_name',
                '@profile_username',
                '@profile_avatar_url',
              ]);
              DeviceEventEmitter.emit('app:resetToWelcome');
              DeviceEventEmitter.emit('app:goToHome');
              if (navigation?.popToTop && navigation?.canGoBack?.()) {
                navigation.popToTop();
              }
            } catch (error) {
              console.log('Failed to delete account:', error);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: contentHorizontalPadding,
            paddingTop: contentTopPadding,
            paddingBottom: contentBottomPadding,
          },
        ]}
      >
        <View style={[styles.titleRow, { marginBottom: Math.max(22, Math.min(34, windowHeight * 0.035)) }]}>
          <Text style={[styles.title, { fontSize: titleFontSize }]}>{t('settings.title')}</Text>
          <TouchableOpacity
            style={[
              styles.shareButton,
              {
                width: shareButtonSize,
                height: shareButtonSize,
                borderRadius: shareButtonSize / 2,
              },
            ]}
            activeOpacity={0.8}
            onPress={() => setShareModalVisible(true)}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="#000">
              <Path
                d="M12 22.75C6.07 22.75 1.25 17.93 1.25 12C1.25 6.07 6.07 1.25 12 1.25C12.41 1.25 12.75 1.59 12.75 2C12.75 2.41 12.41 2.75 12 2.75C6.9 2.75 2.75 6.9 2.75 12C2.75 17.1 6.9 21.25 12 21.25C17.1 21.25 21.25 17.1 21.25 12C21.25 11.59 21.59 11.25 22 11.25C22.41 11.25 22.75 11.59 22.75 12C22.75 17.93 17.93 22.75 12 22.75Z"
                fill="black"
              />
              <Path
                d="M12.9999 11.7502C12.8099 11.7502 12.6199 11.6802 12.4699 11.5302C12.1799 11.2402 12.1799 10.7602 12.4699 10.4702L20.6699 2.27023C20.9599 1.98023 21.4399 1.98023 21.7299 2.27023C22.0199 2.56023 22.0199 3.04023 21.7299 3.33023L13.5299 11.5302C13.3799 11.6802 13.1899 11.7502 12.9999 11.7502Z"
                fill="black"
              />
              <Path
                d="M22 7.58C21.59 7.58 21.25 7.24 21.25 6.83V2.75H17.17C16.76 2.75 16.42 2.41 16.42 2C16.42 1.59 16.76 1.25 17.17 1.25H22C22.41 1.25 22.75 1.59 22.75 2V6.83C22.75 7.24 22.41 7.58 22 7.58Z"
                fill="black"
              />
            </Svg>
          </TouchableOpacity>
        </View>

        <View style={styles.bentoCardContainer}>
          <UserProfileHeader
            stats={stats}
            profile={profile}
            onPressEdit={() => {
                navigation.navigate('ProfileEdit');
            }}
          />
        </View>

        {membershipType === 'free' && (
          <TouchableOpacity
            style={[
              styles.paywallBannerTouchable,
              {
                marginTop: Math.max(18, Math.min(30, windowHeight * 0.03)),
                marginBottom: Math.max(10, Math.min(16, windowHeight * 0.017)),
              },
            ]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Paywall')}
          >
            <LinearGradient
              colors={['#2B2B2B', '#121212']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.paywallBanner,
                {
                  minHeight: paywallBannerMinHeight,
                  paddingLeft: Math.max(14, Math.min(24, windowWidth * 0.045)),
                  paddingRight: Math.max(10, Math.min(18, windowWidth * 0.035)),
                  paddingVertical: Math.max(12, Math.min(18, windowHeight * 0.018)),
                },
              ]}
            >
              <View style={styles.paywallBannerTextBlock}>
                <Text style={[styles.paywallBannerCaption, { fontSize: Math.max(11, Math.min(13, windowWidth * 0.03)) }]}>{t('settings.banner.caption')}</Text>
                <Text style={[styles.paywallBannerTitle, { fontSize: Math.max(16, Math.min(20, windowWidth * 0.046)) }]}>
                  {t('settings.banner.title')}
                </Text>
                <Text style={[styles.paywallBannerAction, { fontSize: Math.max(12, Math.min(14, windowWidth * 0.033)) }]}>{t('settings.banner.action')}</Text>
              </View>
              <Image
                source={require('../assets/bannerPass.png')}
                style={[
                  styles.paywallBannerImage,
                  {
                    width: paywallBannerImageWidth,
                    height: paywallBannerImageHeight,
                    right: Math.max(0, Math.min(8, windowWidth * 0.02)),
                  },
                ]}
                resizeMode="contain"
              />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {sections.map((section) => (
          <View key={section.title} style={[styles.sectionWrapper, { marginTop: sectionTopSpacing }]}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <View style={styles.card}>
              {section.data.map((item, index) => {
                const isLast = index === section.data.length - 1;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.row,
                      { paddingVertical: rowVerticalPadding },
                      isLast && styles.rowLast,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (item.id === 'icloud-sync') {
                        navigation.navigate('ICloudSync');
                      } else if (item.id === 'delete') {
                        handleAccountDelete();
                      } else if (item.id === 'notifications') {
                        Linking.openSettings().catch(() => {
                          Alert.alert(t('settings.common.errorTitle'), t('settings.alerts.openSettingsFailed'));
                        });
                      } else if (item.id === 'faq') {
                        navigation.navigate('FAQ');
                      } else if (item.id === 'review') {
                        Linking.openURL(APP_STORE_REVIEW_URL).catch(() => {
                          Alert.alert(t('settings.common.errorTitle'), t('settings.alerts.openAppStoreFailed'));
                        });
                      } else if (item.id === 'feedback') {
                        const feedbackUrl = isTestflightMode
                          ? 'https://testflight.apple.com/join/7stWmpEk'
                          : 'https://forms.gle/Z6fQZZUM79WprPSk8';
                        WebBrowser.openBrowserAsync(feedbackUrl).catch(() => {
                          Alert.alert(t('settings.common.errorTitle'), t('settings.common.openUrlFailed'));
                        });
                      } else if (item.id === 'sns') {
                        Linking.openURL('https://www.instagram.com/tickemo_app/').catch(() => {
                          Alert.alert(t('settings.common.errorTitle'), t('settings.common.openUrlFailed'));
                        });
                      } else if (item.id === 'about') {
                        Alert.alert(
                          t('settings.alerts.aboutTitle'),
                          t('settings.alerts.aboutMessage'),
                          [{ text: t('settings.common.ok') }]
                        );
                      } else if (item.id === 'apple-music') {
                        Alert.alert(
                          t('settings.alerts.aboutAppleMusicTitle'),
                          t('settings.alerts.aboutAppleMusicMessage'),
                          [{ text: t('settings.common.ok') }]
                        );
                      } else if (item.id === 'terms') {
                        WebBrowser.openBrowserAsync('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Terms-of-Use-2f65fd5d3e2d80ba8abcda85615cde4a?source=copy_link').catch(() => {
                          Alert.alert(t('settings.common.errorTitle'), t('settings.common.openUrlFailed'));
                        });
                      } else if (item.id === 'privacy') {
                        WebBrowser.openBrowserAsync('https://traveling-fahrenheit-b9b.notion.site/Tickemo-Privacy-Policy-2f85fd5d3e2d809b912dfc4ec2a2ed6a?source=copy_link').catch(() => {
                          Alert.alert(t('settings.common.errorTitle'), t('settings.common.openUrlFailed'));
                        });
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.rowLabel,
                        item.destructive && styles.rowLabelDestructive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <View style={styles.rowRight}>
                      {item.value && <Text style={styles.rowValue}>{item.value}</Text>}
                      {!item.destructive && item.id !== 'about' && item.id !== 'apple-music' && item.id !== 'faq' && item.id !== 'icloud-sync' && (
                        <MaterialIcons name="arrow-outward" size={20} color="#C7C7CC" />
                      )}
                      {(item.id === 'faq' || item.id === 'icloud-sync') && (
                        <MaterialIcons name="arrow-forward-ios" size={15} color="#C7C7CC" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View style={[styles.footer, { marginTop: footerTopMargin }]}>
          <Image source={require('../assets/logo.simple.png')} style={styles.footerLogo} />
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={styles.version}>Tickemo</Text>
            <Text style={styles.version}>
              {t('settings.version', { version: Constants.expoConfig?.version || '1.0.0' })}
            </Text>
          </View>
        </View>
      </ScrollView>

      <MyPageShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        shareCardSource={shareCardSource}
        shareText={shareSummary}
        stats={{
          fanLevel: stats.fanLevel as ShareStats['fanLevel'],
          totalCheckIns: stats.totalCheckIns,
          nextLevel: stats.nextLevel,
          remainingLives: stats.remainingLives,
          progressPercentage: stats.progressPercentage,
          sinceDate: stats.sinceDate,
          topArtist: stats.topArtist,
          topArtistCount: stats.topArtistCount,
          pastRecords: stats.pastRecords,
          lastSeenLiveName: stats.lastSeenLiveName,
        }}
        profile={profile}
        xHandle={xHandle}
        instagramHandle={instagramHandle}
        onUpdateXHandle={(value) => updateSocialHandle('@sns_x', value)}
        onUpdateInstagramHandle={(value) => updateSocialHandle('@sns_instagram', value)}
      />
    </SafeAreaView>
  );
}

const MyPageShareModal: React.FC<MyPageShareModalProps> = ({
  visible,
  onClose,
  shareCardSource,
  shareText,
  stats,
  profile,
  xHandle,
  instagramHandle,
  onUpdateXHandle,
  onUpdateInstagramHandle,
}) => {
  const { t } = useTranslation();
  const membershipType = useAppStore((state) => state.membershipType);
  const isPremium = membershipType === 'plus' || membershipType === 'lifetime';
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
  });
  const [socialsExpanded, setSocialsExpanded] = useState(false);
  const viewRef = useRef<View>(null);
  const translateY = useRef(new Animated.Value(1)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const prevVisibleRef = useRef(visible);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'save' | 'copy' | 'twitter' | null>(null);

  const outputWidth = 600;
  const outputHeight = 900;
  const displayScale = 0.45; // プレビュー表示用の縮小率

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      translateY.setValue(1);
      dragY.setValue(0);
    }
    prevVisibleRef.current = visible;
  }, [visible, translateY, dragY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) {
          Animated.timing(dragY, {
            toValue: 800,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const captureCard = async (): Promise<string | null> => {
    if (!viewRef.current) {
      Alert.alert(t('settings.common.errorTitle'), t('settings.alerts.previewNotReady'));
      return null;
    }

    try {
      if (Platform.OS === 'android') {
        const uri = await captureRef(viewRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        return uri;
      }
      // iOSの場合はこれで綺麗に撮れることが多いが、viewRefのstyleにbackgroundColor: transparentがないと角が白くなる可能性がある
      // そこで、captureRefのオプションではなく、View階層で調整済み。
      // ただし、snapshotContentContainer: true にすると中身だけ撮れる場合がある
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      return uri;
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert(t('settings.common.errorTitle'), t('settings.alerts.imageGenerateFailed'));
      return null;
    }
  };

  const runWithProcessing = async (
    action: 'save' | 'copy' | 'twitter',
    task: () => Promise<void>,
  ) => {
    setSelectedAction(action);
    setIsProcessing(true);
    try {
      await task();
    } catch (error) {
      console.error('Share modal error:', error);
      Alert.alert(t('settings.common.errorTitle'), t('settings.alerts.processingFailed'));
    } finally {
      setIsProcessing(false);
      setSelectedAction(null);
    }
  };

  const handleCopyLink = async () => {
    await runWithProcessing('copy', async () => {
      const uri = await captureCard();
      if (!uri) return;

      Clipboard.setString(uri);
      Alert.alert(t('settings.common.doneTitle'), t('settings.alerts.copiedImageLink'));
    });
  };

  const handleSaveImage = async () => {
    await runWithProcessing('save', async () => {
      const uri = await captureCard();
      if (!uri) return;

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('settings.common.errorTitle'), t('settings.alerts.mediaPermissionRequired'));
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(t('settings.common.doneTitle'), t('settings.alerts.savedToCameraRoll'));
      onClose();
    });
  };

  const captureAndSaveToLibrary = async (): Promise<string | null> => {
    const uri = await captureCard();
    if (!uri) return null;

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('settings.common.errorTitle'), t('settings.alerts.mediaPermissionRequired'));
      return null;
    }

    await MediaLibrary.saveToLibraryAsync(uri);
    return uri;
  };

  const handleShareToX = async () => {
    await runWithProcessing('twitter', async () => {
      const uri = await captureAndSaveToLibrary();
      if (!uri) return;

      const result = await Share.share({
        url: uri,
        message: shareText,
        title: 'Tickemo',
      });

      if (result.action === Share.sharedAction) {
        onClose();
      }
    });
  };


  const formatHandle = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '-';
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  };

  const displayXHandle = socialsExpanded ? formatHandle(xHandle) : '-';
  const displayInstagramHandle = socialsExpanded ? formatHandle(instagramHandle) : '-';

  const formatJoinedDate = (value?: string) => {
    if (!value) return '-';
    const joinedDate = new Date(value);
    if (Number.isNaN(joinedDate.getTime())) return value;
    const y = joinedDate.getFullYear();
    const m = `${joinedDate.getMonth() + 1}`.padStart(2, '0');
    const d = `${joinedDate.getDate()}`.padStart(2, '0');
    return `${y}/${m}/${d}`;
  };

  const profileInitials = (profile.displayName || 'U')
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // フォント読み込み中はnullを返す
  if (!fontsLoaded) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
      onShow={() => {
        Animated.timing(translateY, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }}
    >
      <View style={shareStyles.overlay}>
        <Animated.View
          style={[
            shareStyles.container,
            {
              transform: [
                {
                  translateY: Animated.add(
                    translateY.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 800],
                    }),
                    dragY,
                  ),
                },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={shareStyles.handleBarContainer}>
            <View style={shareStyles.handleBar} />
          </View>

          <View style={shareStyles.sheetContent}>
            <View style={shareStyles.sheetHeader}>
              <Text style={shareStyles.sheetTitle}>{t('settings.share.preview')}</Text>
            </View>

            <View style={shareStyles.previewArea}>
              
              <View
                collapsable={false}
                style={{
                  position: 'absolute',
                  top: '-3%',
                  left: '8%',
                  width: outputWidth * 0.9 + 80,
                  height: outputHeight * 0.9 + 80,
                  marginTop: -(outputHeight * displayScale) / 2 - 40,
                  marginLeft: -(outputWidth * displayScale) / 2 - 40,
                  backgroundColor: 'transparent',
                }}
              >
                <Svg
                  width={outputWidth * 0.9 + 80}
                  height={outputHeight * 0.9 + 80}
                  style={{ position: 'absolute', top: 0, left: 0 }}
                >
                  <Defs>
                    <RadialGradient id="shareShadow" cx="50%" cy="50%" rx="50%" ry="50%">
                      <Stop offset="60%" stopColor="rgba(0,0,0,0)" />
                      <Stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
                    </RadialGradient>
                  </Defs>
                  <Rect
                    x={28}
                    y={34}
                    width={outputWidth * 0.9 + 24}
                    height={outputHeight * 0.9 + 24}
                    rx={60}
                    fill="url(#shareShadow)"
                  />
                </Svg>
                <View
                  style={{
                    margin: 40,
                    width: outputWidth * 0.9,
                    height: outputHeight * 0.9,
                    borderRadius: 50,
                    backgroundColor: 'transparent', // 透明に変更して影用の背景を表示させない（実際には外側のSVGが影）
                  }}
                >
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#fff', // カード背景を白に設定
                    }}
                  >
                    <View
                      ref={viewRef}
                      collapsable={false}
                      style={{
                        width: outputWidth,
                        height: outputHeight,
                        transform: [{ scale: displayScale }],
                        transformOrigin: 'center center',
                        backgroundColor: '#fff', // カード背景を白に設定
                        borderRadius: 28,
                        overflow: 'hidden',
                      }}
                    >
                      <ExpoImage
                        source={shareCardSource}
                        style={shareStyles.cardBackground}
                        contentFit="cover"
                      />

                  <View style={shareStyles.cardContent}>
                    <Text style={shareStyles.totalLivesBackdrop}>
                      {stats.totalCheckIns}
                    </Text>
                    <View style={shareStyles.profileHeader}>
                      {isPremium ? (
                        <LinearGradient
                          colors={['#8FE58C', '#8872F8']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={shareStyles.profileAvatarWrapPremium}
                        >
                          <View style={shareStyles.profileAvatarWrapInner}>
                            {profile.avatarUrl ? (
                              <ExpoImage
                                source={{ uri: profile.avatarUrl }}
                                style={shareStyles.profileAvatar}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                              />
                            ) : (
                              <View style={shareStyles.profileAvatarFallback}>
                                <Text style={shareStyles.profileAvatarInitials}>
                                  {profileInitials || 'U'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </LinearGradient>
                      ) : (
                        <View
                          style={[
                            shareStyles.profileAvatarWrap,
                            { borderColor: rankAccentColorMap[stats.fanLevel] },
                          ]}
                        >
                          {profile.avatarUrl ? (
                            <ExpoImage
                              source={{ uri: profile.avatarUrl }}
                              style={shareStyles.profileAvatar}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                            />
                          ) : (
                            <View style={shareStyles.profileAvatarFallback}>
                              <Text style={shareStyles.profileAvatarInitials}>
                                {profileInitials || 'U'}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                      <View style={shareStyles.profileInfo}>
                        <Text style={shareStyles.profileName} numberOfLines={1}>
                          {profile.displayName || 'User'}
                        </Text>
                        <Text style={shareStyles.profileMeta} numberOfLines={1}>
                          Joined {formatJoinedDate(profile.joinedAt)}
                        </Text>
                      </View>
                    </View>

                    <View style={shareStyles.socialSection}>
                      <View style={shareStyles.socialRow}>
                        <View style={shareStyles.socialItem}>
                          <Image
                            source={require('../assets/shareCard/cardParts/xIcon.png')}
                            style={[shareStyles.socialIcon, { borderRadius: 8 }]}
                          />
                          <Text style={shareStyles.socialHandle}>
                            {displayXHandle}
                          </Text>
                          {socialsExpanded && xHandle.trim() ? (
                            <Image
                              source={require('../assets/shareCard/cardParts/scribble.png')}
                              style={shareStyles.socialScribbleX}
                            />
                          ) : null}
                        </View>
                      </View>
                      <View style={shareStyles.socialRow}>
                        <View style={shareStyles.socialItem}>
                          <Image
                            source={require('../assets/shareCard/cardParts/instagramIcon.png')}
                            style={shareStyles.socialIcon}
                          />
                          <Text style={shareStyles.socialHandle}>
                            {displayInstagramHandle}
                          </Text>
                          {socialsExpanded && instagramHandle.trim() ? (
                            <Image
                              source={require('../assets/shareCard/cardParts/scribble.png')}
                              style={shareStyles.socialScribbleInstagram}
                            />
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <View style={shareStyles.statusSection}>
                      <View style={shareStyles.statusItem}>
                          <Text style={shareStyles.statusLabel}>{t('settings.share.statusLastSeen')}</Text>
                        <Text style={shareStyles.statusValue} numberOfLines={1}>
                          {stats.lastSeenLiveName || '-'}
                        </Text>
                      </View>
                      <View style={shareStyles.statusItem}>
                          <Text style={shareStyles.statusLabel}>{t('settings.share.statusMostLoved')}</Text>
                        <Text style={shareStyles.statusValue} numberOfLines={1}>
                          {stats.topArtist || '-'}
                        </Text>
                      </View>
                    </View>

                    <View style={shareStyles.storeQrWrap}>
                      <QRCode
                        value={APP_STORE_URL}
                        size={74}
                        ecl="M"
                        backgroundColor="white"
                        color="black"
                      />
                    </View>
                  </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={shareStyles.socialSettingsContainer}>
              <View style={shareStyles.socialSettingsLeft}>
                <Text style={shareStyles.socialSettingsTitle}>{t('settings.share.socials')}</Text>
                <Switch
                  value={socialsExpanded}
                  onValueChange={setSocialsExpanded}
                  trackColor={{ false: '#E5E5E5', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={shareStyles.socialSettingsRight}>
                <View
                  style={[
                    shareStyles.socialSettingsBody,
                    !socialsExpanded && { height: 0, overflow: 'hidden' }
                  ]}
                >
                  <View style={shareStyles.socialSettingsRow}>
                    <Image
                      source={require('../assets/shareCard/cardParts/xIcon.png')}
                      style={[shareStyles.settingsIcon, {  borderRadius: 6}]}
                    />
                    <TextInput
                      style={shareStyles.socialSettingsInput}
                      placeholder="@tickemo_app"
                      placeholderTextColor="#C7C7CC"
                      value={xHandle}
                      onChangeText={onUpdateXHandle}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={shareStyles.socialSettingsRow}>
                    <Image
                      source={require('../assets/shareCard/cardParts/instagramIcon.png')}
                      style={shareStyles.settingsIcon}
                    />
                    <TextInput
                      style={shareStyles.socialSettingsInput}
                      placeholder="@tickemo_app"
                      placeholderTextColor="#C7C7CC"
                      value={instagramHandle}
                      onChangeText={onUpdateInstagramHandle}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={shareStyles.actionBar}>
            <TouchableOpacity
              style={shareStyles.actionButtonWrapper}
              onPress={handleSaveImage}
              disabled={isProcessing}
            >
              <View style={shareStyles.actionButtonCircle}>
                {isProcessing && selectedAction === 'save' ? (
                  <ActivityIndicator color="#666" size="small" />
                ) : (
                  <Feather name="download" size={24} color="#333" />
                )}
              </View>
              <Text style={shareStyles.actionButtonLabel}>{t('settings.share.actionSaveImage')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={shareStyles.actionButtonWrapper}
              onPress={handleCopyLink}
              disabled={isProcessing}
            >
              <View style={shareStyles.actionButtonCircle}>
                {isProcessing && selectedAction === 'copy' ? (
                  <ActivityIndicator color="#666" size="small" />
                ) : (
                  <AntDesign name="link" size={24} color="#333" />
                )}
              </View>
              <Text style={shareStyles.actionButtonLabel}>{t('settings.share.actionCopyImageLink')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={shareStyles.actionButtonWrapper}
              onPress={handleShareToX}
              disabled={isProcessing}
            >
              <View style={[shareStyles.actionButtonCircle, { backgroundColor: '#1c1c1c' }]}>
                {isProcessing && selectedAction === 'twitter' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Image source={require('../assets/x.logo.white.png')} style={{ width: 18, height: 18 }} />
                )}
              </View>
              <Text style={shareStyles.actionButtonLabel}>{t('settings.share.actionShareX')}</Text>
            </TouchableOpacity>

          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const shareStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    height: '90%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleBarContainer: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
  },
  sheetContent: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    position: 'relative',
    zIndex: 2,
    backgroundColor: '#FFFFFF',
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    padding: 6,
  },
  previewArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  cardBackground: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 58,
    paddingTop: 160,
    paddingBottom: 140,
  },
  totalLivesBackdrop: {
    position: 'absolute',
    right: 135,
    top: 350,
    fontSize: 190,
    fontWeight: '900',
    color: '#cacaca',
    opacity: 0.3,
    transform: [{ rotate: '6deg' }],
    letterSpacing: 0.5,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  profileAvatarWrap: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 5,
    borderColor: '#4DC9D8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginRight: 25,
    marginLeft: -20,
  },
  profileAvatarWrapPremium: {
    width: 152,
    height: 152,
    borderRadius: 76,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 25,
    marginLeft: -20,
  },
  profileAvatarWrapInner: {
    width: 142,
    height: 142,
    borderRadius: 71,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  profileAvatar: {
    width: 140,
    height: 140,
    borderRadius: 71,
  },
  profileAvatarFallback: {
    width: 140,
    height: 140,
    borderRadius: 71,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#2F2F2F',
  },
  profileMeta: {
    marginTop: 14,
    fontSize: 25,
    fontFamily: 'Anton_400Regular',
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 0.4,
  },
  rankTitle: {
    fontSize: 120,
    color: '#3d3d3d',
    fontFamily: 'Anton_400Regular',
    letterSpacing: 1.2,
  },
  socialSection: {
    marginTop: 25,
    marginBottom: 22,
    alignSelf: 'flex-start',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  socialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  socialIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
    marginRight: 30,
  },
  socialHandle: {
    fontSize: 28,
    fontFamily: 'Inter',
    fontWeight: '800',
    color: '#494949',
  },
  socialScribbleX: {
    position: 'absolute',
    left: -85,
    top: -24,
    width: 210,
    height: 90,
    resizeMode: 'contain',
    opacity: 0.8,
  },
  socialScribbleInstagram: {
    position: 'absolute',
    left: -90,
    top: -24,
    width: 210,
    height: 90,
    resizeMode: 'contain',
    opacity: 0.8,
  },
  statusSection: {
    marginTop: 16,
    marginLeft: -10,
    gap: 18,
  },
  storeQrWrap: {
    position: 'absolute',
    left: 55,
    bottom: 75,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  statusItem: {
    alignItems: 'flex-start',
  },
  statusLabel: {
    fontSize: 23,
    fontFamily: 'Inter',
    fontWeight: '800',
    color: '#9A9A9A',
    letterSpacing: 0.6,
  },
  statusValue: {
    fontSize: 26,
    fontFamily: 'Inter',
    fontWeight: '900',
    color: '#5c5c5c',
    marginTop: 4,
    maxWidth: 410,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 50,
    backgroundColor: '#FFF',
  },
  actionButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionButtonLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  socialSettingsContainer: {
    height: 75,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    marginTop: 24,
    paddingHorizontal: 40,
  },
  socialSettingsLeft: {
    width: 80,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 10,
  },
  socialSettingsRight: {
    flex: 1,
  },
  socialSettingsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 0.8,
  },
  socialSettingsBody: {
    gap: 12,
  },
  socialSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  socialSettingsLabel: {
    width: 50,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  socialSettingsInput: {
    flex: 1,
    height: 32,
    borderRadius: 18,
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1C1C1E',
  },
  
});

const formatJoinedAt = (value?: string) => {
  if (!value) return '-';
  const joinedDate = new Date(value);
  if (Number.isNaN(joinedDate.getTime())) return value;

  const now = new Date();
  const diffMs = now.getTime() - joinedDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `${Math.max(diffMinutes, 1)}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const y = joinedDate.getFullYear();
  const m = `${joinedDate.getMonth() + 1}`.padStart(2, '0');
  const d = `${joinedDate.getDate()}`.padStart(2, '0');
  return `${y}/${m}/${d}`;
};

const rankAccentColorMap: Record<ShareStats['fanLevel'], string> = {
  ROOKIE: '#22D3EE',
  EXPERT: '#DFCCAA',
  MASTER: '#D7E0E9',
  LEGEND: '#F4EAC6',
};

const UserProfileHeader: React.FC<{
  stats: ShareStats;
  profile: {
    displayName: string;
    username: string;
    avatarUrl: string;
    joinedAt: string;
  };
  onPressEdit: () => void;
}> = ({ stats, profile, onPressEdit }) => {
  const membershipType = useAppStore((state) => state.membershipType);
  const rankColor = rankAccentColorMap[stats.fanLevel];
  const joinedText = formatJoinedAt(profile.joinedAt);
  const displayName = profile.displayName || 'User';
  const username = profile.username || '@user';
  const initials = displayName
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const isPremium = membershipType === 'plus' || membershipType === 'lifetime';

  return (
    <View style={styles.bentoGrid}>
      <View style={styles.profileCard}>
        <View style={styles.profileLeft}>
          {isPremium ? (
            <LinearGradient
              colors={['#8FE58C', '#8872F8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRingLegend}
            >
              <View style={styles.avatarRingInner}>
                {profile.avatarUrl ? (
                  <ExpoImage
                    source={{ uri: profile.avatarUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    priority="high"
                    transition={0}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials || 'U'}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          ) : stats.fanLevel === 'LEGEND' ? (
            <LinearGradient
              colors={['#F5E097', '#8E8361']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRingLegend}
            >
              <View style={styles.avatarRingInner}>
                {profile.avatarUrl ? (
                  <ExpoImage
                    source={{ uri: profile.avatarUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    priority="high"
                    transition={0}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials || 'U'}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.avatarRing, { borderColor: rankColor }]}> 
              {profile.avatarUrl ? (
                <ExpoImage
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials || 'U'}</Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.profileText}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{displayName}</Text>
              <View style={[styles.rankDot, { backgroundColor: rankColor }]} />
              {isPremium ? (
                <LinearGradient
                  colors={['#8FE58C', '#8872F8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.plusBadge}
                >
                  <Text style={styles.plusBadgeText}>Plus</Text>
                </LinearGradient>
              ) : (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>Free</Text>
                </View>
              )}
            </View>
            <Text style={styles.userMeta}>{username} • Joined {joinedText}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.profileEditButton} onPress={onPressEdit}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M11 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22H15C20 22 22 20 22 15V13"
              stroke="#2F2F2F"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M16.04 3.01928L8.16 10.8993C7.86 11.1993 7.56 11.7893 7.5 12.2193L7.07 15.2293C6.91 16.3193 7.68 17.0793 8.77 16.9293L11.78 16.4993C12.2 16.4393 12.79 16.1393 13.1 15.8393L20.98 7.95928C22.34 6.59928 22.98 5.01928 20.98 3.01928C18.98 1.01928 17.4 1.65928 16.04 3.01928Z"
              stroke="#2F2F2F"
              strokeWidth={2.5}
              strokeMiterlimit={10}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M14.91 4.15039C15.58 6.54039 17.45 8.41039 19.85 9.09039"
              stroke="#2F2F2F"
              strokeWidth={2.5}
              strokeMiterlimit={10}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.rankCard,
          stats.fanLevel === 'LEGEND' && styles.rankCardLegend,
        ]}
      >
        {stats.fanLevel === 'LEGEND' && (
          <LinearGradient
            colors={['#f3d66c', '#faefc8', '#8E8361']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rankCardGradient}
          />
        )}
        <View style={styles.rankInfo}>
          <Text style={styles.rankCurrentLabel}>現在のランク</Text>
          <Text style={styles.rankName}>{stats.fanLevel}</Text>
          {stats.fanLevel !== 'LEGEND' && (
            <>
              <Text style={styles.rankNextText}>次のランクまで {stats.remainingLives} Live</Text>
              <View style={styles.rankProgressBarBackground}>
                <View
                  style={[
                    styles.rankProgressBarFill,
                    { width: `${stats.progressPercentage}%` },
                  ]}
                />
              </View>
            </>
          )}
        </View>
        <ExpoImage
          source={
            stats.fanLevel === 'ROOKIE'
              ? require('../assets/status/rookie.png')
              : stats.fanLevel === 'EXPERT'
                ? require('../assets/status/expert.png')
                : stats.fanLevel === 'MASTER'
                  ? require('../assets/status/master.png')
                  : require('../assets/status/legend.png')
          }
          style={styles.rankIllustration}
          contentFit="contain"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    position: 'relative',
    zIndex: 9000,
    elevation: 30,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 120,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  shareButton: {
    width: 42,
    height: 42,
    borderRadius: 24,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d2d2d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  paywallBannerTouchable: {
    marginTop: 25,
    marginBottom: 12,
  },
  paywallBanner: {
    position: 'relative',
    borderRadius: 20,
    minHeight: 120,
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  paywallBannerTextBlock: {
    flex: 1,
    paddingLeft: 8,
  },
  paywallBannerCaption: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  paywallBannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  paywallBannerAction: {
    color: '#8FE58C',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  paywallBannerImage: {
    position: 'absolute',
    top: 0,
    right: 5,
    width: 140,
    height: 113,
    marginLeft: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
  },
  bentoCardContainer: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    marginBottom: 10,
    overflow: 'hidden',
  },
  bentoCardBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  bentoGrid: {
    gap: 10,
    marginBottom: 6,
  },
  profileCard: {
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 8,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  avatarRingLegend: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  profileText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2D2D',
  },
  rankDot: {
    width: 6,
    height: 6,
    borderRadius: 4,
  },
  plusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7E7E7',
  },
  freeBadgeText: {
    color: '#5A5A5A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  userMeta: {
    marginTop: 8,
    fontSize: 12,
    color: '#9C9C9C',
  },
  profileEditButton: {
    width: 30,
    height: 30,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankCard: {
    backgroundColor: '#252525',
    borderRadius: 26,
    paddingHorizontal: 28,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 100,
    maxHeight: 150,
    overflow: 'hidden',
  },
  rankCardLegend: {
    backgroundColor: 'transparent',
  },
  rankCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  rankInfo: {
    flex: 1,
    paddingRight: 100,
  },
  rankCurrentLabel: {
    marginTop: 3,
    fontSize: 12,
    color: '#B8B8B8',
  },
  rankName: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Anton_400Regular',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  rankNextText: {
    marginTop: 6,
    fontSize: 12,
    color: '#B8B8B8',
  },
  rankProgressBarBackground: {
    marginTop: 10,
    height: 8,
    width: '80%',
    borderRadius: 10,
    backgroundColor: '#2E2E2E',
    overflow: 'hidden',
  },
  rankProgressBarFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  rankIllustration: {
    position: 'absolute',
    right: -4,
    bottom: -14,
    width: 140,
    height: 140,
  },
  sectionWrapper: {
    marginTop: 35,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9A9A9A',
    marginBottom: 14,
    marginLeft: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#d2d2d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  rowLabelDestructive: {
    color: '#FF3B30',
  },
  rowRight: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 10,
    color: '#8E8E93',
    marginRight: 0,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  backupMeta: {
    marginTop: 3,
    marginHorizontal: 0,
    fontSize: 11,
    color: '#8E8E93',
    lineHeight: 16,
  },
  backupHint: {
    marginTop: 3,
    marginHorizontal: 0,
    fontSize: 10,
    color: '#B0B0B0',
    lineHeight: 14,
  },
  backupNote: {
    marginTop: 10,
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  backupNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backupNoteTitle: {
    flex: 1,
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  backupNoteBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  backupNoteText: {
    flex: 1,
    fontSize: 10,
    color: '#8E8E93',
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    marginTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLogo: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
    opacity: 0.6,
  },
  version: {
    fontSize: 11,
    color: '#8E8E93',
    lineHeight: 14,
  },
});

// ================ FAQ Screen Component ================
export function FAQScreen({ navigation }: any) {
  const { t } = useTranslation();
  const faqData = t('settings.faq.sections', { returnObjects: true }) as Array<{
    category: string;
    items: Array<{ question: string; answer: string }>;
  }>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F8F8' }}>
      <View style={faqStyles.header}>
        <TouchableOpacity style={faqStyles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={faqStyles.headerTitle}>{t('settings.faq.header')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={faqStyles.content}>
        {faqData.map((section, sectionIndex) => (
          <View key={sectionIndex} style={faqStyles.section}>
            <Text style={faqStyles.categoryTitle}>{section.category}</Text>
            {section.items.map((item, itemIndex) => (
              <View key={itemIndex} style={faqStyles.faqItem}>
                <View style={faqStyles.questionRow}>
                  <Text style={faqStyles.qLabel}>Q.</Text>
                  <Text style={faqStyles.questionText}>{item.question}</Text>
                </View>
                <View style={faqStyles.answerRow}>
                  <Text style={faqStyles.aLabel}>A.</Text>
                  <Text style={faqStyles.answerText}>{item.answer}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={faqStyles.footer}>
          <Text style={faqStyles.footerText}>{t('settings.faq.footer')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const faqStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 20,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  qLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    marginRight: 8,
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    lineHeight: 22,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#666',
    marginRight: 8,
  },
  answerText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 21,
  },
  footer: {
    marginTop: 10,
    marginBottom: 100,
    padding: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
  },
  footerText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
  },
});

