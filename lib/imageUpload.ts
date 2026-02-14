import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

// ファイルパスから拡張子を取得するヘルパー関数
const getExtension = (uri: string) => {
  const match = uri.match(/\.([a-zA-Z0-9]+)$/);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
};

const buildFileName = (uri: string, baseName: string) => {
  const ext = getExtension(uri);
  const sanitized = baseName.endsWith(ext) ? baseName : `${baseName}${ext}`;
  return sanitized;
};


const sanitizeAlbumPart = (value: string) => {
  return value.replace(/[\\/:]/g, '-').replace(/\s+/g, ' ').trim();
};

const formatAlbumDate = (date?: Date | string) => {
  if (!date) return '';
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}.${month}.${day}`;
  }
  if (typeof date === 'string') {
    return date;
  }
  return '';
};

export const buildLiveAlbumName = (date?: Date | string, liveName?: string) => {
  const dateLabel = sanitizeAlbumPart(formatAlbumDate(date));
  const liveLabel = liveName ? sanitizeAlbumPart(liveName) : '';
  const suffix = [dateLabel, liveLabel].filter(Boolean).join(' ');
  return suffix ? `Tickemo - ${suffix}` : 'Tickemo';
};


const getBaseDir = () => FileSystem.documentDirectory;
const getTickemoDir = () => {
  const baseDir = getBaseDir();
  return baseDir ? `${baseDir}Tickemo/` : null;
};
const getLegacyLivesDir = () => {
  const baseDir = getBaseDir();
  return baseDir ? `${baseDir}lives` : null;
};

const toRelativePath = (liveId: string, fileName: string) => {
  return `Tickemo/lives/${liveId}/${fileName}`;
};

export const resolveLocalImageUri = (path: string) => {
  if (!path) return '';
  if (path.startsWith('file://') || path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('icloud://')) return '';
  const baseDir = getBaseDir();
  if (!baseDir) return '';
  const trimmed = path.replace(/^\/+/, '');
  return `${baseDir}${trimmed}`;
};

export const normalizeStoredImageUri = (uri: string) => {
  if (!uri) return uri;
  if (!uri.startsWith('file://')) return uri;

  const baseDir = getBaseDir();
  const tickemoDir = getTickemoDir();
  if (tickemoDir && uri.startsWith(tickemoDir)) {
    return uri.replace(tickemoDir, 'Tickemo/');
  }
  if (baseDir && uri.startsWith(`${baseDir}lives/`)) {
    return uri.replace(baseDir, '');
  }
  return uri;
};

export const resolveStoredImageUri = async (
  savedUri?: string,
  assetId?: string | null
): Promise<string | null> => {
  if (!savedUri && !assetId) return null;
  const resolved = savedUri ? resolveLocalImageUri(savedUri) : '';

  if (resolved) {
    try {
      const info = await FileSystem.getInfoAsync(resolved);
      if (info.exists) return resolved;
    } catch (error) {
      console.log('[imageUpload] File check failed:', error);
    }
  }

  if (assetId) {
    try {
      const asset = await MediaLibrary.getAssetInfoAsync(assetId);
      const assetUri = asset.localUri ?? asset.uri;
      if (!assetUri) return null;

      if (resolved && resolved.startsWith('file://')) {
        try {
          await FileSystem.makeDirectoryAsync(resolved.replace(/\/[^/]+$/, ''), { intermediates: true });
          await FileSystem.copyAsync({ from: assetUri, to: resolved });
          return resolved;
        } catch (error) {
          console.log('[imageUpload] Restore copy failed:', error);
        }
      }

      return assetUri;
    } catch (error) {
      console.log('[imageUpload] Asset lookup failed:', error);
      if (assetId.startsWith('ph://') || assetId.startsWith('assets-library://') || assetId.startsWith('content://')) {
        return assetId;
      }
    }
  }

  return null;
};

/**
 * 画像ファイルをローカル領域に保存
 * @param fileUri - ImagePicker から取得したファイルURI
 * @param userId - 互換用（未使用）
 * @param fileName - ファイル名（オプション）
 * @returns 保存後のローカルURI、またはnull（エラー時）
 */
export const uploadImage = async (
  fileUri: string,
  userId: string,
  liveId: string,
  fileName?: string
): Promise<string | null> => {
  try {
    if (!fileUri.startsWith('file://')) {
      return fileUri;
    }

    const baseName = fileName || 'cover';
    const targetFileName = buildFileName(fileUri, baseName);
    const baseDir = getBaseDir();
    const tickemoDir = getTickemoDir();
    
    // FileSystemが利用できない場合は元のURIをそのまま返す
    if (!baseDir) {
      console.warn('FileSystem not available, using original URI:', fileUri, {
        documentDirectory: FileSystem.documentDirectory,
        cacheDirectory: (FileSystem as any).cacheDirectory,
      });
      return fileUri;
    }

    const relativePath = toRelativePath(liveId, targetFileName);
    const rootDir = tickemoDir || baseDir;
    const directory = `${rootDir}lives/${liveId}`;
    const targetPath = `${rootDir}lives/${liveId}/${targetFileName}`;

    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    await FileSystem.copyAsync({ from: fileUri, to: targetPath });
    return relativePath;

  } catch (error) {
    console.error('Image save failed:', error);
    // エラー時も元のURIを返す（nullではなく）
    return fileUri;
  }
};

export const migrateLegacyImagesToTickemo = async (): Promise<void> => {
  try {
    const tickemoDir = getTickemoDir();
    const legacyDir = getLegacyLivesDir();
    if (!tickemoDir || !legacyDir) return;

    const legacyInfo = await FileSystem.getInfoAsync(legacyDir);
    if (!legacyInfo.exists) return;

    await FileSystem.makeDirectoryAsync(`${tickemoDir}lives`, { intermediates: true });

    const liveIds = await FileSystem.readDirectoryAsync(legacyDir);
    for (const liveId of liveIds) {
      const legacyLiveDir = `${legacyDir}/${liveId}`;
      const legacyLiveInfo = await FileSystem.getInfoAsync(legacyLiveDir);
      if (!legacyLiveInfo.exists || !legacyLiveInfo.isDirectory) {
        continue;
      }

      const targetLiveDir = `${tickemoDir}lives/${liveId}`;
      await FileSystem.makeDirectoryAsync(targetLiveDir, { intermediates: true });

      const files = await FileSystem.readDirectoryAsync(legacyLiveDir);
      for (const file of files) {
        const sourcePath = `${legacyLiveDir}/${file}`;
        const targetPath = `${targetLiveDir}/${file}`;
        const targetInfo = await FileSystem.getInfoAsync(targetPath);
        if (!targetInfo.exists) {
          await FileSystem.copyAsync({ from: sourcePath, to: targetPath });
        }
      }
    }
  } catch (error) {
    console.log('Legacy image migration failed:', error);
  }
};

/**
 * 複数の画像をアップロード
 * @param fileUris - ImagePicker から取得したファイルURIの配列
 * @param userId - ユーザーID
 * @param liveId - ライブID（ストレージパス内でのグループ化に使用）
 * @returns アップロード後のURLの配列
 */
export const uploadMultipleImages = async (
  fileUris: string[],
  userId: string,
  liveId: string,
  albumName?: string,
  previousImageCount?: number,
  totalImageCount?: number
): Promise<{ imageUrls: string[]; assetIds: Array<string | null> }> => {
  const uploadPromises = fileUris.map((uri, index) => {
    const baseName = index === 0 ? 'cover' : `image-${index + 1}`;
    return uploadImage(uri, userId, liveId, baseName);
  });

  const results = await Promise.all(uploadPromises);
  const imageUrls: string[] = [];
  const assetIds: Array<string | null> = [];
  results.forEach((url, index) => {
    if (!url) return;
    imageUrls.push(url);
    assetIds.push(null);
  });

  return { imageUrls, assetIds };
};

/**
 * ローカル画像を削除
 * @param storagePath - ローカルパス
 */
export const deleteImage = async (storagePath: string): Promise<boolean> => {
  try {
    if (!storagePath) return true;
    const localPath = storagePath.startsWith('file://')
      ? storagePath
      : resolveLocalImageUri(storagePath);
    if (!localPath) return true;
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    }
    return true;
  } catch (error) {
    console.error('Image deletion failed:', error);
    return false;
  }
};

export const deleteLiveImages = async (liveId: string): Promise<void> => {
  try {
    const baseDir = getBaseDir();
    const tickemoDir = getTickemoDir();
    if (tickemoDir) {
      await FileSystem.deleteAsync(`${tickemoDir}lives/${liveId}`, { idempotent: true });
    }
    if (baseDir) {
      await FileSystem.deleteAsync(`${baseDir}lives/${liveId}`, { idempotent: true });
    }
  } catch (error) {
    console.log('Local image folder delete failed:', error);
  }
};
