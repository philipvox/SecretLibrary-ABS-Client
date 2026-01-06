/**
 * src/shared/theme/themeStore.ts
 *
 * Theme store and hooks for dark/light mode.
 * Persisted to AsyncStorage.
 *
 * Usage:
 *   import { useTheme } from '@/shared/theme';
 *   const { colors, mode, toggleMode } = useTheme();
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, type ThemeColors } from './colors';
import { spacing, layout, radius, elevation, scale } from './spacing';
import { typography, fontSize } from './typography';

// =============================================================================
// TYPES
// =============================================================================

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

// =============================================================================
// THEME STORE
// =============================================================================

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light', // Default to light mode

      setMode: (mode: ThemeMode) => {
        set({ mode });
      },

      toggleMode: () => {
        const current = get().mode;
        set({ mode: current === 'light' ? 'dark' : 'light' });
      },
    }),
    {
      name: 'theme-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// =============================================================================
// THEME HOOKS
// =============================================================================

/**
 * Main theme hook - returns everything needed for theming
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { colors, mode, toggleMode, spacing, typography } = useTheme();
 *
 *   return (
 *     <View style={{ backgroundColor: colors.background.primary }}>
 *       <Text style={{ color: colors.text.primary }}>Hello</Text>
 *       <Button onPress={toggleMode}>Toggle Theme</Button>
 *     </View>
 *   );
 * }
 * ```
 */
export function useTheme() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const toggleMode = useThemeStore((state) => state.toggleMode);

  const colors: ThemeColors = mode === 'light' ? lightColors : darkColors;
  const isDark = mode === 'dark';

  return {
    // Colors
    colors,
    // Mode info
    mode,
    isDark,
    // Mode setters
    setMode,
    toggleMode,
    // Design tokens (convenience exports)
    spacing,
    layout,
    radius,
    elevation,
    typography,
    fontSize,
    scale,
  };
}

/**
 * Hook to get just the current theme colors
 * Use this when you only need colors and want minimal re-renders
 *
 * @example
 * ```tsx
 * const colors = useColors();
 * <View style={{ backgroundColor: colors.background.primary }} />
 * ```
 */
export function useColors(): ThemeColors {
  const mode = useThemeStore((state) => state.mode);
  return mode === 'light' ? lightColors : darkColors;
}

/**
 * Hook to get just the theme mode
 *
 * @example
 * ```tsx
 * const { mode, isDark } = useThemeMode();
 * ```
 */
export function useThemeMode() {
  const mode = useThemeStore((state) => state.mode);
  return {
    mode,
    isDark: mode === 'dark',
    isLight: mode === 'light',
  };
}

/**
 * Hook to check if dark mode is active
 *
 * @example
 * ```tsx
 * const isDarkMode = useIsDarkMode();
 * const gradient = isDarkMode ? darkGradient : lightGradient;
 * ```
 */
export function useIsDarkMode(): boolean {
  const mode = useThemeStore((state) => state.mode);
  return mode === 'dark';
}

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility)
// =============================================================================

/**
 * @deprecated Use `useTheme()` or `useColors()` instead
 * Legacy basic theme colors - limited subset
 */
export const themeColors = {
  light: {
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F5',
    text: '#000000',
    textSecondary: 'rgba(0,0,0,0.5)',
    textTertiary: 'rgba(0,0,0,0.25)',
    accent: '#F3B60C',
    border: 'rgba(0,0,0,0.1)',
    tabActive: '#000000',
    tabInactive: 'rgba(0,0,0,0.25)',
    surfaceElevated: '#FFFFFF',
    card: 'rgba(0,0,0,0.03)',
    statusBar: 'dark-content' as const,
  },
  dark: {
    background: '#000000',
    backgroundSecondary: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.7)',
    textTertiary: 'rgba(255,255,255,0.4)',
    accent: '#F3B60C',
    border: 'rgba(255,255,255,0.1)',
    tabActive: '#FFFFFF',
    tabInactive: 'rgba(255,255,255,0.25)',
    surfaceElevated: '#262626',
    card: 'rgba(255,255,255,0.05)',
    statusBar: 'light-content' as const,
  },
};

/**
 * @deprecated Use `useTheme()` or `useColors()` instead
 * Legacy hook for basic theme colors
 */
export function useThemeColors() {
  const mode = useThemeStore((state) => state.mode);
  return themeColors[mode];
}
