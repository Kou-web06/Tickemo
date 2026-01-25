import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import PagerView from 'react-native-pager-view';
import CollectionScreen from './screens/CollectionScreen';
import CountdownScreen from './screens/CountdownScreen';
import { FloatingTabBar } from './components/FloatingTabBar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from './theme';
import { RecordsProvider } from './contexts/RecordsContext';
import { TabBarProvider, useTabBar } from './contexts/TabBarContext';

// Keep the splash screen visible while we fetch fonts
SplashScreen.preventAutoHideAsync();

// ================ Root App Component ================
function AppContent() {
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const { isTabBarVisible } = useTabBar();

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

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
      <View style={styles.container}>
        <PagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={0}
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
        </PagerView>

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
                  const index = name === 'Home' ? 0 : 1;
                  handleTabPress(index);
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
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <RecordsProvider>
      <TabBarProvider>
        <AppContent />
      </TabBarProvider>
    </RecordsProvider>
  );
}

const styles = StyleSheet.create({
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
    bottom: 0,
    left: 0,
    right: 0,
  },
});
