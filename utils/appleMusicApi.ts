/**
 * Apple Music API ヘルパー関数
 * https://developer.apple.com/documentation/applemusicapi
 */

const APPLE_MUSIC_STOREFRONT = 'jp';
const APPLE_MUSIC_LOCALE = 'ja-JP';
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

type SearchCacheEntry<T> = {
  expiresAt: number;
  data: T;
};

const songSearchCache = new Map<string, SearchCacheEntry<AppleMusicSong[]>>();
const artistSearchCache = new Map<string, SearchCacheEntry<AppleMusicArtist[]>>();
const songSearchInFlight = new Map<string, Promise<AppleMusicSong[]>>();
const artistSearchInFlight = new Map<string, Promise<AppleMusicArtist[]>>();

const buildSearchCacheKey = (term: string, limit: number) => {
  return `${term.trim().toLowerCase()}::${limit}::${APPLE_MUSIC_STOREFRONT}::${APPLE_MUSIC_LOCALE}`;
};

export const getAppleMusicLocale = (): string => APPLE_MUSIC_LOCALE;

export const getAppleMusicStorefront = (): string => APPLE_MUSIC_STOREFRONT;

const buildAppleMusicCatalogSearchUrl = (
  term: string,
  type: 'songs' | 'artists',
  limit: number
) => {
  return `https://api.music.apple.com/v1/catalog/${APPLE_MUSIC_STOREFRONT}/search?term=${encodeURIComponent(
    term
  )}&types=${type}&limit=${limit}&l=${encodeURIComponent(APPLE_MUSIC_LOCALE)}`;
};

export const getAppleMusicSongUrl = (songId: string): string => {
  return `https://music.apple.com/${APPLE_MUSIC_STOREFRONT}/song/${songId}?l=${encodeURIComponent(APPLE_MUSIC_LOCALE)}`;
};

export interface AppleMusicSong {
  id: string;
  type: 'songs';
  attributes: {
    name: string;
    artistName: string;
    albumName?: string;
    releaseDate?: string;
    genreNames?: string[];
    durationInMillis?: number;
    artwork: {
      width: number;
      height: number;
      url: string; // {w}x{h}bb.jpg形式のテンプレートURL
    };
    previews?: Array<{
      url: string;
    }>;
    playParams?: {
      id: string;
      kind: string;
    };
  };
}

export interface AppleMusicArtist {
  id: string;
  type: 'artists';
  attributes: {
    name: string;
    artwork?: {
      width: number;
      height: number;
      url: string;
    };
    url?: string;
  };
}

export interface AppleMusicSearchResponse {
  results: {
    songs?: {
      data: AppleMusicSong[];
    };
    artists?: {
      data: AppleMusicArtist[];
    };
  };
}

/**
 * Apple Music APIで楽曲を検索
 * @param term 検索キーワード
 * @param developerToken JWT Developer Token
 * @param limit 取得する曲数（デフォルト: 20）
 * @returns 楽曲の配列
 */
export async function searchAppleMusicSongs(
  term: string,
  developerToken: string,
  limit: number = 20
): Promise<AppleMusicSong[]> {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) {
    return [];
  }

  const cacheKey = buildSearchCacheKey(normalizedTerm, limit);
  const now = Date.now();
  const cached = songSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const inFlight = songSearchInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const requestPromise = (async () => {
    try {
      const url = buildAppleMusicCatalogSearchUrl(normalizedTerm, 'songs', limit);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${developerToken}`,
          'Content-Type': 'application/json',
          'Accept-Language': APPLE_MUSIC_LOCALE,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Apple Music API] Error response:', errorText);
        throw new Error(`Apple Music API error: ${response.status} - ${errorText}`);
      }

      const data: AppleMusicSearchResponse = await response.json();
      const songs = data.results.songs?.data || [];

      songSearchCache.set(cacheKey, {
        data: songs,
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      });

      return songs;
    } catch (error) {
      console.error('[Apple Music API] Search error:', error);
      return [];
    } finally {
      songSearchInFlight.delete(cacheKey);
    }
  })();

  songSearchInFlight.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * アートワークURLを指定サイズに変換
 * @param templateUrl Apple MusicのアートワークテンプレートURL
 * @param size 正方形のサイズ（例: 600）
 * @returns 実際のURL
 */
export function getArtworkUrl(templateUrl: string, size: number = 600): string {
  return templateUrl.replace('{w}', size.toString()).replace('{h}', size.toString());
}

/**
 * Apple Music APIでアーティストを検索
 * @param term 検索キーワード
 * @param developerToken JWT Developer Token
 * @param limit 取得するアーティスト数（デフォルト: 10）
 * @returns アーティストの配列
 */
export async function searchAppleMusicArtists(
  term: string,
  developerToken: string,
  limit: number = 10
): Promise<AppleMusicArtist[]> {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) {
    return [];
  }

  const cacheKey = buildSearchCacheKey(normalizedTerm, limit);
  const now = Date.now();
  const cached = artistSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const inFlight = artistSearchInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const requestPromise = (async () => {
    try {
      const url = buildAppleMusicCatalogSearchUrl(normalizedTerm, 'artists', limit);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${developerToken}`,
          'Content-Type': 'application/json',
          'Accept-Language': APPLE_MUSIC_LOCALE,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Apple Music API] Artist search error:', errorText);
        throw new Error(`Apple Music API error: ${response.status}`);
      }

      const data: AppleMusicSearchResponse = await response.json();
      const artists = data.results.artists?.data || [];

      artistSearchCache.set(cacheKey, {
        data: artists,
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      });

      return artists;
    } catch (error) {
      console.error('[Apple Music API] Artist search error:', error);
      return [];
    } finally {
      artistSearchInFlight.delete(cacheKey);
    }
  })();

  artistSearchInFlight.set(cacheKey, requestPromise);
  return requestPromise;
}
