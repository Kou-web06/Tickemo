import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableWithoutFeedback, Animated, Alert, Modal } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { FontAwesome, Ionicons, Octicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Path, Rect, Defs, Pattern, Use, Image as SvgImage } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { ChekiRecord, useRecords } from '../contexts/RecordsContext';
import LiveEditScreen from '../screens/LiveEditScreen';
import ShareImageGenerator from './ShareImageGenerator';

interface TicketDetailProps {
  record: ChekiRecord;
  onBack?: () => void;
}

interface LiveInfo {
  name: string;
  artist: string;
  date: Date;
  venue: string;
  startTime: string;
  endTime: string;
  imageUrl?: string;
  qrCode?: string;
  memo?: string;
  detail?: string;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ record, onBack }) => {
  const { updateRecord, deleteRecord } = useRecords();
  const [showEditScreen, setShowEditScreen] = useState(false);
  const [showShareGenerator, setShowShareGenerator] = useState(false);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const width = 330;
  const height = 852;
  const qrSize = 155;

  const translateY = useRef(new Animated.Value(1000)).current;
  // jacketTranslateXはtranslateYからinterpolateで算出
  const lastOffset = useRef(0);

  const handleTitleLayout = (event: any) => {
    const { lines } = event.nativeEvent;
    if (lines && lines.length > 1) {
      setIsTitleTruncated(true);
    } else {
      setIsTitleTruncated(false);
    }
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
            if (onBack) {
              onBack();
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleEditPress = () => {
    setShowEditScreen(true);
  };

  const handleSharePress = () => {
    setShowShareGenerator(true);
  };

  const handleSaveLiveInfo = (info: LiveInfo) => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${year}.${month}.${day}`;
    };

    const updatedRecord: ChekiRecord = {
      ...record,
      artist: info.artist,
      liveName: info.name,
      date: formatDate(info.date),
      venue: info.venue,
      seat: info.seat,
      startTime: info.startTime,
      endTime: info.endTime,
      imageUrl: info.imageUrl || record.imageUrl,
      imageUrls: info.imageUrls || record.imageUrls || [],
      memo: info.memo || record.memo,
      detail: info.detail || record.detail,
      qrCode: info.qrCode || record.qrCode,
    };
    updateRecord(record.id, updatedRecord);
    setShowEditScreen(false);
    if (onBack) {
      onBack();
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
      <TouchableWithoutFeedback onPress={onBack}>
        <View style={{ flex: 1 }}>
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
                <MaterialIcons name="open-in-new" size={26} color="#FFF" />
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
                      style={{ width: qrSize, height: qrSize, resizeMode: 'contain' }}
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
                      source={{ uri: record.imageUrl }}
                      style={styles.jacketImage}
                      contentFit="cover"
                    />
                  </View>
                </Animated.View>

                {/* Info section */}
                <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false} pointerEvents="auto">
                  <View style={styles.infoSection}>
                    <Text 
                      style={[styles.mainTitle, (record.liveName || '').length >= 15 && {fontSize: 22}]}
                      onTextLayout={handleTitleLayout}
                    >
                      {isTitleTruncated ? `${(record.liveName || '-').substring(0, 10)}\n${(record.liveName || '-').substring(10)}` : (record.liveName || '-')}
                    </Text>
                    <Text style={[styles.artistName, (record.liveName || '').length >= 12 && {top: 75}]}>
                      {record.artist || '-'} 
                    </Text>

                    <View style={[styles.info, { flexDirection: 'column', gap: 12, marginTop: 40 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>DATE</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.date || '-'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>START</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.startTime || '-'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>VENUE</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left'}, (record.venue || '').length > 6 && {fontSize: 18}]}>
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
            date: new Date(record.date.replace(/\./g, '-')),
            venue: record.venue || '',
            seat: record.seat,
            startTime: record.startTime || '18:00',
            endTime: record.endTime || '20:00',
            imageUrl: record.imageUrl,
            imageUrls: record.imageUrls,
            qrCode: record.qrCode,
            memo: record.memo,
            detail: record.detail,
          }}
          onSave={handleSaveLiveInfo}
          onCancel={() => setShowEditScreen(false)}
        />
      </Modal>

      <ShareImageGenerator
        record={record}
        visible={showShareGenerator}
        onClose={() => setShowShareGenerator(false)}
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
                  style={{ width: qrSize, height: qrSize, resizeMode: 'contain' }}
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
                    source={{ uri: record.imageUrl }}
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
                  <Text style={[styles.artistName, (record.liveName || '').length >= 12 && {top: 75}]}>
                    {record.artist || '-'} 
                  </Text>

                  <View style={[styles.info, { flexDirection: 'column', gap: 12, marginTop: 40 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>DATE</Text>
                      <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.date || '-'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>START</Text>
                        <Text style={[styles.infoValue, { flex: 1, textAlign: 'left' }]}>{record.startTime || '-'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.infoLabel, { width: 100, textAlign: 'right' }]}>VENUE</Text>
                      <Text style={[styles.infoValue, { flex: 1, textAlign: 'left'}, (record.venue || '').length > 8 && {fontSize: 20}]}>
                        {record.venue || '-'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: 40 }}>
                    <Text>{record.memo || '-'}</Text>
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
    top: 80,
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
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    marginBottom: 5,
  },
  artistName: {
    position: 'absolute',
    top: 50,
    left: 70,
    fontSize: 18,
    fontWeight: '600',
    color: '#A1A1A1',
    marginBottom: 16,
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
    fontSize: 26,
    fontWeight: '800',
    color: '#A1A1A1',
    textTransform: 'uppercase',
    marginRight: 15,
  },
  infoValue: {
    fontSize: 26,
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
