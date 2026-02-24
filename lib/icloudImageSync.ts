import * as FileSystem from 'expo-file-system/legacy';
import { CloudStorage } from 'react-native-cloud-storage';

const getBaseDir = () => FileSystem.documentDirectory;

const toCloudPath = (relativePath: string) => {
  const trimmed = relativePath.replace(/^\/+/, '');
  if (trimmed.startsWith('Tickemo/')) {
    return `/${trimmed}`;
  }
  return `/Tickemo/${trimmed}`;
};

const toLocalPath = (relativePathOrUri: string) => {
  if (!relativePathOrUri) return '';
  if (relativePathOrUri.startsWith('file://')) return relativePathOrUri;
  if (relativePathOrUri.startsWith('http://') || relativePathOrUri.startsWith('https://')) return '';
  const baseDir = getBaseDir();
  if (!baseDir) return '';
  const trimmed = relativePathOrUri.replace(/^\/+/, '');
  return `${baseDir}${trimmed}`;
};

export const isTickemoRelativePath = (path: string) => {
  if (!path) return false;
  if (path.startsWith('file://')) return false;
  if (path.startsWith('http://') || path.startsWith('https://')) return false;
  return path.startsWith('Tickemo/');
};

export const pushImageToCloud = async (relativePath: string, localPathOverride?: string): Promise<boolean> => {
  try {
    if (!isTickemoRelativePath(relativePath)) return false;

    const localPath = localPathOverride || toLocalPath(relativePath);
    if (!localPath) return false;

    const info = await FileSystem.getInfoAsync(localPath);
    if (!info.exists) return false;

    console.log('[iCloudImageSync] Preparing to push:', { relativePath, localPath });

    const base64 = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[iCloudImageSync] Read file to base64, size:', base64.length);

    const cloudPath = toCloudPath(relativePath);
    const cloudDir = cloudPath.replace(/\/[^/]+$/, '');
    if (cloudDir) {
      try {
        await CloudStorage.mkdir(cloudDir);
        console.log('[iCloudImageSync] Created directory:', cloudDir);
      } catch (error) {
        // Directory might already exist; ignore
      }
    }
    await CloudStorage.writeFile(cloudPath, base64);
    console.log('[iCloudImageSync] Push succeeded:', cloudPath);
    return true;
  } catch (error) {
    console.log('[iCloudImageSync] Push failed:', { relativePath, error });
    return false;
  }
};

export const pullImageFromCloud = async (relativePath: string): Promise<boolean> => {
  try {
    if (!isTickemoRelativePath(relativePath)) return false;

    const localPath = toLocalPath(relativePath);
    if (!localPath) return false;

    const localInfo = await FileSystem.getInfoAsync(localPath);
    if (localInfo.exists) {
      console.log('[iCloudImageSync] Local file already exists, skipping pull:', relativePath);
      return true;
    }

    const cloudPath = toCloudPath(relativePath);
    console.log('[iCloudImageSync] Attempting to pull from cloud:', cloudPath);
    const exists = await CloudStorage.exists(cloudPath);
    if (!exists) {
      console.log('[iCloudImageSync] Cloud file does not exist:', cloudPath);
      return false;
    }

    console.log('[iCloudImageSync] Cloud file found, downloading...');
    const base64 = await CloudStorage.readFile(cloudPath);
    console.log('[iCloudImageSync] Downloaded base64, size:', base64.length);
    await FileSystem.makeDirectoryAsync(localPath.replace(/\/+[^/]+$/, ''), { intermediates: true });
    await FileSystem.writeAsStringAsync(localPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('[iCloudImageSync] Pull succeeded:', relativePath);
    return true;
  } catch (error) {
    console.log('[iCloudImageSync] Pull failed:', { relativePath, error });
    return false;
  }
};
