import { useEffect, useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';

type CheckedOverlayProps = {
  visible: boolean;
  animationKey: number;
  onFinish: () => void;
};

export function CheckedOverlay({ visible, animationKey, onFinish }: CheckedOverlayProps) {
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    if (visible) {
      animationRef.current?.play(0);
    }
  }, [visible, animationKey]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={styles.overlay} pointerEvents="none">
        <LottieView
          key={animationKey}
          ref={animationRef}
          source={require('../assets/animations/Checked.json')}
          autoPlay
          loop={false}
          onAnimationFinish={onFinish}
          style={styles.animation}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  animation: {
    width: 250,
    height: 250,
  },
});
