import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableWithoutFeedback, Animated, Alert, Modal, useWindowDimensions } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { FontAwesome, Ionicons, Octicons, MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Share06Icon, Edit01Icon, Settings03Icon, Delete01Icon, Ticket03Icon } from '@hugeicons/core-free-icons';
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
import { useTranslation } from 'react-i18next';
import { LIVE_TYPE_ICON_MAP, normalizeLiveType, getLiveTypeLabel } from '../utils/liveType';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DummyJacket } from './DummyJacket';

interface TicketDetailProps {
  record: ChekiRecord;
  onBack?: () => void;
}

interface LiveInfo {
  name: string;
  artists: string[];
  artist?: string;
  artistImageUrls?: string[];
  liveType?: string;
  artistImageUrl?: string;
  date: Date;
  venue: string;
  seat?: string;
  ticketPrice?: number;
  startTime: string;
  endTime: string;
  imageUrl?: string;
  imageUrls?: string[];
  qrCode?: string;
  memo?: string;
  detail?: string;
  setlistSongs?: SetlistItem[];
}

const isPersistedImageUri = (uri: string) => {
  return uri.startsWith('Tickemo/') || uri.startsWith('http://') || uri.startsWith('https://');
};

const sanitizeTicketPrice = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const normalized = value
      .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xfee0))
      .replace(/[^0-9]/g, '');
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const TICKET_BASE_LAYOUT = {
  width: 350,
  height: 852,
  qrSize: 160,
  titleTickerWidth: 240,
  contentTop: 200,
  contentPaddingTop: 80,
  contentPaddingHorizontal: 0,
  contentPaddingBottom: 10,
  qrTop: 130,
  jacketTop: 400,
  jacketLeft: -18,
  infoSectionTop: 360,
  titleTop: 100,
  titleLeft: 90,
  liveTypeTop: 200,
  artistTop: 250,
  artistRight: 20,
  infoTop: 330,
  infoRight: -20,
  infoLabelWidth: 100,
  venueTickerHeight: 28,
  infoGap: 100,
  infoMarginTop: 40,
} as const;

export const TicketDetail: React.FC<TicketDetailProps> = ({ record, onBack }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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
  const baseWidth = TICKET_BASE_LAYOUT.width;
  const baseHeight = TICKET_BASE_LAYOUT.height;
  const ticketWidth = Math.min(windowWidth * 0.9, baseWidth);
  const ticketAspectRatio = baseWidth / baseHeight;
  const toXPct = (value: number): `${number}%` => `${(value / baseWidth) * 100}%`;
  const toYPct = (value: number): `${number}%` => `${(value / baseHeight) * 100}%`;
  const qrSize = (TICKET_BASE_LAYOUT.qrSize / baseWidth) * ticketWidth;
  const titleTickerWidthPct = toXPct(TICKET_BASE_LAYOUT.titleTickerWidth);
  const topBarBottom = Math.max(insets.bottom + 20, windowHeight * 0.045);
  const topBarRight = Math.max(16, windowWidth * 0.04);
  const qrTopPct = toYPct(TICKET_BASE_LAYOUT.qrTop);
  const qrLeftPct = toXPct((baseWidth - TICKET_BASE_LAYOUT.qrSize) / 2);
  const qrWidthPct = toXPct(TICKET_BASE_LAYOUT.qrSize);
  const jacketTopPct = toYPct(TICKET_BASE_LAYOUT.jacketTop);
  const jacketLeftPct = toXPct(TICKET_BASE_LAYOUT.jacketLeft);
  const jacketWidthPct = toXPct(TICKET_BASE_LAYOUT.qrSize * 0.6);
  const infoSectionTopPct = toYPct(TICKET_BASE_LAYOUT.infoSectionTop);
  const infoSectionBottomPct = toYPct(70);
  const titleTopPct = toYPct(TICKET_BASE_LAYOUT.titleTop);
  const titleLeftPct = toXPct(TICKET_BASE_LAYOUT.titleLeft);
  const liveTypeTopPct = toYPct(TICKET_BASE_LAYOUT.liveTypeTop);
  const artistTopPct = toYPct(TICKET_BASE_LAYOUT.artistTop);
  const artistRightPct = toXPct(TICKET_BASE_LAYOUT.artistRight);
  const infoTopPct = toYPct(TICKET_BASE_LAYOUT.infoTop + TICKET_BASE_LAYOUT.infoMarginTop);
  const infoRightPct = toXPct(TICKET_BASE_LAYOUT.infoRight);
  const infoLabelWidthPct = toXPct(TICKET_BASE_LAYOUT.infoLabelWidth);
  const venueTickerHeightPct = toYPct(TICKET_BASE_LAYOUT.venueTickerHeight);
  const infoGapPct = toYPct(TICKET_BASE_LAYOUT.infoGap);
  const liveName = record.liveName || '-';
  const isLongName = liveName.length >= 8;
  const liveTypeLabels = t('liveEdit.liveTypes', { returnObjects: true }) as string[];
  const normalizedLiveType = normalizeLiveType(record.liveType);
  const isStreamingLiveType = normalizedLiveType === 'streaming';
  const liveTypeLabel = getLiveTypeLabel(normalizedLiveType, liveTypeLabels);
  const liveTypeIconName = (LIVE_TYPE_ICON_MAP[normalizedLiveType] ?? 'account') as keyof typeof MaterialCommunityIcons.glyphMap;
  const ticketPriceValue = sanitizeTicketPrice(record.ticketPrice);
  const ticketPriceLabel = ticketPriceValue === undefined ? '-' : `¥${ticketPriceValue.toLocaleString('ja-JP')}`;
  const coverUri = resolveLocalImageUri(record.imageUrls?.[0] ?? record.imagePath ?? '');
  const hasCoverImage = Boolean(coverUri && coverUri !== NO_IMAGE_URI);
  const fullArtistText = useMemo(() => {
    const artists = (record.artists && record.artists.length > 0 ? record.artists : [record.artist || ''])
      .map((artist) => artist.trim())
      .filter((artist) => artist.length > 0);
    if (artists.length === 0) return '-';
    return artists.join(' / ');
  }, [record.artists, record.artist]);
  const editInitialData = useMemo(() => ({
    name: record.liveName,
    artists: record.artists && record.artists.length > 0 ? record.artists : [record.artist || ''],
    artist: record.artist,
    artistImageUrls: record.artistImageUrls,
    artistImageUrl: record.artistImageUrl,
    liveType: record.liveType,
    date: new Date(record.date.replace(/\./g, '-')),
    venue: record.venue || '',
    seat: record.seat,
    ticketPrice: sanitizeTicketPrice(record.ticketPrice),
    startTime: record.startTime || '18:00',
    endTime: record.endTime || '20:00',
    imageUrls: record.imageUrls,
    qrCode: record.qrCode,
    memo: record.memo,
    detail: record.detail,
    setlistSongs: setlistSongs,
  }), [record.liveName, record.artists, record.artist, record.artistImageUrls, record.artistImageUrl, record.liveType, record.date, record.venue, record.seat, record.ticketPrice, record.startTime, record.endTime, record.imageUrls, record.qrCode, record.memo, record.detail, setlistSongs]);

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
      t('ticketDetail.alerts.deleteConfirmTitle'),
      t('ticketDetail.alerts.deleteConfirmMessage', {
        liveName: record.liveName || t('ticketDetail.defaultLiveName'),
      }),
      [
        {
          text: t('ticketDetail.alerts.cancel'),
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: t('ticketDetail.alerts.delete'),
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
          
          if (!isPersistedImageUri(normalizedUri)) {
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
      const filteredArtists = (Array.isArray(info.artists) ? info.artists : [info.artist || record.artist || ''])
        .map((artistName) => artistName.trim())
        .filter((artistName) => artistName !== '');
      const filteredArtistImageUrls = (Array.isArray(info.artistImageUrls) ? info.artistImageUrls : [info.artistImageUrl || record.artistImageUrl || ''])
        .map((imageUrl) => imageUrl.trim())
        .slice(0, Math.max(filteredArtists.length, 0));

      const updatedRecord: ChekiRecord = {
        ...record,
        artists: filteredArtists,
        artist: filteredArtists[0] || '',
        artistImageUrls: filteredArtistImageUrls,
        artistImageUrl: filteredArtistImageUrls[0] || info.artistImageUrl || record.artistImageUrl,
        liveName: info.name,
        liveType: normalizeLiveType(info.liveType || record.liveType),
        date: formatDate(info.date),
        venue: info.venue,
        seat: info.seat,
        ticketPrice: sanitizeTicketPrice(info.ticketPrice) ?? sanitizeTicketPrice(record.ticketPrice),
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
      Alert.alert(t('ticketDetail.alerts.error'), t('ticketDetail.alerts.saveFailed'));
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
                bottom: topBarBottom,
                right: topBarRight,
              },
              {
                transform: [{
                  translateX: translateY.interpolate({
                    inputRange: [0, 1000],
                    outputRange: [0, windowWidth * 1.2],
                    extrapolate: 'clamp',
                  }),
                }],
              },
            ]}
          >
            <TouchableOpacity style={styles.topBarButton} onPress={handleSharePress}>
              <View style={styles.topBarButtonInner}>
                <HugeiconsIcon icon={Share06Icon} size={24} color="#FFFFFF" strokeWidth={2.0} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.topBarButton} onPress={handleEditPress}>
              <View style={styles.topBarButtonInner}>
                <HugeiconsIcon icon={Edit01Icon} size={24} color="#FFFFFF" strokeWidth={2.0} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.topBarButton} onPress={handleDeletePress}>
              <View style={styles.topBarButtonInner}>
                <HugeiconsIcon icon={Delete01Icon} size={24} color="#FF6B6B" strokeWidth={2.0} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          <PanGestureHandler
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
          >
            <Animated.View
              style={[
                styles.container,
                { width: ticketWidth, aspectRatio: ticketAspectRatio },
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
              <Svg width="100%" height="100%" viewBox="0 0 280 529" fill="none" style={StyleSheet.absoluteFillObject}>
                <Path d="M279.118 201.1C275.555 201.681 272.834 204.772 272.834 208.5C272.834 212.228 275.555 215.319 279.118 215.9L279.118 531.006C278.95 531.004 278.782 531 278.613 531C259.927 531 244.767 544.319 244.64 560.791L33.9746 560.791C33.8473 544.319 18.6859 531 0 531L0 215.991C0.110743 215.996 0.222045 216 0.333984 216C4.47612 216 7.83398 212.642 7.83398 208.5C7.83398 204.358 4.47612 201 0.333984 201C0.222045 201 0.110743 201.004 0 201.009L0 30C18.4716 29.9996 33.5006 16.9848 33.9658 0.774414L33.9766 0L244.637 0C244.637 16.5684 259.848 29.9998 278.613 30C278.782 30 278.95 29.9963 279.118 29.9941L279.118 201.1ZM27.834 208.5C27.834 204.358 24.4761 201 20.334 201C16.1921 201 12.834 204.358 12.834 208.5C12.834 212.642 16.1921 216 20.334 216C24.4761 216 27.834 212.642 27.834 208.5ZM47.834 208.5C47.834 204.358 44.4761 201 40.334 201C36.1921 201 32.834 204.358 32.834 208.5C32.834 212.642 36.1921 216 40.334 216C44.4761 216 47.834 212.642 47.834 208.5ZM67.834 208.5C67.834 204.358 64.4761 201 60.334 201C56.1921 201 52.834 204.358 52.834 208.5C52.834 212.642 56.1921 216 60.334 216C64.4761 216 67.834 212.642 67.834 208.5ZM87.834 208.5C87.834 204.358 84.4761 201 80.334 201C76.1921 201 72.834 204.358 72.834 208.5C72.834 212.642 76.1921 216 80.334 216C84.4761 216 87.834 212.642 87.834 208.5ZM107.834 208.5C107.834 204.358 104.476 201 100.334 201C96.1921 201 92.834 204.358 92.834 208.5C92.834 212.642 96.1921 216 100.334 216C104.476 216 107.834 212.642 107.834 208.5ZM127.834 208.5C127.834 204.358 124.476 201 120.334 201C116.192 201 112.834 204.358 112.834 208.5C112.834 212.642 116.192 216 120.334 216C124.476 216 127.834 212.642 127.834 208.5ZM147.834 208.5C147.834 204.358 144.476 201 140.334 201C136.192 201 132.834 204.358 132.834 208.5C132.834 212.642 136.192 216 140.334 216C144.476 216 147.834 212.642 147.834 208.5ZM167.834 208.5C167.834 204.358 164.476 201 160.334 201C156.192 201 152.834 204.358 152.834 208.5C152.834 212.642 156.192 216 160.334 216C164.476 216 167.834 212.642 167.834 208.5ZM187.834 208.5C187.834 204.358 184.476 201 180.334 201C176.192 201 172.834 204.358 172.834 208.5C172.834 212.642 176.192 216 180.334 216C184.476 216 187.834 212.642 187.834 208.5ZM207.834 208.5C207.834 204.358 204.476 201 200.334 201C196.192 201 192.834 204.358 192.834 208.5C192.834 212.642 196.192 216 200.334 216C204.476 216 207.834 212.642 207.834 208.5ZM227.834 208.5C227.834 204.358 224.476 201 220.334 201C216.192 201 212.834 204.358 212.834 208.5C212.834 212.642 216.192 216 220.334 216C224.476 216 227.834 212.642 227.834 208.5ZM247.834 208.5C247.834 204.358 244.476 201 240.334 201C236.192 201 232.834 204.358 232.834 208.5C232.834 212.642 236.192 216 240.334 216C244.476 216 247.834 212.642 247.834 208.5ZM267.834 208.5C267.834 204.358 264.476 201 260.334 201C256.192 201 252.834 204.358 252.834 208.5C252.834 212.642 256.192 216 260.334 216C264.476 216 267.834 212.642 267.834 208.5Z" fill="white" />
              </Svg>

              {/* Content overlay */}
              <View
                style={[
                  styles.responsiveContentContainer,
                ]}
                pointerEvents="box-none"
              >
                {/* QR Code section at top */}
                <View
                  style={[
                    styles.qrContainer,
                    {
                      top: qrTopPct,
                      left: qrLeftPct,
                      width: qrWidthPct,
                      aspectRatio: 1,
                    },
                  ]}
                >
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
                    { top: jacketTopPct, left: jacketLeftPct },
                    { width: jacketWidthPct, aspectRatio: 1 },
                    {
                      transform: [
                        {
                          translateX: translateY.interpolate({
                            inputRange: [0, 1000],
                            outputRange: [0, -ticketWidth],
                            extrapolate: 'clamp',
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.jacketOverlay}>
                    {hasCoverImage ? (
                      <Image
                        source={{ uri: coverUri }}
                        style={styles.jacketImage}
                        contentFit="cover"
                      />
                    ) : (
                      <DummyJacket style={styles.jacketImage} iconSize={22} />
                    )}
                  </View>
                </Animated.View>

                {/* Info section */}
                <ScrollView
                  style={styles.responsiveInfoScroll}
                  contentContainerStyle={{
                    flexGrow: 1,
                    paddingBottom: toYPct(50),
                  }}
                  showsVerticalScrollIndicator={false}
                  pointerEvents="auto"
                >
                  <View
                    style={[
                      styles.responsiveInfoSection,
                      {
                        top: infoSectionTopPct,
                        bottom: infoSectionBottomPct,
                      },
                    ]}
                    pointerEvents="box-none"
                  >
                    {isLongName ? (
                      <View style={[styles.mainTitleWrapper, { top: titleTopPct, left: titleLeftPct, width: titleTickerWidthPct }]}>
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
                      <View style={[styles.mainTitleWrapper, { top: titleTopPct, left: titleLeftPct, width: titleTickerWidthPct }]}>
                        <Text style={styles.mainTitleText} numberOfLines={1}>
                          {liveName}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.liveTypeIconRow, { top: liveTypeTopPct, left: titleLeftPct }]}>
                      {isStreamingLiveType ? (
                        <Feather name="radio" size={18} color="#A1A1A1" />
                      ) : (
                        <MaterialCommunityIcons name={liveTypeIconName} size={18} color="#A1A1A1" />
                      )}
                      <Text style={styles.liveTypeText}>{liveTypeLabel}</Text>
                      <View style={styles.ticketPriceInlineRow}>
                        <HugeiconsIcon icon={Ticket03Icon} size={16} color="#A1A1A1" strokeWidth={2.0} />
                        <Text style={styles.ticketPriceInlineText}>{ticketPriceLabel}</Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.artistName, { top: artistTopPct, left: titleLeftPct, right: artistRightPct }]}
                      numberOfLines={2}
                      adjustsFontSizeToFit={true}
                    >
                      {fullArtistText}
                    </Text>

                    <View style={[styles.info, { top: infoTopPct, right: infoRightPct, flexDirection: 'column', gap: infoGapPct }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: infoLabelWidthPct, textAlign: 'right' }]}>DATE</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.date || '-'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: infoLabelWidthPct, textAlign: 'right' }]}>START</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.endTime || '18:00'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: infoLabelWidthPct, textAlign: 'right' }]}>VENUE</Text>
                        {(record.venue || '-').length >= 8 ? (
                          <View style={{ flex: 1, height: venueTickerHeightPct, justifyContent: 'center' }}>
                            <TextTicker
                              style={[styles.infoValue, { textAlign: 'left' }]}
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
                          <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>
                            {record.venue || '-'}
                          </Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: infoLabelWidthPct, textAlign: 'right' }]}>SEAT</Text>
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
          initialData={editInitialData}
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
  const { t } = useTranslation();
  const width = 330;
  const height = 852;
  const qrSize = 155;
  const normalizedLiveType = normalizeLiveType(record.liveType);
  const isStreamingLiveType = normalizedLiveType === 'streaming';
  const liveTypeLabels = t('liveEdit.liveTypes', { returnObjects: true }) as string[];
  const liveTypeLabel = getLiveTypeLabel(normalizedLiveType, liveTypeLabels);
  const liveTypeIconName = (LIVE_TYPE_ICON_MAP[normalizedLiveType] ?? 'account') as keyof typeof MaterialCommunityIcons.glyphMap;
  const ticketPriceValue = sanitizeTicketPrice(record.ticketPrice);
  const ticketPriceLabel = ticketPriceValue === undefined ? '-' : `¥${ticketPriceValue.toLocaleString('ja-JP')}`;
  const coverUri = resolveLocalImageUri(record.imageUrls?.[0] ?? record.imagePath ?? '');
  const hasCoverImage = Boolean(coverUri && coverUri !== NO_IMAGE_URI);
  const fullArtistText = useMemo(() => {
    const artists = (record.artists && record.artists.length > 0 ? record.artists : [record.artist || ''])
      .map((artist) => artist.trim())
      .filter((artist) => artist.length > 0);
    if (artists.length === 0) return '-';
    return artists.join(' / ');
  }, [record.artists, record.artist]);

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
              { width, height, paddingTop: 130 },
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
                  {hasCoverImage ? (
                    <Image
                      source={{ uri: coverUri }}
                      style={styles.jacketImage}
                      contentFit="cover"
                    />
                  ) : (
                    <DummyJacket style={styles.jacketImage} iconSize={18} />
                  )}
                </View>
              </Animated.View>

              {/* Info section */}
              <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false} pointerEvents="auto">
                <View style={styles.infoSection}>
                  <Text style={[styles.mainTitle, (record.liveName || '').length >= 12 && {fontSize: 22}]}>
                    {(record.liveName || '').length >= 12 ? `${record.liveName?.substring(0, 10)}\n${record.liveName?.substring(10)}` : (record.liveName || '-')}
                  </Text>
                  <View style={[styles.liveTypeIconRow, (record.liveName || '').length >= 12 && { top: 55 }]}> 
                    {isStreamingLiveType ? (
                      <Feather name="radio" size={18} color="#A1A1A1" />
                    ) : (
                      <MaterialCommunityIcons name={liveTypeIconName} size={18} color="#A1A1A1" />
                    )}
                    <Text style={styles.liveTypeText}>{liveTypeLabel}</Text>
                    <View style={styles.ticketPriceInlineRow}>
                      <HugeiconsIcon icon={Ticket03Icon} size={16} color="#A1A1A1" strokeWidth={2.0} />
                      <Text style={styles.ticketPriceInlineText}>{ticketPriceLabel}</Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.artistName, (record.liveName || '').length >= 12 && { top: 75 }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit={true}
                  >
                    {fullArtistText}
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
                      {(record.venue || '-').length >= 8 ? (
                        <View style={{ flex: 1, height: 28, justifyContent: 'center' }}>
                          <TextTicker
                            style={[styles.infoValue, { textAlign: 'left' }]}
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
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>
                          {record.venue || '-'}
                        </Text>
                      )}
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
    paddingTop: 0,
  },
  responsiveContentContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  responsiveInfoScroll: {
    ...StyleSheet.absoluteFillObject,
  },
  responsiveInfoSection: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  topBar: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.80)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 14,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 100,
  },
  topBarButton: {
    overflow: 'hidden',
    borderRadius: 24,
  },
  topBarButtonInner: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 24,
  },
  contentContainer: {
    position: 'absolute',
    top: 130,
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
    paddingBottom: 30,
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
  ticketPriceInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 12,
  },
  ticketPriceInlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A1A1A1',
  },
  artistName: {
    position: 'absolute',
    top: 50,
    left: 70,
    right: 20,
    fontSize: 14,
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
