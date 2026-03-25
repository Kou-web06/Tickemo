import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import type { SetlistItem } from '../types/setlist';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_REDIRECT_URI = 'tickemo://spotify-auth';
const SPOTIFY_SCOPES = [
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-private',
  'user-read-private',
];
const SPOTIFY_TOKEN_STORAGE_KEY = 'spotify_user_token';
const SPOTIFY_REFRESH_TOKEN_STORAGE_KEY = 'spotify_refresh_token';

const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: SPOTIFY_AUTH_URL,
  tokenEndpoint: SPOTIFY_TOKEN_URL,
};

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type SpotifySearchResponse = {
  tracks?: {
    items?: Array<{
      id: string;
      uri: string;
      name: string;
      artists?: Array<{ name: string }>;
    }>;
  };
};

type CachedSpotifyToken = {
  accessToken: string;
  expiresAt: number;
};

type SpotifyUserTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type StoredSpotifyUserToken = {
  accessToken: string;
  expiresAt: number;
  scopes?: string[];
};

const hasRequiredScopes = (scopes: string[] | undefined) => {
  if (!scopes || scopes.length === 0) {
    return false;
  }
  return SPOTIFY_SCOPES.every((required) => scopes.includes(required));
};

type SpotifyUserProfile = {
  id: string;
  display_name: string;
  email?: string;
  product?: string;
  country?: string;
  explicit_content?: {
    filter_enabled?: boolean;
    filter_locked?: boolean;
  };
};

type SpotifyPlaylistResponse = {
  id: string;
  uri: string;
  owner?: {
    id?: string;
  };
  external_urls?: {
    spotify?: string;
  };
};

type SpotifyAddTracksResponse = {
  snapshot_id: string;
  addedCount?: number;
  failedUris?: string[];
};

export type SpotifyPlaylistCreationResult = {
  playlistId: string;
  playlistUri: string;
  playlistUrl: string;
  matchedTrackCount: number;
};

let cachedToken: CachedSpotifyToken | null = null;

const getSpotifyCredentials = () => {
  const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';
  const clientSecret = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials are not configured.');
  }

  return { clientId, clientSecret };
};

const getSpotifyClientId = () => {
  const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';
  if (!clientId) {
    throw new Error('Spotify client ID is not configured.');
  }
  return clientId;
};

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const fetchSpotifyWithRateLimit = async (
  url: string,
  init: RequestInit,
  retries: number = 2
): Promise<Response> => {
  const response = await fetch(url, init);
  if (response.status !== 429 || retries <= 0) {
    return response;
  }

  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds = Number(retryAfterHeader || '1');
  const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 1000;
  await sleep(waitMs);
  return fetchSpotifyWithRateLimit(url, init, retries - 1);
};

const getSpotifyAccessToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret } = getSpotifyCredentials();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify token request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as SpotifyTokenResponse;
  if (!data.access_token) {
    throw new Error('Spotify token response did not include access_token.');
  }

  const ttlMs = Math.max(0, (data.expires_in - 60) * 1000);
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + ttlMs,
  };

  return data.access_token;
};

// ===== User Auth (Authorization Code Flow) =====

export const initiateSpotifyAuth = async (): Promise<string> => {
  const clientId = getSpotifyClientId();
  const redirectUrl = SPOTIFY_REDIRECT_URI;

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: SPOTIFY_SCOPES,
    redirectUri: redirectUrl,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(SPOTIFY_DISCOVERY);

  if (result.type !== 'success') {
    const paramsText = 'params' in result && result.params ? JSON.stringify(result.params) : '';
    throw new Error(`Spotify auth failed (type=${result.type}) ${paramsText}`.trim());
  }

  const authCode = (result.params as Record<string, string>).code;
  if (!authCode) {
    throw new Error('No auth code received from Spotify');
  }

  if (!request.codeVerifier) {
    throw new Error('Missing PKCE code_verifier.');
  }

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: authCode,
      redirectUri: redirectUrl,
      extraParams: {
        code_verifier: request.codeVerifier,
      },
    },
    SPOTIFY_DISCOVERY
  );

  if (!tokenResponse.accessToken) {
    throw new Error('No access token in exchange response.');
  }

  const grantedScopesRaw = tokenResponse.scope || '';
  const grantedScopes = grantedScopesRaw.split(' ').map((scope) => scope.trim()).filter(Boolean);
  console.log('[Spotify] granted scopes', grantedScopes);
  if (!hasRequiredScopes(grantedScopes)) {
    throw new Error(`Spotify token missing required scopes: ${SPOTIFY_SCOPES.join(', ')}`);
  }

  const expiresAt = Date.now() + Math.max(0, (tokenResponse.expiresIn || 3600) - 60) * 1000;
  const stored: StoredSpotifyUserToken = {
    accessToken: tokenResponse.accessToken,
    expiresAt,
    scopes: grantedScopes,
  };
  await AsyncStorage.setItem(SPOTIFY_TOKEN_STORAGE_KEY, JSON.stringify(stored));

  if (tokenResponse.refreshToken) {
    await AsyncStorage.setItem(SPOTIFY_REFRESH_TOKEN_STORAGE_KEY, tokenResponse.refreshToken);
  }

  return tokenResponse.accessToken;
};

export const getStoredSpotifyUserToken = async (): Promise<string | null> => {
  try {
    const stored = await AsyncStorage.getItem(SPOTIFY_TOKEN_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as StoredSpotifyUserToken;
    const { accessToken, expiresAt } = parsed;
    if (Date.now() < expiresAt) {
      if (!hasRequiredScopes(parsed.scopes)) {
        await AsyncStorage.removeItem(SPOTIFY_TOKEN_STORAGE_KEY);
        return null;
      }
      return accessToken;
    }

    const clientId = getSpotifyClientId();
    const refreshToken = await AsyncStorage.getItem(SPOTIFY_REFRESH_TOKEN_STORAGE_KEY);
    if (!refreshToken) {
      await AsyncStorage.removeItem(SPOTIFY_TOKEN_STORAGE_KEY);
      return null;
    }

    const refreshed = await AuthSession.refreshAsync(
      {
        clientId,
        refreshToken,
      },
      SPOTIFY_DISCOVERY
    );

    if (!refreshed.accessToken) {
      await AsyncStorage.removeItem(SPOTIFY_TOKEN_STORAGE_KEY);
      return null;
    }

    await AsyncStorage.setItem(
      SPOTIFY_TOKEN_STORAGE_KEY,
      JSON.stringify({
        accessToken: refreshed.accessToken,
        expiresAt: Date.now() + Math.max(0, (refreshed.expiresIn || 3600) - 60) * 1000,
        scopes: refreshed.scope ? refreshed.scope.split(' ').map((scope) => scope.trim()).filter(Boolean) : undefined,
      })
    );

    if (refreshed.refreshToken) {
      await AsyncStorage.setItem(SPOTIFY_REFRESH_TOKEN_STORAGE_KEY, refreshed.refreshToken);
    }

    return refreshed.accessToken;
  } catch (error) {
    console.warn('Error getting Spotify user token:', error);
    return null;
  }
};

export const clearSpotifyUserToken = async () => {
  await AsyncStorage.removeItem(SPOTIFY_TOKEN_STORAGE_KEY);
  await AsyncStorage.removeItem(SPOTIFY_REFRESH_TOKEN_STORAGE_KEY);
};

// ===== API Methods =====

export const searchSpotifyTrackId = async (songName: string, artistName: string): Promise<string | null> => {
  const query = `${songName || ''} ${artistName || ''}`.trim();
  if (!query) {
    return null;
  }

  const runSearch = async (accessToken: string, useFromTokenMarket: boolean) => {
    const searchParams = new URLSearchParams({
      q: query,
      type: 'track',
      limit: '1',
    });
    if (useFromTokenMarket) {
      searchParams.set('market', 'from_token');
    }

    const response = await fetch(`${SPOTIFY_SEARCH_URL}?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Spotify Search] Query: "${query}", Status: ${response.status}, Error: ${errorText}`);
      throw new Error(`Spotify search request failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as SpotifySearchResponse;
    const trackId = data.tracks?.items?.[0]?.id;
    return trackId || null;
  };

  // Try user OAuth token first if available
  let accessToken: string | null = null;
  let usedUserToken = false;
  try {
    accessToken = await getStoredSpotifyUserToken();
    usedUserToken = Boolean(accessToken);
  } catch (e) {
    console.warn('Failed to get stored user token, falling back to Client Credentials:', e);
  }

  // Fall back to Client Credentials if user token unavailable
  if (!accessToken) {
    try {
      accessToken = await getSpotifyAccessToken();
    } catch (e) {
      console.error('Failed to get Client Credentials token:', e);
      throw new Error('Unable to obtain Spotify access token');
    }
  }

  try {
    return await runSearch(accessToken, usedUserToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const insufficientScope = message.includes('403') && message.includes('Insufficient client scope');

    // If user token scope is not enough, retry once with client-credentials token and no from_token market.
    if (usedUserToken && insufficientScope) {
      const fallbackToken = await getSpotifyAccessToken();
      return runSearch(fallbackToken, false);
    }

    throw error;
  }
};

export const buildSpotifyCommunityFallbackUrl = (trackId: string) => {
  return `https://open.spotify.com/track/${trackId}`;
};

export const getUserProfile = async (userAccessToken: string): Promise<SpotifyUserProfile> => {
  const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get user profile: ${response.status} ${errorText}`);
  }

  return (await response.json()) as SpotifyUserProfile;
};

export const createPlaylist = async (
  userAccessToken: string,
  userId: string,
  playlistName: string,
  isPublic: boolean = false
): Promise<SpotifyPlaylistResponse> => {
  const body = JSON.stringify({
    name: playlistName,
    public: isPublic,
    description: `Created by Tickemo`,
  });

  const response = await fetch(`${SPOTIFY_API_BASE}/me/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403) {
      throw new Error(
        `Failed to create playlist: ${response.status} ${errorText} | Check: scopes(${SPOTIFY_SCOPES.join(', ')}), app mode(User Management), and re-consent.`
      );
    }
    throw new Error(`Failed to create playlist: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as SpotifyPlaylistResponse;
  console.log('[Spotify] playlist created', {
    playlistId: data.id,
    ownerId: data.owner?.id,
    requestedUserId: userId,
  });
  return data;
};

export const addTracksToPlaylist = async (
  userAccessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<SpotifyAddTracksResponse> => {
  const normalizedUris = trackUris
    .map((uri) => (uri || '').trim())
    .filter((uri) => /^spotify:track:[A-Za-z0-9]+$/.test(uri));

  console.log('[Spotify] addTracksToPlaylist payload check', {
    playlistId,
    originalCount: trackUris.length,
    validCount: normalizedUris.length,
    firstThree: normalizedUris.slice(0, 3),
  });

  if (normalizedUris.length === 0) {
    throw new Error('No valid Spotify track URIs to add.');
  }

  const body = JSON.stringify({
    uris: normalizedUris,
  });

  const response = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (response.ok) {
    const data = (await response.json()) as SpotifyAddTracksResponse;
    return {
      ...data,
      addedCount: normalizedUris.length,
      failedUris: [],
    };
  }

  const errorText = await response.text();

  if (response.status === 403 && normalizedUris.length > 1) {
    // Some tracks can be region/account-restricted even with valid scopes. Retry one-by-one and keep partial success.
    console.warn('[Spotify] batch add returned 403, fallback to per-track add');

    let lastSnapshotId = '';
    let addedCount = 0;
    const failedUris: string[] = [];

    for (const uri of normalizedUris) {
      const singleResponse = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [uri] }),
      });

      if (singleResponse.ok) {
        const singleData = (await singleResponse.json()) as SpotifyAddTracksResponse;
        lastSnapshotId = singleData.snapshot_id || lastSnapshotId;
        addedCount += 1;
      } else {
        const singleError = await singleResponse.text();
        failedUris.push(uri);
        console.warn('[Spotify] failed to add single track', {
          uri,
          status: singleResponse.status,
          error: singleError,
        });
      }

      await sleep(80);
    }

    console.log('[Spotify] per-track add result', {
      addedCount,
      failedCount: failedUris.length,
    });

    if (addedCount > 0) {
      return {
        snapshot_id: lastSnapshotId || 'partial-success',
        addedCount,
        failedUris,
      };
    }

    // Final fallback: try query-parameter mode (Spotify also supports uris in query string).
    console.warn('[Spotify] per-track add all failed, fallback to query-parameter mode');

    let querySnapshotId = '';
    let queryAddedCount = 0;
    const queryFailedUris: string[] = [];
    const chunkSize = 50;

    for (let i = 0; i < normalizedUris.length; i += chunkSize) {
      const chunk = normalizedUris.slice(i, i + chunkSize);
      const searchParams = new URLSearchParams();
      searchParams.set('uris', chunk.join(','));

      const chunkResponse = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?${searchParams.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      });

      if (chunkResponse.ok) {
        const chunkData = (await chunkResponse.json()) as SpotifyAddTracksResponse;
        querySnapshotId = chunkData.snapshot_id || querySnapshotId;
        queryAddedCount += chunk.length;
      } else {
        const chunkError = await chunkResponse.text();
        queryFailedUris.push(...chunk);
        console.warn('[Spotify] query-mode chunk failed', {
          status: chunkResponse.status,
          error: chunkError,
          chunkSize: chunk.length,
        });
      }

      await sleep(120);
    }

    if (queryAddedCount > 0) {
      return {
        snapshot_id: querySnapshotId || 'query-partial-success',
        addedCount: queryAddedCount,
        failedUris: queryFailedUris,
      };
    }

    // Final fallback 2: replace playlist items with PUT (some accounts/apps reject POST but accept PUT).
    console.warn('[Spotify] query-mode failed, fallback to PUT replace mode');
    const putBody = JSON.stringify({ uris: normalizedUris });
    const putResponse = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: putBody,
    });

    if (putResponse.ok) {
      const putData = (await putResponse.json()) as SpotifyAddTracksResponse;
      console.log('[Spotify] PUT replace mode succeeded', {
        playlistId,
        addedCount: normalizedUris.length,
      });
      return {
        ...putData,
        addedCount: normalizedUris.length,
        failedUris: [],
      };
    }

    const putError = await putResponse.text();
    console.warn('[Spotify] PUT replace mode failed', {
      status: putResponse.status,
      error: putError,
    });
  }

  if (response.status === 403) {
    throw new Error(
      `Failed to add tracks to playlist: ${response.status} ${errorText} | Spotify account/app policy likely blocks write operations (Users and Access / app mode / account restriction).`
    );
  }

  throw new Error(`Failed to add tracks to playlist: ${response.status} ${errorText}`);
};

const searchSpotifyTrackUriWithUserToken = async (
  userAccessToken: string,
  songName: string,
  artistName: string
): Promise<string | null> => {
  const query = `track:${songName || ''} artist:${artistName || ''}`.trim();
  if (!query) {
    return null;
  }

  const searchParams = new URLSearchParams({
    q: query,
    type: 'track',
    limit: '1',
  });

  const response = await fetchSpotifyWithRateLimit(`${SPOTIFY_SEARCH_URL}?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify search request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as SpotifySearchResponse;
  return data.tracks?.items?.[0]?.uri || null;
};

const isMarkerLikeSong = (item: SetlistItem): boolean => {
  if (item.type !== 'song') {
    return true;
  }
  const raw = item.songName || '';
  const normalized = raw.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const keywords = ['SE', 'MC', 'ENCORE', 'SETTION', 'SECTION'];
  return keywords.some((keyword) => normalized.includes(keyword));
};

export const createPlaylistFromSetlist = async (
  setlistItems: SetlistItem[],
  artistName: string,
  liveName: string,
  liveDate: string
): Promise<SpotifyPlaylistCreationResult> => {
  const runWithToken = async (userAccessToken: string): Promise<SpotifyPlaylistCreationResult> => {
    // Step 2: Get profile
    const profile = await getUserProfile(userAccessToken);
    console.log('[Spotify] profile', {
      id: profile.id,
      product: profile.product,
      country: profile.country,
      explicitFilterEnabled: profile.explicit_content?.filter_enabled,
      explicitFilterLocked: profile.explicit_content?.filter_locked,
    });

    // Step 3: Create empty playlist (private first)
    const playlistName = `[Tickemo] ${liveName || 'Unknown Event'} - ${artistName || 'Unknown Artist'}`;
    let playlist = await createPlaylist(userAccessToken, profile.id, playlistName, false);

    // Step 4: Resolve song URIs with throttle
    const songs = setlistItems.filter((item) => !isMarkerLikeSong(item));
    const trackUris: string[] = [];

    for (const song of songs) {
      if (song.type !== 'song') {
        continue;
      }
      const trackUri = await searchSpotifyTrackUriWithUserToken(userAccessToken, song.songName, song.artistName || artistName);
      if (trackUri) {
        trackUris.push(trackUri);
      }
      // Gentle throttle to avoid 429 bursts
      await sleep(140);
    }

    // Step 5: Add tracks in batches
    if (trackUris.length > 0) {
      try {
        const chunkSize = 100;
        for (let i = 0; i < trackUris.length; i += chunkSize) {
          await addTracksToPlaylist(userAccessToken, playlist.id, trackUris.slice(i, i + chunkSize));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isForbidden = message.includes(' 403 ') || message.includes('Forbidden');
        if (!isForbidden) {
          throw error;
        }

        // Some accounts fail to write into private playlists via API despite valid modify scopes.
        // Retry once with a public playlist to avoid hard failure.
        console.warn('[Spotify] private playlist add failed with 403, retrying with public playlist');
        playlist = await createPlaylist(userAccessToken, profile.id, `${playlistName} [PUBLIC RETRY]`, true);

        const retryChunkSize = 100;
        for (let i = 0; i < trackUris.length; i += retryChunkSize) {
          await addTracksToPlaylist(userAccessToken, playlist.id, trackUris.slice(i, i + retryChunkSize));
        }
      }
    }

    return {
      playlistId: playlist.id,
      playlistUri: playlist.uri || `spotify:playlist:${playlist.id}`,
      playlistUrl: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
      matchedTrackCount: trackUris.length,
    };
  };

  // Step 1: User auth + token
  let userAccessToken = await getStoredSpotifyUserToken();
  if (!userAccessToken) {
    userAccessToken = await initiateSpotifyAuth();
  }

  try {
    return await runWithToken(userAccessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldReauth = message.includes(' 401 ') || message.includes(' 403 ');
    if (!shouldReauth) {
      throw error;
    }

    // Fallback: invalidate stale token and force fresh consent once.
    await clearSpotifyUserToken();
    const freshAccessToken = await initiateSpotifyAuth();
    return runWithToken(freshAccessToken);
  }
};

