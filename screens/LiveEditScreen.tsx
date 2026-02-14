import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import PagerView from 'react-native-pager-view';
import LottieView from 'lottie-react-native';
import { theme } from '../theme';
import DateInputField from '../components/DateInputField';
import ArtistInput from '../components/ArtistInput';
import SetlistEditor from '../components/SetlistEditor';
import { OverlayLoading } from '../components/OverlayLoading';
import type { SetlistItem } from '../types/setlist';

interface LiveInfo {
  name: string;
  artist: string;
  artistImageUrl?: string; // アーティスト画像URL
  date: Date;
  venue: string;
  seat?: string;
  startTime: string;
  endTime: string;
  imageUrls?: string[]; // 最大6枚の画像
  qrCode?: string;
  memo?: string;
  detail?: string; // 旧形式（後方互換）
  setlistSongs?: SetlistItem[];
}

interface Props {
  initialData: LiveInfo | null;
  onSave: (info: LiveInfo) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean; // ローディング状態を親から受け取る
  focusMemo?: boolean; // メモ入力欄にオートフォーカスするかどうか
}

export default function LiveEditScreen({ initialData, onSave, onCancel, isLoading = false, focusMemo = false }: Props) {
  const parseTime = (timeStr?: string, defaultTime: string = '18:00'): string => {
    if (!timeStr || typeof timeStr !== 'string') {
      return defaultTime;
    }
    // HH:mm形式の検証
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      if (hour >= 0 && hour < 24 && (minute === 0 || minute === 30)) {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
    }
    return defaultTime;
  };

  const [name, setName] = useState(initialData?.name || '');
  const [artist, setArtist] = useState(initialData?.artist || '');
  const [artistImageUrl, setArtistImageUrl] = useState(initialData?.artistImageUrl || '');
  const [date, setDate] = useState(initialData?.date || new Date());
  const [venue, setVenue] = useState(initialData?.venue || '');
  const [seat, setSeat] = useState(initialData?.seat || '');
  const [startTime, setStartTime] = useState(parseTime(initialData?.startTime, '18:00'));
  const [endTime, setEndTime] = useState(parseTime(initialData?.endTime, '20:00'));
  const [imageUrls, setImageUrls] = useState<string[]>(initialData?.imageUrls || []);
  const [qrCode, setQrCode] = useState(initialData?.qrCode || '');
  const [memo, setMemo] = useState(initialData?.memo || '');
  const [detail, setDetail] = useState(initialData?.detail || '');
  const [setlistSongs, setSetlistSongs] = useState<SetlistItem[]>(initialData?.setlistSongs || []);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [isArtistDropdownOpen, setIsArtistDropdownOpen] = useState(false);
  const [isSongDropdownOpen, setIsSongDropdownOpen] = useState(false);
  const pagerRef = useRef<PagerView>(null);
  const memoInputRef = useRef<TextInput>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [showChecked, setShowChecked] = useState(false);
  const [pendingShowChecked, setPendingShowChecked] = useState(false);
  const [checkedOverlayKey, setCheckedOverlayKey] = useState(0);
  const checkedRef = useRef<LottieView>(null);
  const checkedCloseReady = useRef(false);
  const checkedAnimationFinished = useRef(false);
  const checkedCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkedStartTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (pendingShowChecked && !isLoading && !showChecked) {
      if (checkedStartTimeout.current) {
        clearTimeout(checkedStartTimeout.current);
      }
      checkedStartTimeout.current = setTimeout(() => {
        setPendingShowChecked(false);
        setCheckedOverlayKey((prev) => prev + 1);
        setShowChecked(true);
      }, 250);
    }
  }, [pendingShowChecked, isLoading]);

  useEffect(() => {
    if (showChecked) {
      checkedRef.current?.play(0);
      checkedCloseReady.current = false;
      checkedAnimationFinished.current = false;
      if (checkedCloseTimeout.current) {
        clearTimeout(checkedCloseTimeout.current);
      }
      checkedCloseTimeout.current = setTimeout(() => {
        checkedCloseReady.current = true;
        if (checkedAnimationFinished.current) {
          setShowChecked(false);
          onCancel();
        }
      }, 900);
    }
  }, [showChecked, checkedOverlayKey, onCancel]);

  useEffect(() => {
    return () => {
      if (checkedCloseTimeout.current) {
        clearTimeout(checkedCloseTimeout.current);
      }
      if (checkedStartTimeout.current) {
        clearTimeout(checkedStartTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (focusMemo) {
      // Memories ページ（index 2）に遷移
      goToPage(2);
      // 少し時間をおいてからメモ入力欄をフォーカス
      const timer = setTimeout(() => {
        memoInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [focusMemo]);

  const isBasicValid =
    name.trim().length > 0 &&
    artist.trim().length > 0 &&
    venue.trim().length > 0 &&
    Boolean(date);

  const goToPage = (index: number) => {
    pagerRef.current?.setPage(index);
    setCurrentPage(index);
  };

  const handlePageSelected = (event: any) => {
    const nextIndex = event.nativeEvent.position;
    if (nextIndex > 0 && !isBasicValid) {
      Alert.alert('入力エラー', 'ライブ名・アーティスト名・日付・会場は必須です');
      pagerRef.current?.setPage(0);
      setCurrentPage(0);
      return;
    }
    setCurrentPage(nextIndex);
  };

  const handleNext = () => {
    if (currentPage === 0 && !isBasicValid) {
      Alert.alert('入力エラー', 'ライブ名・アーティスト名・日付・会場は必須です');
      return;
    }
    goToPage(Math.min(currentPage + 1, 2));
  };

  const handleBack = () => {
    goToPage(Math.max(currentPage - 1, 0));
  };

  // 必須ラベルコンポーネント
  const RequiredLabel = ({ label, required = false }: { label: string; required?: boolean }) => (
    <Text style={styles.sectionLabel}>
      {label}
      {required && <Text style={styles.requiredMark}> *</Text>}
    </Text>
  );

  // 時間選択モーダルコンポーネント（30分刻み）
  const TimePickerModal = ({ visible, title, selectedTime, onSelect, onClose }: {
    visible: boolean;
    title: string;
    selectedTime: string;
    onSelect: (time: string) => void;
    onClose: () => void;
  }) => {
    // 30分刻みの時刻リストを生成 (00:00, 00:30, 01:00, ..., 23:30)
    const timeOptions: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      timeOptions.push(`${String(hour).padStart(2, '0')}:00`);
      timeOptions.push(`${String(hour).padStart(2, '0')}:30`);
    }

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timeModalContent}>
            <View style={styles.timeModalHeader}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.timeModalCancel}>キャンセル</Text>
              </TouchableOpacity>
              <Text style={styles.timeModalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.timeModalDone}>完了</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 300 }}>
              {timeOptions.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeOption,
                    selectedTime === time && styles.timeOptionSelected,
                  ]}
                  onPress={() => {
                    onSelect(time);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      selectedTime === time && styles.timeOptionTextSelected,
                    ]}
                  >
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const handlePickImage = async () => {
    if (imageUrls.length >= 6) {
      Alert.alert('画像は6枚まで', '最大6枚まで登録できます');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const resolvedUri = await resolvePickedImageUri(asset);
      setImageUrls([...imageUrls, resolvedUri]);
    }
  };

  const handleReplaceImage = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const resolvedUri = await resolvePickedImageUri(asset);
      const newUrls = [...imageUrls];
      newUrls[index] = resolvedUri;
      setImageUrls(newUrls);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleArtistChange = (name: string, imageUrl?: string) => {
    setArtist(name);
    setArtistImageUrl(imageUrl || '');
  };

  const resolvePickedImageUri = async (asset: ImagePicker.ImagePickerAsset): Promise<string> => {
    if (asset.uri.startsWith('file://')) {
      return asset.uri;
    }
    if (asset.assetId) {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset.assetId);
        if (info.localUri) {
          return info.localUri;
        }
      } catch (error) {
        console.log('[LiveEditScreen] Failed to resolve asset localUri:', error);
      }
    }
    if (asset.base64 && FileSystem.cacheDirectory) {
      const extensionMatch = asset.uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
      const extension = extensionMatch?.[1] || (asset.mimeType?.includes('png') ? 'png' : 'jpg');
      const targetPath = `${FileSystem.cacheDirectory}tickemo-pick-${Date.now()}.${extension}`;
      try {
        await FileSystem.writeAsStringAsync(targetPath, asset.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return targetPath;
      } catch (error) {
        console.log('[LiveEditScreen] Failed to write base64 image:', error);
      }
    }
    return asset.uri;
  };

  const handleSave = async () => {
    if (!name || !artist || !venue) {
      Alert.alert('エラー', 'ライブ名、アーティスト名、会場は必須項目です');
      return;
    }

    if (imageUrls.length === 0) {
      Alert.alert('エラー', '少なくとも1枚の画像を選択してください');
      return;
    }

    if (isLoading || isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;

    try {
      await onSave({
        name,
        artist,
        artistImageUrl,
        date,
        venue,
        seat: seat || '',
        startTime: startTime || '18:00',
        endTime: endTime || '20:00',
        imageUrls,
        qrCode: qrCode || '',
        memo: memo || '',
        detail: detail || '',
        setlistSongs,
      });
    } catch (error) {
      isSubmittingRef.current = false;
      return;
    }

    setPendingShowChecked(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" />

      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton} disabled={isLoading}>
          <Ionicons name="close" size={28} color={isLoading ? '#ccc' : '#000'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ライブ情報の設定</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.stepHeader}>
        <View style={styles.stepHeaderRow}>
          <Text style={styles.stepHeaderLabel}>Step {currentPage + 1}/3</Text>
          <Text style={styles.stepHeaderTitle}>
            {currentPage === 0 ? '基本情報' : currentPage === 1 ? 'セットリスト作成' : '思い出・メモ'}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((currentPage + 1) / 3) * 100}%` }]} />
        </View>
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
        scrollEnabled={false}
      >
        <View key="basic" style={styles.page}>
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isArtistDropdownOpen}
            keyboardShouldPersistTaps="handled"
          >
            {/* ライブ名 */}
            <View style={styles.section}>
              <RequiredLabel label="ライブ名" required />
              <View style={styles.inputContainer}>
                <View style={styles.inputBlur}>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="例: どんぐりTOUR 2026"
                    placeholderTextColor="#CCCCCC"
                  />
                </View>
              </View>
            </View>

            {/* アーティスト名 */}
            <View style={[styles.section, { zIndex: 1000 }]}>
              <RequiredLabel label="アーティスト名" required />
              <ArtistInput
                value={artist}
                imageUrl={artistImageUrl}
                onChange={handleArtistChange}
                placeholder="アーティストを検索"
                onDropdownVisibilityChange={setIsArtistDropdownOpen}
              />
            </View>

            {/* 日付 */}
            <View style={styles.section}>
              <RequiredLabel label="日付" required />
              <DateInputField
                value={date}
                onChange={setDate}
              />
            </View>

            {/* 時間 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>開始時間</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowStartTimeModal(true)}
              >
                <View style={styles.inputBlur}>
                  <View style={styles.timeButton}>
                    <Ionicons name="time-outline" size={20} color="#666666" />
                    <Text style={styles.timeDisplay}>
                      {startTime || '18:00'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>終了時間</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowEndTimeModal(true)}
              >
                <View style={styles.inputBlur}>
                  <View style={styles.timeButton}>
                    <Ionicons name="time-outline" size={20} color="#666666" />
                    <Text style={styles.timeDisplay}>
                      {endTime || '20:00'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* 会場 */}
            <View style={styles.section}>
              <RequiredLabel label="会場" required />
              <View style={styles.inputContainer}>
                <View style={styles.inputBlur}>
                  <TextInput
                    style={styles.input}
                    value={venue}
                    onChangeText={setVenue}
                    placeholder="例: 東京ドーム"
                    placeholderTextColor="#CCCCCC"
                  />
                </View>
              </View>
            </View>

            {/* 座席 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>座席</Text>
              <View style={styles.inputContainer}>
                <View style={styles.inputBlur}>
                  <TextInput
                    style={styles.input}
                    value={seat}
                    onChangeText={setSeat}
                    placeholder="例: アリーナA-10"
                    placeholderTextColor="#CCCCCC"
                  />
                </View>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <TimePickerModal
            visible={showStartTimeModal}
            title="開始時間を選択"
            selectedTime={startTime}
            onSelect={setStartTime}
            onClose={() => setShowStartTimeModal(false)}
          />

          <TimePickerModal
            visible={showEndTimeModal}
            title="終了時間を選択"
            selectedTime={endTime}
            onSelect={setEndTime}
            onClose={() => setShowEndTimeModal(false)}
          />
        </View>

        <View key="setlist" style={styles.page}>
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isSongDropdownOpen}
            keyboardShouldPersistTaps="handled"
          >
            {/* SET LIST */}
            <View style={[styles.section, { zIndex: 50, minHeight: 300 }]}>
              <Text style={styles.sectionLabel}>SET LIST</Text>
              <SetlistEditor
                artistName={artist}
                initialSongs={setlistSongs}
                onChange={setSetlistSongs}
                onDropdownVisibilityChange={setIsSongDropdownOpen}
              />
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>

        <View key="memories" style={styles.page}>
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 画像（最大6枚） */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ライブの思い出</Text>
              <Text style={styles.caption}>最大6枚まで選択できます（1枚目がジャケット写真になります）</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 14, paddingVertical: 6 }}
              >
                {imageUrls.map((url, index) => (
                  <View key={index} style={styles.imageCard}>
                    <Image source={{ uri: url }} style={styles.imagePreview} contentFit="cover" />
                    {index === 0 && (
                      <View style={styles.jacketBadge}>
                        <MaterialIcons name="art-track" size={18} color="#ffffff" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeButtonOverlay}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {imageUrls.length < 6 && (
                  <TouchableOpacity style={styles.addImageCard} onPress={handlePickImage}>
                    <MaterialIcons name="add-a-photo" size={40} color="#999" />
                    <Text style={styles.addImageSub}>{imageUrls.length}/6</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {/* QRコード */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>QRコード（公式サイト、チケット、SNS等のURL）</Text>
              <View style={styles.inputContainer}>
                <View style={styles.inputBlur}>
                  <TextInput
                    style={styles.input}
                    value={qrCode}
                    onChangeText={setQrCode}
                    placeholder="例: https://example.com"
                    placeholderTextColor="#CCCCCC"
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
              </View>
            </View>

            {/* 思い出（メモ）*/}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>思い出（メモ）</Text>
              <View style={styles.inputContainer}>
                <View style={styles.inputBlur}>
                  <TextInput
                    ref={memoInputRef}
                    style={[styles.input, styles.multilineInput]}
                    value={memo}
                    onChangeText={setMemo}
                    placeholder="思い出をメモに残す..."
                    placeholderTextColor="#CCCCCC"
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </PagerView>

      <View style={styles.footerNav}>
        <View style={styles.footerButtons}>
          {currentPage > 0 ? (
            <TouchableOpacity style={styles.navButton} onPress={handleBack}>
              <Text style={styles.navButtonText}>戻る</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.navButtonPlaceholder} />
          )}

          {currentPage < 2 ? (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonPrimary,
                currentPage === 0 && !isBasicValid && styles.navButtonDisabled,
              ]}
              onPress={handleNext}
              disabled={currentPage === 0 && !isBasicValid}
            >
              <Text style={styles.navButtonPrimaryText}>次へ</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary]}
              onPress={handleSave}
              disabled={isLoading}
            >
              <Text style={styles.navButtonPrimaryText}>保存</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <OverlayLoading visible={isLoading} message="アップロード中..." />
      {showChecked && (
        <View style={styles.checkedOverlay} pointerEvents="none">
          <LottieView
            key={checkedOverlayKey}
            ref={checkedRef}
            source={require('../assets/animations/Checked.json')}
            autoPlay
            loop={false}
            speed={1.5}
            onAnimationFinish={() => {
              checkedAnimationFinished.current = true;
              if (checkedCloseReady.current) {
                setShowChecked(false);
                onCancel();
              }
            }}
            style={styles.checkedAnimation}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    paddingBottom: theme.spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 30,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F8F8F8',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSpacer: {
    width: 44,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 300,
  },
  stepHeader: {
    paddingHorizontal: 38,
    paddingBottom: 18,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: 0.6,
  },
  stepHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E3E3E3',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  footerNav: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#F8F8F8',
    borderTopWidth: 1,
    borderTopColor: '#F8F8F8',
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    minWidth: 120,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  navButtonPrimary: {
    backgroundColor: '#111111',
  },
  navButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  navButtonPlaceholder: {
    width: 120,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999999',
    marginBottom: 8,
    marginLeft: 4,
  },
  requiredMark: {
    color: '#D6007A',
    fontWeight: '400',
    fontSize: 18,
  },
  inputContainer: {
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputBlur: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontSize: 16,
    color: '#000',
  },
  multilineInput: {
    minHeight: 100,
  },
  caption: {
    fontSize: 12,
    color: '#777',
    marginBottom: 10,
    marginLeft: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 10,
    marginLeft: 4,
  },
  warningText: {
    fontSize: 11,
    color: '#FF453A',
    flex: 1,
    lineHeight: 16,
  },
  imageRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 6,
  },
  imageCard: {
    width: 140,
    height: 140,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  jacketBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#535353',
  },
  removeButtonOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageCard: {
    width: 140,
    height: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DDD',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addImageText: {
    fontSize: 14,
    color: '#777',
    fontWeight: '700',
  },
  addImageSub: {
    fontSize: 12,
    color: '#999',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#000',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeDisplay: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timeModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 12,
  },
  timeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timeModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  timeModalCancel: {
    fontSize: 14,
    color: '#999',
  },
  timeModalDone: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D6007A',
  },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  timeOptionSelected: {
    backgroundColor: '#FFF0F7',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: '#D6007A',
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 200 : 60,
  },
  pickerItem: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  checkedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  checkedAnimation: {
    width: 300,
    height: 300,
  },
});
