/**
 * Apple Music API ヘルパー関数
 * https://developer.apple.com/documentation/applemusicapi
 */

export interface AppleMusicSong {
  id: string;
  type: 'songs';
  attributes: {
    name: string;
    artistName: string;
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
 * @param artistName アーティスト名
 * @param developerToken JWT Developer Token
 * @param limit 取得する曲数（デフォルト: 20）
 * @returns 楽曲の配列
 */
export async function searchAppleMusicSongs(
  artistName: string,
  developerToken: string,
  limit: number = 20
): Promise<AppleMusicSong[]> {
  try {
    // console.log('[Apple Music API] Searching for artist:', artistName);
    
    const url = `https://api.music.apple.com/v1/catalog/jp/search?term=${encodeURIComponent(
      artistName
    )}&types=songs&limit=${limit}`;

    // console.log('[Apple Music API] URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${developerToken}`,
        'Content-Type': 'application/json',
      },
    });

    // console.log('[Apple Music API] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Apple Music API] Error response:', errorText);
      throw new Error(`Apple Music API error: ${response.status} - ${errorText}`);
    }

    const data: AppleMusicSearchResponse = await response.json();
    // console.log('[Apple Music API] Response data:', data);
    
    const songs = data.results.songs?.data || [];
    // console.log('[Apple Music API] Found songs:', songs.length);
    
    return songs;
  } catch (error) {
    console.error('[Apple Music API] Search error:', error);
    return [];
  }
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
  try {
    const url = `https://api.music.apple.com/v1/catalog/jp/search?term=${encodeURIComponent(
      term
    )}&types=artists&limit=${limit}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${developerToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Apple Music API] Artist search error:', errorText);
      throw new Error(`Apple Music API error: ${response.status}`);
    }

    const data: AppleMusicSearchResponse = await response.json();
    return data.results.artists?.data || [];
  } catch (error) {
    console.error('[Apple Music API] Artist search error:', error);
    return [];
  }
}
