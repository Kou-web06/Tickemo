import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator, Clipboard, Animated, Easing, Switch, Share, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Defs } from 'react-native-svg';
import { Feather, Ionicons, AntDesign } from '@expo/vector-icons';
import { ChekiRecord } from '../contexts/RecordsContext';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

interface ShareImageGeneratorProps {
  record: ChekiRecord;
  visible: boolean;
  onClose: () => void;
}

export const ShareImageGenerator: React.FC<ShareImageGeneratorProps> = ({
  record,
  visible,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'copy' | 'save' | 'twitter' | null>(null);
  const [showParticipatedStamp, setShowParticipatedStamp] = useState(false);
  const viewRef = useRef<View>(null);
  const translateY = useRef(new Animated.Value(1)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const prevVisibleRef = useRef(visible);

  // 出力サイズを固定（横長のチケット用に調整）
  const outputWidth = 1480;
  const outputHeight = 1200;
  const displayScale = 0.25;

  useLayoutEffect(() => {
    // visibleがfalseからtrueに変わった時だけ初期化
    if (visible && !prevVisibleRef.current) {
      translateY.setValue(1);
      dragY.setValue(0);
    }
    prevVisibleRef.current = visible;
  }, [visible, translateY, dragY]);

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

  const captureImage = async (): Promise<string | null> => {
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
      console.error('Capture error:', error);
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
        Alert.alert('✓', 'リンクをコピーしました');
      } else {
        Alert.alert('エラー', 'QRコードが設定されていません');
      }
    } catch (error) {
      console.error('Copy error:', error);
      Alert.alert('エラー', 'コピーに失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveImage = async () => {
    setIsGenerating(true);
    const uri = await captureImage();
    if (uri) {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('エラー', 'ライブラリへのアクセス許可が必要です');
          setIsGenerating(false);
          return;
        }
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert('✓', '画像をカメラロールに保存しました');
        onClose();
      } catch (error) {
        console.error('Save error:', error);
        Alert.alert('エラー', '保存に失敗しました');
      }
    }
    setIsGenerating(false);
  };

  const handleTwitterShare = async () => {
    setIsGenerating(true);
    const uri = await captureImage();
    if (uri) {
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
          Alert.alert('エラー', 'この機能は利用できません');
          setIsGenerating(false);
          return;
        }
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        onClose();
      } catch (error) {
        console.error('Share error:', error);
        Alert.alert('エラー', '共有に失敗しました');
      }
    }
    setIsGenerating(false);
  };

  const handleShareOther = async () => {
    setIsGenerating(true);
    const uri = await captureImage();
    if (uri) {
      try {
        await Share.share({
          url: uri,
          message: `${record.liveName || ''} - ${record.artist || ''}`,
        });
        onClose();
      } catch (error) {
        console.error('Share error:', error);
        Alert.alert('エラー', '共有に失敗しました');
      }
    }
    setIsGenerating(false);
  };

  const renderPreview = () => {
    const width = outputWidth;
    const height = outputHeight;
    const ticketWidth = width;
    const ticketHeight = height;
    const imageSize = ticketHeight * 0.33;
    const qrSize = imageSize * 0.3;

    return (
      <View style={{ width, height, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'flex-start' }}>
        {/* Ticket Card */}
        <View style={{ width: ticketWidth, height: ticketHeight }}>
          {/* SVG Background */}
          <Svg width={ticketWidth} height={ticketHeight} viewBox="0 0 362 187" style={{ position: 'relative'}}>
            <Path
              d="M139.417 20C140.189 21.7657 141.95 23 144 23C146.05 23 147.811 21.7657 148.583 20H322C322 30.9759 330.842 39.885 341.791 39.9971V147.002C330.842 147.114 322 156.024 322 167H148.899C148.436 164.718 146.419 163 144 163C141.581 163 139.564 164.718 139.101 167H40C40 155.954 31.0457 147 20 147V41.7754C20.9786 41.9226 21.9803 42 23 42C34.0457 42 43 33.0457 43 22C43 21.325 42.9657 20.6578 42.9004 20H139.417ZM144 148C141.239 148 139 150.239 139 153C139 155.761 141.239 158 144 158C146.761 158 149 155.761 149 153C149 150.239 146.761 148 144 148ZM144 133C141.239 133 139 135.239 139 138C139 140.761 141.239 143 144 143C146.761 143 149 140.761 149 138C139 135.239 146.761 133 144 133ZM144 118C141.239 118 139 120.239 139 123C139 125.761 141.239 128 144 128C146.761 128 149 125.761 149 123C149 120.239 146.761 118 144 118ZM144 103C141.239 103 139 105.239 139 108C139 110.761 141.239 113 144 113C146.761 113 149 110.761 149 108C149 105.239 146.761 103 144 103ZM144 88C141.239 88 139 90.2386 139 93C139 95.7614 141.239 98 144 98C146.761 98 149 95.7614 149 93C149 90.2386 146.761 88 144 88ZM144 73C141.239 73 139 75.2386 139 78C139 80.7614 141.239 83 144 83C146.761 83 149 80.7614 149 78C149 75.2386 146.761 73 144 73ZM144 58C141.239 58 139 60.2386 139 63C139 65.7614 141.239 68 144 68C146.761 68 149 65.7614 149 63C149 60.2386 146.761 58 144 58ZM144 43C141.239 43 139 45.2386 139 48C139 50.7614 141.239 53 144 53C146.761 53 149 50.7614 149 48C149 45.2386 146.761 43 144 43ZM144 28C141.239 28 139 30.2386 139 33C139 35.7614 141.239 38 144 38C146.761 38 149 35.7614 149 33C149 30.2386 146.761 28 144 28Z"
              fill="white"
            />
          </Svg>

          {/* Content Container */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: ticketWidth,
              height: ticketHeight,
            }}
          >
            {/* Jacket Image */}
            <View
              style={{
                position: 'absolute',
                left: ticketWidth * 0.09,
                top: ticketHeight * 0.50 - imageSize / 2,
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
              {record.imageUrl ? (
                <Image
                  source={{ uri: record.imageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <Text style={{ fontSize: imageSize * 0.3, color: '#999' }}>No Image</Text>
              )}
            </View>

            {/* Live Name */}
            <Text
              style={{
                position: 'absolute',
                left: ticketWidth * 0.10 + imageSize + ticketWidth * 0.08,
                right: ticketWidth * 0.13,
                top: ticketHeight * 0.31,
                fontSize: ticketHeight * 0.07,
                fontWeight: '900',
                color: '#000',
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {record.liveName || '-'}
            </Text>

            {/* Artist */}
            <Text
              style={{
                position: 'absolute',
                left: ticketWidth * 0.10 + imageSize + ticketWidth * 0.08,
                top: ticketHeight * 0.40,
                fontSize: ticketHeight * 0.035,
                fontWeight: '800',
                color: '#666',
              }}
              numberOfLines={1}
            >
              {record.artist || '-'}
            </Text>

            {/* DATE */}
            <View
              style={{
                position: 'absolute',
                left: ticketWidth * 0.10 + imageSize + ticketWidth * 0.08,
                top: ticketHeight * 0.49,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: ticketHeight * 0.045,
                  color: '#999',
                  fontWeight: '600',
                  marginRight: ticketWidth * 0.02,
                  minWidth: ticketWidth * 0.1,
                }}
              >
                DATE
              </Text>
              <Text
                style={{
                  fontSize: ticketHeight * 0.045,
                  color: '#000',
                  fontWeight: '800',
                }}
              >
                {record.date || '-'}
              </Text>
            </View>

            {/* VENUE */}
            <View
              style={{
                position: 'absolute',
                left: ticketWidth * 0.10 + imageSize + ticketWidth * 0.08,
                right: ticketWidth * 0.25,
                top: ticketHeight * 0.56,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: ticketHeight * 0.045,
                  color: '#999',
                  fontWeight: '600',
                  marginRight: ticketWidth * 0.02,
                  minWidth: ticketWidth * 0.1,
                }}
              >
                VENUE
              </Text>
              <Text
                style={{
                  fontSize: ticketHeight * 0.045,
                  color: '#000',
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

            {/* START */}
            <View
              style={{
                position: 'absolute',
                left: ticketWidth * 0.10 + imageSize + ticketWidth * 0.08,
                top: ticketHeight * 0.63,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: ticketHeight * 0.045,
                  color: '#999',
                  fontWeight: '600',
                  marginRight: ticketWidth * 0.02,
                  minWidth: ticketWidth * 0.1,
                }}
              >
                START
              </Text>
              <Text
                style={{
                  fontSize: ticketHeight * 0.045,
                  color: '#000',
                  fontWeight: '800',
                }}
              >
                {record.startTime || '-'}
              </Text>
            </View>

            {/* QR Code */}
            <View
              style={{
                position: 'absolute',
                right: ticketWidth * 0.13,
                bottom: ticketHeight * 0.26,
                width: qrSize + qrSize * 0.10,
                backgroundColor: 'white',
                padding: qrSize * 0.12,
                borderRadius: 4,
              }}
            >
              <Image source={require('../assets/no-qr.png')} style={{ width: qrSize, height: qrSize, backgroundColor: '#f0f0f0' }} />
            </View>

            {/*ウォーターマーク*/}
            <View
              style={{
                position: 'absolute',
                bottom: ticketHeight * 0.27,
                left: ticketWidth * 0.14,
                opacity: 0.3,
              }}>
                <Text style={{ fontWeight: '800', fontSize: ticketHeight * 0.02 }}>TICKEMO</Text>
            </View>
          </View>

          

          {/* Participated Stamp Overlay */}
          {showParticipatedStamp && (
            <View
              style={{
                position: 'absolute',
                right: ticketWidth * 0.08,
                top: ticketHeight * 0.34,
                width: ticketHeight * 0.25,
                height: ticketHeight * 0.25,
                transform: [{ rotate: '-10deg' }],
                opacity: 0.8,
              }}
            >
              <Image
                source={require('../assets/participated.png')}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
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

            {/* チケットカード */}
            <View style={styles.ticketCardContainer}>
              <View
                style={{
                  width: outputWidth * displayScale,
                  height: outputHeight * displayScale,
                  alignSelf: 'center',
                  overflow: 'hidden',
                  borderRadius: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 24,
                  elevation: 10,
                }}
              >
                <View
                  ref={viewRef}
                  collapsable={false}
                  style={{
                    width: outputWidth,
                    height: outputHeight,
                    transform: [{ scale: displayScale }],
                    transformOrigin: 'top left',
                  }}
                >
                  {renderPreview()}
                </View>
              </View>
            </View>

            {/* 参戦済みトグル */}
            <View style={styles.toggleContainer}>
              <Switch
                trackColor={{ false: '#767577', true: '#34C759' }}
                thumbColor="#FFF"
                ios_backgroundColor="#767577"
                onValueChange={setShowParticipatedStamp}
                value={showParticipatedStamp}
                style={styles.switch}
              />
              <Text style={styles.toggleLabel}>参戦済み</Text>
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
                  <Text style={{ fontSize: 26, fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    𝕏
                  </Text>
                )}
              </View>
              <Text style={styles.actionButtonLabel}>X (Twitter)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButtonWrapper}
              onPress={handleShareOther}
              disabled={isGenerating}
            >
              <View style={styles.actionButtonCircle}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
              </View>
              <Text style={styles.actionButtonLabel}>その他</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    height: '70%',
    backgroundColor: '#FFFFFF',
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
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  ticketCardContainer: {
    paddingHorizontal: 20,
    flex: 1,
    justifyContent: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 12,
  },
  switch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
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
