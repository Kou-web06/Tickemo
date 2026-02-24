import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableWithoutFeedback, Animated, Alert, Modal } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { FontAwesome, Ionicons, Octicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Path, Rect, Defs, Pattern, Use, Image as SvgImage } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import TextTicker from 'react-native-text-ticker';
import { ChekiRecord, useRecords } from '../contexts/RecordsContext';
import LiveEditScreen from '../screens/LiveEditScreen';
import { buildLiveAlbumName, deleteImage, normalizeStoredImageUri, uploadImage, resolveLocalImageUri } from '../lib/imageUpload';
import { saveSetlist, getSetlist } from '../lib/setlistDb';
import ShareImageGenerator from './ShareImageGenerator';
import type { SetlistItem } from '../types/setlist';
import { NO_IMAGE_URI } from '../hooks/useResolvedImageUri';

interface TicketDetailProps {
  record: ChekiRecord;
  onBack?: () => void;
}

interface LiveInfo {
  name: string;
  artist: string;
  liveType?: string;
  artistImageUrl?: string;
  date: Date;
  venue: string;
  seat?: string;
  startTime: string;
  endTime: string;
  imageUrl?: string;
  imageUrls?: string[];
  qrCode?: string;
  memo?: string;
  detail?: string;
  setlistSongs?: SetlistItem[];
}

const LIVE_TYPE_ICON_MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  ワンマン: 'account',
  対バン: 'account-multiple',
  フェス: 'account-group',
  FC限定: 'account-star',
};

export const TicketDetail: React.FC<TicketDetailProps> = ({ record, onBack }) => {
  const { updateRecord, deleteRecord } = useRecords();
  const [showEditScreen, setShowEditScreen] = useState(false);
  const [showShareGenerator, setShowShareGenerator] = useState(false);
  const [setlistSongs, setSetlistSongs] = useState<SetlistItem[]>([]);
  const pendingCloseAfterSave = useRef(false);
  const renderCountRef = useRef(0);
  const recordIdRef = useRef(record.id);
  const prevShowShareRef = useRef(showShareGenerator);
  
  renderCountRef.current++;
  
  // showShareGenerator が変わったか即座に検出
  if (prevShowShareRef.current !== showShareGenerator) {
    prevShowShareRef.current = showShareGenerator;
  }
  
  // render の時間を記録（毎フレーム何秒ごとに来ているか追跡）
  const prevRenderTimeRef = useRef<number>(performance.now());
  const timeSinceLastRender = performance.now() - prevRenderTimeRef.current;
  prevRenderTimeRef.current = performance.now();
  
  // シェアボタン押下：モーダルを即座に開く（UIブロッキングなし）
  const handleSharePress = useCallback(() => {
    setShowShareGenerator(true); // ← ユーザータップ時に即座に開始
  }, [showShareGenerator]);
  const width = 330;
  const height = 852;
  const qrSize = 155;
  const titleTickerWidth = width - 90;
  const liveName = record.liveName || '-';
  const isLongName = liveName.length >= 8;
  const liveTypeLabel = record.liveType || 'ワンマン';
  const liveTypeIconName = LIVE_TYPE_ICON_MAP[record.liveType || ''] ?? 'account';
  const coverUri = resolveLocalImageUri(record.imageUrls?.[0] ?? record.imagePath ?? '');

  const translateY = useRef(new Animated.Value(1000)).current;
  // jacketTranslateXはtranslateYからinterpolateで算出
  const lastOffset = useRef(0);

  // スライドアウトアニメーション付きで閉じる共通メソッド
  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: 1000,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (onBack) {
        onBack();
      }
    });
  };

  const handleDeletePress = () => {
    Alert.alert(
      '本当に削除しますか？',
      `${record.liveName || 'このライブ'}を記録から削除します。この操作は取り消せません。`,
      [
        {
          text: 'キャンセル',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: '削除',
          onPress: () => {
            deleteRecord(record.id);
            handleClose();
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleEditPress = async () => {
    // セットリストを読み込む
    try {
      const songs = await getSetlist(record.id);
      setSetlistSongs(songs);
    } catch (error) {
      setSetlistSongs([]);
    }
    setShowEditScreen(true);
  };

  const handleShareModalClose = useCallback(() => {
    setShowShareGenerator(false);
  }, [showShareGenerator]);

  const handleBeforeOpenPaywall = useCallback(() => {
    setShowShareGenerator(false);
    if (onBack) {
      onBack();
    }
  }, [onBack]);



  const handleSaveLiveInfo = async (info: LiveInfo) => {
    try {
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}.${month}.${day}`;
      };

      // ユーザーIDを取得
      const userId = 'local-user';

      // 新しい画像をアップロード（ジャケット画像の置換）
      let uploadedImageUrls: string[] = [];
      let uploadedImageAssetIds: Array<string | null> = [];

      if (info.imageUrls && info.imageUrls.length > 0) {
        const rawUri = info.imageUrls[0];
        if (rawUri) {
          const normalizedUri = normalizeStoredImageUri(rawUri) || rawUri;
          
          if (normalizedUri.startsWith('file://')) {
            // 新規画像をアップロード
            // キャッシュ回避のためユニークな名前を使用
            const newBaseName = `cover-${Date.now()}`;
            const uploaded = await uploadImage(normalizedUri, userId, record.id, newBaseName);
            if (uploaded) {
              // 古い画像を削除
              if (record.imageUrls && record.imageUrls.length > 0) {
                try {
                   await deleteImage(record.imageUrls[0]);
                } catch (e) {
                   console.warn('[TicketDetail] Old image delete failed:', e);
                }
              }
              uploadedImageUrls = [uploaded];
              uploadedImageAssetIds = [null];
            }
          } else {
             // 既存のURL
            uploadedImageUrls = [normalizedUri];
            // 既存のアセットIDを探す
            const originalIndex = (record.imageUrls || []).indexOf(rawUri);
            const originalAssetId = originalIndex !== -1 ? (record.imageAssetIds?.[originalIndex] ?? null) : null;
            uploadedImageAssetIds = [originalAssetId];
          }
        }
      }

      // アップロード完了待ち（一応）
      if (uploadedImageUrls.length > 0 && uploadedImageUrls[0].startsWith('file://')) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // imageUrls と imageAssetIds のサイズを確保
      const finalImageUrls = uploadedImageUrls;
      const finalImageAssetIds = uploadedImageUrls.length > 0 ? uploadedImageAssetIds : [];

      const updatedRecord: ChekiRecord = {
        ...record,
        artist: info.artist,
        artistImageUrl: info.artistImageUrl || record.artistImageUrl,
        liveName: info.name,
        liveType: info.liveType || record.liveType || 'ワンマン',
        date: formatDate(info.date),
        venue: info.venue,
        seat: info.seat,
        startTime: info.startTime,
        endTime: info.endTime,
        imageUrls: finalImageUrls,
        imageAssetIds: finalImageAssetIds,
        memo: info.memo || record.memo,
        detail: info.detail || record.detail,
        qrCode: info.qrCode || record.qrCode,
      };
      await updateRecord(record.id, updatedRecord);
      
      // セットリストを保存（既存を削除して新規挿入）
      if (info.setlistSongs) {
        try {
          await saveSetlist(record.id, info.setlistSongs);
        } catch (setlistError) {
          // セットリストの保存に失敗してもレコードは更新済みなので続行
        }
      }

      pendingCloseAfterSave.current = true;
    } catch (error) {
      Alert.alert('エラー', 'ライブ情報の保存に失敗しました。もう一度お試しください。');
      throw error;
    }
  };

  useEffect(() => {
    // モーダル本体のアニメーション
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 9,
    }).start();
    // jacketTranslateXはtranslateYに連動するので個別アニメーション不要
  }, []);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;

      // If swiped down significantly or with high velocity, close modal
      if (translationY > 100 || velocityY > 500) {
        // モーダル本体を下へスライドアウト（ジャケットはtranslateYに連動）
        Animated.timing(translateY, {
          toValue: 1000,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (onBack) {
            onBack();
          }
        });
      } else {
        // Spring back to original position
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
        lastOffset.current = 0;
      }
    }
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={{ flex: 1 }}>
          {/* PhotoStack Removed */}

          {/* トップバー（ダイナミックアイランド風） */}
          <Animated.View 
            style={[
              styles.topBar,
              {
                transform: [{
                  translateX: translateY.interpolate({
                    inputRange: [0, 1000],
                    outputRange: [0, 400],
                    extrapolate: 'clamp',
                  }),
                }],
              },
            ]}
          >
            <TouchableOpacity style={styles.topBarButton} onPress={handleSharePress}>
              <BlurView intensity={10} tint="dark" style={styles.topBarButtonBlur}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="#fff">
                  <Path
                    d="M12 22.75C6.07 22.75 1.25 17.93 1.25 12C1.25 6.07 6.07 1.25 12 1.25C12.41 1.25 12.75 1.59 12.75 2C12.75 2.41 12.41 2.75 12 2.75C6.9 2.75 2.75 6.9 2.75 12C2.75 17.1 6.9 21.25 12 21.25C17.1 21.25 21.25 17.1 21.25 12C21.25 11.59 21.59 11.25 22 11.25C22.41 11.25 22.75 11.59 22.75 12C22.75 17.93 17.93 22.75 12 22.75Z"
                    fill="white"
                  />
                  <Path
                    d="M12.9999 11.7502C12.8099 11.7502 12.6199 11.6802 12.4699 11.5302C12.1799 11.2402 12.1799 10.7602 12.4699 10.4702L20.6699 2.27023C20.9599 1.98023 21.4399 1.98023 21.7299 2.27023C22.0199 2.56023 22.0199 3.04023 21.7299 3.33023L13.5299 11.5302C13.3799 11.6802 13.1899 11.7502 12.9999 11.7502Z"
                    fill="white"
                  />
                  <Path
                    d="M22 7.58C21.59 7.58 21.25 7.24 21.25 6.83V2.75H17.17C16.76 2.75 16.42 2.41 16.42 2C16.42 1.59 16.76 1.25 17.17 1.25H22C22.41 1.25 22.75 1.59 22.75 2V6.83C22.75 7.24 22.41 7.58 22 7.58Z"
                    fill="white"
                  />
                </Svg>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity style={styles.topBarButton} onPress={handleEditPress}>
              <BlurView intensity={10} tint="dark" style={styles.topBarButtonBlur}>
                <FontAwesome name="sliders" size={26} color="#FFF" />
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity style={styles.topBarButton} onPress={handleDeletePress}>
              <BlurView intensity={10} tint="dark" style={styles.topBarButtonBlur}>
                <Octicons name="trash" size={25} color="#FF6B6B" />
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          <PanGestureHandler
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
          >
            <Animated.View
              style={[
                styles.container,
                { width, height },
                {
                  transform: [{
                    translateY: translateY.interpolate({
                      inputRange: [-1000, 0, 1000],
                      outputRange: [0, 0, 1000],
                      extrapolate: 'clamp',
                    }),
                  }],
                },
              ]}
            >
              <Svg width={width} height={height} viewBox="0 0 280 529" fill="none">
                <Path d="M279.118 201.1C275.555 201.681 272.834 204.772 272.834 208.5C272.834 212.228 275.555 215.319 279.118 215.9L279.118 531.006C278.95 531.004 278.782 531 278.613 531C259.927 531 244.767 544.319 244.64 560.791L33.9746 560.791C33.8473 544.319 18.6859 531 0 531L0 215.991C0.110743 215.996 0.222045 216 0.333984 216C4.47612 216 7.83398 212.642 7.83398 208.5C7.83398 204.358 4.47612 201 0.333984 201C0.222045 201 0.110743 201.004 0 201.009L0 30C18.4716 29.9996 33.5006 16.9848 33.9658 0.774414L33.9766 0L244.637 0C244.637 16.5684 259.848 29.9998 278.613 30C278.782 30 278.95 29.9963 279.118 29.9941L279.118 201.1ZM27.834 208.5C27.834 204.358 24.4761 201 20.334 201C16.1921 201 12.834 204.358 12.834 208.5C12.834 212.642 16.1921 216 20.334 216C24.4761 216 27.834 212.642 27.834 208.5ZM47.834 208.5C47.834 204.358 44.4761 201 40.334 201C36.1921 201 32.834 204.358 32.834 208.5C32.834 212.642 36.1921 216 40.334 216C44.4761 216 47.834 212.642 47.834 208.5ZM67.834 208.5C67.834 204.358 64.4761 201 60.334 201C56.1921 201 52.834 204.358 52.834 208.5C52.834 212.642 56.1921 216 60.334 216C64.4761 216 67.834 212.642 67.834 208.5ZM87.834 208.5C87.834 204.358 84.4761 201 80.334 201C76.1921 201 72.834 204.358 72.834 208.5C72.834 212.642 76.1921 216 80.334 216C84.4761 216 87.834 212.642 87.834 208.5ZM107.834 208.5C107.834 204.358 104.476 201 100.334 201C96.1921 201 92.834 204.358 92.834 208.5C92.834 212.642 96.1921 216 100.334 216C104.476 216 107.834 212.642 107.834 208.5ZM127.834 208.5C127.834 204.358 124.476 201 120.334 201C116.192 201 112.834 204.358 112.834 208.5C112.834 212.642 116.192 216 120.334 216C124.476 216 127.834 212.642 127.834 208.5ZM147.834 208.5C147.834 204.358 144.476 201 140.334 201C136.192 201 132.834 204.358 132.834 208.5C132.834 212.642 136.192 216 140.334 216C144.476 216 147.834 212.642 147.834 208.5ZM167.834 208.5C167.834 204.358 164.476 201 160.334 201C156.192 201 152.834 204.358 152.834 208.5C152.834 212.642 156.192 216 160.334 216C164.476 216 167.834 212.642 167.834 208.5ZM187.834 208.5C187.834 204.358 184.476 201 180.334 201C176.192 201 172.834 204.358 172.834 208.5C172.834 212.642 176.192 216 180.334 216C184.476 216 187.834 212.642 187.834 208.5ZM207.834 208.5C207.834 204.358 204.476 201 200.334 201C196.192 201 192.834 204.358 192.834 208.5C192.834 212.642 196.192 216 200.334 216C204.476 216 207.834 212.642 207.834 208.5ZM227.834 208.5C227.834 204.358 224.476 201 220.334 201C216.192 201 212.834 204.358 212.834 208.5C212.834 212.642 216.192 216 220.334 216C224.476 216 227.834 212.642 227.834 208.5ZM247.834 208.5C247.834 204.358 244.476 201 240.334 201C236.192 201 232.834 204.358 232.834 208.5C232.834 212.642 236.192 216 240.334 216C244.476 216 247.834 212.642 247.834 208.5ZM267.834 208.5C267.834 204.358 264.476 201 260.334 201C256.192 201 252.834 204.358 252.834 208.5C252.834 212.642 256.192 216 260.334 216C264.476 216 267.834 212.642 267.834 208.5Z" fill="white" />
              </Svg>

              {/* Content overlay */}
              <View style={styles.contentContainer} pointerEvents="box-none">
                {/* QR Code section at top */}
                <View style={styles.qrContainer}>
                  {record.qrCode ? (
                    <QRCode
                      value={record.qrCode}
                      size={qrSize}
                      color="#000"
                      backgroundColor="#fff"
                    />
                  ) : (
                    <Image
                      source={require('../assets/no-qr.png')}
                      style={{ width: qrSize, height: qrSize }}
                      contentFit="contain"
                    />
                  )}
                  <Text style={styles.qrText}>
                    {record.qrCode ? 'M3M0RY-N3V3R-D13' : 'NO DATA'}
                  </Text>
                </View>

                {/* Jacket image overlay on QR */}
                <Animated.View
                  style={[
                    styles.jacketShadow,
                    { width: qrSize * 0.6, height: qrSize * 0.6 },
                    {
                      transform: [
                        {
                          translateX: translateY.interpolate({
                            inputRange: [0, 1000],
                            outputRange: [0, -330],
                            extrapolate: 'clamp',
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.jacketOverlay}>
                    <Image
                      source={{ uri: coverUri ?? NO_IMAGE_URI }}
                      style={styles.jacketImage}
                      contentFit="cover"
                    />
                  </View>
                </Animated.View>

                {/* Info section */}
                <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false} pointerEvents="auto">
                  <View style={styles.infoSection} pointerEvents="box-none">
                    {isLongName ? (
                      <View style={[styles.mainTitleWrapper, { width: titleTickerWidth }]}>
                        <TextTicker
                          style={[styles.mainTitleText, { fontSize: 28 }]}
                          duration={liveName.length * 300}
                          loop
                          bounce={false}
                          repeatSpacer={50}
                          marqueeDelay={1000}
                        >
                          {liveName}
                        </TextTicker>
                      </View>
                    ) : (
                      <View style={[styles.mainTitleWrapper, { width: titleTickerWidth }]}>
                        <Text style={styles.mainTitleText} numberOfLines={1}>
                          {liveName}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.liveTypeIconRow, { top: 55 }]}>
                      <MaterialCommunityIcons name={liveTypeIconName} size={18} color="#A1A1A1" />
                      <Text style={styles.liveTypeText}>{liveTypeLabel}</Text>
                    </View>
                    <Text style={[styles.artistName, { top: 75 }]}>{record.artist || '-'}</Text>

                    <View style={[styles.info, { flexDirection: 'column', gap: 12, marginTop: 40 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>DATE</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.date || '-'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>START</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.startTime || '18:00'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>VENUE</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left'}, (record.venue || '').length > 6 && {fontSize: 18}]}>
                          {record.venue || '-'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>SEAT</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.seat || '-'}</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </Animated.View>
          </PanGestureHandler>
        </View>
      </TouchableWithoutFeedback>

      <Modal
        visible={showEditScreen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditScreen(false)}
      >
        <LiveEditScreen
          initialData={{
            name: record.liveName,
            artist: record.artist,
            artistImageUrl: record.artistImageUrl,
            liveType: record.liveType,
            date: new Date(record.date.replace(/\./g, '-')),
            venue: record.venue || '',
            seat: record.seat,
            startTime: record.startTime || '18:00',
            endTime: record.endTime || '20:00',
            imageUrls: record.imageUrls,
            qrCode: record.qrCode,
            memo: record.memo,
            detail: record.detail,
            setlistSongs: setlistSongs,
          }}
          onSave={handleSaveLiveInfo}
            onCancel={async () => {
              const shouldCloseDetail = pendingCloseAfterSave.current;
              pendingCloseAfterSave.current = false;
              setShowEditScreen(false);
              if (shouldCloseDetail) {
                await new Promise(resolve => setTimeout(resolve, 400));
                handleClose();
              }
            }}
        />
      </Modal>

      <ShareImageGenerator
        record={record}
        visible={showShareGenerator}
        onClose={handleShareModalClose}
        onBeforeOpenPaywall={handleBeforeOpenPaywall}
      />
    </>
  );
};

function TicketDetailWrapper(props: TicketDetailProps) {
  return (
    <TouchableWithoutFeedback onPress={props.onBack}>
      <View style={{ flex: 1 }}>
        <TicketDetail {...props} />
      </View>
    </TouchableWithoutFeedback>
  );
}

export default TicketDetailWrapper;

export const TicketDetailOld: React.FC<TicketDetailProps> = ({ record, onBack }) => {
  const width = 330;
  const height = 852;
  const qrSize = 155;
  const liveTypeLabel = record.liveType || 'ワンマン';
  const liveTypeIconName = LIVE_TYPE_ICON_MAP[record.liveType || ''] ?? 'account';
  const coverUri = resolveLocalImageUri(record.imageUrls?.[0] ?? record.imagePath ?? '');

  const translateY = useRef(new Animated.Value(1000)).current;
  // jacketTranslateXはtranslateYからinterpolateで算出
  const lastOffset = useRef(0);

  useEffect(() => {
    // モーダル本体のアニメーション
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 9,
    }).start();
    // jacketTranslateXはtranslateYに連動するので個別アニメーション不要
  }, []);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;

      // If swiped down significantly or with high velocity, close modal
      if (translationY > 100 || velocityY > 500) {
        // モーダル本体を下へスライドアウト（ジャケットはtranslateYに連動）
        Animated.timing(translateY, {
          toValue: 1000,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (onBack) {
            onBack();
          }
        });
      } else {
        // Spring back to original position
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
        lastOffset.current = 0;
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={onBack}>
      <View style={{ flex: 1 }}>
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View
            style={[
              styles.container,
              { width, height },
              {
                transform: [{
                  translateY: translateY.interpolate({
                    inputRange: [-1000, 0, 1000],
                    outputRange: [0, 0, 1000],
                    extrapolate: 'clamp',
                  }),
                }],
              },
            ]}
          >
            <Svg width={width} height={height} viewBox="0 0 280 529" fill="none">
              <Path d="M279.118 201.1C275.555 201.681 272.834 204.772 272.834 208.5C272.834 212.228 275.555 215.319 279.118 215.9L279.118 531.006C278.95 531.004 278.782 531 278.613 531C259.927 531 244.767 544.319 244.64 560.791L33.9746 560.791C33.8473 544.319 18.6859 531 0 531L0 215.991C0.110743 215.996 0.222045 216 0.333984 216C4.47612 216 7.83398 212.642 7.83398 208.5C7.83398 204.358 4.47612 201 0.333984 201C0.222045 201 0.110743 201.004 0 201.009L0 30C18.4716 29.9996 33.5006 16.9848 33.9658 0.774414L33.9766 0L244.637 0C244.637 16.5684 259.848 29.9998 278.613 30C278.782 30 278.95 29.9963 279.118 29.9941L279.118 201.1ZM27.834 208.5C27.834 204.358 24.4761 201 20.334 201C16.1921 201 12.834 204.358 12.834 208.5C12.834 212.642 16.1921 216 20.334 216C24.4761 216 27.834 212.642 27.834 208.5ZM47.834 208.5C47.834 204.358 44.4761 201 40.334 201C36.1921 201 32.834 204.358 32.834 208.5C32.834 212.642 36.1921 216 40.334 216C44.4761 216 47.834 212.642 47.834 208.5ZM67.834 208.5C67.834 204.358 64.4761 201 60.334 201C56.1921 201 52.834 204.358 52.834 208.5C52.834 212.642 56.1921 216 60.334 216C64.4761 216 67.834 212.642 67.834 208.5ZM87.834 208.5C87.834 204.358 84.4761 201 80.334 201C76.1921 201 72.834 204.358 72.834 208.5C72.834 212.642 76.1921 216 80.334 216C84.4761 216 87.834 212.642 87.834 208.5ZM107.834 208.5C107.834 204.358 104.476 201 100.334 201C96.1921 201 92.834 204.358 92.834 208.5C92.834 212.642 96.1921 216 100.334 216C104.476 216 107.834 212.642 107.834 208.5ZM127.834 208.5C127.834 204.358 124.476 201 120.334 201C116.192 201 112.834 204.358 112.834 208.5C112.834 212.642 116.192 216 120.334 216C124.476 216 127.834 212.642 127.834 208.5ZM147.834 208.5C147.834 204.358 144.476 201 140.334 201C136.192 201 132.834 204.358 132.834 208.5C132.834 212.642 136.192 216 140.334 216C144.476 216 147.834 212.642 147.834 208.5ZM167.834 208.5C167.834 204.358 164.476 201 160.334 201C156.192 201 152.834 204.358 152.834 208.5C152.834 212.642 156.192 216 160.334 216C164.476 216 167.834 212.642 167.834 208.5ZM187.834 208.5C187.834 204.358 184.476 201 180.334 201C176.192 201 172.834 204.358 172.834 208.5C172.834 212.642 176.192 216 180.334 216C184.476 216 187.834 212.642 187.834 208.5ZM207.834 208.5C207.834 204.358 204.476 201 200.334 201C196.192 201 192.834 204.358 192.834 208.5C192.834 212.642 196.192 216 200.334 216C204.476 216 207.834 212.642 207.834 208.5ZM227.834 208.5C227.834 204.358 224.476 201 220.334 201C216.192 201 212.834 204.358 212.834 208.5C212.834 212.642 216.192 216 220.334 216C224.476 216 227.834 212.642 227.834 208.5ZM247.834 208.5C247.834 204.358 244.476 201 240.334 201C236.192 201 232.834 204.358 232.834 208.5C232.834 212.642 236.192 216 240.334 216C244.476 216 247.834 212.642 247.834 208.5ZM267.834 208.5C267.834 204.358 264.476 201 260.334 201C256.192 201 252.834 204.358 252.834 208.5C252.834 212.642 256.192 216 260.334 216C264.476 216 267.834 212.642 267.834 208.5Z" fill="white" />
            </Svg>

            {/* Content overlay */}
            <View style={styles.contentContainer} pointerEvents="box-none">
              {/* QR Code section at top */}
              <View style={styles.qrContainer}>
                {/* QRコードが無い場合は画像を表示 */}
                <Image
                  source={require('../assets/no-qr.png')}
                  style={{ width: qrSize, height: qrSize }}
                  contentFit="contain"
                />
                <Text style={styles.qrText}>M3M0R135-N3V3R-D13</Text>
              </View>

              {/* Jacket image overlay on QR */}
              <Animated.View
                style={[
                  styles.jacketShadow,
                  { width: qrSize * 0.6, height: qrSize * 0.6 },
                  {
                    transform: [
                      {
                        translateX: translateY.interpolate({
                          inputRange: [0, 1000],
                          outputRange: [0, -330],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.jacketOverlay}>
                  <Image
                      source={{ uri: coverUri ?? NO_IMAGE_URI }}
                    style={styles.jacketImage}
                    contentFit="cover"
                  />
                </View>
              </Animated.View>

              {/* Info section */}
              <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false} pointerEvents="auto">
                <View style={styles.infoSection}>
                  <Text style={[styles.mainTitle, (record.liveName || '').length >= 12 && {fontSize: 22}]}>
                    {(record.liveName || '').length >= 12 ? `${record.liveName?.substring(0, 10)}\n${record.liveName?.substring(10)}` : (record.liveName || '-')}
                  </Text>
                  <View style={[styles.liveTypeIconRow, (record.liveName || '').length >= 12 && { top: 55 }]}> 
                    <MaterialCommunityIcons name={liveTypeIconName} size={18} color="#A1A1A1" />
                    <Text style={styles.liveTypeText}>{liveTypeLabel}</Text>
                  </View>
                  <Text style={[styles.artistName, (record.liveName || '').length >= 12 && { top: 75 }]}> 
                    {record.artist || '-'} 
                  </Text>

                  <View style={[styles.info, { flexDirection: 'column', gap: 12, marginTop: 40 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>DATE</Text>
                      <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.date || '-'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>START</Text>
                      <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.startTime || '18:00'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>VENUE</Text>
                      <Text style={[styles.infoValue, { flex: 1, textAlign: 'left'}, (record.venue || '').length > 8 && {fontSize: 20}]}>
                        {record.venue || '-'}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingTop: 110,
  },
  topBar: {
    position: 'absolute',
    top: 90,
    left: 180,
    right: -3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
    paddingHorizontal: 2,
    paddingVertical: 2,
    shadowColor: '#323232',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 100,
  },
  topBarButton: {
    overflow: 'hidden',
    borderRadius: 30,
  },
  topBarButtonBlur: {
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  contentContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  qrContainer: {
    position: 'absolute',
    top: 150,
    left: (330 - 160) / 2,
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
  },
  qrText: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: '600',
    color: '#000',
    letterSpacing: 1,
  },

  jacketShadow: {
    position: 'absolute',
    top: 415,
    left: -18,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  jacketOverlay: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  jacketImage: {
    width: '100%',
    height: '100%',
  },
  infoScroll: {
    flex: 1,
  },
  infoSection: {
    position: 'absolute',
    top: 355,
    left: 0,
    right: 0,
    paddingBottom: 20,
  },
  mainTitle: {
    position: 'absolute',
    top: 10,
    left: 70,
    fontSize: 30,
    fontWeight: '900',
    color: '#000',
    marginBottom: 5,
  },
  mainTitleWrapper: {
    position: 'absolute',
    top: 10,
    left: 70,
    height: 36,
  },
  mainTitleText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
  },
  liveTypeIconRow: {
    position: 'absolute',
    top: 30,
    left: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveTypeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A1A1A1',
  },
  artistName: {
    position: 'absolute',
    top: 50,
    left: 70,
    fontSize: 18,
    fontWeight: '600',
    color: '#A1A1A1',
  },
  info: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 24,
    fontWeight: '800',
    color: '#A1A1A1',
    textTransform: 'uppercase',
    marginRight: 16,
  },
  infoValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },
  memoSection: {
    gap: 8,
  },
  memoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  setlistSection: {
    gap: 8,
  },
  setlistText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
