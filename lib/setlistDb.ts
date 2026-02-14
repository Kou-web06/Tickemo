import type { SetlistItem } from '../types/setlist';
import { useAppStore } from '../store/useAppStore';

/**
 * レコードのセットリストを保存（既存の曲を削除して新規挿入）
 */
const SPECIAL_PREFIX = '__special__:';

export async function saveSetlist(recordId: string, songs: SetlistItem[]): Promise<void> {
  try {
    useAppStore.getState().setSetlist(recordId, songs);
  } catch (error) {
    console.error('[Setlist] Save error:', error);
    throw error;
  }
}

/**
 * レコードのセットリストを取得
 */
export async function getSetlist(recordId: string): Promise<SetlistItem[]> {
  try {
    const items = useAppStore.getState().setlists[recordId];
    return items ? [...items] : [];
  } catch (error) {
    console.error('[Setlist] Fetch error:', error);
    return [];
  }
}

/**
 * レコード削除時にセットリストも削除（CASCADE設定されているが念のため）
 */
export async function deleteSetlist(recordId: string): Promise<void> {
  try {
    useAppStore.getState().clearSetlist(recordId);
  } catch (error) {
    console.error('[Setlist] Delete error:', error);
    // エラーを無視（CASCADE削除されている可能性）
  }
}
