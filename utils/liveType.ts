export const LIVE_TYPE_KEYS = ['one-man', 'two-man', 'festival', 'fc-only', 'streaming'] as const;

export type LiveTypeKey = (typeof LIVE_TYPE_KEYS)[number];

const LEGACY_LIVE_TYPE_MAP: Record<string, LiveTypeKey> = {
  ワンマン: 'one-man',
  対バン: 'two-man',
  フェス: 'festival',
  FC限定: 'fc-only',
  'One-man': 'one-man',
  'Two-man': 'two-man',
  Festival: 'festival',
  'FC Only': 'fc-only',
  配信: 'streaming',
  Streaming: 'streaming',
};

const LIVE_TYPE_INDEX_MAP: Record<LiveTypeKey, number> = {
  'one-man': 0,
  'two-man': 1,
  festival: 2,
  'fc-only': 3,
  streaming: 4,
};

export const LIVE_TYPE_ICON_MAP: Record<LiveTypeKey, string> = {
  'one-man': 'account',
  'two-man': 'account-multiple',
  festival: 'account-group',
  'fc-only': 'account-star',
  streaming: 'radio',
};

export const normalizeLiveType = (value?: string): LiveTypeKey => {
  if (!value) return 'one-man';
  if (LIVE_TYPE_KEYS.includes(value as LiveTypeKey)) {
    return value as LiveTypeKey;
  }
  return LEGACY_LIVE_TYPE_MAP[value] ?? 'one-man';
};

export const getLiveTypeLabel = (value: string | undefined, labels: string[]): string => {
  const normalized = normalizeLiveType(value);
  return labels[LIVE_TYPE_INDEX_MAP[normalized]] ?? labels[0] ?? '';
};
