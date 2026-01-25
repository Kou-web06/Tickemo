import React, { useState, useRef } from 'react';
import { TouchableWithoutFeedback, View, StyleSheet, Animated } from 'react-native';

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  style?: any;
}

export const FlipCard: React.FC<FlipCardProps> = ({ front, back, style }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  const handleFlip = () => {
    const toValue = isFlipped ? 0 : 180;
    
    Animated.spring(animatedValue, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    
    setIsFlipped(!isFlipped);
  };

  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  return (
    <TouchableWithoutFeedback onPress={handleFlip}>
      <View style={[styles.container, style]}>
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardFront,
            frontAnimatedStyle,
          ]}
        >
          {front}
        </Animated.View>
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardBack,
            backAnimatedStyle,
          ]}
        >
          {back}
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  cardFace: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    zIndex: 2,
  },
  cardBack: {
    zIndex: 1,
  },
});
