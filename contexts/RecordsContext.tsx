import React, { createContext, useContext, useEffect, ReactNode, useMemo } from 'react';
import type { ChekiRecord } from '../types/record';
import { scheduleLiveReminders } from '../utils/liveNotifications';
import { useAppStore } from '../store/useAppStore';
import { deleteLiveImages, migrateLegacyImagesToTickemo, resolveLocalImageUri } from '../lib/imageUpload';
import { useCloudSync } from '../hooks/useCloudSync';
export type { ChekiRecord } from '../types/record';

interface RecordsContextType {
  records: ChekiRecord[];
  addRecord: (record: ChekiRecord) => Promise<void>;
  updateRecord: (id: string, record: ChekiRecord) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  clearRecords: () => Promise<void>;
  isLoading: boolean;
}

const RecordsContext = createContext<RecordsContextType | undefined>(undefined);

/**
 * 日付形式を「2025-01-12」から「2025.01.12」に統一する
 */
const normalizeDateFormat = (record: ChekiRecord): ChekiRecord => {
  if (!record.date) return record;
  
  const normalized = record.date.replace(/-/g, '.');
  
  return {
    ...record,
    date: normalized,
  };
};

const resolveRecordImages = (record: ChekiRecord): ChekiRecord => {
  if (!record.imageUrls || record.imageUrls.length === 0) return record;
  const resolvedEntries = record.imageUrls
    .map((uri, index) => {
      const resolvedUri = resolveLocalImageUri(uri);
      if (!resolvedUri) return null;
      return {
        uri: resolvedUri,
        assetId: record.imageAssetIds?.[index] ?? null,
      };
    })
    .filter((entry): entry is { uri: string; assetId: string | null } => Boolean(entry));
  return {
    ...record,
    imageUrls: resolvedEntries.map((entry) => entry.uri),
    imageAssetIds: record.imageAssetIds ? resolvedEntries.map((entry) => entry.assetId) : record.imageAssetIds,
  };
};


export const RecordsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const lives = useAppStore((state) => state.lives);
  const addLive = useAppStore((state) => state.addLive);
  const updateLive = useAppStore((state) => state.updateLive);
  const deleteLive = useAppStore((state) => state.deleteLive);
  const clearLives = useAppStore((state) => state.clearLives);
  
  const { isSyncing } = useCloudSync();

  const records = useMemo(
    () => lives.map((record) => resolveRecordImages(normalizeDateFormat(record))),
    [lives]
  );
  const isLoading = isSyncing;

  useEffect(() => {
    migrateLegacyImagesToTickemo().catch((error) => {
      console.log('[RecordsContext] Legacy image migration failed:', error);
    });
  }, []);

  useEffect(() => {
    scheduleLiveReminders(records).catch((error) => {
      console.log('[RecordsContext] Failed to schedule reminders:', error);
    });
  }, [records]);

  const addRecord = async (record: ChekiRecord) => {
    addLive(normalizeDateFormat(record));
  };

  const updateRecord = async (id: string, updatedRecord: ChekiRecord) => {
    updateLive(id, normalizeDateFormat(updatedRecord));
  };

  const deleteRecord = async (id: string) => {
    await deleteLiveImages(id);
    deleteLive(id);
  };

  const clearRecords = async () => {
    clearLives();
  };

  return (
    <RecordsContext.Provider value={{ records, addRecord, updateRecord, deleteRecord, clearRecords, isLoading }}>
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
