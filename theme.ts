/**
 * Global Theme Configuration
 * All colors, fonts, spacing, shadows, and border radii are centralized here
 */

export const theme = {
  colors: {
    // Background colors
    background: {
      primary: '#000000',
      secondary: '#1C1C1E',
      card: '#FFFFFF',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    
    // Text colors
    text: {
      primary: '#FFFFFF',
      secondary: '#8E8E93',
      tertiary: '#48484A',
      inverse: '#000000',
    },
    
    // Accent colors
    accent: {
      primary: '#007AFF',
      secondary: '#5856D6',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
    },
    
    // Border colors
    border: {
      light: '#E5E5EA',
      medium: '#D1D1D6',
      dark: '#353535ff',
    },
    
    // Tab bar
    tabBar: {
      background: '#1C1C1E',
      activeIcon: '#FFFFFF',
      inactiveIcon: '#8E8E93',
    },
  },
  
  // Typography
  typography: {
    fontFamily: {
      regular: 'System',
      bold: 'System',
      aoharu: 'Aoharu',
    },
    fontSize: {
      xs: 10,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
      xxl: 20,
      xxxl: 24,
    },
    fontWeight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      black: '900' as const,
    },
  },
  
  // Spacing
  spacing: {
    xxxs: 0,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    xxxxl: 40,
    xxxxxl: 48,
  },
  
  // Border radius
  borderRadius: {
    sm: 25,
    md: 25,
    lg: 25,
    xl: 25,
    full: 9999,
  },
  
  // Shadows
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
  },
  
  // Card dimensions
  card: {
    aspectRatio: 3 / 4,
    padding: {
      top: 4,
      bottom: 4,
      horizontal: 4,
    },
    imageRadius: 25,
  },
  
  // Tab bar dimensions
  tabBar: {
    height: 64,
    borderRadius: 40,
    iconSize: 28,
    padding: 10,
    bottomOffset: 24,
  },
} as const;

export type Theme = typeof theme;
