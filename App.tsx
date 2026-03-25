import { View, StyleSheet, DeviceEventEmitter, Animated, Dimensions, Image, Easing, Alert, Platform } from 'react-native';
import { NavigationContainer, StackActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import CollectionScreen from './screens/CollectionScreen';
import CalendarScreen from './screens/CalendarScreen';
import StatisticsScreen from './screens/StatisticsScreen';
import SettingsScreen, { FAQScreen, MusicProviderScreen, NotificationSettingsScreen } from './screens/SettingsScreen';
import ProfileEditScreen from './screens/ProfileEditScreen';
import ICloudSyncScreen from './screens/ICloudSyncScreen';
import { PaywallScreen } from './screens';
import { FloatingTabBar } from './components/FloatingTabBar';
import AppReviewPromptModal from './components/AppReviewPromptModal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './theme';
import { RecordsProvider } from './contexts/RecordsContext';
import { TabBarProvider, useTabBar } from './contexts/TabBarContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { usePushNotifications } from './hooks/usePushNotifications';
import { setGlobalNotification } from './contexts/NotificationContext';
import { useAppStore } from './store/useAppStore';
import { isTestflightMode } from './utils/appMode';
import { getPremiumStatusFromCustomerInfo, initializeRevenueCat } from './lib/revenuecat';
import { resolveLocalImageUri } from './lib/imageUpload';
import { APP_MAX_WIDTH } from './utils/layout';
import type { ChekiRecord } from './types/record';

// Keep the splash screen visible while we fetch fonts
SplashScreen.preventAutoHideAsync();

// タブレット検出ヘルパー
const isTablet = () => {
  const { width, height } = Dimensions.get('window');
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  const minDimension = Math.min(width, height);
  const isPad = Platform.OS === 'ios' && (Platform as typeof Platform & { isPad?: boolean }).isPad === true;
  // iPadを検出、または画面の最小幅が600dp以上の場合はタブレット
  return isPad || (minDimension >= 600 && aspectRatio < 1.6);
};

const SettingsStack = createNativeStackNavigator();
const MAX_PRELOAD_RECORD_IMAGES = 24;
const APP_SURFACE_COLOR = '#F8F8F8';

const SHARE_PRELOAD_ASSETS = [
  require('./assets/cdFrame.png'),
  require('./assets/receipt.png'),
  require('./assets/tickemo_qr.png'),
  require('./assets/x.logo.white.png'),
  require('./assets/ticketEmpty.png'),
  require('./assets/splash.png'),
  require('./assets/hideParts/scribble1.png'),
  require('./assets/hideParts/scribble2.png'),
  require('./assets/hideParts/scribble3.png'),
];

const preloadLaunchAssets = async () => {
  try {
    await Asset.loadAsync(SHARE_PRELOAD_ASSETS);
  } catch (error) {
    console.log('[LaunchPreload] Static asset preload failed:', error);
  }

  try {
    const lives = (useAppStore.getState().lives ?? []) as ChekiRecord[];
    const imageUris = lives
      .map((record) => record.imageUrls?.[0] ?? record.imagePath)
      .filter((value): value is string => Boolean(value))
      .map((path) => resolveLocalImageUri(path) || path)
      .filter((uri) => Boolean(uri) && uri.startsWith('file://'))
      .filter((uri, index, arr) => arr.indexOf(uri) === index)
      .slice(0, MAX_PRELOAD_RECORD_IMAGES);

    if (imageUris.length > 0) {
      await ExpoImage.prefetch(imageUris, 'memory-disk');
    }
  } catch (error) {
    console.log('[LaunchPreload] Record image preload failed:', error);
  }
};

function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        contentStyle: {
          backgroundColor: theme.colors.background.primary,
        },
      }}
    >
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} />
      <SettingsStack.Screen
        name="FAQ"
        component={FAQScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <SettingsStack.Screen
        name="MusicProvider"
        component={MusicProviderScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <SettingsStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <SettingsStack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <SettingsStack.Screen
        name="ICloudSync"
        component={ICloudSyncScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <SettingsStack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          animation: 'fade',
          presentation: 'transparentModal',
          contentStyle: {
            backgroundColor: 'transparent',
          },
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
    </SettingsStack.Navigator>
  );
}

// ================ Root App Component ================
function AppContent() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0); // デフォルトをCollectionタブに設定
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [visitedPages, setVisitedPages] = useState<Record<number, boolean>>({ 0: true });
  const [pageWidth, setPageWidth] = useState(APP_MAX_WIDTH);
  const [tabTransition, setTabTransition] = useState<null | { from: number; to: number; direction: 1 | -1 }>(null);
  const tabSlideProgress = useRef(new Animated.Value(0)).current;
  const { isTabBarVisible } = useTabBar();
  const settingsNavigationRef = useRef<any>(null);

  const moveToPage = (index: number, animated = true) => {
    if (index === activeTabIndex && !tabTransition) return;
    if (tabTransition) return;

    if (!animated) {
      setActiveTabIndex(index);
      setCurrentPage(index);
      setVisitedPages((prev) => (prev[index] ? prev : { ...prev, [index]: true }));
      return;
    }

    const fromPage = currentPage;
    const direction: 1 | -1 = index > fromPage ? 1 : -1;

    setActiveTabIndex(index);
    setVisitedPages((prev) => (prev[index] ? prev : { ...prev, [index]: true }));
    setTabTransition({ from: fromPage, to: index, direction });
    tabSlideProgress.setValue(0);
    Animated.timing(tabSlideProgress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setCurrentPage(index);
      } else {
        setActiveTabIndex(fromPage);
        setCurrentPage(fromPage);
      }
      setTabTransition(null);
    });
  };

  // タブレット検出と警告（起動時のみ）
  useEffect(() => {
    if (isTablet()) {
      Alert.alert(
        t('app.tabletWarning.title'),
        t('app.tabletWarning.message'),
        [{ text: t('app.tabletWarning.ok') }]
      );
    }
  }, [t]);

  const handleNotificationTap = (data: any) => {
    console.log('[App] Notification tapped:', data);
    
    if (!data) return;

    // ライブリマインダー通知
    if (data.type === 'live_reminder' && data.recordId && data.kind) {
      setGlobalNotification({
        recordId: data.recordId,
        kind: data.kind,
      });
      
      // kindに基づいて画面を振り分け
      switch (data.kind) {
        case 'beforeLive':
        case 'onDay':
        case 'nextDayReview':
          // ライブ詳細画面またはカウントダウン画面へ
          moveToPage(1, false); // Countdown/Calendar画面へ
          break;
        case 'nextYearReview':
        case 'monthlyReport':
          // 統計情報画面へ
          moveToPage(2, false); // Statistics画面へ
          break;
        case 'campaigns':
          // 設定画面へ
          moveToPage(3, false); // Settings画面へ
          break;
        default:
          break;
      }
      return;
    }

    // タイムカプセル通知：該当ライブの詳細画面へ
    if (data.type === 'timecapsule' && data.recordId) {
      setGlobalNotification({
        recordId: data.recordId,
        kind: data.kind,
      });
      moveToPage(0, false); // Collection画面へ
      return;
    }

    // 年次レポート通知：レポート画面の年間タブへ
    if (data.type === 'yearly_report') {
      setGlobalNotification({
        recordId: data.recordId,
        kind: data.kind,
      });
      moveToPage(2, false); // Statistics画面へ
      return;
    }
  };

  usePushNotifications(handleNotificationTap);

  const handleTabPress = (index: number) => {
    moveToPage(index);
  };

  const routes = [
    { key: 'home', name: 'Home' },
    { key: 'calendar', name: 'Calendar' },
    { key: 'statistics', name: 'Statistics' },
    { key: 'settings', name: 'Settings' },
  ];

  const descriptors = routes.reduce((acc, route) => {
    acc[route.key] = {
      options: {
        tabBarAccessibilityLabel: route.name,
        tabBarTestID: route.key,
      },
    };
    return acc;
  }, {} as any);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('app:goToHome', () => {
      moveToPage(0, false);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const getPageLayerStyle = (index: number) => {
    if (!tabTransition) {
      return [
        styles.pageLayer,
        index === currentPage ? styles.pageVisible : styles.pageHidden,
        index === currentPage ? null : styles.pageDetached,
      ];
    }

    if (index === tabTransition.from) {
      return [
        styles.pageLayer,
        {
          opacity: 1,
          zIndex: 2,
          transform: [
            {
              translateX: tabSlideProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -tabTransition.direction * pageWidth],
              }),
            },
          ],
        },
      ];
    }

    if (index === tabTransition.to) {
      return [
        styles.pageLayer,
        {
          opacity: 1,
          zIndex: 1,
          transform: [
            {
              translateX: tabSlideProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [tabTransition.direction * pageWidth, 0],
              }),
            },
          ],
        },
      ];
    }

    return [styles.pageLayer, styles.pageHidden];
  };

  const getPagePointerEvents = (index: number): 'auto' | 'none' => {
    if (!tabTransition) {
      return index === currentPage ? 'auto' : 'none';
    }
    return index === tabTransition.to ? 'auto' : 'none';
  };

  const shouldRenderPage = (index: number) => {
    if (visitedPages[index]) return true;
    if (!tabTransition) return false;
    return index === tabTransition.from || index === tabTransition.to;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_SURFACE_COLOR }}>
      <View style={styles.container}>
        <View
          style={styles.pageStack}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width > 0 && width !== pageWidth) {
              setPageWidth(width);
            }
          }}
        >
          <Animated.View
            style={getPageLayerStyle(0)}
            pointerEvents={getPagePointerEvents(0)}
          >
            {shouldRenderPage(0) ? (
              <NavigationContainer independent={true}>
                <CollectionScreen />
              </NavigationContainer>
            ) : null}
          </Animated.View>

          <Animated.View
            style={getPageLayerStyle(1)}
            pointerEvents={getPagePointerEvents(1)}
          >
            {shouldRenderPage(1) ? (
              <NavigationContainer independent={true}>
                <CalendarScreen />
              </NavigationContainer>
            ) : null}
          </Animated.View>

          <Animated.View
            style={getPageLayerStyle(2)}
            pointerEvents={getPagePointerEvents(2)}
          >
            {shouldRenderPage(2) ? (
              <NavigationContainer independent={true}>
                <StatisticsScreen />
              </NavigationContainer>
            ) : null}
          </Animated.View>

          <Animated.View
            style={getPageLayerStyle(3)}
            pointerEvents={getPagePointerEvents(3)}
          >
            {shouldRenderPage(3) ? (
              <NavigationContainer independent={true} ref={settingsNavigationRef}>
                <SettingsStackScreen />
              </NavigationContainer>
            ) : null}
          </Animated.View>
        </View>

        {/* フローティングタブバー */}
        {isTabBarVisible && (
          <View style={styles.tabBarContainer}>
            <FloatingTabBar
              state={{
                index: activeTabIndex,
                routes: routes,
              }}
              descriptors={descriptors}
              navigation={{
                navigate: (name: string) => {
                  const index = routes.findIndex((route) => route.name === name);
                  if (index >= 0) {
                    if (index === activeTabIndex && name === 'Calendar') {
                      DeviceEventEmitter.emit('calendar:scrollToToday');
                    }

                    if (index === activeTabIndex && name === 'Settings') {
                      if (settingsNavigationRef.current?.canGoBack?.()) {
                        settingsNavigationRef.current.dispatch(StackActions.popToTop());
                      }
                      DeviceEventEmitter.emit('settings:scrollToTop');
                    }
                    handleTabPress(index);
                  }
                },
                emit: () => ({ defaultPrevented: false }),
                isFocused: () => true,
              }}
            />
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
  });
  const setRevenueCatState = useAppStore((state) => state.setRevenueCatState);
  const fontsLoadedRef = useRef(fontsLoaded);
  const [showSplashOverlay, setShowSplashOverlay] = useState(true);
  const splashAnim = useRef(new Animated.Value(0)).current;
  const splashImage = useRef(require('./assets/splash.png')).current;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const splashSize = Math.max(screenWidth, screenHeight);

  useEffect(() => {
    const ensureFirstLaunch = async () => {
      try {
        const existing = await AsyncStorage.getItem('@has_launched');
        if (!existing || Number.isNaN(Date.parse(existing))) {
          await AsyncStorage.setItem('@has_launched', new Date().toISOString());
        }
      } catch (error) {
        console.log('Failed to set first launch date:', error);
      }
    };

    ensureFirstLaunch();
  }, []);

  useEffect(() => {
    fontsLoadedRef.current = fontsLoaded;
  }, [fontsLoaded]);

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const waitForFonts = () =>
      new Promise<void>((resolve) => {
        if (fontsLoadedRef.current) {
          resolve();
          return;
        }
        intervalId = setInterval(() => {
          if (fontsLoadedRef.current) {
            if (intervalId) {
              clearInterval(intervalId);
            }
            resolve();
          }
        }, 50);
      });

    const waitMinimum = () =>
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, 3000);
      });

    const runSplashAnimation = () => {
      Animated.timing(splashAnim, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (isMounted) {
          setShowSplashOverlay(false);
        }
      });
    };

    const prepare = async () => {
      try {
        await Promise.all([waitForFonts(), waitMinimum(), preloadLaunchAssets()]);
      } catch (error) {
        console.warn('[Splash] prepare failed:', error);
      } finally {
        if (isMounted) {
          SplashScreen.hideAsync().catch(() => {
            // Ignore errors to avoid blocking the splash flow.
          });
          runSplashAnimation();
        }
      }
    };

    prepare();

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('app:resetToWelcome', () => {
      useAppStore.getState().clearAll();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrapRevenueCat = async () => {
      try {
        const result = await initializeRevenueCat();

        if (!isMounted) {
          return;
        }

        if (!result.initialized || !result.customerInfo) {
          setRevenueCatState({
            isPremium: false,
            membershipType: 'free',
            activeEntitlementIds: [],
            revenueCatInitialized: false,
          });
          if (result.reason) {
            console.log('[RevenueCat] Initialization skipped:', result.reason);
          }
          return;
        }

        const { isPremium, membershipType, activeEntitlementIds } = getPremiumStatusFromCustomerInfo(result.customerInfo);

        setRevenueCatState({
          isPremium,
          membershipType,
          activeEntitlementIds,
          revenueCatInitialized: true,
        });
      } catch (error) {
        console.warn('[RevenueCat] Initialization failed:', error);
        if (!isMounted) {
          return;
        }
        setRevenueCatState({
          isPremium: false,
          membershipType: 'free',
          activeEntitlementIds: [],
          revenueCatInitialized: false,
        });
      }
    };

    bootstrapRevenueCat();

    return () => {
      isMounted = false;
    };
  }, [setRevenueCatState]);


  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <RecordsProvider>
          <TabBarProvider>
            <View style={styles.appRoot}>
              {fontsLoaded ? <AppContent /> : <View style={styles.appPlaceholder} />}
              <AppReviewPromptModal />
              {showSplashOverlay && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.splashOverlay,
                    {
                      transform: [
                        {
                          translateY: splashAnim.interpolate({
                            inputRange: [0, 0.72, 1],
                            outputRange: [0, 0, -screenHeight - 24],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.splashImageWrap,
                      {
                        width: splashSize,
                        height: splashSize,
                      },
                    ]}
                  >
                    <Image source={splashImage} style={styles.splashImage} />
                  </View>
                </Animated.View>
              )}
            </View>
          </TabBarProvider>
        </RecordsProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: APP_SURFACE_COLOR,
  },
  appPlaceholder: {
    flex: 1,
    backgroundColor: APP_SURFACE_COLOR,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  splashImageWrap: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  splashImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: APP_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: APP_SURFACE_COLOR,
  },
  pageStack: {
    flex: 1,
    backgroundColor: APP_SURFACE_COLOR,
    overflow: 'hidden',
  },
  pageLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  pageVisible: {
    opacity: 1,
  },
  pageHidden: {
    opacity: 0,
  },
  pageDetached: {
    display: 'none',
  },
  page: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
