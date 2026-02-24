import React, { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';

type TiltTicketCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
  sensitivity?: number;
  maxTiltDeg?: number;
};

const DEFAULT_SENSITIVITY = 200;
const DEFAULT_MAX_TILT_DEG = 20;

const TiltTicketCard: React.FC<TiltTicketCardProps> = ({
  children,
  style,
  cardStyle,
  sensitivity = DEFAULT_SENSITIVITY,
  maxTiltDeg = DEFAULT_MAX_TILT_DEG,
}) => {
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          tension: 40,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          tension: 40,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const rotateX = useMemo(
    () =>
      pan.y.interpolate({
        inputRange: [-sensitivity, sensitivity],
        outputRange: [`${maxTiltDeg}deg`, `-${maxTiltDeg}deg`],
        extrapolate: 'clamp',
      }),
    [maxTiltDeg, pan.y, sensitivity]
  );

  const rotateY = useMemo(
    () =>
      pan.x.interpolate({
        inputRange: [-sensitivity, sensitivity],
        outputRange: [`-${maxTiltDeg}deg`, `${maxTiltDeg}deg`],
        extrapolate: 'clamp',
      }),
    [maxTiltDeg, pan.x, sensitivity]
  );

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.cardWrapper,
          cardStyle,
          {
            transform: [{ perspective: 1000 }, { rotateX }, { rotateY }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
});

export default TiltTicketCard;
