/**
 * Color design tokens - Warm, modern palette inspired by design
 */

export const colors = {
  // Primary Colors (AudiobookShelf Blue)
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#007AFF',
    600: '#1E88E5',
    700: '#1976D2',
    800: '#1565C0',
    900: '#0D47A1',
  },

  // Warm Neutral Colors (Beige/Cream palette)
  neutral: {
    0: '#FFFFFF',
    50: '#FAF8F5',    // Very light cream
    100: '#F5F2ED',   // Light cream
    200: '#EDE8E0',   // Cream
    300: '#E0D8CC',   // Light beige
    400: '#C9BDB0',   // Beige
    500: '#A69885',   // Medium beige
    600: '#857A6B',   // Dark beige
    700: '#5C5449',   // Darker brown
    800: '#3D362E',   // Very dark brown
    900: '#2A241E',   // Almost black brown
    950: '#1A1612',   // Black brown
  },

  // Semantic Colors
  semantic: {
    success: '#4CAF50',
    successLight: '#81C784',
    successDark: '#388E3C',
    
    error: '#E53935',
    errorLight: '#EF5350',
    errorDark: '#C62828',
    
    warning: '#FFA726',
    warningLight: '#FFB74D',
    warningDark: '#F57C00',
    
    info: '#29B6F6',
    infoLight: '#4FC3F7',
    infoDark: '#0288D1',
  },

  // Background Colors (Warm tones)
  background: {
    primary: '#FAF8F5',      // Main background - light cream
    secondary: '#F5F2ED',    // Secondary background
    tertiary: '#EDE8E0',     // Tertiary background
    elevated: '#FFFFFF',     // Elevated cards
  },

  // Text Colors (Warm dark tones)
  text: {
    primary: '#2A241E',      // Almost black brown
    secondary: '#5C5449',    // Dark brown
    tertiary: '#857A6B',     // Medium brown
    disabled: '#C9BDB0',     // Light beige
    inverse: '#FFFFFF',      // White text
  },

  // Border Colors
  border: {
    light: '#F5F2ED',
    default: '#EDE8E0',
    dark: '#E0D8CC',
  },

  // Overlay Colors
  overlay: {
    light: 'rgba(42, 36, 30, 0.05)',
    medium: 'rgba(42, 36, 30, 0.15)',
    dark: 'rgba(42, 36, 30, 0.6)',
  },

  // Component-Specific Colors
  card: {
    background: '#FFFFFF',
    backgroundHover: '#FAF8F5',
    shadow: 'rgba(42, 36, 30, 0.08)',
  },

  progress: {
    background: '#EDE8E0',
    fill: '#007AFF',
  },

  // Status Colors
  status: {
    online: '#4CAF50',
    offline: '#A69885',
    away: '#FFA726',
  },
} as const;

export type ColorKey = keyof typeof colors;