import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Octicons, Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import { theme } from '../theme';

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export const FloatingTabBar: React.FC<TabBarProps> = ({ state, descriptors, navigation }) => {
  const [pressedTab, setPressedTab] = useState<string | null>(null);
  
  // Check if any focused route wants to hide the tab bar
  const focusedRoute = state.routes[state.index];
  const { options } = descriptors[focusedRoute.key];
  
  // If tabBarStyle has display: 'none', don't render the tab bar
  if (options.tabBarStyle?.display === 'none') {
    return null;
  }

  const getIconInfo = (routeName: string): { IconComponent: any; name: string } => {
    switch (routeName) {
      case 'Home':
        return { IconComponent: Ionicons, name: 'albums' };
      case 'Countdown':
        return { IconComponent: Octicons, name: 'home-fill' };
      case 'Statistics':
        return { IconComponent: Ionicons, name: 'stats-chart' };
      default:
        return { IconComponent: Octicons, name: 'circle' };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBarWrapper}>
        <BlurView intensity={50} tint="dark" style={styles.blurView}>
          <View style={styles.tabBar}>
            {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const isPressed = pressedTab === route.key;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
            setPressedTab(null);
          };

          const onPressIn = () => {
            setPressedTab(route.key);
          };

          const onPressOut = () => {
            setPressedTab(null);
          };

          const { IconComponent, name: iconName } = getIconInfo(route.name);

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={styles.tab}
              activeOpacity={0.7}
            >
              <IconComponent
                name={iconName}
                size={theme.tabBar.iconSize}
                color={(isFocused || isPressed) ? theme.colors.tabBar.activeIcon : theme.colors.tabBar.inactiveIcon}
              />
            </TouchableOpacity>
          ); })}
          </View>
        </BlurView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: theme.tabBar.bottomOffset,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    zIndex: 9999,
  },
  tabBarWrapper: {
    borderRadius: theme.tabBar.borderRadius,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  blurView: {
    borderRadius: theme.tabBar.borderRadius,
    overflow: 'hidden',
  },
  tabBar: {
    minWidth: 220,
    flexDirection: 'row',
    borderRadius: theme.tabBar.borderRadius,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: theme.tabBar.padding,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxl,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.xs,
  },
});
