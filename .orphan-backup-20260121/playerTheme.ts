/**
 * src/features/player/utils/playerTheme.ts
 *
 * Theme colors and hook for the player UI.
 * Derives colors from the central theme system in @/shared/theme/colors.ts.
 */

import { useThemeStore } from '@/shared/theme/themeStore';
import { getThemeColors } from '@/shared/theme/colors';

/**
 * Type for player color theme (derived from central theme)
 */
export interface PlayerColors {
  // Page background (respects light/dark mode)
  pageBackground: string;
  // Main backgrounds (player-specific, always dark)
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  // Borders & dividers
  border: string;
  borderStrong: string;
  // Sheet backgrounds
  sheetBackground: string;
  sheetHandle: string;
  // Timeline
  tickDefault: string;
  tickActive: string;
  markerColor: string;
  // Overlays
  overlayLight: string;
  overlayMedium: string;
  overlayHeavy: string;
  // Accents
  accent: string;
  accentRed: string;
  // Icons
  iconPrimary: string;
  iconSecondary: string;
  iconMuted: string;
  // Buttons
  buttonBackground: string;
  buttonText: string;
  // Status bar
  statusBar: 'light-content' | 'dark-content';
  // Floating widget (control bar) - from central theme
  widgetBackground: string;
  widgetButtonBg: string;
  widgetIcon: string;
  widgetDivider: string;
  widgetBorder: string;
  widgetTrack: string;
  widgetTimeLabel: string;
  // Gradients (for cover overlays)
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
}

/**
 * Hook to get player colors based on current theme mode and accent theme.
 * Returns the appropriate color palette for light or dark mode with dynamic accent.
 * All colors are derived from the central theme in @/shared/theme/colors.ts.
 */
export function usePlayerColors(): PlayerColors {
  const mode = useThemeStore((state) => state.mode);
  const accentTheme = useThemeStore((state) => state.accentTheme);
  const themeColors = getThemeColors(accentTheme, mode === 'dark');
  const isDark = mode === 'dark';

  return {
    // Page background - from main theme (respects light/dark mode)
    pageBackground: themeColors.background.primary,
    // Main backgrounds - from player section (always dark for cinematic feel)
    background: themeColors.player.background,
    backgroundSecondary: themeColors.player.backgroundSecondary,
    backgroundTertiary: themeColors.player.backgroundTertiary,
    // Text - from main theme (respects light/dark mode)
    textPrimary: themeColors.text.primary,
    textSecondary: themeColors.text.secondary,
    textTertiary: themeColors.text.tertiary,
    textMuted: themeColors.text.disabled,
    // Borders & dividers - from player section
    border: themeColors.player.border,
    borderStrong: themeColors.player.borderStrong,
    // Sheet backgrounds - from player section
    sheetBackground: themeColors.player.sheetBackground,
    sheetHandle: themeColors.player.sheetHandle,
    // Timeline - from player section
    tickDefault: themeColors.player.tickDefault,
    tickActive: themeColors.player.tickActive,
    markerColor: themeColors.player.markerColor,
    // Overlays - from player section
    overlayLight: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    overlayMedium: themeColors.player.overlay,
    overlayHeavy: themeColors.player.overlayHeavy,
    // Accents - from player section
    accent: themeColors.player.accent,
    accentRed: themeColors.player.accentRed,
    // Icons - from player section
    iconPrimary: themeColors.player.control,
    iconSecondary: themeColors.player.controlSecondary,
    iconMuted: themeColors.player.controlMuted,
    // Buttons - from player section
    buttonBackground: themeColors.player.standardControlsBg,
    buttonText: themeColors.player.standardControlsText,
    // Status bar
    statusBar: themeColors.statusBar,
    // Floating widget - from player section (new fields)
    widgetBackground: themeColors.player.widgetBackground,
    widgetButtonBg: themeColors.player.widgetButtonBg,
    widgetIcon: themeColors.player.widgetIcon,
    widgetDivider: themeColors.player.widgetDivider,
    widgetBorder: themeColors.player.widgetBorder,
    widgetTrack: themeColors.player.widgetTrack,
    widgetTimeLabel: themeColors.player.widgetTimeLabel,
    // Gradients - from player section
    gradientStart: themeColors.player.gradientStart,
    gradientMid: themeColors.player.gradientMid,
    gradientEnd: themeColors.player.gradientEnd,
  };
}
