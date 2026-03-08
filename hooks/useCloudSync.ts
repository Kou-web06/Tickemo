import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { CloudStorage } from 'react-native-cloud-storage';
import { useAppStore } from '../store/useAppStore';
import { AppState } from 'react-native';
import { isTickemoRelativePath, pullImageFromCloud, pushImageToCloud } from '../lib/icloudImageSync';

const CLOUD_FILE = '/tickemo_data.json';
const KVS_FILE = '/tickemo_kvs.json';
const SCHEMA_VERSION = 1;

const stableStringify = (value: unknown) => JSON.stringify(value);

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
  const { lives, setlists, userProfile, hasOnboarded, importData, hasHydrated } = useAppStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [initialPullDone, setInitialPullDone] = useState(false);

  const lastImportedData = useRef<string | null>(null);
  const pushedImagesRef = useRef<Set<string>>(new Set());
  const pullFromCloudRef = useRef<(() => Promise<void>) | null>(null);

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

  const getImagePathsFromLives = useCallback((records: typeof lives, profile?: typeof userProfile) => {
    const paths: string[] = [];

    // Lives からの画像パス
    records.forEach((record) => {
      (record.imageUrls || []).forEach((path) => {
        if (isTickemoRelativePath(path)) {
          paths.push(path);
        }
      });
    });

    // プロフィール画像
    if (profile?.avatarUri && isTickemoRelativePath(profile.avatarUri)) {
      paths.push(profile.avatarUri);
    }

    return Array.from(new Set(paths));
  }, []);

  const pullImagesFromCloud = useCallback(async (records: typeof lives, profile?: typeof userProfile) => {
    const paths = getImagePathsFromLives(records, profile);
    await Promise.all(paths.map((path) => pullImageFromCloud(path)));
  }, [getImagePathsFromLives]);

  const pushImagesToCloud = useCallback(async (records: typeof lives) => {
    const paths = getImagePathsFromLives(records, userProfile);
    const targets = paths.filter((path) => !pushedImagesRef.current.has(path));
    await Promise.all(
      targets.map(async (path) => {
        const ok = await pushImageToCloud(path);
        if (ok) {
          pushedImagesRef.current.add(path);
        }
      })
    );
  }, [getImagePathsFromLives, userProfile]);

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
            await pullImagesFromCloud(data.lives, data.userProfile ?? null);
      }
      
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('[CloudSync] Pull failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [importData, pullImagesFromCloud]);

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

      await pushImagesToCloud(data.lives);
      
      // Update last imported data to current so we don't push again until next change
      lastImportedData.current = contentStr;
      
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('[CloudSync] Push failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [pushImagesToCloud]);

  // pullFromCloud を ref に保存
  useEffect(() => {
    pullFromCloudRef.current = pullFromCloud;
  }, [pullFromCloud]);

  // CloudStorage を初期化
  useEffect(() => {
    if (!hasHydrated) return;

    let isActive = true;
    const runInitialPull = async () => {
      await pullFromCloudRef.current?.();
      if (isActive) {
        setInitialPullDone(true);
      }
    };

    runInitialPull();

    return () => {
      isActive = false;
    };
  }, [hasHydrated]);

  // データ変更時にプッシュ（変更検知）
  // 初回ロード完了後にのみ有効にしたい（無限ループ防止）
  const isMounted = useRef(false);
  useEffect(() => {
    if (!hasHydrated || !initialPullDone) {
      return;
    }

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
  }, [debouncedData, pushToCloud, hasHydrated, initialPullDone]);

  // AppState listener（アプリ復帰時のプル）
  // 空の dependencies でアプリのライフタイム全体で1回だけセットアップ
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && hasHydrated) {
        console.log('[CloudSync] App active, pulling data...');
        pullFromCloudRef.current?.();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [hasHydrated]);

  return {
    isSyncing,
    lastSyncTime,
    forceSync: pullFromCloud
  };
};

export const useICloudKvsSync = () => {
  const { lives, setlists, userProfile, hasOnboarded, importData } = useAppStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const lastImportedHash = useRef<string | null>(null);

  const payload = useMemo(
    () => ({
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      lives,
      setlists,
      userProfile,
      hasOnboarded,
    }),
    [lives, setlists, userProfile, hasOnboarded]
  );

  const pull = useCallback(async () => {
    try {
      setIsSyncing(true);
      const exists = await CloudStorage.exists(KVS_FILE);
      if (!exists) return;

      const raw = await CloudStorage.readFile(KVS_FILE);
      const remote = JSON.parse(raw);
      if (!remote || !remote.lives) return;

      const { updatedAt, ...content } = remote;
      const hash = stableStringify(content);
      lastImportedHash.current = hash;

      importData(remote);
    } finally {
      setIsSyncing(false);
    }
  }, [importData]);

  const push = useCallback(async () => {
    const { updatedAt, ...content } = payload;
    const hash = stableStringify(content);
    if (lastImportedHash.current === hash) return;

    try {
      setIsSyncing(true);
      await CloudStorage.writeFile(KVS_FILE, JSON.stringify(payload));
      lastImportedHash.current = hash;
    } finally {
      setIsSyncing(false);
    }
  }, [payload]);

  // 初回 + foreground 復帰時に pull
  useEffect(() => {
    pull();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pull();
    });
    return () => sub.remove();
  }, [pull]);

  // デバウンス push
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(push, 2000);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [push]);

  return { isSyncing, forceSync: pull };
};
