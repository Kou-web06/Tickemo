import React from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Home01Icon,
  Home05Icon,
  Calendar03Icon,
  CalendarFold,
  LayoutGridIcon,
  GridViewIcon,
  Settings03Icon,
} from '@hugeicons/core-free-icons';

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

const HAPTICS_ENABLED_KEY = '@haptics_enabled';

export const FloatingTabBar: React.FC<TabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const settingsSpin = React.useRef(new Animated.Value(0)).current;
  const [isHapticsEnabled, setIsHapticsEnabled] = React.useState(true);
  const routes = Array.isArray(state?.routes) ? state.routes : [];
  const activeIndex = typeof state?.index === 'number' ? state.index : 0;

  React.useEffect(() => {
    const loadHapticsPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(HAPTICS_ENABLED_KEY);
        if (stored === null) {
          setIsHapticsEnabled(true);
          return;
        }
        setIsHapticsEnabled(stored === 'true');
      } catch {
        setIsHapticsEnabled(true);
      }
    };

    void loadHapticsPreference();

    const subscription = DeviceEventEmitter.addListener('haptics:changed', (nextValue?: boolean) => {
      if (typeof nextValue !== 'boolean') return;
      setIsHapticsEnabled(nextValue);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const shouldTriggerHaptics = !isHapticsEnabled;

  if (routes.length === 0) {
    return null;
  }

  const settingsRotate = settingsSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  // Check if any focused route wants to hide the tab bar
  const focusedRoute = routes[activeIndex] || routes[0];
  const { options } = descriptors?.[focusedRoute.key] ?? { options: {} };
  
  // If tabBarStyle has display: 'none', don't render the tab bar
  if (options.tabBarStyle?.display === 'none') {
    return null;
  }

  const getIconInfo = (routeName: string, isFocused: boolean) => {
    switch (routeName) {
      case 'Home':
        return isFocused ? Home01Icon : Home05Icon;
      case 'Calendar':
        return isFocused ? Calendar03Icon : CalendarFold;
      case 'Statistics':
        return isFocused ? GridViewIcon : LayoutGridIcon;
      case 'Settings':
        return Settings03Icon;
      default:
        return Home01Icon;
    }
  };

  const spinSettingsIcon = () => {
    settingsSpin.setValue(0);
    Animated.timing(settingsSpin, {
      toValue: 1,
      duration: 150,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[styles.container, { bottom: insets.bottom > 0 ? insets.bottom - 10 : 0 }]}>
      <BlurView tint="light" intensity={80} style={styles.tabBar}>
        <View style={styles.tabBarContent}>
          {routes.map((route: any, index: number) => {
          const { options } = descriptors?.[route.key] ?? { options: {} };
          const isFocused = activeIndex === index;

          const onPress = () => {
            if (route.name === 'Settings') {
              spinSettingsIcon();
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!event.defaultPrevented && isFocused && route.name === 'Settings') {
              navigation.navigate(route.name);
            } else if (!isFocused && !event.defaultPrevented) {
              if (shouldTriggerHaptics) {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
                  // Ignore haptics errors on unsupported devices.
                });
              }
              navigation.navigate(route.name);
            }
          };

          const icon = getIconInfo(route.name, isFocused);
          const iconNode = (
            <HugeiconsIcon icon={icon} size={24} color={isFocused ? '#FFFFFF' : '#A890B3'} strokeWidth={1.8} />
          );
          const renderedIcon = route.name === 'Settings' ? (
            <Animated.View style={{ transform: [{ rotate: settingsRotate }] }}>{iconNode}</Animated.View>
          ) : (
            iconNode
          );

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                style={styles.tab}
                activeOpacity={0.9}
              >
                {isFocused ? (
                  <View style={styles.activeCircle}>
                    {renderedIcon}
                  </View>
                ) : (
                  renderedIcon
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    alignSelf: 'center',
    zIndex: 9999,
  },
  tabBar: {
    width: '85%',
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(243, 229, 250, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    shadowColor: '#6C3A8D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 15,
    elevation: 5,
  },
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircle: {
    width: 65,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#A328DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
