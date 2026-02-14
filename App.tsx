import { View, StyleSheet, DeviceEventEmitter, Animated, Dimensions, Image, Easing } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import PagerView from 'react-native-pager-view';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import CollectionScreen from './screens/CollectionScreen';
import CountdownScreen from './screens/CountdownScreen';
import StatisticsScreen from './screens/StatisticsScreen';
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

// Keep the splash screen visible while we fetch fonts
SplashScreen.preventAutoHideAsync();

// ================ Root App Component ================
function AppContent() {
  const [currentPage, setCurrentPage] = useState(1); // デフォルトを中央のタブに設定
  const pagerRef = useRef<PagerView>(null);
  const { isTabBarVisible } = useTabBar();
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  const handleNotificationTap = (data: any) => {
    console.log('[App] Notification tapped:', data);
    if (data?.recordId && data?.kind === 'after_show') {
      // グローバルに通知情報を設定
      setGlobalNotification({
        recordId: data.recordId,
        kind: data.kind,
      });
      // Collection（ホーム）タブに切り替え
      setCurrentPage(0);
      pagerRef.current?.setPage(0);
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
        </PagerView>

        {/* バナー広告は本番環境のみ表示（TestFlight はコメントアウト）
        {isBannerVisible && !isTestflightMode && (
          <View style={styles.bannerContainer}>
            <AdmobBanner />
          </View>
        )}
        */}

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
  const fontsLoadedRef = useRef(fontsLoaded);
  const [showSplashOverlay, setShowSplashOverlay] = useState(true);
  const splashAnim = useRef(new Animated.Value(0)).current;
  const splashImage = useRef(require('./assets/splash.png')).current;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const splashSize = Math.max(screenWidth, screenHeight);

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
    width: '80%',
    height: '80%',
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
