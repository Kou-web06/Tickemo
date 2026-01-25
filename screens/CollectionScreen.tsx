import React, { useState } from 'react';
import { View, FlatList, Dimensions, TouchableOpacity, Alert, StyleSheet, Text, TextInput, ScrollView, Modal, Animated, ImageBackground } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { TicketCard } from '../components/TicketCard';
import { TicketDetail } from '../components/TicketDetail';
import { AddCardButton } from '../components/AddCardButton';
import SettingsScreen from './SettingsScreen';
import LiveEditScreen from './LiveEditScreen';
import { theme } from '../theme';
import { useRecords, ChekiRecord } from '../contexts/RecordsContext';

const Stack = createNativeStackNavigator();

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: 0,
    paddingTop: theme.spacing.xxxxl,
  },
  headerContainer: {
    paddingHorizontal: theme.spacing.xxl,
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.lg,
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
});

const ListScreen: React.FC<{ navigation: any; records: ChekiRecord[] }> = ({ navigation, records }) => {
  const [selectedRecord, setSelectedRecord] = useState<ChekiRecord | null>(null);
  const [animatingCardId, setAnimatingCardId] = useState<string | null>(null);
  const [closingRecordId, setClosingRecordId] = useState<string | null>(null);
  const [showAfterAnimId, setShowAfterAnimId] = useState<string | null>(null);

  // スライドイン完了後に一度だけ「通常表示」状態に戻すためのフラグを自動リセット
  React.useEffect(() => {
    if (showAfterAnimId) {
      const timer = setTimeout(() => setShowAfterAnimId(null), 0);
      return () => clearTimeout(timer);
    }
  }, [showAfterAnimId]);

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
    navigation.navigate('Add');
  };

  // 日付で新しい順にソート（最新のライブが先頭）
  const toTime = (record: ChekiRecord) => {
    if (!record?.date) return 0;
    const time = new Date(record.date.replace(/\./g, '-')).getTime();
    return Number.isNaN(time) ? 0 : time;
  };
  const sortedRecords = [...records].sort((a, b) => toTime(b) - toTime(a));

  // Create display data with add button at the end
  const displayData = [...sortedRecords, { id: 'add-button' }];

  // 最初のレコードの画像を背景として使用（並び替え後の先頭）
  const backgroundImageUrl = sortedRecords.length > 0 && sortedRecords[0].imageUrl ? sortedRecords[0].imageUrl : null;

  return (
    <View style={styles.listContainer}>
      {/* Dynamic Blur Background */}
      {backgroundImageUrl ? (
        <>
          <ImageBackground
            source={{ uri: backgroundImageUrl }}
            style={styles.backgroundImage}
            resizeMode="cover"
            blurRadius={50}
          />
          <BlurView intensity={50} tint="dark" style={styles.blurOverlay} />
          
        </>
      ) : null}

      <View style={styles.headerContainer}>
        <Text style={styles.title}>コレクション</Text>
      </View>
      
      <FlatList
        data={displayData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (item.id === 'add-button') {
            return (
              <TouchableOpacity
                style={{ width: cardWidth, marginBottom: 12, alignSelf: 'center' }}
                onPress={handleAddPress}
                activeOpacity={0.7}
              >
                <AddCardButton width={cardWidth} />
              </TouchableOpacity>
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
          return (
            <TouchableOpacity
              style={{ marginBottom: 12, alignSelf: 'center', opacity, pointerEvents }}
              onPress={() => handleCardPress(item as ChekiRecord)}
              activeOpacity={0.9}
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

const AddScreen: React.FC<{ navigation: any; addNewRecord: (record: ChekiRecord) => void }> = ({ navigation, addNewRecord }) => {
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSave = (info: any) => {
    const primaryImage = info.imageUrl || '';

    const newRecord: ChekiRecord = {
      id: Date.now().toString(),
      user_id: 'demo-user-id',
      artist: info.artist,
      liveName: info.name,
      date: formatDate(info.date),
      venue: info.venue,
      imageUrl: primaryImage,
      memo: info.memo || '',
      detail: info.detail || '',
      qrCode: info.qrCode || '',
      createdAt: new Date().toISOString(),
    };
    addNewRecord(newRecord);
    navigation.goBack();
  };

  return (
    <LiveEditScreen
      initialData={null}
      onSave={handleSave}
      onCancel={() => navigation.goBack()}
    />
  );
};

// Collection Stack Navigator
const CollectionStack = ({ records, addNewRecord }: { records: ChekiRecord[]; addNewRecord: (record: ChekiRecord) => void }) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
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
        }}
      >
        {(props) => <SettingsScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="Add"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
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
        }}
      />
    </Stack.Navigator>
  );
};

export default function CollectionScreen() {
  const { records, addRecord } = useRecords();

  return (
    <CollectionStack 
      records={records} 
      addNewRecord={addRecord}
    />
  );
}
