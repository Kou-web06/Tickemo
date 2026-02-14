import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { CloudStorage } from 'react-native-cloud-storage';
import { useAppStore } from '../store/useAppStore';
import { AppState, AppStatus } from 'react-native';

const CLOUD_FILE = '/tickemo_data.json';

// 単純なデバウンス用
const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export const useCloudSync = () => {
  const { lives, setlists, userProfile, hasOnboarded, importData } = useAppStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const lastImportedData = useRef<string | null>(null);

  // ストアの状態をまとめる
  const currentData = useMemo(() => ({
    lives,
    setlists,
    userProfile,
    hasOnboarded,
    // updatedAt is removed from memo to avoid cycles
  }), [lives, setlists, userProfile, hasOnboarded]);

  const debouncedData = useDebounce(currentData, 2000); // 変更から2秒後に同期
  const prevLivesCount = useRef(lives.length);

  // クラウドからデータを読み込む
  const pullFromCloud = useCallback(async () => {
    try {
      setIsSyncing(true);
      const exists = await CloudStorage.exists(CLOUD_FILE);
      if (!exists) {
        console.log('[CloudSync] No data on cloud');
        setIsSyncing(false);
        return;
      }

      const json = await CloudStorage.readFile(CLOUD_FILE);
      const data = JSON.parse(json);

      if (data && data.lives) {
          // Store the data we just imported to avoid echoing it back
          // We must stringify safely, excluding updatedAt relative to the imported data
          // Actually, just storing the json string we got is enough if push logic matches
          // But store logic might reorder? Safer to normalize.
          const { updatedAt, ...content } = data;
          lastImportedData.current = JSON.stringify(content);

          console.log('[CloudSync] Imported data from cloud');
          importData(data);
      }
      
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('[CloudSync] Pull failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [importData]);

  // クラウドへ書き込む
  const pushToCloud = useCallback(async (data: typeof currentData) => {
    try {
      const payload = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      
      // Compare with last imported data to avoid echo
      const contentStr = JSON.stringify(data);
      if (lastImportedData.current === contentStr) {
        console.log('[CloudSync] Data matches last import, skipping push');
        return;
      }

      setIsSyncing(true);
      await CloudStorage.writeFile(CLOUD_FILE, JSON.stringify(payload));
      console.log('[CloudSync] Pushed data to cloud');
      
      // Update last imported data to current so we don't push again until next change
      lastImportedData.current = contentStr;
      
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('[CloudSync] Push failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 初回マウント時およびアプリ復帰時にプル
  useEffect(() => {
    pullFromCloud();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[CloudSync] App active, pulling data...');
        pullFromCloud();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [pullFromCloud]);

  // データ変更時にプッシュ（変更検知）
  // 初回ロード完了後にのみ有効にしたい（無限ループ防止）
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      prevLivesCount.current = debouncedData.lives.length;
      return;
    }
    const shouldPush = debouncedData.lives.length > 0 || prevLivesCount.current > 0;
    if (shouldPush) {
      pushToCloud(debouncedData);
    }
    prevLivesCount.current = debouncedData.lives.length;
  }, [debouncedData, pushToCloud]);

  return {
    isSyncing,
    lastSyncTime,
    forceSync: pullFromCloud
  };
};
