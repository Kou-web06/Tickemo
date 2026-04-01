import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Linking,
  Share as NativeShare,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { CdIcon, Ticket02Icon, Invoice01Icon, AddCircleHalfDotIcon, MoreHorizontalCircle01Icon, Cancel01Icon, CircleLock02Icon, LookTopIcon } from '@hugeicons/core-free-icons';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { SvgXml } from 'react-native-svg';
import { resolveLocalImageUri } from '../lib/imageUpload';
import { getSetlist } from '../lib/setlistDb';
import EditableTicketPreview from './EditableTicketPreviewCard';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import type { ChekiRecord } from '../types/record';
import type { SetlistItem } from '../types/setlist';

const BARCODE_SVG = `<svg width="315" height="101" viewBox="0 0 315 101" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="101" height="13.2036" transform="matrix(0 -1 -1 0 39.6108 101)" fill="white"/>
<rect width="101" height="13.2036" transform="matrix(0 -1 -1 0 92.4248 101)" fill="white"/>
<rect width="101" height="1.88623" transform="matrix(0 -1 -1 0 20.7485 101)" fill="white"/>
<rect width="101" height="1.88623" transform="matrix(0 -1 -1 0 56.5869 101)" fill="white"/>
<rect width="101" height="1.88623" transform="matrix(0 -1 -1 0 64.1318 101)" fill="white"/>
<rect width="101" height="1.88623" transform="matrix(0 -1 -1 0 135.808 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 13.2036 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 73.563 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 145.239 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 154.67 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 115.06 101)" fill="white"/>
<rect width="101" height="7.54491" transform="matrix(0 -1 -1 0 105.629 101)" fill="white"/>
<rect width="101" height="7.54491" transform="matrix(0 -1 -1 0 128.263 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 49.0415 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 3.77246 101)" fill="white"/>
<rect width="101" height="13.2036" transform="matrix(0 -1 -1 0 199.94 101)" fill="white"/>
<rect width="101" height="13.2036" transform="matrix(0 -1 -1 0 252.754 101)" fill="white"/>
<rect width="101" height="1.88623" transform="matrix(0 -1 -1 0 181.078 101)" fill="white"/>
<rect width="101" height="1.88623" transform="matrix(0 -1 -1 0 216.916 101)" fill="white"/>
<rect width="101" height="1.88623" transform="matrix(0 -1 -1 0 224.461 101)" fill="white"/>
<rect width="101" height="1.88623" transform="matrix(0 -1 -1 0 296.138 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 173.533 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 233.892 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 305.569 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 315 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 275.389 101)" fill="white"/>
<rect width="101" height="7.54491" transform="matrix(0 -1 -1 0 265.958 101)" fill="white"/>
<rect width="101" height="7.54491" transform="matrix(0 -1 -1 0 288.593 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 209.371 101)" fill="white"/>
<rect width="101" height="3.77246" transform="matrix(0 -1 -1 0 164.102 101)" fill="white"/>
</svg>`;

interface ShareImageGeneratorProps {
  record: ChekiRecord;
  visible: boolean;
  onClose: () => void;
  onBeforeOpenPaywall?: () => void;
}

type CardType = 'ticket' | 'cd' | 'receipt';
type ShareAction = 'save' | 'stories' | 'other' | null;

const LOCK_SCRIBBLE_SOURCES = [
  require('../assets/hideParts/scribble1.png'),
  require('../assets/hideParts/scribble2.png'),
  require('../assets/hideParts/scribble3.png'),
] as const;

type RNShareLike = {
  shareSingle: (options: Record<string, unknown>) => Promise<unknown>;
  open?: (options: Record<string, unknown>) => Promise<unknown>;
  Social: {
    InstagramStories: string;
  };
};

const getRNShare = (): RNShareLike | null => {
  try {
    const mod = require('react-native-share');
    const share = (mod?.default ?? mod) as {
      shareSingle?: (options: Record<string, unknown>) => Promise<unknown>;
      open?: (options: Record<string, unknown>) => Promise<unknown>;
    };
    const social = mod?.Social as { InstagramStories?: string } | undefined;

    if (!share?.shareSingle || !social?.InstagramStories) {
      return null;
    }

    return {
      shareSingle: share.shareSingle,
      open: share.open,
      Social: {
        InstagramStories: social.InstagramStories,
      },
    };
  } catch {
    return null;
  }
};

const ShareImageGenerator: React.FC<ShareImageGeneratorProps> = ({ record, visible, onClose, onBeforeOpenPaywall }) => {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const userProfile = useAppStore((state) => state.userProfile);
  const isPremium = useAppStore((state) => state.isPremium);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ShareAction>(null);
  const [captureBlurBackground, setCaptureBlurBackground] = useState(false);
  const [cachedImageUri, setCachedImageUri] = useState<string | null>(null);
  const [cardType, setCardType] = useState<CardType>('ticket');
  const [setlistSongs, setSetlistSongs] = useState<SetlistItem[]>([]);
  const [cdTextColor, setCdTextColor] = useState<'white' | 'black'>('white');
  const ticketViewRef = useRef<View>(null);
  const cdViewRef = useRef<View>(null);
  const receiptViewRef = useRef<View>(null);
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible && record?.id) {
      getSetlist(record.id).then(setSetlistSongs).catch(() => setSetlistSongs([]));
    } else {
      setSetlistSongs([]);
    }
  }, [visible, record?.id]);

  const outputWidth = 1480;
  const outputHeight = 1200;
  const receiptOutputWidth = 826;
  const receiptOutputHeight = 2044;
  const displayScale = 0.25;
  const defaultPreviewHeight = 400;
  const receiptPreviewHeight = Math.min(Math.max(screenHeight * 0.5, 420), 520);
  const previewHeightAnim = useRef(new Animated.Value(defaultPreviewHeight)).current;

  // record が変わった瞬間に即座に画像を解決・キャッシュ（visible 待ちなし）
  useEffect(() => {
    const coverSource = record.imageUrls?.[0] ?? record.imagePath;
    if (coverSource) {
      const resolved = resolveLocalImageUri(coverSource);
      setCachedImageUri(resolved || coverSource);
    } else {
      setCachedImageUri(null);
    }
  }, [record.id]);

  const handleModalShow = useCallback(() => {
    overlayAnim.setValue(0);
    sheetAnim.setValue(600);
    Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 11 }),
    ]).start();
  }, []);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: 700, duration: 280, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  const coverUri = useMemo(() => {
    const coverSource = record.imageUrls?.[0] ?? record.imagePath;
    return cachedImageUri || (coverSource ? resolveLocalImageUri(coverSource) : null) || coverSource || null;
  }, [cachedImageUri, record.imageUrls, record.imagePath]);

  const isLockedPreview = !isPremium && (cardType === 'cd' || cardType === 'receipt');
  const isActionDisabled = isGenerating || isLockedPreview;

  const handleOpenPaywall = useCallback(() => {
    if (onBeforeOpenPaywall) {
      onBeforeOpenPaywall();
      return;
    }
    Alert.alert('Upgrade to Plus', 'CD and Receipt cards are available for Plus members.');
  }, [onBeforeOpenPaywall]);

  const captureImage = async (): Promise<string | null> => {
    if (isLockedPreview) {
      handleOpenPaywall();
      return null;
    }

    const activeViewRef = cardType === 'ticket'
      ? ticketViewRef
      : cardType === 'cd'
        ? cdViewRef
        : receiptViewRef;

    if (!activeViewRef.current) {
      Alert.alert(t('shareImageGenerator.alerts.error'), t('shareImageGenerator.alerts.previewNotReady'));
      return null;
    }

    try {
      const captureWidth = cardType === 'receipt' ? receiptOutputWidth : outputWidth;
      const captureHeight = cardType === 'receipt' ? receiptOutputHeight : outputHeight;
      const uri = await captureRef(activeViewRef, {
        format: 'png',
        quality: 1,
        width: captureWidth,
        height: captureHeight,
      });
      return uri;
    } catch (error) {
      Alert.alert(t('shareImageGenerator.alerts.error'), t('shareImageGenerator.alerts.imageGenerateFailed'));
      return null;
    }
  };

  const handleSaveImage = async () => {
    setSelectedAction('save');
    setIsGenerating(true);
    try {
      const uri = await captureImage();
      if (!uri) return;

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('shareImageGenerator.alerts.error'), t('shareImageGenerator.alerts.mediaPermissionRequired'));
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(t('shareImageGenerator.alerts.done'), t('shareImageGenerator.alerts.savedToCameraRoll'));
      onClose();
    } catch (error) {
      Alert.alert(t('shareImageGenerator.alerts.error'), t('shareImageGenerator.alerts.saveFailed'));
    } finally {
      setIsGenerating(false);
      setSelectedAction(null);
    }
  };

  const handleSystemShare = async () => {
    setSelectedAction('other');
    setIsGenerating(true);
    setCaptureBlurBackground(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const uri = await captureImage();
      if (!uri) return;

      const postText = `${record.date || ''} ${record.artist || ''} - ${record.liveName || ''} \n #Tickemo`;
      const shareUrl = uri.startsWith('file://') ? uri : `file://${uri}`;

      const rnShare = getRNShare();
      if (rnShare?.open) {
        await rnShare.open({
          title: 'Share',
          url: shareUrl,
          type: 'image/png',
          message: postText,
          failOnCancel: false,
        });
      } else {
        await NativeShare.share({
          message: postText,
          url: shareUrl,
        });
      }

      onClose();
    } catch (error) {
      Alert.alert(t('shareImageGenerator.alerts.error'), t('shareImageGenerator.alerts.shareFailed'));
    } finally {
      setCaptureBlurBackground(false);
      setIsGenerating(false);
      setSelectedAction(null);
    }
  };

  const handleStoriesShare = async () => {
    setSelectedAction('stories');
    setIsGenerating(true);
    setCaptureBlurBackground(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const uri = await captureImage();
      if (!uri) return;

      const shareUrl = uri.startsWith('file://') ? uri : `file://${uri}`;

      const rnShare = getRNShare();
      if (rnShare) {
        await rnShare.shareSingle({
          social: rnShare.Social.InstagramStories,
          appId: 'com.anonymous.Tickemo',
          backgroundImage: shareUrl,
        });
      } else {
        const storyUrls = Platform.OS === 'ios'
          ? ['instagram-stories://share', 'instagram://camera']
          : ['instagram://story-camera', 'instagram-stories://share'];
        let opened = false;
        for (const url of storyUrls) {
          const supported = await Linking.canOpenURL(url);
          if (!supported) continue;
          await Linking.openURL(url);
          opened = true;
          break;
        }
        if (!opened) {
          throw new Error('Stories editor not available');
        }
      }

      onClose();
    } catch (error) {
      // 連携失敗時のみカメラ画面遷移へフォールバック
      try {
        const storyUrls = Platform.OS === 'ios'
          ? ['instagram-stories://share', 'instagram://camera']
          : ['instagram://story-camera', 'instagram-stories://share'];
        let opened = false;
        for (const url of storyUrls) {
          const supported = await Linking.canOpenURL(url);
          if (!supported) continue;
          await Linking.openURL(url);
          opened = true;
          break;
        }
        if (!opened) {
          throw new Error('Stories editor not available');
        }
      } catch {
        Alert.alert(t('shareImageGenerator.alerts.error'), t('shareImageGenerator.alerts.shareFailed'));
      }
    } finally {
      setCaptureBlurBackground(false);
      setIsGenerating(false);
      setSelectedAction(null);
    }
  };

  const handleSelectCardType = useCallback((type: CardType) => {
    setCardType(type);
  }, []);

  useEffect(() => {
    Animated.timing(previewHeightAnim, {
      toValue: cardType === 'receipt' ? receiptPreviewHeight : defaultPreviewHeight,
      duration: 420,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [cardType, defaultPreviewHeight, previewHeightAnim, receiptPreviewHeight]);

  const shareCreditHandle = useMemo(() => {
    const username = userProfile?.username?.trim();
    return username ? `@${username.replace(/^@+/, '')}` : '@tickemo_user';
  }, [userProfile?.username]);

  const renderCDCard = () => {
    const cdScale = 0.20;
    const displayW = outputWidth * cdScale;   // 296
    const displayH = outputHeight * cdScale;  // 240

    // song と encore を保持し、表示用に変換
    type SetlistRow =
      | { kind: 'song'; name: string }
      | { kind: 'encore' };

    const setlistRows: SetlistRow[] = setlistSongs
      .filter((item) => item.type === 'song' || item.type === 'encore')
      .map((item) =>
        item.type === 'encore'
          ? { kind: 'encore' as const }
          : { kind: 'song' as const, name: (item as { type: 'song'; songName: string }).songName }
      );

    const fgColor = cdTextColor === 'white' ? '#FFFFFF' : '#1C1C1C';
    const fgColorSub = cdTextColor === 'white' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.65)';
    const fgShadow = cdTextColor === 'white'
      ? { textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }
      : {};
    const creditShadow = cdTextColor === 'white'
      ? { textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }
      : {};
    const barcodeXml = BARCODE_SVG.replaceAll('fill="white"', `fill="${cdTextColor === 'white' ? '#FFFFFF' : '#1C1C1C'}"`);

    type SetlistDisplayLine = {
      key: string;
      text: string;
      fontSize: number;
      lineHeight: number;
      fontWeight?: '500';
      letterSpacing?: number;
      color: string;
    };

    const setlistDisplayLines: SetlistDisplayLine[] = (() => {
      const lines: SetlistDisplayLine[] = [];
      let songIndex = 0;

      setlistRows.forEach((row, idx) => {
        if (row.kind === 'encore') {
          lines.push({
            key: `encore-space-${idx}`,
            text: ' ',
            fontSize: 25,
            lineHeight: 35,
            color: 'transparent',
          });
          lines.push({
            key: `encore-label-${idx}`,
            text: '[ENCORE]',
            fontSize: 22,
            lineHeight: 30,
            fontWeight: '500',
            letterSpacing: 2,
            color: fgColor,
          });
          return;
        }

        songIndex += 1;
        lines.push({
          key: `song-${idx}`,
          text: `${songIndex}.${row.name.trim()}`,
          fontSize: 25,
          lineHeight: 35,
          fontWeight: '500',
          color: fgColor,
        });
      });

      return lines;
    })();

    const maxLinesPerColumn = 28;
    const column1Lines = setlistDisplayLines.slice(0, maxLinesPerColumn);
    const column2Lines = setlistDisplayLines.slice(maxLinesPerColumn);
    const codeDate = (record.date || '')
      .replace(/[^\d]/g, '')
      .slice(0, 8)
      .padEnd(8, '0');
    const codeTime = (record.startTime || '')
      .replace(/[^\d]/g, '')
      .slice(0, 4)
      .padEnd(4, '0');
    const setlistCount = setlistSongs.filter((item) => item.type === 'song').length;
    const businessCode = `No. ${codeDate}-${codeTime}-${String(setlistCount).padStart(2, '0')}`;

    return (
      <View style={styles.previewFrame}>
        <View style={{ width: displayW, height: displayH, overflow: 'hidden' }}>
          <View
            ref={cdViewRef}
            collapsable={false}
            style={{
              width: outputWidth,
              height: outputHeight,
              transform: [{ scale: cdScale }],
              transformOrigin: 'top left',
              backgroundColor: 'transparent',
            }}
          >
            {/* Layer 1 (最下層): cdFrame.png */}
            <Image
              source={require('../assets/cdFrame.png')}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              contentFit="contain"
            />

            {/* Layer 2: ジャケット画像（spineを除いたメインエリアに配置） */}
            <View style={{ position: 'absolute', top: 75, left: 180, right: 62, bottom: 0, overflow: 'hidden' }}>
              <View style={{ width: '95%', height: '95%' }}>
                {coverUri ? (
                  <Image
                    source={{ uri: coverUri }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: '100%', height: '100%', backgroundColor: '#882211' }} />
                )}
                {cdTextColor === 'white' ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.15)',
                    }}
                  />
                ) : null}
              </View>
            </View>

            {/* Layer 3: セットリスト（左端に縦並び） */}
            <View style={{ position: 'absolute', top: 120, left: 200, width: 460, bottom: 90, backgroundColor: 'transparent', padding: 10, flexDirection: 'row', columnGap: 16 }}>
              {setlistDisplayLines.length > 0 ? (
                <>
                  <View style={{ flex: 1 }}>
                    {column1Lines.map((line) => (
                      <Text
                        key={line.key}
                        style={{
                          fontSize: line.fontSize,
                          lineHeight: line.lineHeight,
                          fontWeight: line.fontWeight,
                          letterSpacing: line.letterSpacing,
                          color: line.color,
                        }}
                        numberOfLines={1}
                      >
                        {line.text}
                      </Text>
                    ))}
                  </View>

                  {column2Lines.length > 0 ? (
                    <View style={{ flex: 1 }}>
                      {column2Lines.map((line) => (
                        <Text
                          key={line.key}
                          style={{
                            fontSize: line.fontSize,
                            lineHeight: line.lineHeight,
                            fontWeight: line.fontWeight,
                            letterSpacing: line.letterSpacing,
                            color: line.color,
                          }}
                          numberOfLines={1}
                        >
                          {line.text}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={{ fontSize: 25, color: fgColor }}>No setlist</Text>
              )}
            </View>

            {/* Layer 4: ライブ情報（右上） */}
            <View style={{ position: 'absolute', top: 160, right: 200, width: 600, alignItems: 'flex-end' }}>
              <Text
                style={{ fontSize: 56, fontWeight: '900', color: fgColor, textAlign: 'right', ...fgShadow }}
                numberOfLines={2}
              >
                {record.liveName}
              </Text>
              <Text
                style={{ fontSize: 42, fontWeight: '600', color: fgColor, marginTop: 50, textAlign: 'right', ...fgShadow }}
              >
                {record.date}
              </Text>
              {record.venue ? (
                <Text
                  style={{ fontSize: 38, fontWeight: '600', color: fgColorSub, marginTop: 10, textAlign: 'right', ...fgShadow }}
                  numberOfLines={2}
                >
                  {record.venue}
                </Text>
              ) : null}
            </View>

            {/* Layer 5: バーコード（最上面） */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 180,
                bottom: 355,
                width: 430,
                zIndex: 999,
                elevation: 999,
                alignItems: 'flex-end',
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  letterSpacing: 1,
                  color: fgColor,
                  textAlign: 'right',
                  ...fgShadow,
                }}
              >
                {businessCode}
              </Text>
            </View>

            {/* Layer 5: バーコード（最上面） */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 180,
                bottom: 200,
                width: 430,
                height: 140,
                zIndex: 999,
                elevation: 999,
              }}
            >
              <SvgXml xml={barcodeXml} width="100%" height="100%" />
            </View>

            {/* Layer 6: クレジット表記 */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 180,
                bottom: 90,
                width: 550,
                zIndex: 999,
                elevation: 999,
                alignItems: 'flex-end',
              }}
            >
              <Text
                style={{ fontSize: 38, fontWeight: '500', color: fgColor, textAlign: 'right', ...creditShadow }}
              >
                This share card was created
              </Text>
              <Text
                style={{ marginTop: 0, fontSize: 38, fontWeight: '500', color: fgColor, textAlign: 'right', ...creditShadow }}
              >
                {`by ${shareCreditHandle} with Tickemo`}
              </Text>
            </View>

            {/* Layer 7: filmLayer（最上面） */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1000,
                elevation: 1000,
              }}
            >
              <Image
                source={require('../assets/filmLayer.svg')}
                style={{ position: 'absolute', top: 65, bottom: 0, left: 65, width: '90%', height: '90%'}}
                contentFit="contain"
              />
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderReceiptCard = () => {
    const targetDisplayHeight = Math.min(receiptPreviewHeight - 72, screenHeight * 0.42);
    const receiptScale = targetDisplayHeight / receiptOutputHeight;
    const displayW = receiptOutputWidth * receiptScale;
    const displayH = receiptOutputHeight * receiptScale;
    const receiptLine = '------------------------------------------------------------';

    const receiptArtistLabel = (() => {
      const names = [...new Set(
        setlistSongs
          .filter((item): item is SetlistItem & { type: 'song'; artistName?: string } => item.type === 'song')
          .map((item) => item.artistName?.trim())
          .filter((n): n is string => !!n)
      )];
      if (names.length > 0) return names.join(' / ');
      return record.artist || '-';
    })();

    const isMultiArtist = (() => {
      const names = [...new Set(
        setlistSongs
          .filter((item): item is SetlistItem & { type: 'song'; artistName?: string } => item.type === 'song')
          .map((item) => item.artistName?.trim())
          .filter((n): n is string => !!n)
      )];
      return names.length > 1;
    })();

    const sortedItems = [...setlistSongs]
      .filter((item): item is SetlistItem & ({ type: 'song'; songName: string } | { type: 'encore' } | { type: 'mc'; title: string }) =>
        item.type === 'song' || item.type === 'encore' || item.type === 'mc'
      )
      .sort((a, b) => a.orderIndex - b.orderIndex);

    type ReceiptEntry =
      | { kind: 'song'; songNumber: number; songName: string; key: string }
      | { kind: 'encore'; key: string };

    const isEncoreMarkerText = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return false;
      const compact = trimmed
        .toLowerCase()
        .replace(/[\s\-－—–―ー_＊*\[\]【】()（）]/g, '');
      return compact === 'encore' || compact === 'アンコール';
    };

    let songNumber = 0;
    const allEntries: ReceiptEntry[] = sortedItems
      .map((item) => {
        if (item.type === 'encore') {
          return { kind: 'encore', key: `encore-${item.id}` };
        }

        if (item.type === 'mc') {
          return isEncoreMarkerText(item.title)
            ? { kind: 'encore', key: `encore-mc-${item.id}` }
            : null;
        }

        const name = item.songName.trim();
        if (!name) return null;
        if (isEncoreMarkerText(name)) {
          return { kind: 'encore', key: `encore-song-${item.id}` };
        }
        songNumber += 1;
        return {
          kind: 'song',
          songNumber,
          songName: isMultiArtist && item.artistName?.trim()
            ? `${name} - ${item.artistName.trim()}`
            : name,
          key: `song-${item.id}`,
        };
      })
      .filter((item): item is ReceiptEntry => item !== null);

    const totalTracks = allEntries.filter((entry) => entry.kind === 'song').length;
    const shouldCompressList = totalTracks > 16;

    const takeHeadEntries = (entries: ReceiptEntry[], songLimit: number) => {
      const result: ReceiptEntry[] = [];
      let songs = 0;
      for (const entry of entries) {
        if (songs >= songLimit) break;
        result.push(entry);
        if (entry.kind === 'song') songs += 1;
      }
      return result;
    };

    const takeTailEntries = (entries: ReceiptEntry[], songLimit: number) => {
      const result: ReceiptEntry[] = [];
      let songs = 0;
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const entry = entries[i];
        if (songs >= songLimit) break;
        result.unshift(entry);
        if (entry.kind === 'song') songs += 1;
      }
      return result;
    };

    const leadingEntries = shouldCompressList ? takeHeadEntries(allEntries, 8) : allEntries;
    const trailingEntries = shouldCompressList ? takeTailEntries(allEntries, 8) : [];
    const shownSongs = (entries: ReceiptEntry[]) => entries.filter((entry) => entry.kind === 'song').length;
    const hiddenTrackCount = shouldCompressList
      ? Math.max(totalTracks - shownSongs(leadingEntries) - shownSongs(trailingEntries), 0)
      : 0;

    return (
      <View style={styles.previewFrame}>
        <View style={{ width: displayW, height: displayH, overflow: 'hidden' }}>
          <View
            ref={receiptViewRef}
            collapsable={false}
            style={{
              width: receiptOutputWidth,
              height: receiptOutputHeight,
              transform: [{ scale: receiptScale }],
              transformOrigin: 'top left',
            }}
          >
            <Image
              source={require('../assets/receipt.png')}
              style={styles.receiptBackgroundImage}
              contentFit="cover"
            />

            <View style={styles.receiptOverlayContent}>
              <Text style={styles.receiptTitle}>TICKEMO</Text>

              <View style={styles.receiptInfoBlock}>
                <Text style={styles.receiptInfoLine} numberOfLines={1}>{`VENUE: ${record.venue || '-'}`}</Text>
                <Text style={styles.receiptInfoLine}>{`DATE : ${record.date || '-'}`}</Text>
                <Text style={styles.receiptInfoLine} numberOfLines={1}>{`EVENT: ${record.liveName || '-'}`}</Text>
                <Text style={styles.receiptInfoLine} numberOfLines={1}>{`ARTIST: ${receiptArtistLabel}`}</Text>
              </View>

              <Text style={styles.receiptDivider}>{receiptLine}</Text>

              <View style={styles.receiptTableHeaderRow}>
                <View style={styles.receiptTableLeftHeaderGroup}>
                  <Text style={styles.receiptTableHeaderText}>QTY</Text>
                  <Text style={styles.receiptTableHeaderText}>ITEM</Text>
                </View>
                <Text style={styles.receiptTableHeaderText}>AMT</Text>
              </View>

              <Text style={styles.receiptDivider}>{receiptLine}</Text>

              <View style={styles.receiptItemsBlock}>
                {leadingEntries.map((entry) => (
                  entry.kind === 'encore' ? (
                    <Text key={entry.key} style={styles.receiptEncoreLine}>-------------------- ENCORE --------------------</Text>
                  ) : (
                    <View key={entry.key} style={styles.receiptItemRow}>
                      <Text style={styles.receiptQtyText}>{entry.songNumber.toString().padStart(2, '0')}</Text>
                      <Text style={styles.receiptItemText} numberOfLines={1}>{entry.songName}</Text>
                      <Text style={styles.receiptAmtText}>1.00</Text>
                    </View>
                  )
                ))}

                {hiddenTrackCount > 0 ? (
                  <Text style={styles.receiptEllipsis}>...</Text>
                ) : null}

                {trailingEntries.map((entry) => (
                  entry.kind === 'encore' ? (
                    <Text key={entry.key} style={styles.receiptEncoreLine}>-------------------- ENCORE --------------------</Text>
                  ) : (
                    <View key={entry.key} style={styles.receiptItemRow}>
                      <Text style={styles.receiptQtyText}>{entry.songNumber.toString().padStart(2, '0')}</Text>
                      <Text style={styles.receiptItemText} numberOfLines={1}>{entry.songName}</Text>
                      <Text style={styles.receiptAmtText}>1.00</Text>
                    </View>
                  )
                ))}
              </View>

              <Text style={styles.receiptDivider}>{receiptLine}</Text>

              <View style={styles.receiptSummaryRow}>
                <Text style={styles.receiptSummaryLabel}>SUBTOTAL:</Text>
                <Text style={styles.receiptSummaryValue}>{totalTracks}</Text>
              </View>
              <View style={styles.receiptSummaryRow}>
                <Text style={styles.receiptSummaryLabel}>TAX:</Text>
                <Text style={styles.receiptSummaryValue}>0%</Text>
              </View>

              <Text style={styles.receiptDivider}>{receiptLine}</Text>

              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>TOTAL:</Text>
                <Text style={styles.receiptTotalValue}>{`${totalTracks} ITEMS`}</Text>
              </View>

              <Text style={styles.receiptDivider}>{receiptLine}</Text>

              <View style={styles.receiptPaymentBlock}>
                <Text style={styles.receiptInfoLine}>PAID WITH: PASSION & TEARS</Text>
                <Text style={styles.receiptInfoLine}>AUTH CODE: VDY-20260214</Text>
                <Text style={styles.receiptInfoLine}>{`HOLDER: ${shareCreditHandle}`}</Text>
              </View>

              <View style={styles.receiptBottomBlock}>
                <Text style={styles.receiptThanksText}>THANK YOU FOR VISITING!</Text>
                <Image
                  source={require('../assets/tickemo_qr.png')}
                  style={styles.receiptQrImage}
                  contentFit="contain"
                />
                <Text style={styles.receiptBottomCaption}>NO REFUNDS ON LIVE MEMORIES.</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (!record) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="none" transparent={true} statusBarTranslucent onRequestClose={handleClose} onShow={handleModalShow}>
      <Animated.View style={[styles.overlayBg, { opacity: overlayAnim }]} />
      <Animated.View style={[styles.sheetWrapper, { transform: [{ translateY: sheetAnim }] }]}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <View style={styles.handleBarContainer}>
            <View style={styles.handleBar} />
          </View>

          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.85} style={styles.closeButton}>
              <HugeiconsIcon icon={Cancel01Icon} size={26} color="#BCBCBC" strokeWidth={2.1} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Share</Text>
          </View>

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollContainer}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Animated.View style={[styles.previewArea, { height: previewHeightAnim }]}>
              <View style={styles.previewContainer}>
                <View
                  pointerEvents={cardType === 'ticket' ? 'auto' : 'none'}
                  style={[styles.previewLayer, cardType === 'ticket' ? styles.previewLayerActive : styles.previewLayerHidden]}
                >
                  <View style={styles.previewFrame}>
                    <EditableTicketPreview
                      record={record}
                      coverUri={coverUri}
                      captureBlurBackground={captureBlurBackground}
                      outputWidth={outputWidth}
                      outputHeight={outputHeight}
                      displayScale={displayScale}
                      selectedSticker={'none'}
                      backgroundColor={'#FFFFFF'}
                      selectedFilterId={'normal'}
                      captureViewRef={ticketViewRef}
                    />
                  </View>
                </View>

                <View
                  pointerEvents={cardType === 'cd' ? 'auto' : 'none'}
                  style={[styles.previewLayer, cardType === 'cd' ? styles.previewLayerActive : styles.previewLayerHidden]}
                >
                  {renderCDCard()}
                </View>

                <View
                  pointerEvents={cardType === 'receipt' ? 'auto' : 'none'}
                  style={[styles.previewLayer, cardType === 'receipt' ? styles.previewLayerActive : styles.previewLayerHidden]}
                >
                  {renderReceiptCard()}
                </View>

                {isLockedPreview ? (
                  <TouchableOpacity style={styles.lockOverlayTouchable} activeOpacity={0.9} onPress={handleOpenPaywall}>
                    <BlurView intensity={8} tint="light" style={styles.lockBlur} />
                    <View style={styles.lockContent}>
                      <HugeiconsIcon icon={LookTopIcon} size={34} color="#2F2F2F" strokeWidth={2.0} />
                      <Text style={styles.lockTitle}>Upgrade to Plus</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Animated.View>

            <View style={styles.bottomArea}>
              <View style={styles.switcherRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handleSelectCardType('ticket')}
                style={[styles.switcherButton, cardType === 'ticket' ? styles.switcherButtonActive : styles.switcherButtonInactive]}
              >
                <View style={styles.switcherContent}>
                  <HugeiconsIcon
                    icon={Ticket02Icon}
                    size={14}
                    color={cardType === 'ticket' ? '#FFFFFF' : '#888888'}
                    strokeWidth={2}
                  />
                  <Text style={[styles.switcherText, cardType === 'ticket' ? styles.switcherTextActive : styles.switcherTextInactive]}>
                    Ticket
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handleSelectCardType('receipt')}
                style={[styles.switcherButton, cardType === 'receipt' ? styles.switcherButtonActive : styles.switcherButtonInactive]}
              >
                <View style={styles.switcherContent}>
                  <HugeiconsIcon
                    icon={Invoice01Icon}
                    size={14}
                    color={cardType === 'receipt' ? '#FFFFFF' : '#888888'}
                    strokeWidth={2}
                  />
                  <Text style={[styles.switcherText, cardType === 'receipt' ? styles.switcherTextActive : styles.switcherTextInactive]}>
                    Receipt
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handleSelectCardType('cd')}
                style={[styles.switcherButton, cardType === 'cd' ? styles.switcherButtonActive : styles.switcherButtonInactive]}
              >
                <View style={styles.switcherContent}>
                  <HugeiconsIcon
                    icon={CdIcon}
                    size={14}
                    color={cardType === 'cd' ? '#FFFFFF' : '#888888'}
                    strokeWidth={2}
                  />
                  <Text style={[styles.switcherText, cardType === 'cd' ? styles.switcherTextActive : styles.switcherTextInactive]}>
                    CD
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {cardType === 'cd' && (
              <View style={styles.cdColorPickerRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setCdTextColor('white')}
                  style={[styles.cdColorButton, { backgroundColor: '#FFFFFF', borderColor: cdTextColor === 'white' ? '#333333' : '#CCCCCC' }]}
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setCdTextColor('black')}
                  style={[styles.cdColorButton, { backgroundColor: '#1C1C1C', borderColor: cdTextColor === 'black' ? '#888888' : 'transparent' }]}
                />
              </View>
            )}

            <Text style={styles.shareQuestion}>where to share?</Text>

            <View style={styles.shareButtonsRow}>
            <TouchableOpacity style={[styles.shareAction, isLockedPreview && styles.shareActionDisabled]} onPress={handleSaveImage} disabled={isActionDisabled} activeOpacity={0.85}>
              <View style={[styles.circleButton, isLockedPreview && styles.circleButtonDisabled]}>
                {isGenerating && selectedAction === 'save' ? (
                  <ActivityIndicator size="small" color="#666666" />
                ) : (
                  <Feather name="download" size={26} color="#333333" />
                )}
                {isLockedPreview ? (
                  <Image source={LOCK_SCRIBBLE_SOURCES[0]} style={styles.actionLockScribble} contentFit="contain" pointerEvents="none" />
                ) : null}
              </View>
              <Text style={styles.shareButtonText}>save</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.shareAction, isLockedPreview && styles.shareActionDisabled]} onPress={handleStoriesShare} disabled={isActionDisabled} activeOpacity={0.85}>
              <View style={[styles.circleButton, isLockedPreview && styles.circleButtonDisabled]}>
                {isGenerating && selectedAction === 'stories' ? (
                  <ActivityIndicator size="small" color="#666666" />
                ) : (
                  <View style={{ transform: [{ scaleY: -1 }] }}>
                    <HugeiconsIcon
                      icon={AddCircleHalfDotIcon}
                      size={28}
                      color="#333333"
                      strokeWidth={2.1}
                    />
                  </View>
                )}
                {isLockedPreview ? (
                  <Image source={LOCK_SCRIBBLE_SOURCES[1]} style={styles.actionLockScribble} contentFit="contain" pointerEvents="none" />
                ) : null}
              </View>
              <Text style={styles.shareButtonText}>stories</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.shareAction, isLockedPreview && styles.shareActionDisabled]} onPress={handleSystemShare} disabled={isActionDisabled} activeOpacity={0.85}>
              <View style={[styles.circleButton, isLockedPreview && styles.circleButtonDisabled]}>
                {isGenerating && selectedAction === 'other' ? (
                  <ActivityIndicator size="small" color="#666666" />
                ) : (
                  <HugeiconsIcon
                    icon={MoreHorizontalCircle01Icon}
                    size={28}
                    color="#333333"
                    strokeWidth={1.8}
                  />
                )}
                {isLockedPreview ? (
                  <Image source={LOCK_SCRIBBLE_SOURCES[2]} style={styles.actionLockScribble} contentFit="contain" pointerEvents="none" />
                ) : null}
              </View>
              <Text style={styles.shareButtonText}>other</Text>
            </TouchableOpacity>
          </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '95%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    overflow: 'hidden',
  },
  handleBarContainer: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 4,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginLeft: 16,
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollContainer: {
    paddingBottom: 14,
  },
  previewArea: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLayerActive: {
    opacity: 1,
  },
  previewLayerHidden: {
    opacity: 0,
  },
  lockOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    overflow: 'hidden',
  },
  lockBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  lockContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  lockTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2F2F2F',
  },
  previewFrame: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    borderRadius: 14,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 24,
  },
  shareQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 10,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  shareAction: {
    alignItems: 'center',
  },
  shareActionDisabled: {
    opacity: 0.95,
  },
  circleButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'visible',
  },
  circleButtonDisabled: {
    backgroundColor: '#F4F4F4',
  },
  actionLockScribble: {
    position: 'absolute',
    width: 60,
    height: 60,
    top: 0,
    left: 0,
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    marginTop: 8,
    textAlign: 'center',
  },
  switcherRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
    gap: 8,
    marginBottom: 35,
  },
  switcherButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  switcherButtonActive: {
    backgroundColor: '#333333',
  },
  switcherButtonInactive: {
    backgroundColor: '#EBEBEB',
  },
  switcherText: {
    fontSize: 13,
    fontWeight: '700',
  },
  switcherTextActive: {
    color: '#FFFFFF',
  },
  switcherTextInactive: {
    color: '#888888',
  },
  cdColorPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: -16,
    marginBottom: 20,
  },
  cdColorButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  // シンプルCD ケーススタイル
  cdCaseContainerSimple: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    padding: 40,
    gap: 30,
    backgroundColor: '#F8F8F8',
  },
  cdJacketWrapperSimple: {
    width: '35%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cdJacketImageSimple: {
    width: '100%',
    height: '100%',
  },
  cdJacketFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cdInfoSection: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 20,
  },
  cdSetlistColumnSimple: {
    flex: 1,
    paddingRight: 20,
  },
  cdSetlistItem: {
    fontSize: 10,
    lineHeight: 14,
    color: '#1C1C1C',
    fontFamily: 'Courier',
    fontWeight: '500',
    marginBottom: 2,
  },
  cdLiveInfoColumnSimple: {
    width: '40%',
    paddingLeft: 16,
    justifyContent: 'space-between',
  },
  cdLiveInfoTitleSimple: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1C',
    fontFamily: 'Courier',
    lineHeight: 20,
    marginBottom: 8,
  },
  cdLiveInfoMetaSimple: {
    fontSize: 9,
    color: '#333333',
    fontFamily: 'Courier',
    fontWeight: '600',
    marginVertical: 2,
  },
  cdDividerLine: {
    height: 1,
    backgroundColor: '#CCCCCC',
    marginVertical: 6,
  },
  cdBarcodeLabel: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: '#666666',
    marginBottom: 4,
  },
  cdBarcodeContainerSimple: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    alignItems: 'center',
  },
  cdCreditContainerSimple: {
    position: 'absolute',
    bottom: 12,
    right: 40,
    alignItems: 'center',
  },
  cdCreditTextSimple: {
    fontSize: 5.5,
    lineHeight: 7,
    color: '#888888',
    fontFamily: 'Courier',
    fontWeight: '400',
    textAlign: 'center',
  },
  receiptBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  receiptOverlayContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 68,
    paddingTop: 92,
    paddingBottom: 54,
  },
  receiptInfoBlock: {
    marginTop: 54,
    gap: 4,
  },
  receiptBottomBlock: {
    marginTop: 'auto',
    marginBottom: 'auto',
    alignItems: 'center',
    paddingTop: 16,
    gap: 18,
  },
  receiptTitle: {
    fontFamily: 'Roboto Mono',
    fontSize: 92,
    lineHeight: 96,
    color: '#333333',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 24,
  },
  receiptInfoLine: {
    fontFamily: 'Roboto Mono',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '700',
  },
  receiptDivider: {
    fontFamily: 'Roboto Mono',
    marginTop: 10,
    marginBottom: 8,
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
  },
  receiptTableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTableLeftHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 50,
  },
  receiptTableHeaderText: {
    fontFamily: 'Roboto Mono',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '700',
  },
  receiptItemsBlock: {
    gap: 2,
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  receiptQtyText: {
    fontFamily: 'Roboto Mono',
    width: 76,
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '700',
  },
  receiptItemText: {
    fontFamily: 'Roboto Mono',
    flex: 1,
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '700',
    paddingRight: 14,
  },
  receiptAmtText: {
    fontFamily: 'Roboto Mono',
    width: 104,
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '700',
    textAlign: 'right',
  },
  receiptEllipsis: {
    fontFamily: 'Roboto Mono',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '700',
    marginVertical: 2,
  },
  receiptEncoreLine: {
    fontFamily: 'Roboto Mono',
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '700',
    marginVertical: 10,
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  receiptSummaryLabel: {
    fontFamily: 'Roboto Mono',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '700',
  },
  receiptSummaryValue: {
    fontFamily: 'Roboto Mono',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '700',
    textAlign: 'right',
  },
  receiptTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  receiptTotalLabel: {
    fontFamily: 'Roboto Mono',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '800',
  },
  receiptTotalValue: {
    fontFamily: 'Roboto Mono',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    fontWeight: '800',
    textAlign: 'right',
  },
  receiptPaymentBlock: {
    gap: 4,
  },
  receiptThanksText: {
    fontFamily: 'Roboto Mono',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    textAlign: 'center',
    fontWeight: '700',
  },
  receiptQrImage: {
    width: 160,
    height: 160,
  },
  receiptBottomCaption: {
    fontFamily: 'Roboto Mono',
    fontSize: 26,
    lineHeight: 34,
    color: '#333333',
    textAlign: 'center',
    fontWeight: '700',
  },
});

export default ShareImageGenerator;
