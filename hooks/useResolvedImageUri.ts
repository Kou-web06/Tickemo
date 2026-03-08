import { useEffect, useState } from 'react';
import { resolveStoredImageUri, normalizeStoredImageUri, resolveLocalImageUri } from '../lib/imageUpload';
import { pullImageFromCloud } from '../lib/icloudImageSync';

const NO_IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">' +
  '<rect width="300" height="300" fill="#1a1a1a" />' +
  '<rect x="24" y="24" width="252" height="252" rx="20" ry="20" fill="#2a2a2a" stroke="#3a3a3a" stroke-width="4" />' +
  '<text x="150" y="160" font-size="28" font-family="Arial, sans-serif" fill="#b3b3b3" text-anchor="middle">NO IMAGE</text>' +
  '</svg>';

export const NO_IMAGE_URI = `data:image/svg+xml;utf8,${encodeURIComponent(NO_IMAGE_SVG)}`;

export const useResolvedImageUri = (savedUri?: string, assetId?: string | null) => {
  const [resolvedUri, setResolvedUri] = useState<string | null>(savedUri ?? null);

  useEffect(() => {
    let isActive = true;

    const resolve = async () => {
      if (!savedUri && !assetId) {
        if (isActive) setResolvedUri(null);
        return;
      }

      const uri = await resolveStoredImageUri(savedUri, assetId);
      
      // ローカルファイルが見つからず、iCloud 相対パスの場合は pull を試みる
      if (!uri && savedUri) {
        const normalized = normalizeStoredImageUri(savedUri) || savedUri;
        if (normalized.startsWith('Tickemo/')) {
          try {
            const pulled = await pullImageFromCloud(normalized);
            if (pulled) {
              const resolvedAfterPull = resolveLocalImageUri(normalized) || '';
              if (isActive) {
                setResolvedUri(resolvedAfterPull || null);
              }
              return;
            }
          } catch (error) {
            console.log('[useResolvedImageUri] iCloud pull failed:', error);
          }
        }
      }
      
      if (isActive) {
        const normalizedSaved = savedUri ? (normalizeStoredImageUri(savedUri) || savedUri) : '';
        const isRenderableSavedUri = Boolean(
          normalizedSaved &&
          (normalizedSaved.startsWith('file://') ||
            normalizedSaved.startsWith('http://') ||
            normalizedSaved.startsWith('https://') ||
            normalizedSaved.startsWith('data:'))
        );

        if (uri) {
          setResolvedUri(uri);
        } else if (isRenderableSavedUri) {
          setResolvedUri(normalizedSaved);
        } else {
          setResolvedUri(null);
        }
      }
    };

    resolve();

    return () => {
      isActive = false;
    };
  }, [savedUri, assetId]);

  return resolvedUri;
};

export const useResolvedImageUris = (savedUris?: string[], assetIds?: Array<string | null | undefined>) => {
  const [resolvedUris, setResolvedUris] = useState<string[]>(savedUris ?? []);

  useEffect(() => {
    let isActive = true;

    const resolveAll = async () => {
      if (!savedUris || savedUris.length === 0) {
        if (isActive) setResolvedUris([]);
        return;
      }

      const resolved = await Promise.all(
        savedUris.map(async (uri, index) => {
          const resolved = await resolveStoredImageUri(uri, assetIds?.[index]);
          
          // ローカルファイルが見つからず、iCloud 相対パスの場合は pull を試みる
          if (!resolved && uri) {
            const normalized = normalizeStoredImageUri(uri) || uri;
            if (normalized.startsWith('Tickemo/')) {
              try {
                const pulled = await pullImageFromCloud(normalized);
                if (pulled) {
                  return resolveLocalImageUri(normalized) || null;
                }
              } catch (error) {
                console.log('[useResolvedImageUris] iCloud pull failed for:', uri);
              }
            }
          }
          
          return resolved;
        })
      );
      const finalUris = resolved.map((uri, index) => {
        if (uri) return uri;

        const saved = savedUris[index] ?? '';
        const normalizedSaved = normalizeStoredImageUri(saved) || saved;
        const isRenderableSavedUri = Boolean(
          normalizedSaved &&
          (normalizedSaved.startsWith('file://') ||
            normalizedSaved.startsWith('http://') ||
            normalizedSaved.startsWith('https://') ||
            normalizedSaved.startsWith('data:'))
        );

        return isRenderableSavedUri ? normalizedSaved : NO_IMAGE_URI;
      });
      if (isActive) {
        setResolvedUris(finalUris);
      }
    };

    resolveAll();

    return () => {
      isActive = false;
    };
  }, [savedUris, assetIds]);

  return resolvedUris;
};
