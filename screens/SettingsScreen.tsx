import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Linking,
  DeviceEventEmitter,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Asset } from 'expo-asset';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Edit01Icon, Sun01Icon, Moon01Icon, Moon02Icon } from '@hugeicons/core-free-icons';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
// import changeIcon from 'react-native-change-icon';
import { useRecords } from '../contexts/RecordsContext';
import { useAppStore } from '../store/useAppStore';
import { isTestflightMode } from '../utils/appMode';
import { normalizeStoredImageUri, resolveLocalImageUri, resolveStoredImageUri } from '../lib/imageUpload';
import { pullImageFromCloud } from '../lib/icloudImageSync';
import {
  getCachedThemePreference,
  hydrateThemePreference,
  saveThemePreference,
  setThemePreferenceCache,
} from '../lib/themePreference';
import { useFonts, LINESeedJP_400Regular, LINESeedJP_700Bold, LINESeedJP_800ExtraBold } from '@expo-google-fonts/line-seed-jp';
import { useTheme, lightTheme, darkTheme } from '../src/theme';

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

// SVGアセットルート
// Note: statusSvgUrisをはcontent内のuseMemoで管理し、レンダリング時の总次訴がその時だけならうえで

const APP_STORE_URL = 'https://apps.apple.com/ja/app/tickemo-%E3%83%A9%E3%82%A4%E3%83%96%E3%81%AE%E6%80%9D%E3%81%84%E5%87%BA%E3%82%92%E8%A8%98%E9%8C%B2/id6758604980';
const APP_STORE_REVIEW_URL = `${APP_STORE_URL}?action=write-review`;

const buildPalette = (isDarkMode: boolean, primaryColor: string) => ({
  screenBackground: isDarkMode ? '#121212' : '#F8F8F8',
  cardBackground: isDarkMode ? '#1A1A1A' : '#FFFFFF',
  mutedCardBackground: isDarkMode ? '#202024' : '#F0F0F0',
  headerBackground: isDarkMode ? 'rgba(18, 18, 18, 0.74)' : 'rgba(248, 248, 248, 0.62)',
  headerBorder: isDarkMode ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.45)',
  titleText: isDarkMode ? '#F5F5F7' : '#333333',
  primaryText: isDarkMode ? '#F5F5F7' : '#000000',
  secondaryText: isDarkMode ? '#A1A1AA' : '#8E8E93',
  tertiaryText: isDarkMode ? '#8A8A94' : '#9A9A9A',
  subtleText: isDarkMode ? '#B7B7C2' : '#666666',
  destructiveText: '#FF453A',
  rowBorder: isDarkMode ? '#2E2E35' : '#E8E8E8',
  iconColor: isDarkMode ? '#D0D0D7' : '#C7C7CC',
  avatarRingBackground: isDarkMode ? '#222227' : '#FFFFFF',
  avatarFallbackBackground: isDarkMode ? '#313643' : '#D9DEE8',
  avatarFallbackText: isDarkMode ? '#E8EBF4' : '#3B4454',
  freeBadgeBackground: isDarkMode ? '#2D2D34' : '#E7E7E7',
  freeBadgeText: isDarkMode ? '#CFCFDD' : '#5A5A5A',
  profileEditIcon: isDarkMode ? '#DADAE6' : '#2F2F2F',
  sectionShadow: isDarkMode ? '#000000' : '#D2D2D2',
  switchThumb: isDarkMode ? '#F5F5F7' : '#FFFFFF',
  switchTrackOff: isDarkMode ? '#3A3A42' : '#D1D1D6',
  switchTrackOn: primaryColor,
  paywallGradientStart: isDarkMode ? '#2B2B2B' : '#2B2B2B',
  paywallGradientEnd: isDarkMode ? '#121212' : '#121212',
  paywallCaption: 'rgba(255,255,255,0.72)',
  paywallTitle: '#FFFFFF',
  paywallAction: '#8FE58C',
  plusGradientStart: '#8FE58C',
  plusGradientEnd: '#8872F8',
  plusText: '#FFFFFF',
  faqQuestionLabel: isDarkMode ? '#F5F5F7' : '#000000',
  faqAnswerLabel: isDarkMode ? '#BCBCC8' : '#666666',
  transparent: 'transparent',
});

type SettingsPalette = ReturnType<typeof buildPalette>;

const CustomThemeToggle: React.FC<{
  isDarkMode: boolean;
  onToggle: () => void;
}> = ({ isDarkMode, onToggle }) => {
  const thumbTranslateX = useRef(new Animated.Value(isDarkMode ? 28 : 0)).current;
  const backgroundProgress = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(thumbTranslateX, {
        toValue: isDarkMode ? 28 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backgroundProgress, {
        toValue: isDarkMode ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [backgroundProgress, isDarkMode, thumbTranslateX]);

  const trackBackgroundColor = backgroundProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#8B5CF6', '#333333'],
  });

  return (
    <Pressable onPress={onToggle} hitSlop={8} style={toggleStyles.pressable}>
      <Animated.View style={[toggleStyles.track, { backgroundColor: trackBackgroundColor as any }]}>
        <View style={toggleStyles.iconLayer} pointerEvents="none">
          <View style={toggleStyles.iconSlot}>
            <HugeiconsIcon icon={Sun01Icon} size={14} color="#FFFFFF" strokeWidth={2.1} />
          </View>
          <View style={toggleStyles.iconSlot}>
            <HugeiconsIcon icon={Moon02Icon} size={14} color="#FFFFFF" strokeWidth={2.1} />
          </View>
        </View>

        <Animated.View
          style={[
            toggleStyles.thumb,
            {
              transform: [{ translateX: thumbTranslateX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const toggleStyles = StyleSheet.create({
  pressable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    width: 60,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    padding: 2,
  },
  iconLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  iconSlot: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default function SettingsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme: systemTheme, isDark: isSystemDark } = useTheme();
  const [fontsLoaded] = useFonts({
    LINESeedJP_400Regular,
    LINESeedJP_700Bold,
    LINESeedJP_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { records, clearRecords } = useRecords();
  const userProfile = useAppStore((state) => state.userProfile);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const membershipType = useAppStore((state) => state.membershipType);
  const [firstLaunchAt, setFirstLaunchAt] = useState('');
  const [resolvedProfileAvatarUri, setResolvedProfileAvatarUri] = useState('');
  const [manualDarkMode, setManualDarkMode] = useState<boolean | null | undefined>(() => getCachedThemePreference());
  const scrollViewRef = useRef<ScrollView>(null);

  const loadThemePreference = useCallback(async () => {
    const value = await hydrateThemePreference();
    setManualDarkMode(value);
  }, []);

  useEffect(() => {
    void loadThemePreference();
  }, [loadThemePreference]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('theme:changed', (nextValue?: boolean) => {
      if (typeof nextValue !== 'boolean') return;
      setManualDarkMode(nextValue);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const isDarkMode = manualDarkMode ?? false;
  const activeTheme = isDarkMode ? darkTheme : lightTheme;
  const palette = useMemo(
    () => buildPalette(isDarkMode, activeTheme.primary || systemTheme.primary),
    [activeTheme.primary, isDarkMode, systemTheme.primary]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);

  const handleToggleDarkMode = useCallback(async (nextValue: boolean) => {
    setManualDarkMode(nextValue);
    setThemePreferenceCache(nextValue);
    DeviceEventEmitter.emit('theme:changed', nextValue);
    try {
      await saveThemePreference(nextValue);
    } catch {
      // Ignore preference save errors.
    }
  }, []);

  const sections: SettingSection[] = [
    {
      title: t('settings.sections.general'),
      data: [
        { id: 'dark-mode', label: t('settings.items.darkMode') },
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
  const contentTopPadding = Math.max(14, Math.min(24, windowHeight * 0.02));
  const contentBottomPadding = Math.max(insets.bottom + 60, Math.min(140, windowHeight * 0.14));
  const titleFontSize = Math.max(26, Math.min(34, windowWidth * 0.08));
  const paywallBannerMinHeight = Math.max(110, Math.min(150, windowHeight * 0.16));
  const paywallBannerImageWidth = Math.max(120, Math.min(170, windowWidth * 0.36));
  const paywallBannerImageHeight = paywallBannerImageWidth * 0.8;
  const sectionTopSpacing = Math.max(18, Math.min(26, windowHeight * 0.032));
  const rowVerticalPadding = Math.max(14, Math.min(19, windowHeight * 0.02));
  const footerTopMargin = Math.max(44, Math.min(76, windowHeight * 0.085));

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

  useEffect(() => {
    loadFirstLaunchDate();
  }, []);

  useEffect(() => {
    Asset.loadAsync([
      require('../assets/paywallPass.png'),
    ]).catch(() => {
      // noop
    });
  }, []);

  useEffect(() => {
    if (profile.avatarUrl) {
      ExpoImage.prefetch(profile.avatarUrl, 'memory-disk').catch(() => {});
    }
  }, [profile.avatarUrl]);

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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <BlurView tint={isDarkMode ? 'dark' : 'light'} intensity={80} style={[styles.glassHeader, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.titleRow, { marginBottom: 0 }]}> 
          <Text style={[styles.title, { fontSize: titleFontSize }]}>My page</Text>
        </View>
      </BlurView>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: contentHorizontalPadding,
              paddingTop: Math.max(12, contentTopPadding),
              paddingBottom: contentBottomPadding,
            },
          ]}
        >
        <View style={styles.bentoCardContainer}>
          <UserProfileHeader
            profile={profile}
            palette={palette}
            styles={styles}
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
              colors={[palette.paywallGradientStart, palette.paywallGradientEnd]}
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
                    disabled={item.id === 'dark-mode'}
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
                      {item.id === 'dark-mode' ? (
                        <CustomThemeToggle
                          isDarkMode={isDarkMode}
                          onToggle={() => {
                            void handleToggleDarkMode(!isDarkMode);
                          }}
                        />
                      ) : null}
                      {item.value && <Text style={styles.rowValue}>{item.value}</Text>}
                      {!item.destructive && item.id !== 'about' && item.id !== 'faq' && item.id !== 'icloud-sync' && item.id !== 'dark-mode' && (
                        <MaterialIcons name="arrow-outward" size={20} color={palette.iconColor} />
                      )}
                      {(item.id === 'faq' || item.id === 'icloud-sync') && (
                        <MaterialIcons name="arrow-forward-ios" size={15} color={palette.iconColor} />
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
      </View>
    </SafeAreaView>
  );
}


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

const UserProfileHeader: React.FC<{
  profile: {
    displayName: string;
    username: string;
    avatarUrl: string;
    joinedAt: string;
  };
  palette: SettingsPalette;
  styles: ReturnType<typeof createStyles>;
  onPressEdit: () => void;
}> = ({ profile, palette, styles, onPressEdit }) => {
  const membershipType = useAppStore((state) => state.membershipType);
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
              colors={[palette.plusGradientStart, palette.plusGradientEnd]}
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
            <View style={styles.avatarRing}>
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
              {isPremium ? (
                <LinearGradient
                  colors={[palette.plusGradientStart, palette.plusGradientEnd]}
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
          <HugeiconsIcon icon={Edit01Icon} size={18} color={palette.profileEditIcon} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (palette: SettingsPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.screenBackground,
      position: 'relative',
      zIndex: 9000,
      elevation: 30,
    },
    glassHeader: {
      backgroundColor: palette.headerBackground,
      borderBottomWidth: 1,
      borderBottomColor: palette.headerBorder,
      overflow: 'hidden',
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 28,
      paddingBottom: 120,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginBottom: 20,
    },
    title: {
      fontSize: 26,
      color: palette.titleText,
      fontWeight: '800',
    },
    paywallBannerTouchable: {
      marginTop: 15,
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
      color: palette.paywallCaption,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    paywallBannerTitle: {
      color: palette.paywallTitle,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    paywallBannerAction: {
      color: palette.paywallAction,
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
      shadowColor: '#232323',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 20,
      elevation: 8,
    },
    bentoCardContainer: {
      backgroundColor: palette.transparent,
      borderRadius: 0,
      padding: 0,
      shadowColor: palette.transparent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      marginBottom: 0,
      overflow: 'hidden',
    },
    bentoCardBackground: {
      ...StyleSheet.absoluteFillObject,
    },
    bentoGrid: {
      gap: 10,
      marginBottom: 0,
    },
    profileCard: {
      backgroundColor: palette.screenBackground,
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
      backgroundColor: palette.avatarRingBackground,
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
      backgroundColor: palette.avatarRingBackground,
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
      backgroundColor: palette.avatarFallbackBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      color: palette.avatarFallbackText,
      fontSize: 18,
      fontWeight: '800',
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
      color: palette.titleText,
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
      color: palette.plusText,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      shadowColor: palette.primaryText,
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
      backgroundColor: palette.freeBadgeBackground,
    },
    freeBadgeText: {
      color: palette.freeBadgeText,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    userMeta: {
      marginTop: 8,
      fontSize: 12,
      color: palette.secondaryText,
    },
    profileEditButton: {
      width: 30,
      height: 30,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionWrapper: {
      marginTop: 22,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: palette.tertiaryText,
      marginBottom: 10,
      marginLeft: 8,
    },
    card: {
      backgroundColor: palette.cardBackground,
      borderRadius: 20,
      shadowColor: palette.sectionShadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.16,
      shadowRadius: 8,
      elevation: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 20,
      borderBottomWidth: 0.5,
      borderBottomColor: palette.rowBorder,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.primaryText,
    },
    rowLabelDestructive: {
      color: palette.destructiveText,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rowValue: {
      fontSize: 10,
      color: palette.secondaryText,
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
      color: palette.secondaryText,
      lineHeight: 16,
    },
    backupHint: {
      marginTop: 3,
      marginHorizontal: 0,
      fontSize: 10,
      color: palette.tertiaryText,
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
      color: palette.secondaryText,
    },
    backupNoteBody: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    backupNoteText: {
      flex: 1,
      fontSize: 10,
      color: palette.secondaryText,
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
      color: palette.secondaryText,
      lineHeight: 14,
    },
  });

// ================ FAQ Screen Component ================
export function FAQScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { isDark: isSystemDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [manualDarkMode, setManualDarkMode] = useState<boolean | null | undefined>(() => getCachedThemePreference());

  const loadThemePreference = useCallback(async () => {
    const value = await hydrateThemePreference();
    setManualDarkMode(value);
  }, []);

  useEffect(() => {
    void loadThemePreference();
  }, [loadThemePreference]);

  useFocusEffect(
    useCallback(() => {
      void loadThemePreference();
    }, [loadThemePreference])
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('theme:changed', (nextValue?: boolean) => {
      if (typeof nextValue !== 'boolean') return;
      setManualDarkMode(nextValue);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const isDarkMode = manualDarkMode ?? false;
  const themeForFaq = isDarkMode ? darkTheme : lightTheme;
  const palette = useMemo(
    () => buildPalette(isDarkMode, themeForFaq.primary),
    [isDarkMode, themeForFaq.primary]
  );
  const faqStyles = useMemo(() => createFaqStyles(palette), [palette]);
  const faqData = t('settings.faq.sections', { returnObjects: true }) as Array<{
    category: string;
    items: Array<{ question: string; answer: string }>;
  }>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.screenBackground }} edges={['left', 'right', 'bottom']}>
      <BlurView tint={isDarkMode ? 'dark' : 'light'} intensity={80} style={[faqStyles.glassHeader, { paddingTop: insets.top + 8 }]}>
        <View style={faqStyles.header}>
          <TouchableOpacity style={faqStyles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios" size={22} color={palette.primaryText} />
          </TouchableOpacity>
          <Text style={faqStyles.headerTitle}>{t('settings.faq.header')}</Text>
          <View style={{ width: 44 }} />
        </View>
      </BlurView>

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

const createFaqStyles = (palette: SettingsPalette) =>
  StyleSheet.create({
    glassHeader: {
      backgroundColor: palette.headerBackground,
      borderBottomWidth: 1,
      borderBottomColor: palette.headerBorder,
      overflow: 'hidden',
    },
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
      color: palette.titleText,
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
      color: palette.titleText,
    },
    faqItem: {
      marginBottom: 20,
      backgroundColor: palette.cardBackground,
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
      color: palette.faqQuestionLabel,
      marginRight: 8,
    },
    questionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: palette.primaryText,
      lineHeight: 22,
    },
    answerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    aLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: palette.faqAnswerLabel,
      marginRight: 8,
    },
    answerText: {
      flex: 1,
      fontSize: 14,
      color: palette.subtleText,
      lineHeight: 21,
    },
    footer: {
      marginTop: 10,
      marginBottom: 100,
      padding: 16,
      backgroundColor: palette.mutedCardBackground,
      borderRadius: 12,
    },
    footerText: {
      fontSize: 13,
      color: palette.subtleText,
      lineHeight: 20,
      textAlign: 'center',
    },
  });

