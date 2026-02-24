import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator, Clipboard, Animated, Easing, Share, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Feather, Ionicons, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Stop, LinearGradient, Defs, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { ChekiRecord } from '../contexts/RecordsContext';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { resolveLocalImageUri } from '../lib/imageUpload';
import EditableTicketPreview, { StickerType } from './EditableTicketPreviewCard';
import { useAppStore } from '../store/useAppStore';

interface ShareImageGeneratorProps {
  record: ChekiRecord;
  visible: boolean;
  onClose: () => void;
  onBeforeOpenPaywall?: () => void;
}

const DEFAULT_TICKET_BG_COLOR = '#FFFFFF';
const TICKET_STICKERS: StickerType[] = [
  'none',
  'sticker1',
  'sticker2',
  'sticker3',
  'sticker4',
  'sticker5',
  'sticker6',
  'sticker7',
  'sticker8',
];
const STICKER_PICKER_ITEMS: Exclude<StickerType, 'none'>[] = [
  'sticker1',
  'sticker2',
  'sticker3',
  'sticker4',
  'sticker5',
  'sticker6',
  'sticker7',
  'sticker8',
];
const STICKER_IMAGES: Record<Exclude<StickerType, 'none'>, any> = {
  sticker1: require('../assets/shareStickers/sticker1.png'),
  sticker2: require('../assets/shareStickers/sticker2.png'),
  sticker3: require('../assets/shareStickers/sticker3.png'),
  sticker4: require('../assets/shareStickers/sticker4.png'),
  sticker5: require('../assets/shareStickers/sticker5.png'),
  sticker6: require('../assets/shareStickers/sticker6.png'),
  sticker7: require('../assets/shareStickers/sticker7.png'),
  sticker8: require('../assets/shareStickers/sticker8.png'),
};
const PRESET_COLORS = [
  // Reds & Pinks
  '#FF3B30', '#FF2D55', '#7A1F3D', '#F4A7B9', '#F7D6E0',
  // Oranges
  '#FF9500', '#D9C2A7',
  // Yellows
  '#FFD60A',
  // Greens
  '#34C759', '#93EF84', '#8FE3C5', '#C7F9CC',
  // Cyans & Blues
  '#00F5D4', '#64D2FF', '#007AFF',
  // Purples & Indigo
  '#AF52DE', '#B8A1FF', '#5E60CE', '#4B0082',
  // Neutrals
  '#FFFFFF', '#111111', '#6B7280',
  // Dark Navy
  '#0B132B',
] as const;
const DYNAMIC_ICON_SIZE = 22;

const ShareImageGenerator: React.FC<ShareImageGeneratorProps> = ({
  record,
  visible,
  onClose,
  onBeforeOpenPaywall,
}) => {
  const navigation = useNavigation<any>();
  const isPremium = useAppStore((state) => state.isPremium);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'copy' | 'save' | 'twitter' | null>(null);
  const [showParticipatedStamp, setShowParticipatedStamp] = useState(false);
  const [ticketBgColor, setTicketBgColor] = useState(DEFAULT_TICKET_BG_COLOR);
  const [stickerIndex, setStickerIndex] = useState(0);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [captureBlurBackground, setCaptureBlurBackground] = useState(false);
  const [cachedImageUri, setCachedImageUri] = useState<string | null>(null);
  const viewRef = useRef<View>(null);
  const translateY = useRef(new Animated.Value(1)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const paletteOpacity = useRef(new Animated.Value(0)).current;
  const paletteTranslateY = useRef(new Animated.Value(20)).current;
  const prevVisibleRef = useRef(visible);

  // 出力サイズを固定（横長のチケット用に調整）
  const outputWidth = 1480;
  const outputHeight = 1200;
  const displayScale = 0.25;
  
  // モーダルが開いたら、背景で画像を読み込む（ラグなし）
  useEffect(() => {
    if (visible && !cachedImageUri) {
      const coverSource = record.imageUrls?.[0] ?? record.imagePath;
      if (coverSource) {
        const resolved = resolveLocalImageUri(coverSource);
        setCachedImageUri(resolved || coverSource);
      }
    }
  }, [visible, cachedImageUri, record.id]);  // ← record.imageUrls.imagePathではなく record.id を使用
  
  const coverUri = useMemo(() => {
    const coverSource = record.imageUrls?.[0] ?? record.imagePath;
    return cachedImageUri || (coverSource ? resolveLocalImageUri(coverSource) : null) || coverSource || null;
  }, [cachedImageUri, record.imageUrls, record.imagePath]);

  const selectedSticker = TICKET_STICKERS[stickerIndex];

  const stickerOptions = useMemo(
    () =>
      STICKER_PICKER_ITEMS.map((sticker) => ({
        id: sticker,
        source: STICKER_IMAGES[sticker],
      })),
    []
  );

  const handleToggleColorPalette = useCallback(() => {
    setShowColorPalette((prev) => {
      const next = !prev;
      if (next) {
        setShowStickerPicker(false);
      }
      return next;
    });
  }, []);

  const handleCycleSticker = useCallback(() => {
    setShowStickerPicker((prev) => {
      const next = !prev;
      if (next) {
        setShowColorPalette(false);
      }
      return next;
    });
  }, []);

  const handleToggleParticipatedStamp = useCallback(() => {
    setShowParticipatedStamp((prev) => !prev);
  }, []);

  const handleSelectPresetColor = useCallback((hex: string) => {
    setTicketBgColor(hex);
  }, []);

  const handleSelectSticker = useCallback((stickerId: StickerType) => {
    const stickerIndex = TICKET_STICKERS.indexOf(stickerId);
    if (stickerIndex !== -1) {
      setStickerIndex(stickerIndex);
    }
  }, []);

  const handleResetOperations = useCallback(() => {
    setTicketBgColor(DEFAULT_TICKET_BG_COLOR);
    setStickerIndex(0);
    setShowParticipatedStamp(false);
    setShowColorPalette(false);
    setShowStickerPicker(false);
  }, []);

  const handleOpenPaywallFromLock = useCallback(() => {
    onBeforeOpenPaywall?.();
    onClose();
    requestAnimationFrame(() => {
      navigation.navigate('Paywall');
    });
  }, [navigation, onBeforeOpenPaywall, onClose]);

  useLayoutEffect(() => {
    // visibleがfalseからtrueに変わった時だけ初期化
    if (visible && !prevVisibleRef.current) {
      translateY.setValue(1);
      dragY.setValue(0);
    }
    // レンダー終了時に prevVisibleRef を更新
    prevVisibleRef.current = visible;
  }, [visible]);  // ← transformY, dragY を依存配列から削除

  const isPickerVisible = showColorPalette || showStickerPicker;

  useEffect(() => {
    if (isPickerVisible) {
      Animated.parallel([
        Animated.timing(paletteOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(paletteTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(paletteOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(paletteTranslateY, {
          toValue: 20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isPickerVisible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // 下方向のドラッグのみ反応
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // 下方向のみ許可
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // 150px以上ドラッグしたら閉じる
        if (gestureState.dy > 150) {
          Animated.timing(dragY, {
            toValue: 800,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else {
          // 元の位置に戻る
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  if (!record) {
    return null;
  }

  const captureImage = async (includeBlurBackground: boolean = false): Promise<string | null> => {
    if (!viewRef.current) {
      Alert.alert('エラー', 'プレビューの準備ができていません');
      return null;
    }

    try {
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
        width: outputWidth,
        height: outputHeight,
      });
      return uri;
    } catch (error) {
      Alert.alert('エラー', '画像の生成に失敗しました');
      return null;
    }
  };

  const handleCopyLink = async () => {
    setIsGenerating(true);
    try {
      // QRコードのリンクをクリップボードにコピー
      if (record.qrCode) {
        Clipboard.setString(record.qrCode);
        Alert.alert('完了', 'リンクをコピーしました');
      } else {
        Alert.alert('エラー', 'QRコードが設定されていません');
      }
    } catch (error) {
      Alert.alert('エラー', 'コピーに失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveImage = async () => {
    setIsGenerating(true);
    const uri = await captureImage(false);
    if (uri) {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('エラー', 'ライブラリへのアクセス許可が必要です');
          setIsGenerating(false);
          return;
        }
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert('完了', '画像をカメラロールに保存しました');
        onClose();
      } catch (error) {
        Alert.alert('エラー', '保存に失敗しました');
      }
    }
    setIsGenerating(false);
  };

  const captureAndSaveToLibrary = async (includeBlurBackground: boolean = true): Promise<string | null> => {
    const uri = await captureImage(includeBlurBackground);
    if (!uri) return null;

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('エラー', 'ライブラリへのアクセス許可が必要です');
      return null;
    }

    await MediaLibrary.saveToLibraryAsync(uri);
    return uri;
  };

  const handleTwitterShare = async () => {
    setIsGenerating(true);
    setCaptureBlurBackground(true);
    try {
      // Blur 背景が反映されるまで待つ
      await new Promise(resolve => setTimeout(resolve, 100));
      const uri = await captureAndSaveToLibrary(true);
      if (!uri) {
        setCaptureBlurBackground(false);
        setIsGenerating(false);
        return;
      }

      const result = await Share.share({
        url: uri,
        message: `${record.date || ''} ${record.artist || ''} - ${record.liveName || ''} \n #Tickemo`,
        title: 'Tickemo',
      });
      if (result.action === Share.sharedAction) {
        onClose();
      }
    } catch (error) {
      Alert.alert('エラー', '共有に失敗しました');
    } finally {
      setCaptureBlurBackground(false);
      setIsGenerating(false);
    }
  };

  return (
    <>
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={() => {
        onClose();
      }}
      onShow={() => {
        Animated.timing(translateY, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                {
                  translateY: Animated.add(
                    translateY.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 800],
                    }),
                    dragY
                  ),
                },
              ],
            },
          ]}
        >
          {/* Handle Bar */}
          <View style={styles.handleBarContainer} {...panResponder.panHandlers}>
            <View style={styles.handleBar} />
          </View>

          <View style={styles.content}>
            {/* ヘッダー */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>プレビュー</Text>
            </View>

            <EditableTicketPreview
              record={record}
              coverUri={coverUri}
              captureBlurBackground={captureBlurBackground}
              outputWidth={outputWidth}
              outputHeight={outputHeight}
              displayScale={displayScale}
              selectedSticker={selectedSticker}
              showParticipatedStamp={showParticipatedStamp}
              backgroundColor={ticketBgColor}
              selectedFilterId={'normal'}
              captureViewRef={viewRef}
            />

            {isPickerVisible && (
              <Animated.View 
                style={[
                  showColorPalette
                    ? styles.paletteContainer
                    : styles.stickerPaletteContainer,
                  {
                    opacity: paletteOpacity,
                    transform: [{ translateY: paletteTranslateY }],
                  },
                ]}
              >
                {showColorPalette ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteScrollContent}>
                    {PRESET_COLORS.map((color) => {
                      const selected = color.toUpperCase() === ticketBgColor.toUpperCase();
                      return (
                        <TouchableOpacity
                          key={color}
                          activeOpacity={0.85}
                          style={[styles.paletteSwatchOuter, selected && styles.paletteSwatchOuterSelected]}
                          onPress={() => handleSelectPresetColor(color)}
                        >
                          <View style={[styles.paletteSwatchInner, { backgroundColor: color }]}>
                            {selected && <Ionicons name="checkmark" size={12} color={color === '#FFFFFF' ? '#111111' : '#FFFFFF'} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickerScrollContent}>
                    {stickerOptions.map((sticker) => {
                      const selected = sticker.id === selectedSticker;
                      return (
                        <TouchableOpacity
                          key={sticker.id}
                          activeOpacity={0.85}
                          style={[styles.stickerItem, selected && styles.stickerItemSelected]}
                          onPress={() => handleSelectSticker(sticker.id as StickerType)}
                        >
                          <Image source={sticker.source} style={styles.stickerThumbImage} contentFit="contain" />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </Animated.View>
            )}

            <View style={styles.dynamicIslandContainer}>
              <View style={styles.dynamicIslandShell}>
                <View style={styles.dynamicIsland}>
                  <TouchableOpacity style={styles.dynamicItem} activeOpacity={0.8} onPress={handleToggleColorPalette} disabled={!isPremium}>
                    <Svg width={34} height={34} viewBox="0 0 36 36">
                      <Defs>
                        <LinearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <Stop offset="0%" stopColor="#FF0000" />
                          <Stop offset="16%" stopColor="#FF7F00" />
                          <Stop offset="33%" stopColor="#FFFF00" />
                          <Stop offset="50%" stopColor="#00FF00" />
                          <Stop offset="66%" stopColor="#0000FF" />
                          <Stop offset="83%" stopColor="#9400D3" />
                          <Stop offset="100%" stopColor="#FF0000" />
                        </LinearGradient>
                      </Defs>
                      {/* Rainbow outer ring stroke */}
                      <Circle cx="18" cy="18" r="15" fill="none" stroke="url(#rainbowGradient)" strokeWidth="3" />
                      {/* White ring */}
                      <Circle cx="18" cy="18" r="12" fill="#FFFFFF" />
                      {/* Center circle with selected color */}
                      <Circle cx="18" cy="18" r="11" fill={ticketBgColor} />
                    </Svg>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.dynamicItem} activeOpacity={0.8} onPress={handleCycleSticker} disabled={!isPremium}>
                    <Svg width={DYNAMIC_ICON_SIZE} height={DYNAMIC_ICON_SIZE} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"
                        stroke="#222"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="M15 3v5a1 1 0 0 0 1 1h5"
                        stroke="#222"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path d="M8 13h.01" stroke="#222" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M16 13h.01" stroke="#222" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path
                        d="M10 16s.8 1 2 1c1.3 0 2-1 2-1"
                        stroke="#222"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.dynamicItemLabel}>ステッカー</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.dynamicItem} activeOpacity={0.8} onPress={handleToggleParticipatedStamp} disabled={!isPremium}>
                    <Svg width={DYNAMIC_ICON_SIZE} height={DYNAMIC_ICON_SIZE} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
                        stroke={showParticipatedStamp ? '#34C759' : '#222'}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="m9 12 2 2 4-4"
                        stroke={showParticipatedStamp ? '#34C759' : '#222'}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.dynamicItemLabel}>参戦済み</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.dynamicItem} activeOpacity={0.8} onPress={handleResetOperations} disabled={!isPremium}>
                    <MaterialCommunityIcons name="backup-restore" size={DYNAMIC_ICON_SIZE} color="#222" />
                    <Text style={styles.dynamicItemLabel}>リセット</Text>
                  </TouchableOpacity>
                </View>

                {!isPremium && (
                  <TouchableOpacity style={styles.lockOverlay} activeOpacity={0.9} onPress={handleOpenPaywallFromLock}>
                    <BlurView intensity={12} tint="light" style={StyleSheet.absoluteFillObject} />
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={14} color="#111111" />
                      <Text style={styles.lockBadgeText}>Plusで解放</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

          </View>

          {/* アクションボタン群 */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.actionButtonWrapper}
              onPress={handleSaveImage}
              disabled={isGenerating}
            >
              <View style={styles.actionButtonCircle}>
                {isGenerating && selectedAction === 'save' ? (
                  <ActivityIndicator color="#666" size="small" />
                ) : (
                  <Feather name="download" size={24} color="#333" />
                )}
              </View>
              <Text style={styles.actionButtonLabel}>画像を保存</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButtonWrapper}
              onPress={handleCopyLink}
              disabled={isGenerating}
            >
              <View style={styles.actionButtonCircle}>
                <AntDesign name="link" size={24} color="#333" />
              </View>
              <Text style={styles.actionButtonLabel}>リンクをコピー</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButtonWrapper}
              onPress={handleTwitterShare}
              disabled={isGenerating}
            >
              <View style={[styles.actionButtonCircle, { backgroundColor: '#1c1c1c' }]}>
                {isGenerating && selectedAction === 'twitter' ? (
                  <ActivityIndicator color="#666" size="small" />
                ) : (
                  <Image source={require('../assets/x.logo.white.png')} style={{ width: 18, height: 18 }} />
                )}
              </View>
              <Text style={styles.actionButtonLabel}>X (Twitter)</Text>
            </TouchableOpacity>

          </View>
        </Animated.View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    height: '85%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleBarContainer: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  dynamicIslandContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    marginBottom: 10,
    marginTop: 15,
  },
  dynamicIslandShell: {
    borderRadius: 40,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  dynamicIsland: {
    minHeight: 72,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
  },
  dynamicItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dynamicItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 5,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111111',
  },
  colorSwatch: {
    marginTop: 2,
    width: 36,
    height: 36,
  },
  paletteContainer: {
    paddingHorizontal: 14,
    marginTop: -2,
    marginBottom: 10,
  },
  stickerPaletteContainer: {
    paddingHorizontal: 14,
    marginTop: -2,
    marginBottom: 10,
  },
  filterPaletteContainer: {
    paddingHorizontal: 14,
    marginTop: -2,
    marginBottom: 10,
  },
  paletteScrollContent: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    gap: 8,
  },
  stickerScrollContent: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 14,
    alignItems: 'center',
  },
  filterScrollContent: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    gap: 10,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  filterChipSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333333',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  paletteSwatchOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#F3F4F6',
  },
  paletteSwatchOuterSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  paletteSwatchInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  stickerItem: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerItemSelected: {
    transform: [{ scale: 1.08 }],
  },
  stickerThumbImage: {
    width: 58,
    height: 58,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 50,
    backgroundColor: '#FFF',
  },
  actionButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionButtonLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ShareImageGenerator;
