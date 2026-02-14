import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChekiRecord } from '../types/record';

const SYNC_QUEUE_KEY = '@sync_queue';

interface SyncQueueItem {
  id: string;
  action: 'add' | 'update' | 'delete';
  record: ChekiRecord | null; // delete アクション時は null
  timestamp: number;
}

/**
 * 同期キューに操作を追加（オフライン時のみ）
 */
export const addToSyncQueue = async (
  action: 'add' | 'update' | 'delete',
  record: ChekiRecord | null
): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const newItem: SyncQueueItem = {
      id: record?.id || Date.now().toString(),
      action,
      record,
      timestamp: Date.now(),
    };
    queue.push(newItem);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    // console.log(`[SyncQueue] ${action} キューに追加:`, newItem.id);
  } catch (error) {
    console.error('[SyncQueue] キュー追加エラー:', error);
  }
};

/**
 * 同期キューを取得
 */
export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  try {
    const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (error) {
    console.error('[SyncQueue] キュー取得エラー:', error);
    return [];
  }
};

/**
 * 同期キューをクリア
 */
export const clearSyncQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
    // console.log('[SyncQueue] キューをクリア');
  } catch (error) {
    console.error('[SyncQueue] キュークリアエラー:', error);
  }
};

/**
 * 同期キュー内の特定の操作を削除
 */
export const removeFromSyncQueue = async (itemId: string): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    // console.log(`[SyncQueue] 削除:`, itemId);
  } catch (error) {
    console.error('[SyncQueue] 削除エラー:', error);
  }
};
