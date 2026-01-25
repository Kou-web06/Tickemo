import { StyleSheet, View, Text, TouchableOpacity, FlatList, Alert, Dimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import ChekiCard from './ChekiCard';

interface ChekiRecord {
  id: string;
  artist: string;
  date: string;
  imageUrl: string;
  memo: string;
}

type RootStackParamList = {
  List: undefined;
  Detail: { record: ChekiRecord };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const DUMMY_RECORDS: ChekiRecord[] = [
  {
    id: '1',
    artist: 'Mrs. GREEN APPLE',
    date: '2024-12-15',
    imageUrl: 'https://picsum.photos/300/400?random=1',
    memo: '最高のコンサートでした！',
  },
  {
    id: '2',
    artist: 'Taylor Swift',
    date: '2024-11-20',
    imageUrl: 'https://picsum.photos/300/400?random=2',
    memo: 'The Eras Tour 🎤✨',
  },
  {
    id: '3',
    artist: 'Coldplay',
    date: '2024-10-10',
    imageUrl: 'https://picsum.photos/300/400?random=3',
    memo: '素晴らしいステージングでした。',
  },
  {
    id: '4',
    artist: 'Billie Eilish',
    date: '2024-09-05',
    imageUrl: 'https://picsum.photos/300/400?random=4',
    memo: '初めて見ました！迫力がすごい！',
  },
  {
    id: '5',
    artist: 'Olivia Rodrigo',
    date: '2024-08-12',
    imageUrl: 'https://picsum.photos/300/400?random=5',
    memo: '友達と一緒に楽しめました。',
  },
];

interface ListScreenProps {
  navigation: any;
}

const ListScreen: React.FC<ListScreenProps> = ({ navigation }) => {
  const screenWidth = Dimensions.get('window').width;
  const SCREEN_PADDING = 12;
  const GAP = 8;
  
  const cardWidth = useMemo(() => {
    const availableWidth = screenWidth - SCREEN_PADDING * 2 - GAP;
    return availableWidth / 2;
  }, [screenWidth]);

  const handleAddPress = () => {
    Alert.alert('ライブを追加', 'この機能は後日実装予定です');
  };

  const handleCardPress = (record: ChekiRecord) => {
    navigation.navigate('Detail', { record });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={DUMMY_RECORDS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChekiCard
            record={item}
            onPress={() => handleCardPress(item)}
            width={cardWidth}
          />
        )}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        numColumns={2}
        columnWrapperStyle={[styles.columnWrapper, { gap: GAP }]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingHorizontal: SCREEN_PADDING },
        ]}
      />
    </View>
  );
};

interface DetailScreenProps {
  route: any;
  navigation: any;
}

const DetailScreen: React.FC<DetailScreenProps> = ({ route, navigation }) => {
  const { record } = route.params;

  return (
    <View style={styles.detailContainer}>
      <Text style={styles.detailTitle}>{record.artist}</Text>
      <Text style={styles.detailDate}>{record.date}</Text>
      <Text style={styles.detailMemo}>{record.memo}</Text>
    </View>
  );
};

export const HomeTabNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        presentation: 'card',
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '700',
        },
        headerTintColor: '#000',
      }}
    >
      <Stack.Screen
        name="List"
        component={ListScreen}
        options={{
          title: 'ライブ記録',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                Alert.alert('追加', 'この機能は後日実装予定です');
              }}
              style={{ marginRight: 15 }}
            >
              <Text style={{ fontSize: 24 }}>＋</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={{
          title: 'ライブ詳細',
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: 12,
    paddingBottom: 20,
  },
  contentContainer: {
    paddingTop: 0,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  detailDate: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 16,
  },
  detailMemo: {
    fontSize: 16,
    color: '#3C3C43',
    textAlign: 'center',
  },
});
