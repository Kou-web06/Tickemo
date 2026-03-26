import { Linking } from 'react-native';

const SPOTIFY_DEEP_LINK_PREFIX = 'spotify:search:';
const SPOTIFY_WEB_SEARCH_PREFIX = 'https://open.spotify.com/search/';

const normalizeSpotifySearchQuery = (songName: string, artistName: string) => {
  return `${songName || ''} ${artistName || ''}`.trim();
};

export const buildSpotifySearchLinks = (songName: string, artistName: string) => {
  const query = normalizeSpotifySearchQuery(songName, artistName);
  const encodedQuery = encodeURIComponent(query);

  return {
    query,
    encodedQuery,
    deepLinkUrl: `${SPOTIFY_DEEP_LINK_PREFIX}${encodedQuery}`,
    webFallbackUrl: `${SPOTIFY_WEB_SEARCH_PREFIX}${encodedQuery}`,
  };
};

export const openSpotifySearch = async (songName: string, artistName: string): Promise<boolean> => {
  const { query, deepLinkUrl, webFallbackUrl } = buildSpotifySearchLinks(songName, artistName);
  if (!query) {
    return false;
  }

  try {
    const canOpenApp = await Linking.canOpenURL(deepLinkUrl);
    if (canOpenApp) {
      await Linking.openURL(deepLinkUrl);
      return true;
    }
  } catch {
    // Try web fallback below.
  }

  try {
    await Linking.openURL(webFallbackUrl);
    return true;
  } catch {
    return false;
  }
};

// Backward-compatible export kept for older call sites.
export const searchSpotifyTrackId = async (_songName: string, _artistName: string): Promise<string | null> => {
  return null;
};

// Backward-compatible export kept for older call sites.
export const buildSpotifyCommunityFallbackUrl = (trackId: string) => {
  return `https://open.spotify.com/track/${trackId}`;
};
