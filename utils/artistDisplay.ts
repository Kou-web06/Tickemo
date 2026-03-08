export interface ArtistDisplayResult {
  mainText: string;
  showAndMore: boolean;
}

const MAX_SAFE_ARTIST_TEXT_LENGTH = 25;

export const buildTicketArtistDisplay = (
  artists?: string[],
  fallbackArtist?: string
): ArtistDisplayResult => {
  const normalized = (artists && artists.length > 0 ? artists : [fallbackArtist ?? ''])
    .map((artist) => artist.trim())
    .filter((artist) => artist.length > 0);

  if (normalized.length === 0) {
    return {
      mainText: '-',
      showAndMore: false,
    };
  }

  if (normalized.length === 1) {
    return {
      mainText: normalized[0],
      showAndMore: false,
    };
  }

  const firstTwoJoined = `${normalized[0]} / ${normalized[1]}`;
  const shouldUseSafetyFallback = firstTwoJoined.length >= MAX_SAFE_ARTIST_TEXT_LENGTH;

  if (normalized.length === 2) {
    return {
      mainText: shouldUseSafetyFallback ? normalized[0] : firstTwoJoined,
      showAndMore: shouldUseSafetyFallback,
    };
  }

  return {
    mainText: shouldUseSafetyFallback ? normalized[0] : firstTwoJoined,
    showAndMore: true,
  };
};
