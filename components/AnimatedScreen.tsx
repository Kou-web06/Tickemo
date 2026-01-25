import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedScreenProps {
  children: React.ReactNode;
  isFocused: boolean;
  index: number;
  previousIndex: number;
}

export const AnimatedScreen: React.FC<AnimatedScreenProps> = ({
  children,
  isFocused,
  index,
  previousIndex,
}) => {
  const translateX = useRef(new Animated.Value(isFocused ? 0 : index > previousIndex ? SCREEN_WIDTH : -SCREEN_WIDTH)).current;

  useEffect(() => {
    if (isFocused) {
      // 画面がフォーカスされた場合：スライドイン
      const direction = index > previousIndex ? 1 : -1;
      translateX.setValue(SCREEN_WIDTH * direction);
      
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 150,
        damping: 25,
        mass: 1.2,
      }).start();
    } else {
      // 画面がフォーカスを失った場合：スライドアウト（反対方向へ）
      const direction = index < previousIndex ? 1 : -1;
      
      Animated.spring(translateX, {
        toValue: SCREEN_WIDTH * direction,
        useNativeDriver: true,
        stiffness: 150,
        damping: 25,
        mass: 1.2,
      }).start();
    }
  }, [isFocused, index, previousIndex]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          zIndex: isFocused ? 10 : 1,
          transform: [{ translateX }],
        },
      ]}
      pointerEvents={isFocused ? 'auto' : 'none'}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
