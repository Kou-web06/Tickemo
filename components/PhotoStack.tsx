import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Animated as RNAnimated,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  SharedValue,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useResolvedImageUris } from '../hooks/useResolvedImageUri';

interface PhotoStackProps {
  photos: string[];
  assetIds?: Array<string | null | undefined>;
  translateY?: RNAnimated.Value;
}

interface GridPhotoItemProps {
  photo: string;
  index: number;
  stackOriginX: number;
  stackOriginY: number;
  gridStartX: number;
  progress: SharedValue<number>;
  gridColumns: number;
  gridItemSize: number;
  gridSpacing: number;
  gridStartY: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const STACK_TOP = 160;
const STACK_RIGHT = -10;
const PHOTO_SIZE = 85;

const GRID_COLUMNS = 2;
const GRID_SPACING = 12;
const GRID_ITEM_SIZE = 150;
const GRID_START_Y = 230; // 展開時の上側余白

// グリッドアイテムコンポーネント（フックの順序を保つため分離）
const GridPhotoItem: React.FC<GridPhotoItemProps> = ({
  photo,
  index,
  stackOriginX,
  stackOriginY,
  gridStartX,
  progress,
  gridColumns,
  gridItemSize,
  gridSpacing,
  gridStartY,
}) => {
  const col = index % gridColumns;
  const row = Math.floor(index / gridColumns);
  const targetX = gridStartX + col * (gridItemSize + gridSpacing);
  const targetY = gridStartY + row * (gridItemSize + gridSpacing);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          (stackOriginX - gridItemSize / 2) +
          (targetX - (stackOriginX - gridItemSize / 2)) * progress.value,
      },
      {
        translateY:
          (stackOriginY - gridItemSize / 2) +
          (targetY - (stackOriginY - gridItemSize / 2)) * progress.value,
      },
      {
        scale: 0.9 + 0.1 * progress.value,
      },
    ],
    opacity: 0.85 + 0.15 * progress.value,
  }));

  return (
    <Animated.View
      style={[
        styles.gridPhotoWrapper,
        { width: gridItemSize, height: gridItemSize },
        animatedStyle,
      ]}
    >
      <View style={styles.polaroidFrameExpanded}>
        <Image source={{ uri: photo }} style={styles.gridPhoto} contentFit="cover" />
      </View>
    </Animated.View>
  );
};

export const PhotoStack: React.FC<PhotoStackProps> = ({ photos, assetIds, translateY }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // 右上スタックの中心座標（閉じた状態の集約位置）
  const stackOriginX = SCREEN_WIDTH + STACK_RIGHT - (PHOTO_SIZE + 16) / 2;
  const stackOriginY = STACK_TOP + (PHOTO_SIZE + 20) / 2;

  // グリッドの開始位置（中央揃え）
  const gridTotalWidth = GRID_COLUMNS * GRID_ITEM_SIZE + (GRID_COLUMNS - 1) * GRID_SPACING;
  const gridStartX = GRID_SPACING;

  // アニメーション進捗（0:閉 1:開）
  const progress = useSharedValue(0);

  const displayPhotos = useResolvedImageUris(photos, assetIds);

  // 閉じる処理
  const collapse = () => {
    progress.value = withTiming(0, { duration: 260 }, () => runOnJS(setIsExpanded)(false));
  };

  // 開く処理
  const expand = () => {
    setIsExpanded(true);
    progress.value = withTiming(1, {
      duration: 320,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  };

  // 背景のディミング
  const dimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.5,
  }));

  if (displayPhotos.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* 右上のタップ領域（閉じた状態の見た目） */}
      {!isExpanded && (
        <RNAnimated.View
          style={[
            styles.container,
            translateY ? {
              transform: [{
                translateX: translateY.interpolate({
                  inputRange: [0, 1000],
                  outputRange: [0, 400],
                  extrapolate: 'clamp',
                }),
              }],
            } : undefined,
          ]}
        >
        <TouchableOpacity
          style={{ width: '100%', height: '100%' }}
          onPress={expand}
          activeOpacity={0.9}
        >
        {displayPhotos.slice(-3).reverse().map((photo, index) => {
          // 各写真の個別設定（細かい調整が可能）
          const photoStyles = [
            { top: 0, left: 0, rotate: '0deg' },      // 1枚目（一番上）
            { top: -6, left: 8, rotate: '12deg' },   // 2枚目
            { top: -6, left: -8, rotate: '-12deg' },    // 3枚目
          ];
          const style = photoStyles[index] || photoStyles[0];
          
          return (
            <Animated.View
              key={`stack-${index}`}
              style={[
                styles.photoWrapper,
                {
                  zIndex: displayPhotos.length - index,
                  top: style.top,
                  left: style.left,
                  transform: [{ rotate: style.rotate }],
                },
              ]}
            >
              <View style={styles.polaroidFrame}>
                <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
              </View>
            </Animated.View>
          );
        })}
        {photos.length > 3 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>+{photos.length - 3}</Text>
          </View>
        )}
      </TouchableOpacity>
      </RNAnimated.View>
      )}

      {/* 展開オーバーレイ */}
      {isExpanded && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
          {/* 背景ディミング */}
          <TouchableWithoutFeedback onPress={collapse}>
            <Animated.View style={[styles.dimOverlay, dimStyle]} />
          </TouchableWithoutFeedback>

          {/* グリッドに向かうフォト群 */}
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {displayPhotos.map((photo, index) => (
            <GridPhotoItem
              key={`grid-${index}`}
              photo={photo}
              index={index}
              stackOriginX={stackOriginX}
              stackOriginY={stackOriginY}
              gridStartX={gridStartX}
              progress={progress}
              gridColumns={GRID_COLUMNS}
              gridItemSize={GRID_ITEM_SIZE}
              gridSpacing={GRID_SPACING}
              gridStartY={GRID_START_Y}
            />
          ))}

          {/* クローズボタン（右上） */}
          <TouchableOpacity style={styles.closeButton} onPress={collapse} activeOpacity={0.8}>
            <View style={styles.closeButtonCircle}>
              <Ionicons name="close" size={28} color="#fff" />
            </View>
          </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: STACK_TOP,
    right: STACK_RIGHT,
    width: PHOTO_SIZE + 16,
    height: PHOTO_SIZE + 20,
    zIndex: 10,
  },
  photoWrapper: {
    position: 'absolute',
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  polaroidFrame: {
    backgroundColor: '#fff',
    padding: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  photo: {
    width: PHOTO_SIZE - 8,
    height: PHOTO_SIZE - 8,
    borderRadius: 4,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 8,
    backgroundColor: '#000',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 20,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  dimOverlay: {
    position: 'absolute',
    top: 0,
    left: -30,
    right: 0,
    bottom: 0,
    width: '120%',
    height: '100%',
    backgroundColor: 'black',
  },
  gridPhotoWrapper: {
    position: 'absolute',
    borderRadius: 12,
    overflow: 'hidden',
  },
  polaroidFrameExpanded: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 6,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  gridPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 165,
    right: 18,
    zIndex: 50,
  },
  closeButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
