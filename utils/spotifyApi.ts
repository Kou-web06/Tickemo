const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type SpotifySearchResponse = {
  tracks?: {
    items?: Array<{
      id: string;
      name: string;
      artists?: Array<{ name: string }>;
    }>;
  };
};

type CachedSpotifyToken = {
  accessToken: string;
  expiresAt: number;
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

export const searchSpotifyTrackId = async (songName: string, artistName: string): Promise<string | null> => {
  const query = `${songName || ''} ${artistName || ''}`.trim();
  if (!query) {
    return null;
  }

  const accessToken = await getSpotifyAccessToken();
  const searchParams = new URLSearchParams({
    q: query,
    type: 'track',
    limit: '1',
  });

  const response = await fetch(`${SPOTIFY_SEARCH_URL}?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify search request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as SpotifySearchResponse;
  const trackId = data.tracks?.items?.[0]?.id;
  return trackId || null;
};

export const buildSpotifyCommunityFallbackUrl = (trackId: string) => {
  return `https://open.spotify.com/track/${trackId}`;
};
