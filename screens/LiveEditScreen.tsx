import React, { useEffect, useRef, useState, useMemo } from 'react';
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
import { SvgXml } from 'react-native-svg';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import PagerView from 'react-native-pager-view';
import LottieView from 'lottie-react-native';
import { useIsFocused } from '@react-navigation/native';
import { theme } from '../theme';
import DateInputField from '../components/DateInputField';
import ArtistInput from '../components/ArtistInput';
import SetlistEditor from '../components/SetlistEditor';
import { useResolvedImageUris } from '../hooks/useResolvedImageUri';
import type { SetlistItem } from '../types/setlist';

interface LiveInfo {
  name: string;
  artist: string;
  liveType?: string;
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
  focusMemo?: boolean;
  successHoldDuration?: number; // Success表示後の待機時間（デフォルト1500ms）
}

const MEMO_PROMPTS = [
  "今日の推しのビジュ、一言で言うと？",
  "一番鳥肌が立った瞬間はどこ？",
  "MCで心に残った言葉はあった？",
  "席からの景色はどうだった？（近かった？遠かった？）",
  "会場の熱気や、照明の演出はどうだった？",
  "思い出に残ってる曲とかあった？？"
];

const LIVE_TYPES = ['ワンマン', '対バン', 'フェス', 'FC限定'] as const;
const LIVE_TYPE_ICON_MAP: Record<(typeof LIVE_TYPES)[number], keyof typeof MaterialCommunityIcons.glyphMap> = {
  ワンマン: 'account',
  対バン: 'account-multiple',
  フェス: 'account-group',
  FC限定: 'account-star',
};

const ADD_PHOTO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
<g clip-path="url(#clip0_4418_9255)">
<path d="M9 10C10.1046 10 11 9.10457 11 8C11 6.89543 10.1046 6 9 6C7.89543 6 7 6.89543 7 8C7 9.10457 7.89543 10 9 10Z" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
<path d="M13 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22H15C20 22 22 20 22 15V10" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
<path d="M15.75 5H21.25" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" />
<path d="M18.5 7.75V2.25" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" />
<path d="M2.67004 18.9496L7.60004 15.6396C8.39004 15.1096 9.53004 15.1696 10.24 15.7796L10.57 16.0696C11.35 16.7396 12.61 16.7396 13.39 16.0696L17.55 12.4996C18.33 11.8296 19.59 11.8296 20.37 12.4996L22 13.8996" stroke="#8c8c8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</g>
<defs>
<clipPath id="clip0_4418_9255">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>
</svg>`;

export default function LiveEditScreen({ initialData, onSave, onCancel, focusMemo = false, successHoldDuration = 1500 }: Props) {
  const MAX_VENUE_LENGTH = 12;

  // ランダムなプレースホルダーを決定（マウント時に1回だけ計算）
  const randomPlaceholder = useMemo(() => {
    return MEMO_PROMPTS[Math.floor(Math.random() * MEMO_PROMPTS.length)];
  }, []);

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
  const [liveType, setLiveType] = useState(
    initialData?.liveType && LIVE_TYPES.includes(initialData.liveType as (typeof LIVE_TYPES)[number])
      ? initialData.liveType
      : LIVE_TYPES[0]
  );
  const [artistImageUrl, setArtistImageUrl] = useState(initialData?.artistImageUrl || '');
  const [date, setDate] = useState(initialData?.date || new Date());
  const [venue, setVenue] = useState(initialData?.venue || '');
  const [seat, setSeat] = useState(initialData?.seat || '');
  const [startTime, setStartTime] = useState(parseTime(initialData?.startTime, '18:00'));
  const [endTime, setEndTime] = useState(parseTime(initialData?.endTime, '20:00'));
  
  // 初期データの画像を解決（TicketDetailと同じフックを使用）
  const resolvedInitialImages = useResolvedImageUris(initialData?.imageUrls);
  
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUpdateKeys, setImageUpdateKeys] = useState<Record<number, number>>({});
  
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [successOverlayKey, setSuccessOverlayKey] = useState(0);
  const successCloseReady = useRef(false);
  const successAnimationFinished = useRef(false);
  const successCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmittingRef = useRef(false);
  const isFocused = useIsFocused();
  const hasUserEditedImages = useRef(false);

  useEffect(() => {
    if (showSuccess) {
      successCloseReady.current = false;
      successAnimationFinished.current = false;
      if (successCloseTimeout.current) {
        clearTimeout(successCloseTimeout.current);
      }
      // アニメーション完了後に余韻を持たせる
      successCloseTimeout.current = setTimeout(() => {
        successCloseReady.current = true;
        setShowSuccess(false);
        onCancel();
      }, successHoldDuration);
    }
  }, [showSuccess, successOverlayKey, onCancel]);

  useEffect(() => {
    return () => {
      if (successCloseTimeout.current) {
        clearTimeout(successCloseTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (focusMemo) {
      // Memories ページ（index 2）に遷移
      pagerRef.current?.setPage(2);
      setCurrentPage(2);
      // 少し時間をおいてからメモ入力欄をフォーカス
      const timer = setTimeout(() => {
        memoInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [focusMemo]);

  useEffect(() => {
    hasUserEditedImages.current = false;
  }, [initialData]);

  // useResolvedImageUris で解決された画像パスを反映
  // 編集中の変更を上書きしないよう、ユーザー操作後は反映しない
  useEffect(() => {
    // データがない場合はスキップ
    if (!initialData) return;

    if (hasUserEditedImages.current) return;

    // 画像がない場合（空配列）で初期化
    if (!initialData.imageUrls || initialData.imageUrls.length === 0) {
      if (imageUrls.length > 0) { 
         setImageUrls([]);
         setImageUpdateKeys({});
      }
      return;
    }

    // 解決された画像がある場合
    if (resolvedInitialImages && resolvedInitialImages.length > 0) {
      // 初期ロード時またはデータ変更時のみ反映する
      setImageUrls(resolvedInitialImages);
        
      // imageUpdateKeysも再初期化
      const newKeys: Record<number, number> = {};
      const timestamp = Date.now();
      resolvedInitialImages.forEach((_, index) => {
        newKeys[index] = timestamp + index;
      });
      setImageUpdateKeys(newKeys);
    }
  }, [resolvedInitialImages, initialData]);

  const isBasicValid =
    name.trim().length > 0 &&
    artist.trim().length > 0 &&
    venue.trim().length > 0 &&
    Boolean(date);

  const isVenueAtLimit = venue.length >= MAX_VENUE_LENGTH;

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
    const scrollRef = useRef<ScrollView>(null);
    const timeOptionHeight = 48;
    // 30分刻みの時刻リストを生成 (00:00, 00:30, 01:00, ..., 23:30)
    const timeOptions: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      timeOptions.push(`${String(hour).padStart(2, '0')}:00`);
      timeOptions.push(`${String(hour).padStart(2, '0')}:30`);
    }

    useEffect(() => {
      if (!visible) return;
      const index = Math.max(0, timeOptions.indexOf(selectedTime));
      const targetOffset = index * timeOptionHeight;
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: targetOffset, animated: false });
      }, 0);
      return () => clearTimeout(timer);
    }, [visible, selectedTime, timeOptions]);

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
            
            <ScrollView ref={scrollRef} style={{ maxHeight: 300 }}>
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
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('権限が必要です', 'カバーアートを選択するにはフォトライブラリへのアクセスが必要です。');
        return;
      }
      // 既存の制限などを無視して、常に1枚を選択して置換する
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        allowsMultipleSelection: false,
        aspect: [1, 1], // 正方形
        base64: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const resolvedUri = await resolvePickedImageUri(asset);
        if (!resolvedUri) {
          Alert.alert('エラー', '画像の読み込みに失敗しました。もう一度お試しください。');
          return;
        }
        // ジャケット画像として1枚だけ保存（配列を置換）
        hasUserEditedImages.current = true;
        setImageUrls([resolvedUri]);
        setImageUpdateKeys({ 0: Date.now() });
      }
    } catch (error) {
      console.log('[LiveEditScreen] Image pick failed:', error);
      Alert.alert('エラー', '画像の選択中に問題が発生しました。');
    }
  };

  // 既存のhandleReplaceImageは不要になるが、コードの整合性のため削除してもよい
  // ここではhandleRemoveImageを引数なしの単純なクリア関数に変更

  const handleRemoveImage = () => {
    hasUserEditedImages.current = true;
    setImageUrls([]);
    setImageUpdateKeys({});
  };  const handleArtistChange = (name: string, imageUrl?: string) => {
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

    if (venue.trim().length > MAX_VENUE_LENGTH) {
      Alert.alert('エラー', '会場名は12文字以内で入力してください');
      return;
    }

    if (imageUrls.length === 0) {
      Alert.alert('エラー', 'カバーアートを選択してください');
      return;
    }

    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;

    try {
      await onSave({
        name,
        artist,
        liveType,
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

      // アニメーション完了前に画面が閉じないようにする
      setSuccessOverlayKey((prev) => prev + 1);
      setShowSuccess(true);
    } catch (error) {
      isSubmittingRef.current = false;
      return;
    }
  };

  const handleVenueChange = (value: string) => {
    if (value.length > MAX_VENUE_LENGTH) {
      Alert.alert('入力エラー', '会場名は12文字以内で入力してください');
      setVenue(value.slice(0, MAX_VENUE_LENGTH));
      return;
    }
    setVenue(value);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" />

      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ライブ情報の設定</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.stepHeader}>
        <View style={styles.stepHeaderRow}>
          <Text style={styles.stepHeaderLabel}>Step {currentPage + 1}/3</Text>
          <Text style={styles.stepHeaderTitle}>
            {currentPage === 0 ? '基本情報' : currentPage === 1 ? 'セットリスト作成' : 'その他'}
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

              <View style={styles.liveTypeWrap}>
                <Text style={styles.liveTypeLabel}>ライブの種類</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.liveTypeScrollContent}
                >
                  {LIVE_TYPES.map((type) => {
                    const selected = liveType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        activeOpacity={0.85}
                        style={[styles.liveTypeChip, selected && styles.liveTypeChipSelected]}
                        onPress={() => setLiveType(type)}
                      >
                        <MaterialCommunityIcons
                          name={LIVE_TYPE_ICON_MAP[type]}
                          size={14}
                          color={selected ? '#FFFFFF' : '#B6B6B6'}
                        />
                        <Text style={[styles.liveTypeChipText, selected && styles.liveTypeChipTextSelected]}>{type}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
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
                    onChangeText={handleVenueChange}
                    placeholder="例: 東京ドーム"
                    placeholderTextColor="#CCCCCC"
                    maxLength={MAX_VENUE_LENGTH}
                  />
                </View>
              </View>
              {isVenueAtLimit && (
                <View style={styles.warningContainer}>
                  <MaterialIcons name="error-outline" size={14} color="#FF453A" />
                  <Text style={styles.warningText}>会場名は12文字以内で入力してください</Text>
                </View>
              )}
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
            {/* ジャケット画像（1枚） */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>カバーアート（表紙）</Text>
              
              {imageUrls.length > 0 ? (
                <View style={styles.jacketContainer}>
                  <Image
                    key={`jacket-${imageUpdateKeys[0] || '0'}`}
                    source={{ uri: imageUrls[0] }}
                    style={styles.jacketImage}
                    contentFit="cover"
                    cachePolicy="none"
                  />
                  <TouchableOpacity
                    style={styles.jacketRemoveButton}
                    onPress={handleRemoveImage}
                  >
                    <Ionicons name="close-circle" size={30} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.emptyJacketContainer} 
                  onPress={handlePickImage}
                  activeOpacity={0.7}
                >
                  <View style={styles.emptyJacketContent}>
                    <SvgXml xml={ADD_PHOTO_ICON_SVG} width={48} height={48} />
                    <Text style={styles.emptyJacketTitle}>
                      このライブの『表紙』を選択
                    </Text>
                    <Text style={styles.emptyJacketSubtitle}>
                      カメラロールにある数百枚の中から、{'\n'}
                      『最高の1枚』を選ぼう！
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
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
                    placeholder={randomPlaceholder}
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
            >
              <Text style={styles.navButtonPrimaryText}>保存</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showSuccess && (
        <View style={styles.checkedOverlay} pointerEvents="none">
          <LottieView
            key={successOverlayKey}
            source={require('../assets/animations/Success.json')}
            autoPlay
            loop={false}
            speed={1.5}
            onAnimationFinish={() => {
              successAnimationFinished.current = true;
              if (successCloseReady.current) {
                setShowSuccess(false);
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
  liveTypeWrap: {
    marginTop: 12,
  },
  liveTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888888',
    marginLeft: 4,
    marginBottom: 8,
  },
  liveTypeScrollContent: {
    paddingHorizontal: 2,
    gap: 8,
  },
  liveTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d4d4d4',
  },
  liveTypeChipSelected: {
    borderRadius: 30,    
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  liveTypeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B6B6B6',
  },
  liveTypeChipTextSelected: {
    color: '#FFFFFF',
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
  // Jacket Image Styles
  jacketContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F7F7F7',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  jacketImage: {
    width: '100%',
    height: '100%',
  },
  jacketRemoveButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyJacketContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CCC',
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyJacketContent: {
    alignItems: 'center',
    padding: 24,
  },
  emptyJacketTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyJacketSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});
