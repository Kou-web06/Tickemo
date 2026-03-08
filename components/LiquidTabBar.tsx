import React, { useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { getAppWidth } from '../utils/layout';

const SCREEN_WIDTH = getAppWidth();

// グローバルなスクロールオフセット値を管理（単純なオブジェクトとして）
export const tabBarScrollOffset = { value: 0 };

export const LiquidTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  // 現在フォーカスされているタブのオプションを参照し、表示/非表示を制御
  try {
    const focusedKey = state.routes[state.index]?.key;
    const focusedOptions: any = focusedKey ? descriptors[focusedKey]?.options : undefined;
    const styleProp = focusedOptions?.tabBarStyle;
    const isHidden = Array.isArray(styleProp)
      ? styleProp.some((s) => s && typeof s === 'object' && (s as any).display === 'none')
      : styleProp && typeof styleProp === 'object' && (styleProp as any).display === 'none';
    if (isHidden) {
      return null;
    }
  } catch (e) {
    // 何もしない（安全にフォールバックして表示）
  }
  const handlePress = useCallback(
    (routeName: string) => {
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes[state.index].key,
        canPreventDefault: true,
      });

      if (!event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation, state]
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <BlurView intensity={90} tint="light" style={styles.blurContainer}>
        <View style={styles.tabBarContent}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const tabBarIcon = options.tabBarIcon as any;

            return (
              <TouchableOpacity
                key={route.key}
                style={styles.tabButton}
                onPress={() => handlePress(route.name)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconContainer,
                    isFocused && styles.activeIconContainer,
                  ]}
                >
                  {tabBarIcon ? (
                    tabBarIcon({
                      color: isFocused ? '#FFFFFF' : '#999999',
                      size: 24,
                    })
                  ) : (
                    <Feather
                      name="home"
                      size={24}
                      color={isFocused ? '#FFFFFF' : '#999999'}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    width: SCREEN_WIDTH - 40,
    zIndex: 50,
  },
  blurContainer: {
    height: 70,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 0, 0, 0.2)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0)',
  },
  activeIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});
