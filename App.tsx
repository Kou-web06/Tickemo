import { View, StyleSheet, DeviceEventEmitter, Animated, Dimensions, Image, Easing, Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PagerView from 'react-native-pager-view';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import CollectionScreen from './screens/CollectionScreen';
import CountdownScreen from './screens/CountdownScreen';
import StatisticsScreen from './screens/StatisticsScreen';
import SettingsScreen, { FAQScreen } from './screens/SettingsScreen';
import ProfileEditScreen from './screens/ProfileEditScreen';
import ICloudSyncScreen from './screens/ICloudSyncScreen';
import { PaywallScreen } from './screens';
import { FloatingTabBar } from './components/FloatingTabBar';
import { AdmobBanner } from './components/AdmobBanner';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from './theme';
import { RecordsProvider } from './contexts/RecordsContext';
import { TabBarProvider, useTabBar } from './contexts/TabBarContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { usePushNotifications } from './hooks/usePushNotifications';
import { setGlobalNotification } from './contexts/NotificationContext';
import { useAppStore } from './store/useAppStore';
import { isTestflightMode } from './utils/appMode';
import { getPremiumStatusFromCustomerInfo, initializeRevenueCat } from './lib/revenuecat';

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
  const [currentPage, setCurrentPage] = useState(1); // デフォルトを中央のタブに設定
  const pagerRef = useRef<PagerView>(null);
  const { isTabBarVisible } = useTabBar();
  const isPremium = useAppStore((state) => state.isPremium);
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  // タブレット検出と警告（起動時のみ）
  useEffect(() => {
    if (isTablet()) {
      Alert.alert(
        'ご注意',
        'このアプリはスマートフォン向けに最適化されています。タブレットでは一部の表示が最適でない場合があります。',
        [{ text: 'OK' }]
      );
    }
  }, []);

  const handleNotificationTap = (data: any) => {
    console.log('[App] Notification tapped:', data);
    
    if (!data) return;

    // タイムカプセル通知：該当ライブの詳細画面へ
    if (data.type === 'timecapsule' && data.recordId) {
      setGlobalNotification({
        recordId: data.recordId,
        kind: data.kind,
      });
      setCurrentPage(0); // Collection画面へ
      pagerRef.current?.setPage(0);
      return;
    }

    // 年次レポート通知：レポート画面の年間タブへ
    if (data.type === 'yearly_report') {
      setGlobalNotification({
        recordId: data.recordId,
        kind: data.kind,
      });
      setCurrentPage(2); // Statistics画面へ
      pagerRef.current?.setPage(2);
      return;
    }

    // ライブリマインダー通知（after_show）：ライブ編集画面へ
    if (data.type === 'live_reminder' && data.recordId && data.kind === 'after_show') {
      setGlobalNotification({
        recordId: data.recordId,
        kind: data.kind,
      });
      setCurrentPage(0); // Collection画面へ
      pagerRef.current?.setPage(0);
      return;
    }
  };

  usePushNotifications(handleNotificationTap);

  const handlePageSelected = (e: any) => {
    setCurrentPage(e.nativeEvent.position);
  };

  const handleTabPress = (index: number) => {
    setCurrentPage(index); // 即座に状態を更新
    pagerRef.current?.setPage(index);
  };

  const routes = [
    { key: 'home', name: 'Home' },
    { key: 'countdown', name: 'Countdown' },
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
    const subscription = DeviceEventEmitter.addListener('app:bannerVisibility', (visible?: boolean) => {
      if (typeof visible === 'boolean') {
        setIsBannerVisible(visible);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('app:goToHome', () => {
      setCurrentPage(0);
      pagerRef.current?.setPage(0);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (currentPage !== 3) {
      setIsBannerVisible(true);
    }
  }, [currentPage]);


  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
      <View style={styles.container}>
        <PagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={1}
          onPageSelected={handlePageSelected}
          scrollEnabled={false}
          overScrollMode="never"
          keyboardDismissMode="on-drag"
        >
          <View key="home" style={styles.page}>
            <NavigationContainer independent={true}>
              <CollectionScreen />
            </NavigationContainer>
          </View>
          <View key="countdown" style={styles.page}>
            <NavigationContainer independent={true}>
              <CountdownScreen />
            </NavigationContainer>
          </View>
          <View key="statistics" style={styles.page}>
            <NavigationContainer independent={true}>
              <StatisticsScreen />
            </NavigationContainer>
          </View>
          <View key="settings" style={styles.page}>
            <NavigationContainer independent={true}>
              <SettingsStackScreen />
            </NavigationContainer>
          </View>
        </PagerView>

        {/* バナー広告 */}
        {!isPremium && isBannerVisible && (
          <View style={styles.bannerContainer}>
            <AdmobBanner />
          </View>
        )}

        {/* フローティングタブバー */}
        {isTabBarVisible && (
          <View style={styles.tabBarContainer}>
            <FloatingTabBar
              state={{
                index: currentPage,
                routes: routes,
              }}
              descriptors={descriptors}
              navigation={{
                navigate: (name: string) => {
                  const index = routes.findIndex((route) => route.name === name);
                  if (index >= 0) {
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
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        if (isMounted) {
          setShowSplashOverlay(false);
        }
      });
    };

    const prepare = async () => {
      try {
        await Promise.all([waitForFonts(), waitMinimum()]);
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
    <NetworkProvider>
      <RecordsProvider>
        <TabBarProvider>
          <View style={styles.appRoot}>
            {fontsLoaded ? <AppContent /> : <View style={styles.appPlaceholder} />}
            {showSplashOverlay && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.splashOverlay,
                  {
                    opacity: splashAnim.interpolate({
                      inputRange: [0, 0.8, 1],
                      outputRange: [1, 1, 0],
                    }),
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.splashImageWrap,
                    {
                      width: splashSize,
                      height: splashSize,
                      borderRadius: splashAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, splashSize / 2],
                      }),
                      transform: [
                        {
                          scale: splashAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 0.06],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Image source={splashImage} style={styles.splashImage} />
                </Animated.View>
              </Animated.View>
            )}
          </View>
        </TabBarProvider>
      </RecordsProvider>
    </NetworkProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  appPlaceholder: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
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
    backgroundColor: theme.colors.background.primary,
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  },
  bannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 2000,
    elevation: 20,
  },
});
