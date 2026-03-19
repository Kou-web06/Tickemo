import AsyncStorage from '@react-native-async-storage/async-storage';

export const THEME_PREFERENCE_KEY = '@theme_dark_mode';

let cachedThemePreference: boolean | null = null;
let themePreferenceHydrated = false;

export const getCachedThemePreference = (): boolean | null | undefined => {
  return themePreferenceHydrated ? cachedThemePreference : undefined;
};

export const hydrateThemePreference = async (): Promise<boolean | null> => {
  if (themePreferenceHydrated) {
    return cachedThemePreference;
  }

  try {
    const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    cachedThemePreference = stored === null ? null : stored === '1';
  } catch {
    cachedThemePreference = null;
  } finally {
    themePreferenceHydrated = true;
  }

  return cachedThemePreference;
};

export const setThemePreferenceCache = (next: boolean | null) => {
  cachedThemePreference = next;
  themePreferenceHydrated = true;
};

export const saveThemePreference = async (next: boolean) => {
  setThemePreferenceCache(next);
  await AsyncStorage.setItem(THEME_PREFERENCE_KEY, next ? '1' : '0');
};
