import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChekiRecord } from '../types/record';
export type { ChekiRecord } from '../types/record';

const INITIAL_RECORDS: ChekiRecord[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    user_id: 'demo-user-id',
    artist: 'The Beatles',
    liveName: 'Reunion Tour 2024',
    date: '2024-12-15',
    venue: '東京ドーム',
    imageUrl: 'https://picsum.photos/300/400?random=1',
    memo: '最高のコンサートでした！',
    detail: 'Let It Be\nThe Long and Winding Road\nHey Jude\nHere Comes the Sun',
    createdAt: '2024-12-01T12:00:00Z',
  },
];

interface RecordsContextType {
  records: ChekiRecord[];
  addRecord: (record: ChekiRecord) => void;
  updateRecord: (id: string, record: ChekiRecord) => void;
  deleteRecord: (id: string) => void;
  clearRecords: () => void;
}

const RecordsContext = createContext<RecordsContextType | undefined>(undefined);

/**
 * 日付形式を「2025-01-12」から「2025.01.12」に統一する
 */
const normalizeDateFormat = (record: ChekiRecord): ChekiRecord => {
  if (!record.date) return record;
  
  // 「2025-01-12」形式を「2025.01.12」に変換
  const normalized = record.date.replace(/-/g, '.');
  
  return {
    ...record,
    date: normalized,
  };
};

export const RecordsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [records, setRecords] = useState<ChekiRecord[]>(INITIAL_RECORDS.map((r) => normalizeDateFormat(r)));
  const [isLoaded, setIsLoaded] = useState(false);

  // AsyncStorageからデータを読み込む
  useEffect(() => {
    loadRecords();
  }, []);

  // recordsが変更されたら保存
  useEffect(() => {
    if (isLoaded) {
      saveRecords();
    }
  }, [records, isLoaded]);

  const loadRecords = async () => {
    try {
      const storedRecords = await AsyncStorage.getItem('@records');
      if (storedRecords !== null) {
        const parsedRecords = JSON.parse(storedRecords) as ChekiRecord[];
        // 日付形式を統一する
        const normalizedRecords = parsedRecords.map((r) => normalizeDateFormat(r));
        setRecords(normalizedRecords);
      }
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveRecords = async () => {
    try {
      await AsyncStorage.setItem('@records', JSON.stringify(records));
    } catch (error) {
      console.error('Failed to save records:', error);
    }
  };

  const addRecord = (record: ChekiRecord) => {
    const normalized = normalizeDateFormat(record);
    setRecords([normalized, ...records]);
  };

  const updateRecord = (id: string, updatedRecord: ChekiRecord) => {
    const normalized = normalizeDateFormat(updatedRecord);
    setRecords(records.map(r => r.id === id ? normalized : r));
  };

  const deleteRecord = (id: string) => {
    setRecords(records.filter(r => r.id !== id));
  };

  const clearRecords = () => {
    setRecords([]);
  };

  return (
    <RecordsContext.Provider value={{ records, addRecord, updateRecord, deleteRecord, clearRecords }}>
      {children}
    </RecordsContext.Provider>
  );
};

export const useRecords = (): RecordsContextType => {
  const context = useContext(RecordsContext);
  if (context === undefined) {
    throw new Error('useRecords must be used within a RecordsProvider');
  }
  return context;
};
