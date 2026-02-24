import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
} from 'react-native';
import LottieView from 'lottie-react-native';

interface OverlayLoadingProps {
  visible: boolean;
  message?: string;
}

export const OverlayLoading = ({ visible, message = '' }: OverlayLoadingProps) => {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LottieView
            source={require('../assets/animations/Loading.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
          
          {/* メッセージがある場合のみ表示 */}
          {!!message && <Text style={styles.text}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  lottie: {
    width: 150,
    height: 150,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
});