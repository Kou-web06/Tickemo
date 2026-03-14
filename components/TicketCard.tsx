import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback, Easing, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Rect, Defs, Pattern, Use, Image as SvgImage } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import TextTicker from 'react-native-text-ticker';
import { ChekiRecord } from '../contexts/RecordsContext';
import { NO_IMAGE_URI, useResolvedImageUri } from '../hooks/useResolvedImageUri';
import { buildTicketArtistDisplay } from '../utils/artistDisplay';
import { DummyJacket } from '../components/DummyJacket';

interface TicketCardProps {
  record: ChekiRecord;
  width: number;
  isAnimating?: boolean;
  animationDirection?: 'out' | 'in';
  onAnimationEnd?: () => void;
  animationProgress?: Animated.AnimatedInterpolation<number> | number; // 0~1, 親から連動
}

export const TicketCard: React.FC<TicketCardProps> = ({ record, width, isAnimating = false, animationDirection = 'out', onAnimationEnd, animationProgress }) => {
  const height = width * 0.366; // 118/322 ratio from SVG
  const imageSize = height * 0.619; // 73/118
  const liveName = record.liveName || '-';
  const isLongName = liveName.length >= 8;
  const coverUri = useResolvedImageUri(record.imageUrls?.[0], record.imageAssetIds?.[0]);
  const hasCoverImage = Boolean(coverUri && coverUri !== NO_IMAGE_URI);
  const artistDisplay = buildTicketArtistDisplay(record.artists, record.artist);

  const backgroundSlideAnim = useRef(new Animated.Value(0)).current;
  const jacketSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isAnimating) {
      if (animationDirection === 'out') {
        // スライドアウト: 0→1（中央 → 画面外）
        backgroundSlideAnim.setValue(0);
        jacketSlideAnim.setValue(0);
        Animated.parallel([
          Animated.timing(backgroundSlideAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(jacketSlideAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished && onAnimationEnd) onAnimationEnd();
        });
      } else if (animationDirection === 'in') {
        // スライドイン: 0→1（画面外 → 中央）
        // value=0 を画面外、value=1 を中央とみなす
        backgroundSlideAnim.setValue(0);
        jacketSlideAnim.setValue(0);
        Animated.parallel([
          Animated.timing(backgroundSlideAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(jacketSlideAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished && onAnimationEnd) onAnimationEnd();
        });
      }
      // animationDirection が 'in' でも 'out' でもない場合は何もしない
    } else {
      // 非アニメーション時は中央位置にリセット
      // animationDirection が 'out' のデフォルト値の場合、value=0 が中央位置（translateX=0）になる
      // animationDirection が 'in' の場合、value=1 が中央位置（translateX=0）になる
      if (animationDirection === 'in') {
        backgroundSlideAnim.setValue(1);
        jacketSlideAnim.setValue(1);
      } else {
        backgroundSlideAnim.setValue(0);
        jacketSlideAnim.setValue(0);
      }
    }
  }, [isAnimating, animationDirection, onAnimationEnd]);

  // animationProgressが指定されていればそれを完全に優先（0:中央, 1:画面外）
  let backgroundTranslateX, jacketTranslateX;
  if (animationProgress !== undefined) {
    // 0:中央, 1:画面外
    if (typeof animationProgress === 'number') {
      backgroundTranslateX = animationProgress * width * 1.5;
      jacketTranslateX = animationProgress * -width * 1.5;
    } else {
      backgroundTranslateX = animationProgress.interpolate({ inputRange: [0, 1], outputRange: [0, width * 1.5] });
      jacketTranslateX = animationProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -width * 1.5] });
    }
  } else {
    // 従来の内部アニメーション
    backgroundTranslateX = backgroundSlideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: animationDirection === 'out'
        ? [0, width * 1.5]
        : [width * 1.5, 0],
    });
    jacketTranslateX = jacketSlideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: animationDirection === 'out'
        ? [0, -width * 1.5]
        : [-width * 1.5, 0],
    });
  }

  return (
    <View
      style={[styles.container, { width, height }]}
    >
      <Animated.View
        style={{
          transform: [{ translateX: backgroundTranslateX }],
        }}
      >
        <Svg width={width} height={height} viewBox="0 0 322 118">
          {/* Main ticket shape with notches */}
          <Path
            d="M111 0C111 2.20914 112.791 4 115 4C117.209 4 119 2.20914 119 0H313.014C313.261 4.77874 317.04 8.62009 321.791 8.9707V108.028C316.876 108.391 313 112.492 313 117.5C313 117.668 313.005 117.834 313.014 118H118.874C118.956 117.68 119 117.345 119 117C119 114.791 117.209 113 115 113C112.791 113 111 114.791 111 117C111 117.345 111.044 117.68 111.126 118H9C9 113.029 4.97056 109 0 109V8.98633C0.165593 8.99492 0.33227 9 0.5 9C5.57897 9 9.7263 5.01426 9.98633 0H111ZM115 100C112.791 100 111 101.791 111 104C111 106.209 112.791 108 115 108C117.209 108 119 106.209 119 104C119 101.791 117.209 100 115 100ZM115 87C112.791 87 111 88.7909 111 91C111 93.2091 112.791 95 115 95C117.209 95 119 93.2091 119 91C119 88.7909 117.209 87 115 87ZM115 74C112.791 74 111 75.7909 111 78C111 80.2091 112.791 82 115 82C117.209 82 119 80.2091 119 78C119 75.7909 117.209 74 115 74ZM115 61C112.791 61 111 62.7909 111 65C111 67.2091 112.791 69 115 69C117.209 69 119 67.2091 119 65C119 62.7909 117.209 61 115 61ZM115 48C112.791 48 111 49.7909 111 52C111 54.2091 112.791 56 115 56C117.209 56 119 54.2091 119 52C119 49.7909 117.209 48 115 48ZM115 35C112.791 35 111 36.7909 111 39C111 41.2091 112.791 43 115 43C117.209 43 119 41.2091 119 39C119 36.7909 117.209 35 115 35ZM115 22C112.791 22 111 23.7909 111 26C111 28.2091 112.791 30 115 30C117.209 30 119 28.2091 119 26C119 23.7909 117.209 22 115 22ZM115 9C112.791 9 111 10.7909 111 13C111 15.2091 112.791 17 115 17C117.209 17 119 15.2091 119 13C119 10.7909 117.209 9 115 9Z"
            fill="white"
          />
        </Svg>
      </Animated.View>

      {/* Jacket image offset on top-left - Outside contentContainer for independent animation */}
      <Animated.View
        style={[
          styles.jacketShadow,
          { width: imageSize * 1.3, height: imageSize * 1.3 },
          {
            transform: [{ translateX: jacketTranslateX }],
          },
        ]}
      >
        <View style={styles.jacketContainer}>
          {hasCoverImage ? (
            <Image
              source={{ uri: coverUri as string }}
              style={styles.image}
              contentFit="cover"
            />
          ) : (
            <DummyJacket style={styles.image} />
          )}
        </View>
      </Animated.View>

      {/* Content overlay */}
      <Animated.View
        style={[
          styles.contentContainer,
          { height },
          {
            transform: [{ translateX: backgroundTranslateX }],
          },
        ]}
      >
        {/* QR Code in center-left */}
        <View style={[styles.qrContainer, { width: imageSize * 1.2, height: imageSize * 1.2 }]}>
          {record.qrCode ? (
            <QRCode
              value={record.qrCode}
              size={imageSize}
              color="#000"
              backgroundColor="#fff"
            />
          ) : (
            <Image
              source={require('../assets/no-qr.png')}
              style={{ width: imageSize, height: imageSize }}
              contentFit="contain"
            />
          )}
        </View>

        {/* Text info on the right */}
        <View style={styles.infoContainer}>
          {isLongName ? (
            <View style={styles.titleContainer}>
              <TextTicker
                style={styles.titleText}
                duration={liveName.length * 250}
                loop
                bounce={false}
                repeatSpacer={40}
                marqueeDelay={1000}
              >
                {liveName}
              </TextTicker>
            </View>
          ) : (
            <Text style={styles.title} numberOfLines={1}>
              {liveName}
            </Text>
          )}
          <Text
            style={styles.subtitle}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
          >
            {artistDisplay.mainText}
            {artistDisplay.showAndMore && <Text style={styles.andMoreText}> and more...</Text>}
          </Text>
          <View style={styles.details}>
            <View style={styles.detailColumn}>
              <View style={{ flexDirection: 'row', marginRight: 15 }}>
                <Text style={styles.detailLabel}>DATE</Text>
                <Text style={styles.detailValue}>{record.date || '-'}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <Text style={styles.detailLabel}>VENUE</Text>
                {(record.venue || '-').length >= 8 ? (
                  <View style={styles.venueTickerContainer}>
                    <TextTicker
                      style={styles.detailValue}
                      duration={(record.venue || '-').length * 250}
                      loop
                      bounce={false}
                      repeatSpacer={40}
                      marqueeDelay={1000}
                    >
                      {record.venue || '-'}
                    </TextTicker>
                  </View>
                ) : (
                  <Text style={styles.detailValue}>
                    {record.venue || '-'}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row' }}>
                <Text style={styles.detailLabel}>SEAT</Text>
                <Text style={styles.detailValue}>
                  {record.seat || '-'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    shadowColor: '#1b1b1b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 10,
  },
  contentContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  qrContainer: {
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jacketShadow: {
    position: 'absolute',
    left: -10,
    top: 8,
    shadowColor: '#000',
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  jacketContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
    position: 'relative',
    height: '100%',
  },
  titleContainer: {
    position: 'absolute',
    top: 0,
    left: 25,
    width: 164,
    height: 20,
  },
  title: {
    position: 'absolute',
    top: 0,
    left: 25,
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
  subtitle: {
    position: 'absolute',
    top: 23,
    left: 23,
    width: 164,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  andMoreText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#777',
  },
  details: {
    gap: 2,
  },
  detailColumn: {
    position: 'absolute',
    top: 0,
    left: 25,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
    marginRight: 6,
    minWidth: 40,
  },
  detailValue: {
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },
  venueTickerContainer: {
    width: 106,
    height: 18,
    justifyContent: 'center',
  },
});
