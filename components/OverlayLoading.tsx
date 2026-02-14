import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Text,
  ActivityIndicator,
} from 'react-native';

interface OverlayLoadingProps {
  visible: boolean;
  message?: string; // 「保存中...」とか出したい時用
}

export const OverlayLoading = ({ visible, message = '' }: OverlayLoadingProps) => {
  // 5本のバーそれぞれのアニメーション値を作成
  // 値は 0 (最小) 〜 1 (最大) を行き来させます
  const animations = useRef(
    [...Array(5)].map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (visible) {
      // アニメーションの定義
      const createAnimation = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            // 1. 伸びる
            Animated.timing(anim, {
              toValue: 1,
              duration: 500, // 0.5秒かけて伸びる
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true, // ネイティブスレッドで動かす（サクサク）
            }),
            // 2. 縮む
            Animated.timing(anim, {
              toValue: 0,
              duration: 500, // 0.5秒かけて縮む
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
      };

      // 5本を少しずつずらして開始（ウェーブ効果）
      const specificAnimations = animations.map((anim, index) => {
        // index * 100ms ずつ遅延させてスタート
        const animation = createAnimation(anim, index * 100);
        
        // ループ開始のタイミングをずらすためのsetTimeout
        setTimeout(() => {
          animation.start();
        }, index * 120); 

        return animation;
      });

      return () => {
        // アンマウント時や非表示時にリセット
        specificAnimations.forEach(anim => anim.stop());
        animations.forEach(anim => anim.setValue(0));
      };
    }
  }, [visible]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {}} // Androidの戻るボタン無効化
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.loaderContainer}>
            {animations.map((anim, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.bar,
                  {
                    // 0〜1の値を実際の高さ（スケール）に変換
                    transform: [
                      {
                        scaleY: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 1.5], // 40% 〜 150% の高さを行き来
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
          
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // 黒の半透明レイヤー（濃いめ）
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  loaderContainer: {
    flexDirection: 'row',
    height: 40, // アニメーションの基準高さ
    alignItems: 'center',
    gap: 6, // バー同士の間隔
  },
  bar: {
    width: 6, // バーの太さ
    height: 30, // バーの基準高さ
    backgroundColor: '#fff', // バーの色（白）
    borderRadius: 3,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
});