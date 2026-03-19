import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type AppThemeColors } from './colors';

export const useTheme = (): {
  theme: AppThemeColors;
  colorScheme: 'light' | 'dark';
  isDark: boolean;
} => {
  const osScheme = useColorScheme();
  const colorScheme: 'light' | 'dark' = osScheme === 'dark' ? 'dark' : 'light';

  const theme = useMemo<AppThemeColors>(
    () => (colorScheme === 'dark' ? darkTheme : lightTheme),
    [colorScheme]
  );

  return {
    theme,
    colorScheme,
    isDark: colorScheme === 'dark',
  };
};
