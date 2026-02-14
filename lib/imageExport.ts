import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const getTickemoLivesDir = () => {
  const baseDir = FileSystem.documentDirectory;
  return baseDir ? `${baseDir}Tickemo/lives` : null;
};

const readAllFiles = async (dir: string, rootDir: string, zip: JSZip) => {
  const entries = await FileSystem.readDirectoryAsync(dir);
  for (const entry of entries) {
    const fullPath = `${dir}/${entry}`;
    const info = await FileSystem.getInfoAsync(fullPath);
    if (!info.exists) continue;

    if (info.isDirectory) {
      await readAllFiles(fullPath, rootDir, zip);
      continue;
    }

    const relativePath = fullPath.replace(`${rootDir}/`, '');
    const base64 = await FileSystem.readAsStringAsync(fullPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    zip.file(relativePath, base64, { base64: true });
  }
};

export const exportImagesZip = async (): Promise<void> => {
  const livesDir = getTickemoLivesDir();
  if (!livesDir) {
    throw new Error('Document directory not available');
  }

  const livesInfo = await FileSystem.getInfoAsync(livesDir);
  if (!livesInfo.exists) {
    throw new Error('No images directory');
  }

  const zip = new JSZip();
  await readAllFiles(livesDir, livesDir, zip);

  const files = Object.keys(zip.files);
  if (files.length === 0) {
    throw new Error('No images to export');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipPath = `${FileSystem.documentDirectory}Tickemo-images-${timestamp}.zip`;
  const zipBase64 = await zip.generateAsync({ type: 'base64' });
  await FileSystem.writeAsStringAsync(zipPath, zipBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing not available');
  }

  await Sharing.shareAsync(zipPath, {
    mimeType: 'application/zip',
    dialogTitle: 'Tickemo 画像を書き出す',
  });
};
