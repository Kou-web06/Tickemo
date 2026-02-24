import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import * as FileSystem from 'expo-file-system';
import { TicketCard } from '../components/TicketCard';
import { TicketDetail } from '../components/TicketDetail';
import { AddCardButton } from '../components/AddCardButton';
import SettingsScreen from './SettingsScreen';
import ProfileEditScreen from './ProfileEditScreen';
import LiveEditScreen from './LiveEditScreen';
import PaywallScreen from './PaywallScreen';
import { theme } from '../theme';
import { useRecords, ChekiRecord } from '../contexts/RecordsContext';
import { useAppStore } from '../store/useAppStore';
import { uploadImage, normalizeStoredImageUri, resolveLocalImageUri, deleteImage } from '../lib/imageUpload';
import { saveSetlist } from '../lib/setlistDb';
import { NO_IMAGE_URI, useResolvedImageUri } from '../hooks/useResolvedImageUri';

const Stack = createNativeStackNavigator();
const FREE_TICKET_LIMIT = 5;

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

const ListScreen: React.FC<{ navigation: any; records: ChekiRecord[]; addNewRecord: (record: ChekiRecord) => Promise<void>; deleteRecord: (id: string) => Promise<void>; isPremium: boolean }> = ({ navigation, records, addNewRecord, deleteRecord, isPremium }) => {
  const [selectedRecord, setSelectedRecord] = useState<ChekiRecord | null>(null);
  const [animatingCardId, setAnimatingCardId] = useState<string | null>(null);
  const [closingRecordId, setClosingRecordId] = useState<string | null>(null);
  const [showAfterAnimId, setShowAfterAnimId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'past'>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isListAnimating, setIsListAnimating] = useState(false);
  const [currentBackground, setCurrentBackground] = useState<string | null>(null);
  const [previousBackground, setPreviousBackground] = useState<string | null>(null);
  const itemAnimations = useRef(new Map<string, Animated.Value>()).current;
  const didInitialListAnimation = useRef(false);
  const prevFilterType = useRef(filterType);
  const prevRecordCount = useRef(records.length);
  const backgroundFade = useRef(new Animated.Value(1)).current;
  const renderCountRef = useRef(0);
  
  renderCountRef.current++;

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
        // Image preload failed, continue
      }
    };

    preloadCollectionImages();
  }, [records]);

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
      // まず closingRecordId を設定（これによりカードを確実に非表示にする）
      setClosingRecordId(recordId);
      // モーダルを閉じる
      setSelectedRecord(null);
      // モーダルのfadeアニメーション完了を待ってからスライドインを開始（チラつき防止）
      setTimeout(() => {
        setAnimatingCardId(recordId);
      }, 200);
    }
  };

  const handleAddPress = () => {
    if (!isPremium && records.length >= FREE_TICKET_LIMIT) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('Add');
  };

  const handleDuplicateRecord = async (record: ChekiRecord) => {
    if (!isPremium && records.length >= FREE_TICKET_LIMIT) {
      navigation.navigate('Paywall');
      return;
    }

    const newRecord: ChekiRecord = {
      ...record,
      id: Crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      imageUrls: record.imageUrls ? [...record.imageUrls] : [],
      imageAssetIds: record.imageAssetIds ? [...record.imageAssetIds] : [],
    };
    await addNewRecord(newRecord);
    setSelectedRecord(newRecord);
  };

  const handleDeleteRecord = async (record: ChekiRecord) => {
    await deleteRecord(record.id);
    if (selectedRecord?.id === record.id) {
      setSelectedRecord(null);
    }
  };

  const handleLongPress = (record: ChekiRecord) => {
    Alert.alert(
      'チケット操作',
      '操作を選んでください',
      [
        {
          text: '複製',
          onPress: () => {
            void handleDuplicateRecord(record);
          },
        },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '本当に削除しますか？',
              'この操作は取り消せません。',
              [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: '削除',
                  style: 'destructive',
                  onPress: () => {
                    void handleDeleteRecord(record);
                  },
                },
              ]
            );
          },
        },
        { text: 'キャンセル', style: 'cancel' },
      ]
    );
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

  useEffect(() => {
    if (!backgroundImageUrl) {
      setCurrentBackground(null);
      setPreviousBackground(null);
      return;
    }

    if (backgroundImageUrl === currentBackground) {
      return;
    }

    setPreviousBackground(currentBackground);
    setCurrentBackground(backgroundImageUrl);
    backgroundFade.setValue(0);
    Animated.timing(backgroundFade, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setPreviousBackground(null);
    });
  }, [backgroundImageUrl, currentBackground, backgroundFade]);

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

    const filterChanged = prevFilterType.current !== filterType;
    const recordCountChanged = prevRecordCount.current !== records.length;
    prevFilterType.current = filterType;
    prevRecordCount.current = records.length;

    const shouldAnimate = !didInitialListAnimation.current || (!filterChanged && recordCountChanged);
    if (!shouldAnimate) {
      setIsListAnimating(false);
      displayData.forEach((item) => {
        getItemAnimation(item.id).setValue(1);
      });
      return;
    }

    didInitialListAnimation.current = true;
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
  }, [displayData, itemAnimations, filterType, records.length]);

  return (
    <View style={styles.listContainer}>
      {/* Dynamic Blur Background */}
      {currentBackground ? (
        <>
          {previousBackground ? (
            <Animated.View
              style={[styles.backgroundImage, { opacity: Animated.subtract(1, backgroundFade) }]}
            >
              <Image
                source={{ uri: previousBackground }}
                style={styles.backgroundImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.backgroundImage, { opacity: backgroundFade }]}
            >
            <Image
              source={{ uri: currentBackground }}
              style={styles.backgroundImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
            />
          </Animated.View>
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
      
      <View style={{ flex: 1 }}>
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

          // opacity判定ロジック（優先順位を明確化してチラつきを防止）
          let opacity = 0; // デフォルトは非表示
          let pointerEvents: 'auto' | 'none' = 'none';
          
          // 1. closingRecordIdが設定されている場合は常に非表示（モーダル閉じる処理中）
          if (isClosing && !isAnimating) {
            opacity = 0;
            pointerEvents = 'none';
          }
          // 2. モーダル表示中は非表示
          else if (isModal) {
            opacity = 0;
            pointerEvents = 'none';
          }
          // 3. スライドアウト中は非表示
          else if (isAnimating && !isSlideIn) {
            opacity = 0;
            pointerEvents = 'none';
          }
          // 4. スライドイン中は表示（タップ不可）
          else if (isSlideIn && isAnimating) {
            opacity = 1;
            pointerEvents = 'none';
          }
          // 5. アニメーション終了後は表示（タップ可能）
          else if (showAfterAnimId === item.id) {
            opacity = 1;
            pointerEvents = 'auto';
          }
          // 6. それ以外（通常状態）は表示
          else {
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
                  onLongPress={() => handleLongPress(item as ChekiRecord)}
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
              onLongPress={() => handleLongPress(item as ChekiRecord)}
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
      </View>

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
  const { records } = useRecords();
  const isPremium = useAppStore((state) => state.isPremium);

  const dedupeImageEntries = (
    urls: string[],
    assetIds: Array<string | null>
  ): { urls: string[]; assetIds: Array<string | null> } => {
    const seen = new Set<string>();
    const nextUrls: string[] = [];
    const nextAssetIds: Array<string | null> = [];

    urls.forEach((url, index) => {
      const key = normalizeStoredImageUri(url) || url;
      if (seen.has(key)) return;
      seen.add(key);
      nextUrls.push(url);
      nextAssetIds.push(assetIds[index] ?? null);
    });

    return { urls: nextUrls, assetIds: nextAssetIds };
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const handleSave = async (info: any) => {
    if (!isPremium && records.length >= FREE_TICKET_LIMIT) {
      navigation.navigate('Paywall');
      return;
    }

    const minLoadingMs = 700;
    const loadingStart = Date.now();
    let caughtError: unknown;
    try {
      
      const userId = 'local-user';

      // 画像の保存処理（1枚目のジャケットのみ）
      const uploadedImageUrls: string[] = [];
      const uploadedImageAssetIds: Array<string | null> = [];
      // 新規レコードのIDを先に生成（liveIdとして使用）
      const newRecordId = Crypto.randomUUID();

      if (info.imageUrls && info.imageUrls.length > 0) {
        // 先頭の1枚だけを取得
        const rawUri = info.imageUrls[0];
        if (rawUri) {
          const normalizedUri = normalizeStoredImageUri(rawUri) || rawUri;
          if (normalizedUri.startsWith('file://')) {
            // 新しい画像アップロード
            // キャッシュ回避のためにユニークなファイル名を使用
            const newBaseName = `cover-${Date.now()}`;
            const uploaded = await uploadImage(normalizedUri, userId, newRecordId, newBaseName);
            if (uploaded) {
              uploadedImageUrls.push(uploaded);
              uploadedImageAssetIds.push(null);
            }
          } else {
            // 既存のURL（編集画面などから回ってきた場合）
            uploadedImageUrls.push(normalizedUri);
            uploadedImageAssetIds.push(null);
          }
        }
      }

      // dedupeは不要だが、配列形式を維持するための整合性処理
      // （もし何らかの理由で重複してたら排除するが、1枚なら関係ない）

      const finalImageAssetIds = uploadedImageUrls.length > 0 ? [null] : [];

      const newRecord: ChekiRecord = {
        id: newRecordId,
        user_id: userId,
        artist: info.artist,
        artistImageUrl: info.artistImageUrl || '',
        liveName: info.name,
        liveType: info.liveType || 'ワンマン',
        date: formatDate(info.date),
        venue: info.venue,
        seat: info.seat || '',
        startTime: info.startTime || '',
        endTime: info.endTime || '',
        imageUrls: uploadedImageUrls, // [url] or []
        imageAssetIds: finalImageAssetIds,
        memo: info.memo || '',
        detail: info.detail || '',
        qrCode: info.qrCode || '',
        createdAt: new Date().toISOString(),
      };
      
      // レコードを保存
      await addNewRecord(newRecord);
      
      // セットリストを保存
      if (info.setlistSongs && info.setlistSongs.length > 0) {
        try {
          await saveSetlist(newRecord.id, info.setlistSongs);
        } catch (setlistError) {
          // セットリストの保存に失敗してもレコードは保存済みなので続行
        }
      }

    } catch (error) {
      Alert.alert('エラー', '記録の保存に失敗しました');
      caughtError = error;
    } finally {
      const elapsed = Date.now() - loadingStart;
      if (elapsed < minLoadingMs) {
        await new Promise(resolve => setTimeout(resolve, minLoadingMs - elapsed));
      }
    }
    if (caughtError) {
      throw caughtError;
    }
  };

  return (
    <LiveEditScreen
      initialData={null}
      onSave={handleSave}
      onCancel={() => navigation.navigate('List')}
      successHoldDuration={1200}
    />
  );
};

const EditScreen: React.FC<{ route: any; navigation: any; records: ChekiRecord[]; updateRecord: (id: string, record: ChekiRecord) => Promise<void> }> = ({ route, navigation, records, updateRecord }) => {
  const { record, focusMemo = false } = route.params || {};
  
  // record.imageUrlsを相対パス→file://パスに変換（memo化して参照を安定させる）
  const resolvedImageUrls = useMemo(() => {
    return (record?.imageUrls || []).map((url: string) => resolveLocalImageUri(url));
  }, [record?.id]);
  
  const dedupeImageEntries = useCallback(
    (urls: string[], assetIds: Array<string | null>): { urls: string[]; assetIds: Array<string | null> } => {
      const seen = new Set<string>();
      const nextUrls: string[] = [];
      const nextAssetIds: Array<string | null> = [];

      urls.forEach((url, index) => {
        const key = normalizeStoredImageUri(url) || url;
        if (seen.has(key)) return;
        seen.add(key);
        nextUrls.push(url);
        nextAssetIds.push(assetIds[index] ?? null);
      });

      return { urls: nextUrls, assetIds: nextAssetIds };
    },
    []
  );

  if (!record) {
    return null;
  }

  const formatDate = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}.${month}.${day}`;
  }, []);

  const handleSave = useCallback(async (info: any) => {
    try {
      const userId = 'local-user';
      let uploadedImageUrls: string[] = [];
      let uploadedImageAssetIds: Array<string | null> = [];

      // ジャケット画像の更新（1枚のみ）
      if (info.imageUrls && info.imageUrls.length > 0) {
        const rawUri = info.imageUrls[0];
        if (rawUri) {
          const normalizedUri = normalizeStoredImageUri(rawUri) || rawUri;
          
          if (normalizedUri.startsWith('file://')) {
            // 新規画像のアップロード
            const newBaseName = `cover-${Date.now()}`;
            const uploaded = await uploadImage(normalizedUri, userId, record.id, newBaseName);
            if (uploaded) {
              // 古い画像があれば削除
              if (record.imageUrls && record.imageUrls.length > 0) {
                 const oldUri = record.imageUrls[0];
                 try {
                   await deleteImage(oldUri);
                 } catch (e) {
                   // Old image deletion failed, continue
                 }
              }

              uploadedImageUrls = [uploaded];
              uploadedImageAssetIds = [null];
            }
          } else {
            // 既存画像の維持
            uploadedImageUrls = [normalizedUri];
            const originalIndex = (record.imageUrls || []).indexOf(rawUri);
            const originalAssetId = originalIndex !== -1 ? (record.imageAssetIds?.[originalIndex] ?? null) : null;
            uploadedImageAssetIds = [originalAssetId];
          }
        }
      }

      const updatedRecord: ChekiRecord = {
        ...record,
        user_id: userId,
        artist: info.artist,
        artistImageUrl: info.artistImageUrl || '',
        liveName: info.name,
        liveType: info.liveType || record.liveType || 'ワンマン',
        date: formatDate(info.date),
        venue: info.venue,
        seat: info.seat || '',
        startTime: info.startTime || '',
        endTime: info.endTime || '',
        imageUrls: uploadedImageUrls,
        imageAssetIds: uploadedImageUrls.length > 0 ? uploadedImageAssetIds : [],
        memo: info.memo || '',
        detail: info.detail || '',
        qrCode: info.qrCode || '',
      };

      await updateRecord(record.id, updatedRecord);

      if (info.setlistSongs && info.setlistSongs.length > 0) {
        try {
          await saveSetlist(record.id, info.setlistSongs);
        } catch (setlistError) {
          // Setlist save failed, continue
        }
      }

      navigation.navigate('List');
    } catch (error) {
      Alert.alert('エラー', '記録の保存に失敗しました');
    }
  }, [record, formatDate, updateRecord, navigation]);

  // initialData をメモ化して、parent re-render 時に不要な re-render を防ぐ
  const initialData = useMemo(() => ({
    name: record.liveName,
    artist: record.artist,
    liveType: record.liveType,
    artistImageUrl: record.artistImageUrl,
    date: new Date(record.date.replace(/\./g, '-')),
    venue: record.venue,
    seat: record.seat,
    startTime: record.startTime,
    endTime: record.endTime,
    imageUrls: resolvedImageUrls,
    memo: record.memo,
    detail: record.detail,
    qrCode: record.qrCode,
  }), [record.liveName, record.artist, record.liveType, record.artistImageUrl, record.date, record.venue, record.seat, record.startTime, record.endTime, resolvedImageUrls, record.memo, record.detail, record.qrCode]);

  return (
    <LiveEditScreen
      initialData={initialData}
      onSave={handleSave}
      onCancel={() => navigation.navigate('List')}
      focusMemo={focusMemo}
    />
  );
};

// Collection Stack Navigator
const CollectionStack = ({ records, addNewRecord, updateRecord, deleteRecord, navigation }: { records: ChekiRecord[]; addNewRecord: (record: ChekiRecord) => Promise<void>; updateRecord: (id: string, record: ChekiRecord) => Promise<void>; deleteRecord: (id: string) => Promise<void>; navigation: any }) => {
  const isPremium = useAppStore((state) => state.isPremium);

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
        {(props) => <ListScreen {...props} records={records} addNewRecord={addNewRecord} deleteRecord={deleteRecord} isPremium={isPremium} />}
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
        {(props) => <EditScreen {...props} records={records} updateRecord={updateRecord} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default function CollectionScreen() {
  const { records, addRecord, updateRecord, deleteRecord, isLoading } = useRecords();
  const navigation = useRef<any>(null);

  useEffect(() => {
    const { getGlobalNotification } = require('../contexts/NotificationContext');
    const checkNotification = () => {
      const notification = getGlobalNotification();
      if (notification && navigation.current) {
        const record = records.find((r) => r.id === notification.recordId);
        if (record) {
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
      <CollectionStackWrapper records={records} addNewRecord={addRecord} updateRecord={updateRecord} deleteRecord={deleteRecord} />
    </>
  );
}

interface CollectionStackWrapperProps {
  records: ChekiRecord[];
  addNewRecord: (record: ChekiRecord) => Promise<void>;
  updateRecord: (id: string, record: ChekiRecord) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
}

function CollectionStackWrapper({ records, addNewRecord, updateRecord, deleteRecord }: CollectionStackWrapperProps) {
  const navigation = useNavigation<any>();
  const isPremium = useAppStore((state) => state.isPremium);
  const [pendingNotification, setPendingNotification] = useState<{ recordId: string; kind: string } | null>(null);

  useEffect(() => {
    const { getGlobalNotification } = require('../contexts/NotificationContext');
    const notification = getGlobalNotification();
    if (notification) {
      setPendingNotification(notification);
    }
  }, []);

  useEffect(() => {
    if (pendingNotification && pendingNotification.recordId) {
      const record = records.find((r) => r.id === pendingNotification.recordId);
      if (record) {
        // タイムカプセル通知の場合は詳細画面へ（閲覧のみ）
        if (pendingNotification.kind === 'timecapsule') {
          navigation.navigate('Detail', { record });
        }
        // after_show通知の場合は編集画面へ（メモ入力促進）
        else if (pendingNotification.kind === 'after_show') {
          navigation.navigate('Edit', {
            record,
            focusMemo: true,
          });
        }
        
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
        {(props) => <ListScreen {...props} records={records} addNewRecord={addNewRecord} deleteRecord={deleteRecord} isPremium={isPremium} />}
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
        name="Paywall"
        component={PaywallScreen}
        options={{
          animation: 'fade',
          presentation: 'transparentModal',
          contentStyle: {
            backgroundColor: 'transparent',
          },
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
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
        {(props) => <EditScreen {...props} records={records} updateRecord={updateRecord} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
