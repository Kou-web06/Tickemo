import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, FlatList, Dimensions, TouchableOpacity, Alert, StyleSheet, Text, TextInput, ScrollView, Modal, Animated, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { TicketCard } from '../components/TicketCard';
import { TicketDetail } from '../components/TicketDetail';
import { AddCardButton } from '../components/AddCardButton';
import SettingsScreen from './SettingsScreen';
import ProfileEditScreen from './ProfileEditScreen';
import LiveEditScreen from './LiveEditScreen';
import { theme } from '../theme';
import { useRecords, ChekiRecord } from '../contexts/RecordsContext';
import { buildLiveAlbumName, uploadMultipleImages, normalizeStoredImageUri } from '../lib/imageUpload';
import { saveSetlist } from '../lib/setlistDb';
import { useRewardAd } from '../hooks/useRewardAd';
import { isTestflightMode } from '../utils/appMode';
import { NO_IMAGE_URI, useResolvedImageUri } from '../hooks/useResolvedImageUri';

const Stack = createNativeStackNavigator();

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: 0,
    paddingTop: theme.spacing.xxxxl,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xxl,
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.lg,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  headerButtonBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: theme.typography.fontWeight.black,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  detailImageContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 80,
    paddingBottom: theme.spacing.sm,
  },
  detailImage: {
    width: '100%',
    aspectRatio: theme.card.aspectRatio,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.border.light,
  },
  detailForm: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 20,
  },
  formGroup: {
    marginBottom: theme.spacing.xl,
  },
  formLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  formInput: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.dark,
    ...theme.shadows.sm,
  },
  memoInput: {
    height: 120,
    paddingVertical: theme.spacing.md,
  },
  editButton: {
    backgroundColor: theme.colors.accent.primary,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    ...theme.shadows.md,
  },
  editButtonText: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  imagePickerButton: {
    backgroundColor: theme.colors.accent.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  imagePickerButtonText: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  datePickerModal: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.xl,
    width: '85%',
    maxHeight: '70%',
    ...theme.shadows.lg,
  },
  datePickerHeader: {
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.dark,
  },
  datePickerTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  datePickerContent: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  pickerScroll: {
    maxHeight: 200,
    width: '100%',
  },
  pickerItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
    marginVertical: 2,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.accent.primary,
  },
  pickerItemText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.primary,
  },
  pickerItemTextSelected: {
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  datePickerActions: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.dark,
  },
  datePickerButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  datePickerButtonCancel: {
    backgroundColor: theme.colors.border.dark,
  },
  datePickerButtonConfirm: {
    backgroundColor: theme.colors.accent.primary,
  },
  datePickerButtonTextCancel: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
  },
  datePickerButtonTextConfirm: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  detailScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#000',
  },
  detailHeaderButton: {
    padding: 8,
    width: 44,
  },
  detailHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  ticketDetailContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailScrollView: {
    flex: 1,
  },
  detailScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 8,
    marginLeft: 4,
  },
  detailInputContainer: {
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailInputBlur: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailInputText: {
    fontSize: 16,
    color: '#000',
  },
  detailImageWrapper: {
    borderRadius: 12,
    height: 280,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  detailImageNew: {
    width: '100%',
    height: '100%',
  },
  addImagePickerButton: {
    borderRadius: 12,
    height: 150,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImagePickerContent: {
    alignItems: 'center',
    gap: 12,
  },
  addImagePickerText: {
    fontSize: 14,
    color: '#999999',
  },
  addImagePreviewContainer: {
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  addImagePreview: {
    width: 80,
    height: 90,
    borderRadius: 8,
  },
  addImagePreviewText: {
    fontSize: 12,
    color: '#999999',
  },
  addInput: {
    fontSize: 16,
    color: '#000',
  },
  addMultilineInput: {
    minHeight: 100,
  },
  addDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 140,
  },
  previewCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  previewPolaroid: {
    backgroundColor: '#FFF',
    borderRadius: 35,
    padding: 5,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  previewImageWrapper: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewInfo: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  previewArtist: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  previewDate: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  previewDetailButton: {
    position: 'absolute',
    top: 60,
    right: 74,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  previewDetailButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  flipCardContainer: {
    width: '100%',
    maxWidth: 400,
    aspectRatio: 0.8,
  },
  previewBackFace: {
    backgroundColor: '#FFF',
    borderRadius: 35,
    padding: 5,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  setListTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  setListScroll: {
    flex: 1,
  },
  setListContent: {
    paddingVertical: 8,
  },
  setListItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    paddingLeft: 8,
  },
  noSetList: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cardInfoBelow: {
    marginBottom: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xs,
  },
  cardLiveName: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: 900,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  backgroundImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  blurOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  vignetteOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  adConfirmModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '85%',
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    ...theme.shadows.lg,
    alignItems: 'center',
  },
  adConfirmTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#000',
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  adConfirmMessage: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    lineHeight: 18,
  },
  adConfirmGraphic: {
    width: '90%',
    aspectRatio: 1.2,
    marginBottom: 0,
  },
  adConfirmMainButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#333',
    marginTop: theme.spacing.xl,
    ...theme.shadows.md,
  },
  adConfirmMainButtonText: {
    fontSize: 15,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#FFF',
  },
  adConfirmCloseButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    ...theme.shadows.md,
  },
  filterDropdownOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  filterDropdownContainer: {
    position: 'absolute',
    top: 60,
    right: 75,
    minWidth: 210,
  },
  filterDropdown: {
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 0.1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 10,
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  filterDropdownItemText: {
    fontSize: 17,
    color: '#000',
    fontWeight: '400',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xxxxxl,
    marginBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xxl,
  },
  emptyStateImage: {
    width: 150,
    height: 150,
    marginBottom: theme.spacing.md,
  },
  emptyStateTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const ListScreen: React.FC<{ navigation: any; records: ChekiRecord[] }> = ({ navigation, records }) => {
  const [selectedRecord, setSelectedRecord] = useState<ChekiRecord | null>(null);
  const [animatingCardId, setAnimatingCardId] = useState<string | null>(null);
  const [closingRecordId, setClosingRecordId] = useState<string | null>(null);
  const [showAfterAnimId, setShowAfterAnimId] = useState<string | null>(null);
  const [pendingAddAfterAd, setPendingAddAfterAd] = useState(false);
  const [adShown, setAdShown] = useState(false);
  const [showAdConfirmModal, setShowAdConfirmModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'past'>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isListAnimating, setIsListAnimating] = useState(false);
  const itemAnimations = useRef(new Map<string, Animated.Value>()).current;

  const rewardAd = useRewardAd();

  useEffect(() => {
    const preloadCollectionImages = async () => {
      try {
        const uris = new Set<string>();
        records.forEach((record) => {
          if (record.imageUrls && Array.isArray(record.imageUrls)) {
            record.imageUrls.forEach((uri) => {
              if (uri && !uri.startsWith('file://')) {
                uris.add(uri);
              }
            });
          }
        });

        if (uris.size === 0) return;

        const assets = Array.from(uris).map((uri) => Asset.fromURI(uri));
        await Promise.all(assets.map((asset) => asset.downloadAsync()));
      } catch (error) {
        console.log('Failed to preload collection images:', error);
      }
    };

    preloadCollectionImages();
  }, [records]);

  // 広告ロード完了後に表示
  React.useEffect(() => {
    if (pendingAddAfterAd && rewardAd.isLoaded && !adShown) {
      setAdShown(true);
      rewardAd.show();
    }
  }, [pendingAddAfterAd, rewardAd.isLoaded, adShown]);

  // 広告が閉じられたら → Add画面へ遷移（報酬獲得の有無に関わらず）
  React.useEffect(() => {
    if (adShown && rewardAd.isClosed) {
      // 広告が閉じられたので少し待ってから遷移
      const timer = setTimeout(() => {
        setPendingAddAfterAd(false);
        setAdShown(false);
        rewardAd.resetEarned();
        rewardAd.resetClosed();
        navigation.navigate('Add');
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [adShown, rewardAd.isClosed, navigation, rewardAd]);

  const screenWidth = Dimensions.get('window').width;
  const PADDING = theme.spacing.xxl;
  const cardWidth = screenWidth - PADDING * 2;

  const handleCardPress = (record: ChekiRecord) => {
    // 開くときは closing フラグをリセットしてからスライドアウト
    setClosingRecordId(null);
    setAnimatingCardId(record.id);
    // Wait for animation to complete before showing modal
    setTimeout(() => {
      setSelectedRecord(record);
      setTimeout(() => setAnimatingCardId(null), 0);
    }, 200);
  };

  // モーダルを閉じるときにスライドインアニメーション
  const handleCloseModal = () => {
    if (selectedRecord) {
      const recordId = selectedRecord.id;
      // まず closingRecordId を設定（これにより animationDirection が 'in' になる）
      setClosingRecordId(recordId);
      setSelectedRecord(null);
      // モーダルのフェードアウトアニメーション（300ms）が完了してから
      // カードのスライドインアニメーションを開始する
      // これにより、モーダルが完全に消えてからカードが表示される
      setTimeout(() => {
        setAnimatingCardId(recordId);
      }, 300);
    }
  };

  const handleAddPress = () => {
    const hasEnoughTickets = records.length >= 2;
    const testflightMax = 5;

    // TestFlight: 上限チェック
    if (records.length >= testflightMax) {
      Alert.alert(
        '上限に達しました',
        'β版では5枚まで追加可能です。正式リリースをお待ちください！🐿️'
      );
      return;
    }
    navigation.navigate('Add');
    return;

    /* 本番環境のみ（TestFlight ではコメントアウト）
    if (!hasEnoughTickets) {
      navigation.navigate('Add');
      return;
    }

    // 2枚以上の場合は確認モーダルを表示
    setShowAdConfirmModal(true);
    */
  };

  const handleConfirmAd = () => {
    setShowAdConfirmModal(false);
    
    // 広告表示フロー開始
    setPendingAddAfterAd(true);
    setAdShown(false);

    if (!rewardAd.isLoaded) {
      rewardAd.load();
    }
  };

  const handleCancelAd = () => {
    setShowAdConfirmModal(false);
  };

  // 日付で新しい順にソート（最新のライブが先頭）
  const toTime = (record: ChekiRecord) => {
    if (!record?.date) return 0;
    const time = new Date(record.date.replace(/\./g, '-')).getTime();
    return Number.isNaN(time) ? 0 : time;
  };
  
  // フィルタリング処理
  const filterRecords = (records: ChekiRecord[]) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // 今日の0時で比較
    
    if (filterType === 'upcoming') {
      return records.filter(record => {
        const recordDate = new Date(record.date.replace(/\./g, '-'));
        recordDate.setHours(0, 0, 0, 0);
        return recordDate >= now;
      });
    } else if (filterType === 'past') {
      return records.filter(record => {
        const recordDate = new Date(record.date.replace(/\./g, '-'));
        recordDate.setHours(0, 0, 0, 0);
        return recordDate < now;
      });
    }
    return records; // 'all'の場合
  };
  
  const sortedRecords = useMemo(() => [...records].sort((a, b) => toTime(b) - toTime(a)), [records]);
  const filteredRecords = useMemo(() => filterRecords(sortedRecords), [sortedRecords, filterType]);

  // Create display data with add button at the end
  const displayData = useMemo(() => {
    if (filteredRecords.length === 0) {
      return [{ id: 'add-button' }, { id: 'empty-state' }];
    }
    return [...filteredRecords, { id: 'add-button' }];
  }, [filteredRecords]);

  // 最初のレコードの画像を背景として使用（並び替え後の先頭）
  const backgroundImageUri = useResolvedImageUri(
    filteredRecords[0]?.imageUrls?.[0],
    filteredRecords[0]?.imageAssetIds?.[0]
  );
  const backgroundImageUrl = filteredRecords.length > 0 ? (backgroundImageUri ?? NO_IMAGE_URI) : null;

  const getItemAnimation = (id: string) => {
    const existing = itemAnimations.get(id);
    if (existing) return existing;
    const value = new Animated.Value(0);
    itemAnimations.set(id, value);
    return value;
  };

  useEffect(() => {
    const ids = new Set(displayData.map((item) => item.id));
    itemAnimations.forEach((_, key) => {
      if (!ids.has(key)) {
        itemAnimations.delete(key);
      }
    });

    if (displayData.length === 0) {
      setIsListAnimating(false);
      return;
    }

    setIsListAnimating(true);

    displayData.forEach((item) => {
      getItemAnimation(item.id).setValue(0);
    });

    const animations = displayData.map((item) =>
      Animated.timing(getItemAnimation(item.id), {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      })
    );

    Animated.stagger(70, animations).start(() => {
      setIsListAnimating(false);
    });
  }, [displayData, itemAnimations]);

  return (
    <View style={styles.listContainer}>
      {/* Dynamic Blur Background */}
      {backgroundImageUrl ? (
        <>
          <Image
            source={{ uri: backgroundImageUrl }}
            style={styles.backgroundImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
          />
          <BlurView intensity={50} tint="dark" style={styles.blurOverlay} />
          
        </>
      ) : null}

      <View style={styles.headerContainer}>
        <Text style={styles.title}>コレクション</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFilterModal(true)}
          >
            <BlurView intensity={22} tint="dark" style={styles.headerButtonBlur}>
              <Ionicons name="filter-sharp" size={20} color="#FFF" />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleAddPress}
          >
            <BlurView intensity={22} tint="dark" style={styles.headerButtonBlur}>
              <MaterialIcons name="add" size={24} color="#FFF" />
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>
      
      <FlatList
        data={displayData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const itemAnim = getItemAnimation(item.id);
          const animatedStyle = {
            opacity: itemAnim,
            transform: [
              {
                translateY: itemAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          } as const;
          if (item.id === 'add-button') {
            return (
              isListAnimating ? (
                <Animated.View style={animatedStyle}>
                  <TouchableOpacity
                    style={{ width: cardWidth, marginBottom: 12, alignSelf: 'center' }}
                    onPress={handleAddPress}
                    activeOpacity={0.7}
                  >
                    <AddCardButton width={cardWidth} />
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <TouchableOpacity
                  style={{ width: cardWidth, marginBottom: 12, alignSelf: 'center' }}
                  onPress={handleAddPress}
                  activeOpacity={0.7}
                >
                  <AddCardButton width={cardWidth} />
                </TouchableOpacity>
              )
            );
          }

          if (item.id === 'empty-state') {
            return (
              <View style={styles.emptyStateContainer}>
                <Image
                  source={require('../assets/search.png')}
                  style={styles.emptyStateImage}
                  contentFit="contain"
                  transition={0}
                />
                <Text style={styles.emptyStateTitle}>コレクションは{'\n'}まだありません</Text>
                <Text style={styles.emptyStateSubtitle}>上のボタンから追加してください</Text>
              </View>
            );
          }
          
          // アニメーション方向を決定
          const isAnimating = animatingCardId === item.id;
          const isModal = selectedRecord?.id === item.id;
          const isClosing = closingRecordId === item.id;
          const isSlideIn = isClosing && isAnimating;
          const animationDirection: 'out' | 'in' = isSlideIn ? 'in' : 'out';

          // スライドイン中は必ず表示（opacity:1）、それ以外は透明
          let opacity = 1;
          let pointerEvents: 'auto' | 'none' = 'auto';
          // モーダル表示中、またはスライドアウト中、または閉じる準備中（closingRecordId が設定されているがまだアニメーション開始前）は非表示
          if (isModal || (isAnimating && !isSlideIn) || (isClosing && !isAnimating)) {
            opacity = 0;
            pointerEvents = 'none';
          } else if (isSlideIn && isAnimating) {
            // スライドイン中は表示するがタップ不可
            opacity = 1;
            pointerEvents = 'none';
          } else if (showAfterAnimId === item.id) {
            // アニメーション終了後のみ表示
            opacity = 1;
            pointerEvents = 'auto';
          }

          // スライドインアニメーション終了時に状態リセット
          const handleCardAnimationEnd = () => {
            if (animationDirection === 'in') {
              setAnimatingCardId(null);
              setClosingRecordId(null);
              setShowAfterAnimId(item.id);
            }
          };
          if (isListAnimating) {
            return (
              <Animated.View
                style={[
                  animatedStyle,
                  {
                    opacity: Animated.multiply(itemAnim, opacity),
                  },
                ]}
              >
                <TouchableOpacity
                  style={{ marginBottom: 12, alignSelf: 'center' }}
                  onPress={() => handleCardPress(item as ChekiRecord)}
                  activeOpacity={0.9}
                  disabled={pointerEvents === 'none'}
                >
                  <TicketCard
                    record={item as ChekiRecord}
                    width={cardWidth}
                    isAnimating={isAnimating}
                    animationDirection={animationDirection}
                    onAnimationEnd={handleCardAnimationEnd}
                  />
                </TouchableOpacity>
              </Animated.View>
            );
          }

          return (
            <TouchableOpacity
              style={{ marginBottom: 12, alignSelf: 'center', opacity }}
              onPress={() => handleCardPress(item as ChekiRecord)}
              activeOpacity={0.9}
              disabled={pointerEvents === 'none'}
            >
              <TicketCard
                record={item as ChekiRecord}
                width={cardWidth}
                isAnimating={isAnimating}
                animationDirection={animationDirection}
                onAnimationEnd={handleCardAnimationEnd}
              />
            </TouchableOpacity>
          );
        }}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: theme.spacing.xl, paddingBottom: 120 }}
      />

      {selectedRecord && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={handleCloseModal}
        >
          <View style={styles.modalOverlay}>
            <TicketDetail record={selectedRecord} onBack={handleCloseModal} />
          </View>
        </Modal>
      )}

      {/* 広告確認モーダル - 本番環境のみ（TestFlight ではコメントアウト）
      {!isTestflightMode && showAdConfirmModal && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={handleCancelAd}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.adConfirmModal}>
              <Text style={styles.adConfirmTitle}>チケット枠を追加</Text>
              <Text style={styles.adConfirmMessage}>
                動画広告を見ると、{'\n'}チケットを1枚追加できます。
              </Text>
              <Image
                source={require('../assets/addTickets.png')}
                style={styles.adConfirmGraphic}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
              />
              <TouchableOpacity
              style={styles.adConfirmMainButton}
              onPress={handleConfirmAd}
              activeOpacity={0.8}
              >
                <Text style={styles.adConfirmMainButtonText}>
                  動画を見て追加
                </Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.adConfirmCloseButton}
              onPress={handleCancelAd}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={32} color="#FFF" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
      */}

      {/* フィルターモーダル */}
      {showFilterModal && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setShowFilterModal(false)}
        >
          <TouchableOpacity 
            style={styles.filterDropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowFilterModal(false)}
          >
            <View style={styles.filterDropdownContainer}>
              <BlurView intensity={30} tint="light" style={styles.filterDropdown}>
                <TouchableOpacity
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setFilterType('all');
                    setShowFilterModal(false);
                  }}
                >
                  {filterType === 'all' ? (
                    <Ionicons name="checkmark" size={20} color="#000" />
                  ) : (
                    <View style={{ width: 20 }} />
                  )}
                  <Text style={styles.filterDropdownItemText}>すべて</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setFilterType('upcoming');
                    setShowFilterModal(false);
                  }}
                >
                  {filterType === 'upcoming' ? (
                    <Ionicons name="checkmark" size={20} color="#000" />
                  ) : (
                    <View style={{ width: 20 }} />
                  )}
                  <Text style={styles.filterDropdownItemText}>参戦予定</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setFilterType('past');
                    setShowFilterModal(false);
                  }}
                >
                  {filterType === 'past' ? (
                    <Ionicons name="checkmark" size={20} color="#000" />
                  ) : (
                    <View style={{ width: 20 }} />
                  )}
                  <Text style={styles.filterDropdownItemText}>参戦済み</Text>
                </TouchableOpacity>
              </BlurView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const DetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { record } = route.params;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={true}
      onRequestClose={() => navigation.goBack()}
    >
      <View style={styles.modalOverlay}>
        <TicketDetail record={record} onBack={() => navigation.goBack()} />
      </View>
    </Modal>
  );
};

const AddScreen: React.FC<{ navigation: any; addNewRecord: (record: ChekiRecord) => Promise<void> }> = ({ navigation, addNewRecord }) => {
  const [isLoading, setIsLoading] = useState(false);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const handleSave = async (info: any) => {
    try {
      // ローディング開始
      setIsLoading(true);
      
      // console.log('[AddScreen] 保存開始:', { 
      //   artist: info.artist, 
      //   name: info.name, 
      //   imageUrl: info.imageUrl,
      //   imageUrlsCount: info.imageUrls?.length || 0 
      // });
      
      const userId = 'local-user';

      // console.log('[AddScreen] ユーザーID:', userId);

      // 複数画像をアップロード
      let uploadedImageUrls: string[] = [];
      let uploadedImageAssetIds: Array<string | null> = [];
      // 新規レコードのIDを先に生成（liveIdとして使用）
      const newRecordId = Crypto.randomUUID();
      if (info.imageUrls && Array.isArray(info.imageUrls)) {
        // 既存URL（file:// で始まらないもの）を先に追加（最初の画像がジャケットになる）
        const existingUrls = info.imageUrls.filter((uri: string) => !uri.startsWith('file://'));
        uploadedImageUrls.push(...existingUrls);
        uploadedImageAssetIds.push(...existingUrls.map(() => null));
        
        // 新しくアップロードされた画像を後に追加
        const fileUris = info.imageUrls.filter((uri: string) => uri.startsWith('file://'));
        if (fileUris.length > 0) {
          // console.log('[AddScreen] 複数画像アップロード中:', fileUris.length);
          const albumName = buildLiveAlbumName(info.date, info.name);
          const totalImageCount = info.imageUrls.length;
          const uploadResult = await uploadMultipleImages(
            fileUris,
            userId,
            newRecordId,
            albumName,
            0,
            totalImageCount
          );
          uploadedImageUrls.push(...uploadResult.imageUrls);
          uploadedImageAssetIds.push(...uploadResult.assetIds);
          // console.log('[AddScreen] 複数画像アップロード完了:', uploadedImageUrls);
          // アップロード後、URLがアクセス可能になるまで少し待機
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }

      // imageUrls と imageAssetIds のサイズを確保（同じ長さにする）
      const finalImageAssetIds = Array.from({ length: uploadedImageUrls.length }, 
        (_, i) => uploadedImageAssetIds[i] ?? null
      );

      const newRecord: ChekiRecord = {
        id: newRecordId,
        user_id: userId,
        artist: info.artist,
        artistImageUrl: info.artistImageUrl || '',
        liveName: info.name,
        date: formatDate(info.date),
        venue: info.venue,
        seat: info.seat || '',
        startTime: info.startTime || '',
        endTime: info.endTime || '',
        imageUrls: uploadedImageUrls,
        imageAssetIds: finalImageAssetIds,
        memo: info.memo || '',
        detail: info.detail || '',
        qrCode: info.qrCode || '',
        createdAt: new Date().toISOString(),
      };

      console.log('[AddScreen] レコード作成:', newRecord);
      
      // レコードを保存
      await addNewRecord(newRecord);
      console.log('[AddScreen] addNewRecord 完了');
      
      // セットリストを保存
      if (info.setlistSongs && info.setlistSongs.length > 0) {
        try {
          await saveSetlist(newRecord.id, info.setlistSongs);
          console.log('[AddScreen] setlist 保存完了');
        } catch (setlistError) {
          console.error('[AddScreen] setlist保存エラー（スキップ）:', setlistError);
          // セットリストの保存に失敗してもレコードは保存済みなので続行
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('[AddScreen] Error saving record:', error);
      Alert.alert('エラー', '記録の保存に失敗しました');
      setIsLoading(false);
      throw error;
    }
  };

  return (
    <LiveEditScreen
      initialData={null}
      onSave={handleSave}
      onCancel={() => navigation.navigate('List')}
      isLoading={isLoading}
    />
  );
};

const EditScreen: React.FC<{ route: any; navigation: any; records: ChekiRecord[]; addNewRecord: (record: ChekiRecord) => Promise<void> }> = ({ route, navigation, records, addNewRecord }) => {
  const { record, focusMemo = false } = route.params || {};
  const [isLoading, setIsLoading] = useState(false);

  if (!record) {
    return null;
  }

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const handleSave = async (info: any) => {
    try {
      setIsLoading(true);

      const userId = 'local-user';
      let uploadedImageUrls = [...(record?.imageUrls || [])];
      let uploadedImageAssetIds = [...(record?.imageAssetIds || [])];

      // 新規画像をアップロード
      if (info.imageUrls && Array.isArray(info.imageUrls)) {
        // 既存 imageAssetIds をサイズに合わせて確保（不足分は null でパディング）
        const recordAssetIds = record.imageAssetIds || [];
        const recordAssetIdsWithPadding = Array.from({ length: record.imageUrls?.length || 0 }, 
          (_, i) => recordAssetIds[i] ?? null
        );
        
        const existingAssetIdsByUrl = new Map(
          (record.imageUrls || []).map((url: string, index: number) => [normalizeStoredImageUri(url), recordAssetIdsWithPadding[index]])
        );
        const normalizedUrls = info.imageUrls.map((uri: string) => normalizeStoredImageUri(uri));
        const existingUrls = normalizedUrls.filter((uri: string) => !uri.startsWith('file://'));
        uploadedImageUrls = existingUrls;
        uploadedImageAssetIds = existingUrls.map((uri: string) => existingAssetIdsByUrl.get(uri) ?? null);

        const fileUris = normalizedUrls.filter((uri: string) => uri.startsWith('file://'));
        if (fileUris.length > 0) {
          const albumName = buildLiveAlbumName(info.date, info.name);
          const totalImageCount = info.imageUrls.length;
          const previousImageCount = record.imageUrls?.length ?? 0;
          const uploadResult = await uploadMultipleImages(
            fileUris,
            userId,
            record.id,
            albumName,
            previousImageCount,
            totalImageCount
          );
          uploadedImageUrls.push(...uploadResult.imageUrls);
          uploadedImageAssetIds.push(...uploadResult.assetIds);
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }

      const finalUpdatedImageAssetIds = Array.from({ length: uploadedImageUrls.length }, 
        (_, i) => uploadedImageAssetIds[i] ?? null
      );

      const updatedRecord: ChekiRecord = {
        ...record,
        user_id: userId,
        artist: info.artist,
        artistImageUrl: info.artistImageUrl || '',
        liveName: info.name,
        date: formatDate(info.date),
        venue: info.venue,
        seat: info.seat || '',
        startTime: info.startTime || '',
        endTime: info.endTime || '',
        imageUrls: uploadedImageUrls,
        imageAssetIds: uploadedImageUrls.length > 0 ? finalUpdatedImageAssetIds : [],
        memo: info.memo || '',
        detail: info.detail || '',
        qrCode: info.qrCode || '',
      };

      console.log('[EditScreen] レコード更新:', updatedRecord);

      await addNewRecord(updatedRecord);

      if (info.setlistSongs && info.setlistSongs.length > 0) {
        try {
          await saveSetlist(record.id, info.setlistSongs);
          console.log('[EditScreen] setlist 保存完了');
        } catch (setlistError) {
          console.error('[EditScreen] setlist保存エラー（スキップ）:', setlistError);
        }
      }

      setIsLoading(false);
      navigation.navigate('List');
    } catch (error) {
      console.error('[EditScreen] Error saving record:', error);
      Alert.alert('エラー', '記録の保存に失敗しました');
      setIsLoading(false);
    }
  };

  return (
    <LiveEditScreen
      initialData={{
        name: record.liveName,
        artist: record.artist,
        artistImageUrl: record.artistImageUrl,
        date: new Date(record.date.replace(/\./g, '-')),
        venue: record.venue,
        seat: record.seat,
        startTime: record.startTime,
        endTime: record.endTime,
        imageUrls: record.imageUrls,
        memo: record.memo,
        detail: record.detail,
        qrCode: record.qrCode,
      }}
      onSave={handleSave}
      onCancel={() => navigation.navigate('List')}
      isLoading={isLoading}
      focusMemo={focusMemo}
    />
  );
};

// Collection Stack Navigator
const CollectionStack = ({ records, addNewRecord, navigation }: { records: ChekiRecord[]; addNewRecord: (record: ChekiRecord) => Promise<void>; navigation: any }) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        contentStyle: {
          backgroundColor: theme.colors.background.primary,
        },
      }}
    >
      <Stack.Screen name="List">
        {(props) => <ListScreen {...props} records={records} />}
      </Stack.Screen>
      <Stack.Screen
        name="Settings"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <SettingsScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="ProfileEdit"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <ProfileEditScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="Add"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <AddScreen {...props} addNewRecord={addNewRecord} />}
      </Stack.Screen>
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'transparentModal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Edit"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <EditScreen {...props} records={records} addNewRecord={addNewRecord} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default function CollectionScreen() {
  const { records, addRecord, isLoading } = useRecords();
  const navigation = useRef<any>(null);

  useEffect(() => {
    const { getGlobalNotification } = require('../contexts/NotificationContext');
    const checkNotification = () => {
      const notification = getGlobalNotification();
      if (notification && navigation.current) {
        const record = records.find((r) => r.id === notification.recordId);
        if (record) {
          console.log('[CollectionScreen] Navigating to Edit with record:', record.id);
          // Stack Navigator に直接アクセスするため、リスナーを使う別のアプローチ
          // ここでは notificationData を state で管理する
        }
      }
    };

    const timer = setInterval(checkNotification, 100);
    return () => clearInterval(timer);
  }, [records]);

  return (
    <>
      <CollectionStackWrapper records={records} addNewRecord={addRecord} />
    </>
  );
}

interface CollectionStackWrapperProps {
  records: ChekiRecord[];
  addNewRecord: (record: ChekiRecord) => Promise<void>;
}

function CollectionStackWrapper({ records, addNewRecord }: CollectionStackWrapperProps) {
  const navigation = useNavigation<any>();
  const [pendingNotification, setPendingNotification] = useState<{ recordId: string; kind: string } | null>(null);

  useEffect(() => {
    const { getGlobalNotification } = require('../contexts/NotificationContext');
    const notification = getGlobalNotification();
    if (notification) {
      setPendingNotification(notification);
    }
  }, []);

  useEffect(() => {
    if (pendingNotification) {
      const record = records.find((r) => r.id === pendingNotification.recordId);
      if (record) {
        console.log('[CollectionStackWrapper] Navigating to Edit:', record.id);
        navigation.navigate('Edit', {
          record,
          focusMemo: true,
        });
        setPendingNotification(null);
      }
    }
  }, [pendingNotification, records, navigation]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        contentStyle: {
          backgroundColor: theme.colors.background.primary,
        },
      }}
    >
      <Stack.Screen name="List">
        {(props) => <ListScreen {...props} records={records} />}
      </Stack.Screen>
      <Stack.Screen
        name="Settings"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <SettingsScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="ProfileEdit"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          presentation: 'card',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <ProfileEditScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="Add"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <AddScreen {...props} addNewRecord={addNewRecord} />}
      </Stack.Screen>
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'transparentModal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Edit"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        {(props) => <EditScreen {...props} records={records} addNewRecord={addNewRecord} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
