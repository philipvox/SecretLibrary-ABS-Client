/**
 * src/features/player/utils/playerTheme.ts
 *
 * Theme colors and hook for the player UI.
 * Provides light and dark mode color palettes.
 */

import { colors } from '@/shared/theme';
import { useThemeStore } from '@/shared/theme/themeStore';

/**
 * Player color palette for light and dark modes.
 * All player UI components should use these colors for consistency.
 */
export const playerColors = {
  light: {
    // Main backgrounds
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F5',
    backgroundTertiary: '#E8E8E8',
    // Text
    textPrimary: '#000000',
    textSecondary: 'rgba(0,0,0,0.6)',
    textTertiary: 'rgba(0,0,0,0.4)',
    textMuted: 'rgba(0,0,0,0.25)',
    // Borders & dividers
    border: 'rgba(0,0,0,0.1)',
    borderStrong: 'rgba(0,0,0,0.2)',
    // Sheet backgrounds
    sheetBackground: '#FFFFFF',
    sheetHandle: '#E0E0E0',
    // Timeline
    tickDefault: '#000000',
    tickActive: '#F50101',
    markerColor: '#F50101',
    // Overlays
    overlayLight: 'rgba(0,0,0,0.05)',
    overlayMedium: 'rgba(0,0,0,0.3)',
    overlayHeavy: 'rgba(0,0,0,0.5)',
    // Accents
    accent: colors.accent,
    accentRed: '#E53935',
    // Icons
    iconPrimary: '#000000',
    iconSecondary: 'rgba(0,0,0,0.5)',
    iconMuted: 'rgba(0,0,0,0.3)',
    // Buttons
    buttonBackground: '#FFFFFF',
    buttonText: '#000000',
    // Status bar
    statusBar: 'dark-content' as const,
  },
  dark: {
    // Main backgrounds
    background: '#000000',
    backgroundSecondary: '#1A1A1A',
    backgroundTertiary: '#262626',
    // Text
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.7)',
    textTertiary: 'rgba(255,255,255,0.5)',
    textMuted: 'rgba(255,255,255,0.3)',
    // Borders & dividers
    border: 'rgba(255,255,255,0.1)',
    borderStrong: 'rgba(255,255,255,0.2)',
    // Sheet backgrounds
    sheetBackground: '#1C1C1E',
    sheetHandle: 'rgba(255,255,255,0.3)',
    // Timeline
    tickDefault: 'rgba(255,255,255,0.4)',
    tickActive: '#F50101',
    markerColor: '#F50101',
    // Overlays
    overlayLight: 'rgba(255,255,255,0.05)',
    overlayMedium: 'rgba(0,0,0,0.5)',
    overlayHeavy: 'rgba(0,0,0,0.7)',
    // Accents
    accent: colors.accent,
    accentRed: '#E53935',
    // Icons
    iconPrimary: '#FFFFFF',
    iconSecondary: 'rgba(255,255,255,0.7)',
    iconMuted: 'rgba(255,255,255,0.4)',
    // Buttons
    buttonBackground: '#000000',
    buttonText: '#FFFFFF',
    // Status bar
    statusBar: 'light-content' as const,
  },
};

/**
 * Type for player color theme
 */
export type PlayerColors = typeof playerColors.light;

/**
 * Hook to get player colors based on current theme mode.
 * Returns the appropriate color palette for light or dark mode.
 */
export function usePlayerColors(): PlayerColors {
  const mode = useThemeStore((state) => state.mode);
  return playerColors[mode] as PlayerColors;
}
