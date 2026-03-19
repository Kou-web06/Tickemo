export type AppThemeColors = {
  background: string;
  text: string;
  subText: string;
  card: string;
  primary: string;
};

export const lightTheme: AppThemeColors = {
  background: '#F8F8F8',
  text: '#1E1E1E',
  subText: '#6E6E73',
  card: '#FFFFFF',
  primary: '#A328DD',
};

export const darkTheme: AppThemeColors = {
  // Keep this dark gray for eye comfort instead of pure black.
  background: '#121212',
  text: '#F5F5F7',
  subText: '#A1A1AA',
  card: '#1A1A1A',
  primary: '#A328DD',
};
