import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, GestureResponderEvent, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, {
  Path,
  Defs,
  G,
  Filter,
  FeFlood,
  FeColorMatrix,
  FeOffset,
  FeGaussianBlur,
  FeComposite,
  FeBlend,
} from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { ChekiRecord } from '../contexts/RecordsContext';
import { FallbackQRCode } from './FallbackQRCode';
import { NO_IMAGE_URI } from '../hooks/useResolvedImageUri';
import TiltTicketCard from './TiltTicketCard';
import { DummyJacket } from './DummyJacket';

export type TicketMaterial = 'paper' | 'matte' | 'holo';
export type StickerType =
  | 'none'
  | 'sticker1'
  | 'sticker2'
  | 'sticker3'
  | 'sticker4'
  | 'sticker5'
  | 'sticker6'
  | 'sticker7'
  | 'sticker8';
export type TicketFilterId = 'normal' | 'nostalgia' | 'cinematic' | 'mono';

interface EditableTicketPreviewProps {
  record: ChekiRecord;
  coverUri: string | null;
  captureBlurBackground: boolean;
  outputWidth: number;
  outputHeight: number;
  displayScale: number;
  selectedSticker: StickerType;
  backgroundColor: string;
  selectedFilterId: TicketFilterId;
  captureViewRef: React.RefObject<View | null>;
}

const DEFAULT_TICKET_BG_COLOR = '#FFFFFF';
const GRID_SNAP_SIZE = 16;
const SNAP_THRESHOLD = 8;

type SnapKind = 'edge-start' | 'edge-end' | 'grid' | null;

interface SnapResult {
  value: number;
  kind: SnapKind;
}

const STICKER_IMAGES: Partial<Record<Exclude<StickerType, 'none'>, any>> = {
  // Sticker images have been removed
};

const TICKET_SHAPE_PATH_D =
  'M126 15C126 17.2091 127.791 19 130 19C132.209 19 134 17.2091 134 15H328.014C328.261 19.7787 332.04 23.6201 336.791 23.9707V123.028C331.876 123.391 328 127.492 328 132.5C328 132.668 328.005 132.834 328.014 133H133.874C133.956 132.68 134 132.345 134 132C134 129.791 132.209 128 130 128C127.791 128 126 129.791 126 132C126 132.345 126.044 132.68 126.126 133H24C24 128.029 19.9706 124 15 124V23.9863C15.1656 23.9949 15.3323 24 15.5 24C20.579 24 24.7263 20.0143 24.9863 15H126ZM130 115C127.791 115 126 116.791 126 119C126 121.209 127.791 123 130 123C132.209 123 134 121.209 134 119C134 116.791 132.209 115 130 115ZM130 102C127.791 102 126 103.791 126 106C126 108.209 127.791 110 130 110C132.209 110 134 108.209 134 106C134 103.791 132.209 102 130 102ZM130 89C127.791 89 126 90.7909 126 93C126 95.2091 127.791 97 130 97C132.209 97 134 95.2091 134 93C134 90.7909 132.209 89 130 89ZM130 76C127.791 76 126 77.7909 126 80C126 82.2091 127.791 84 130 84C132.209 84 134 82.2091 134 80C134 77.7909 132.209 76 130 76ZM130 63C127.791 63 126 64.7909 126 67C126 69.2091 127.791 71 130 71C132.209 71 134 69.2091 134 67C134 64.7909 132.209 63 130 63ZM130 50C127.791 50 126 51.7909 126 54C126 56.2091 127.791 58 130 58C132.209 58 134 56.2091 134 54C134 51.7909 132.209 50 130 50ZM130 37C127.791 37 126 38.7909 126 41C126 43.2091 127.791 45 130 45C132.209 45 134 43.2091 134 41C134 38.7909 132.209 37 130 37ZM130 24C127.791 24 126 25.7909 126 28C126 30.2091 127.791 32 130 32C132.209 32 134 30.2091 134 28C134 25.7909 132.209 24 130 24Z';

const NOSTALGIA_MATRIX = [
  0.9, 0, 0, 0, 0.05,
  0, 0.8, 0, 0, 0.08,
  0, 0, 0.7, 0, 0.15,
  0, 0, 0, 1, 0,
] as const;

const CINEMATIC_MATRIX = [
  1.1, 0, 0, 0, -0.05,
  0, 1.0, 0, 0, 0.02,
  0, 0, 1.2, 0, 0.05,
  0, 0, 0, 1, 0,
] as const;

const MONO_MATRIX = [
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0, 0, 0, 1, 0,
] as const;

const MONO_CONTRAST_MATRIX = [
  0.4, 0.4, 0.4, 0, -0.1,
  0.4, 0.4, 0.4, 0, -0.1,
  0.4, 0.4, 0.4, 0, -0.1,
  0, 0, 0, 1, 0,
] as const;

const matrixToValues = (matrix: readonly number[]) => matrix.join(' ');

const normalizeHexColor = (hex: string): string => {
  if (!hex || typeof hex !== 'string') return DEFAULT_TICKET_BG_COLOR;
  const trimmed = hex.trim();
  if (!trimmed.startsWith('#')) return DEFAULT_TICKET_BG_COLOR;

  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  if (trimmed.length >= 7) {
    return `#${trimmed.slice(1, 7)}`.toUpperCase();
  }

  return DEFAULT_TICKET_BG_COLOR;
};

const getYiqContrastTextColor = (hexColor: string): '#111111' | '#FFFFFF' => {
  const normalized = normalizeHexColor(hexColor);
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
  return yiq >= 160 ? '#111111' : '#FFFFFF';
};

const clampValue = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const snapToGridAndEdges = (value: number, max: number): SnapResult => {
  if (Math.abs(value) <= SNAP_THRESHOLD) return { value: 0, kind: 'edge-start' };
  if (Math.abs(max - value) <= SNAP_THRESHOLD) return { value: max, kind: 'edge-end' };

  const nearestGrid = Math.round(value / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
  if (Math.abs(nearestGrid - value) <= SNAP_THRESHOLD) {
    return { value: clampValue(nearestGrid, 0, max), kind: 'grid' };
  }

  return { value, kind: null };
};

const getTwoTouchInfo = (event: GestureResponderEvent) => {
  const touches = event.nativeEvent.touches;
  if (!touches || touches.length < 2) return null;

  const first = touches[0];
  const second = touches[1];
  const deltaX = second.pageX - first.pageX;
  const deltaY = second.pageY - first.pageY;

  return {
    distance: Math.sqrt(deltaX * deltaX + deltaY * deltaY),
    angle: Math.atan2(deltaY, deltaX),
    midX: (first.pageX + second.pageX) / 2,
    midY: (first.pageY + second.pageY) / 2,
  };
};

const EditableTicketPreview: React.FC<EditableTicketPreviewProps> = ({
  record,
  coverUri,
  captureBlurBackground,
  outputWidth,
  outputHeight,
  displayScale,
  selectedSticker,
  backgroundColor,
  selectedFilterId,
  captureViewRef,
}) => {
  const normalizedColor = useMemo(() => normalizeHexColor(backgroundColor), [backgroundColor]);
  const contentPrimaryColor = useMemo(() => getYiqContrastTextColor(normalizedColor), [normalizedColor]);
  const contentMutedColor = useMemo(
    () => (contentPrimaryColor === '#111111' ? 'rgba(17,17,17,0.62)' : 'rgba(255,255,255,0.75)'),
    [contentPrimaryColor]
  );
  const contentLabelColor = useMemo(
    () => (contentPrimaryColor === '#111111' ? 'rgba(17,17,17,0.46)' : 'rgba(255,255,255,0.66)'),
    [contentPrimaryColor]
  );
  const fullArtistText = useMemo(() => {
    const artists = (record.artists && record.artists.length > 0 ? record.artists : [record.artist || ''])
      .map((artist) => artist.trim())
      .filter((artist) => artist.length > 0);
    if (artists.length === 0) return '-';
    return artists.join(' / ');
  }, [record.artists, record.artist]);

  const ticketWidth = outputWidth;
  const ticketHeight = outputHeight;
  const imageSize = ticketHeight * 0.32;
  const stickerSize = ticketHeight * 0.18;
  const stickerDefaultPos = useMemo(
    () => ({
      x: ticketWidth * 0.21,
      y: ticketHeight * 0.52,
    }),
    [ticketWidth, ticketHeight]
  );
  const [stickerPosition, setStickerPosition] = useState(stickerDefaultPos);
  const [stickerScale, setStickerScale] = useState(1);
  const [stickerRotation, setStickerRotation] = useState(-9);
  const [snapGuide, setSnapGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const stickerPositionRef = useRef(stickerDefaultPos);
  const stickerScaleRef = useRef(1);
  const stickerRotationRef = useRef(-9);
  const stickerAppearScale = useRef(new Animated.Value(1)).current;
  const stickerAppearOpacity = useRef(new Animated.Value(1)).current;
  const stickerAppearTranslateY = useRef(new Animated.Value(0)).current;
  const filterRevealProgress = useRef(new Animated.Value(0)).current;
  const dragStartRef = useRef(stickerDefaultPos);
  const lastSnapKeyRef = useRef<string>('');
  const lastHapticAtRef = useRef<number>(0);
  const gestureModeRef = useRef<'drag' | 'transform' | null>(null);
  const transformStartRef = useRef<{
    distance: number;
    angle: number;
    midX: number;
    midY: number;
    x: number;
    y: number;
    scale: number;
    rotation: number;
  } | null>(null);

  useEffect(() => {
    stickerPositionRef.current = stickerPosition;
  }, [stickerPosition]);

  useEffect(() => {
    stickerScaleRef.current = stickerScale;
  }, [stickerScale]);

  useEffect(() => {
    stickerRotationRef.current = stickerRotation;
  }, [stickerRotation]);

  useEffect(() => {
    setStickerPosition(stickerDefaultPos);
    setStickerScale(1);
    setStickerRotation(-9);
    setSnapGuide({ x: null, y: null });
    stickerPositionRef.current = stickerDefaultPos;
    stickerScaleRef.current = 1;
    stickerRotationRef.current = -9;
    dragStartRef.current = stickerDefaultPos;
    lastSnapKeyRef.current = '';
  }, [stickerDefaultPos, selectedSticker]);

  useEffect(() => {
    if (selectedSticker === 'none') {
      return;
    }

    stickerAppearScale.setValue(0.72);
    stickerAppearOpacity.setValue(0);
    stickerAppearTranslateY.setValue(14);

    Animated.parallel([
      Animated.spring(stickerAppearScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
      Animated.timing(stickerAppearOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(stickerAppearTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [selectedSticker, stickerAppearOpacity, stickerAppearScale, stickerAppearTranslateY]);

  const activeSvgFilterId = useMemo(() => {
    switch (selectedFilterId) {
      case 'nostalgia':
        return 'ticket-filter-nostalgia';
      case 'cinematic':
        return 'ticket-filter-cinematic';
      case 'mono':
        return 'ticket-filter-mono';
      default:
        return null;
    }
  }, [selectedFilterId]);

  useEffect(() => {
    if (!activeSvgFilterId) {
      filterRevealProgress.setValue(0);
      return;
    }

    filterRevealProgress.setValue(0);
    Animated.timing(filterRevealProgress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [activeSvgFilterId, filterRevealProgress]);

  const filterRevealWidth = useMemo(
    () =>
      filterRevealProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, ticketWidth],
      }),
    [filterRevealProgress, ticketWidth]
  );

  const notifySnapIfNeeded = (xSnap: SnapResult, ySnap: SnapResult) => {
    const key = `${xSnap.kind ?? 'none'}:${Math.round(xSnap.value)}|${ySnap.kind ?? 'none'}:${Math.round(ySnap.value)}`;
    const isSnapped = xSnap.kind !== null || ySnap.kind !== null;

    if (!isSnapped) {
      lastSnapKeyRef.current = '';
      return;
    }

    if (key !== lastSnapKeyRef.current) {
      const now = Date.now();
      if (now - lastHapticAtRef.current > 70) {
        lastHapticAtRef.current = now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      lastSnapKeyRef.current = key;
    }
  };

  const stickerImageSource = useMemo(() => {
    if (selectedSticker === 'none') return null;
    return STICKER_IMAGES[selectedSticker];
  }, [selectedSticker]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const twoTouch = getTwoTouchInfo(event);
          if (twoTouch) {
            gestureModeRef.current = 'transform';
            transformStartRef.current = {
              distance: twoTouch.distance,
              angle: twoTouch.angle,
              midX: twoTouch.midX,
              midY: twoTouch.midY,
              x: stickerPositionRef.current.x,
              y: stickerPositionRef.current.y,
              scale: stickerScaleRef.current,
              rotation: stickerRotationRef.current,
            };
            return;
          }

          gestureModeRef.current = 'drag';
          dragStartRef.current = stickerPositionRef.current;
        },
        onPanResponderMove: (event, gestureState) => {
          const twoTouch = getTwoTouchInfo(event);

          if (twoTouch) {
            if (gestureModeRef.current !== 'transform' || !transformStartRef.current) {
              gestureModeRef.current = 'transform';
              transformStartRef.current = {
                distance: twoTouch.distance,
                angle: twoTouch.angle,
                midX: twoTouch.midX,
                midY: twoTouch.midY,
                x: stickerPositionRef.current.x,
                y: stickerPositionRef.current.y,
                scale: stickerScaleRef.current,
                rotation: stickerRotationRef.current,
              };
              return;
            }

            const start = transformStartRef.current;
            const ratio = start.distance > 0 ? twoTouch.distance / start.distance : 1;
            const nextScale = clampValue(start.scale * ratio, 0.6, 2.6);
            const nextRotation = start.rotation + ((twoTouch.angle - start.angle) * 180) / Math.PI;

            const deltaX = (twoTouch.midX - start.midX) / displayScale;
            const deltaY = (twoTouch.midY - start.midY) / displayScale;

            const scaledStickerSize = stickerSize * nextScale;
            const maxX = Math.max(0, ticketWidth - scaledStickerSize);
            const maxY = Math.max(0, ticketHeight - scaledStickerSize);

            let nextX = clampValue(start.x + deltaX, 0, maxX);
            let nextY = clampValue(start.y + deltaY, 0, maxY);

            const xSnap = snapToGridAndEdges(nextX, maxX);
            const ySnap = snapToGridAndEdges(nextY, maxY);

            nextX = xSnap.value;
            nextY = ySnap.value;
            setSnapGuide({
              x: xSnap.kind ? nextX + scaledStickerSize / 2 : null,
              y: ySnap.kind ? nextY + scaledStickerSize / 2 : null,
            });
            notifySnapIfNeeded(xSnap, ySnap);

            setStickerScale(nextScale);
            setStickerRotation(nextRotation);
            setStickerPosition({ x: nextX, y: nextY });
            return;
          }

          if (gestureModeRef.current !== 'drag') {
            gestureModeRef.current = 'drag';
            dragStartRef.current = stickerPositionRef.current;
          }

          const deltaX = gestureState.dx / displayScale;
          const deltaY = gestureState.dy / displayScale;

          const scaledStickerSize = stickerSize * stickerScaleRef.current;
          const maxX = Math.max(0, ticketWidth - scaledStickerSize);
          const maxY = Math.max(0, ticketHeight - scaledStickerSize);

          let nextX = clampValue(dragStartRef.current.x + deltaX, 0, maxX);
          let nextY = clampValue(dragStartRef.current.y + deltaY, 0, maxY);

          const xSnap = snapToGridAndEdges(nextX, maxX);
          const ySnap = snapToGridAndEdges(nextY, maxY);

          nextX = xSnap.value;
          nextY = ySnap.value;
          setSnapGuide({
            x: xSnap.kind ? nextX + scaledStickerSize / 2 : null,
            y: ySnap.kind ? nextY + scaledStickerSize / 2 : null,
          });
          notifySnapIfNeeded(xSnap, ySnap);

          setStickerPosition({ x: nextX, y: nextY });
        },
        onPanResponderRelease: () => {
          gestureModeRef.current = null;
          transformStartRef.current = null;
          setSnapGuide({ x: null, y: null });
          lastSnapKeyRef.current = '';
        },
        onPanResponderTerminate: () => {
          gestureModeRef.current = null;
          transformStartRef.current = null;
          setSnapGuide({ x: null, y: null });
          lastSnapKeyRef.current = '';
        },
      }),
    [displayScale, ticketWidth, ticketHeight, stickerSize]
  );

  const qrSize = imageSize * 0.3;
  const qrPadding = qrSize * 0.1;
  const qrContainerSize = qrSize + qrPadding * 2;

  return (
    <View style={styles.ticketCardContainer}>
      <View>
        <View
          style={{
            width: outputWidth * displayScale,
            height: outputHeight * displayScale,
            alignSelf: 'center',
            overflow: 'hidden',
            borderRadius: 12,
          }}
        >
          <View
            ref={captureViewRef}
            collapsable={false}
            style={{
              width: outputWidth,
              height: outputHeight,
              transform: [{ scale: displayScale }],
              transformOrigin: 'top left',
            }}
          >
            <View style={{ width: outputWidth, height: outputHeight, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'flex-start' }}>
              {captureBlurBackground && (
                coverUri && coverUri !== NO_IMAGE_URI ? (
                  <Image
                    source={{ uri: coverUri }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                    blurRadius={60}
                  />
                ) : (
                  <DummyJacket style={StyleSheet.absoluteFillObject} iconSize={48} />
                )
              )}

              <View style={{ width: ticketWidth, height: ticketHeight }}>
                <Svg width={ticketWidth} height={ticketHeight} viewBox="0 0 352 148" style={{ position: 'relative' }}>
                  <Defs>
                    <Filter
                      id="filter0_d_789_77"
                      x="0"
                      y="0"
                      width="351.791"
                      height="148"
                      filterUnits="userSpaceOnUse"
                    >
                      <FeFlood floodOpacity="0" result="BackgroundImageFix" />
                      <FeColorMatrix
                        in="SourceAlpha"
                        type="matrix"
                        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                        result="hardAlpha"
                      />
                      <FeOffset />
                      <FeGaussianBlur stdDeviation="7.5" />
                      <FeComposite in2="hardAlpha" operator="out" />
                      <FeColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0" />
                      <FeBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_789_77" />
                      <FeBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_789_77" result="shape" />
                    </Filter>
                  </Defs>
                  <G filter="url(#filter0_d_789_77)">
                    <Path
                      d={TICKET_SHAPE_PATH_D}
                      fill={normalizedColor}
                    />
                  </G>
                </Svg>

                <View style={StyleSheet.absoluteFillObject}>
                  <View
                    style={{
                      position: 'absolute',
                      left: ticketWidth * 0.07,
                      top: ticketHeight * 0.5 - imageSize / 2,
                      width: imageSize,
                      height: imageSize,
                      borderRadius: 40,
                      overflow: 'hidden',
                      backgroundColor: '#f0f0f0',
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 10, height: 10 },
                      shadowOpacity: 0.3,
                      shadowRadius: 12,
                      elevation: 8,
                    }}
                  >
                    {coverUri && coverUri !== NO_IMAGE_URI ? (
                      <Image
                        source={{ uri: coverUri }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                    ) : (
                      <DummyJacket style={{ width: '100%', height: '100%' }} iconSize={Math.max(20, imageSize * 0.34)} />
                    )}
                  </View>

                  {(record.liveName || '-').length <= 8 ? (
                    <Text
                      style={{
                        position: 'absolute',
                        left: ticketWidth * 0.1 + imageSize + ticketWidth * 0.08,
                        right: ticketWidth * 0.13,
                        top: ticketHeight * 0.33,
                        fontSize: ticketHeight * 0.06,
                        fontWeight: '900',
                        color: contentPrimaryColor,
                      }}
                      numberOfLines={1}
                    >
                      {record.liveName || '-'}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        position: 'absolute',
                        left: ticketWidth * 0.1 + imageSize + ticketWidth * 0.08,
                        right: ticketWidth * 0.13,
                        top: ticketHeight * 0.33,
                        fontSize: ticketHeight * 0.04,
                        fontWeight: '900',
                        color: contentPrimaryColor,
                        lineHeight: ticketHeight * 0.055,
                      }}
                      numberOfLines={2}
                    >
                      {record.liveName || '-'}
                    </Text>
                  )}

                  <Text
                    style={{
                      position: 'absolute',
                      left: ticketWidth * 0.1 + imageSize + ticketWidth * 0.08,
                      right: ticketWidth * 0.13,
                      top: (record.liveName || '-').length <= 8 ? ticketHeight * 0.42 : ticketHeight * 0.455,
                      fontSize: ticketHeight * 0.03,
                      lineHeight: ticketHeight * 0.034,
                      fontWeight: '800',
                      color: contentMutedColor,
                    }}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {fullArtistText}
                  </Text>

                  <View
                    style={{
                      position: 'absolute',
                      left: ticketWidth * 0.1 + imageSize + ticketWidth * 0.08,
                      top: ticketHeight * 0.5,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: ticketHeight * 0.04,
                        color: contentLabelColor,
                        fontWeight: '600',
                        marginRight: ticketWidth * 0.02,
                        minWidth: ticketWidth * 0.1,
                      }}
                    >
                      DATE
                    </Text>
                    <Text
                      style={{
                        fontSize: ticketHeight * 0.04,
                        color: contentPrimaryColor,
                        fontWeight: '800',
                      }}
                    >
                      {record.date || '-'}
                    </Text>
                  </View>

                  <View
                    style={{
                      position: 'absolute',
                      left: ticketWidth * 0.1 + imageSize + ticketWidth * 0.08,
                      top: ticketHeight * 0.55,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: ticketHeight * 0.04,
                        color: contentLabelColor,
                        fontWeight: '600',
                        marginRight: ticketWidth * 0.02,
                        minWidth: ticketWidth * 0.1,
                      }}
                    >
                      START
                    </Text>
                    <Text
                      style={{
                        fontSize: ticketHeight * 0.04,
                        color: contentPrimaryColor,
                        fontWeight: '800',
                      }}
                    >
                      {record.endTime || record.startTime || '18:00'}
                    </Text>
                  </View>

                  <View
                    style={{
                      position: 'absolute',
                      left: ticketWidth * 0.1 + imageSize + ticketWidth * 0.08,
                      right: ticketWidth * 0.25,
                      top: ticketHeight * 0.6,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: ticketHeight * 0.04,
                        color: contentLabelColor,
                        fontWeight: '600',
                        marginRight: ticketWidth * 0.02,
                        minWidth: ticketWidth * 0.1,
                      }}
                    >
                      VENUE
                    </Text>
                    <Text
                      style={{
                        fontSize: ticketHeight * 0.04,
                        color: contentPrimaryColor,
                        fontWeight: '800',
                        flex: 1,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                    >
                      {record.venue || '-'}
                    </Text>
                  </View>

                  <View
                    style={{
                      position: 'absolute',
                      right: ticketWidth * 0.09,
                      bottom: ticketHeight * 0.31,
                      width: qrContainerSize,
                      height: qrContainerSize,
                      padding: qrPadding,
                      borderRadius: 10,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {record.qrCode ? (
                      <QRCode value={record.qrCode} size={qrSize} quietZone={0} />
                    ) : (
                      <FallbackQRCode width={qrSize} height={qrSize} />
                    )}
                  </View>

                  <View
                    style={{
                      position: 'absolute',
                      bottom: ticketHeight * 0.3,
                      left: ticketWidth * 0.08,
                      opacity: 0.3,
                    }}
                  >
                    <Text style={{ fontWeight: '800', fontSize: ticketHeight * 0.02, color: contentPrimaryColor }}>TICKEMO</Text>
                  </View>

                  {activeSvgFilterId && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFillObject,
                        {
                          width: filterRevealWidth,
                          overflow: 'hidden',
                        },
                      ]}
                    >
                      <Svg
                        pointerEvents="none"
                        width={ticketWidth}
                        height={ticketHeight}
                        viewBox="0 0 352 148"
                      >
                        <Defs>
                          <Filter id="ticket-filter-nostalgia">
                            <FeColorMatrix type="matrix" values={matrixToValues(NOSTALGIA_MATRIX)} />
                          </Filter>
                          <Filter id="ticket-filter-cinematic">
                            <FeColorMatrix type="matrix" values={matrixToValues(CINEMATIC_MATRIX)} />
                            <FeColorMatrix type="matrix" values="1.15 0 0 0 -0.075 0 1.15 0 0 -0.075 0 0 1.15 0 -0.075 0 0 0 1 0" />
                          </Filter>
                          <Filter id="ticket-filter-mono">
                            <FeColorMatrix type="matrix" values={matrixToValues(MONO_MATRIX)} />
                            <FeColorMatrix type="matrix" values={matrixToValues(MONO_CONTRAST_MATRIX)} />
                          </Filter>
                        </Defs>
                        <G filter={`url(#${activeSvgFilterId})`}>
                          <Path d={TICKET_SHAPE_PATH_D} fill="#FFFFFF" opacity={0.35} />
                        </G>
                      </Svg>
                    </Animated.View>
                  )}

                  {stickerImageSource && (
                    <View
                      {...panResponder.panHandlers}
                      style={{
                        position: 'absolute',
                        left: stickerPosition.x,
                        top: stickerPosition.y,
                        width: stickerSize,
                        height: stickerSize,
                        transform: [{ rotate: `${stickerRotation}deg` }, { scale: stickerScale }],
                      }}
                    >
                      <Animated.View
                        style={{
                          width: '100%',
                          height: '100%',
                          opacity: stickerAppearOpacity,
                          transform: [{ translateY: stickerAppearTranslateY }, { scale: stickerAppearScale }],
                        }}
                      >
                        <Image source={stickerImageSource} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                      </Animated.View>
                    </View>
                  )}

                  {snapGuide.x !== null && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: snapGuide.x,
                        top: 0,
                        width: 1,
                        height: ticketHeight,
                        backgroundColor: 'rgba(255,255,255,0.75)',
                      }}
                    />
                  )}

                  {snapGuide.y !== null && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: snapGuide.y,
                        width: ticketWidth,
                        height: 1,
                        backgroundColor: 'rgba(255,255,255,0.75)',
                      }}
                    />
                  )}
                </View>

              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ticketCardContainer: {
    paddingHorizontal: 20,
    flex: 1,
    justifyContent: 'center',
  },
});

export default React.memo(EditableTicketPreview);
