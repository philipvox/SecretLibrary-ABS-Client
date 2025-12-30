/**
 * src/features/player/screens/CDPlayerScreen.tsx
 *
 * CD disc-style audiobook player with skeuomorphic design.
 * Features a circular CD disc with cover art and center hole,
 * amber/gold accent color, glass-morphic controls.
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  PanResponder,
  ScrollView,
  UIManager,
  Platform,
  InteractionManager,
  TextInput,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaskedViewImport from '@react-native-masked-view/masked-view';
import Svg, { Path, Defs, RadialGradient, Stop, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import ReanimatedAnimated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  useFrameCallback,
  SharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { CD_ROTATION } from '@/shared/animation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  X,
  Volume2,
  Check,
  CheckCircle,
  Cloud,
  Play,
  Layers,
  Hourglass,
  Bookmark,
  Settings,
  Trash2,
  Moon,
  Gauge,
} from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { useNavigation } from '@react-navigation/native';

import { usePlayerStore, useCurrentChapterIndex } from '../stores/playerStore';
import { useSnapToChapterSettings } from '../stores/settingsStore';
import { SleepTimerSheet, SpeedSheet } from '../sheets';
import { QueuePanel } from '@/features/queue/components/QueuePanel';
import { useQueueCount, useQueueStore } from '@/features/queue/stores/queueStore';
import { useReducedMotion } from 'react-native-reanimated';
import { useCoverUrl } from '@/core/cache';
import { useIsOfflineAvailable } from '@/core/hooks/useDownloads';
import { useRenderTracker, useLifecycleTracker } from '@/utils/perfDebug';
import { useFpsMonitor, fpsMonitor } from '@/utils/runtimeMonitor';
import { useNormalizedChapters } from '@/shared/hooks';
// CoverPlayButton removed - using long-press + pan on timeline instead
import { haptics } from '@/core/native/haptics';
import { useTimelineHaptics, Chapter as HapticChapter } from '../hooks/useTimelineHaptics';
import { colors, spacing, radius, scale, wp, hp, layout } from '@/shared/theme';
import { useThemeStore } from '@/shared/theme/themeStore';
import { useScreenLoadTime } from '@/core/hooks/useScreenLoadTime';

// =============================================================================
// THEME COLORS
// =============================================================================

// Player colors for light and dark modes
const playerColors = {
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
    // Disc (keep dark for contrast in light mode)
    discRing: '#6B6B6B',
    discCenter: '#1A1A1A',
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
    // Disc
    discRing: '#6B6B6B',
    discCenter: colors.backgroundTertiary,
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

// Hook to get player colors based on theme
function usePlayerColors() {
  const mode = useThemeStore((state) => state.mode);
  return playerColors[mode];
}

// Check if MaskedView native module is available (not just JS module)
const isMaskedViewAvailable =
  UIManager.getViewManagerConfig('RNCMaskedView') != null;
const MaskedView = isMaskedViewAvailable ? MaskedViewImport : null;

const SCREEN_WIDTH = wp(100);
const SCREEN_HEIGHT = hp(100);

const ACCENT_COLOR = colors.accent;
const DISC_SIZE = SCREEN_WIDTH - scale(20); // Slightly smaller than screen width
const HOLE_SIZE = DISC_SIZE * 0.22;
const GRAY_RING_COLOR = '#6B6B6B';

// =============================================================================
// TYPES
// =============================================================================

type SheetType = 'none' | 'chapters' | 'settings' | 'queue' | 'sleep' | 'speed' | 'bookmarks';
type ProgressMode = 'chapter' | 'book';

// =============================================================================
// CONSTANTS
// =============================================================================

// Quick speed options for settings panel
const SPEED_QUICK_OPTIONS = [1, 1.25, 1.5, 2];
// Sleep timer quick options (in minutes)
const SLEEP_QUICK_OPTIONS = [5, 15, 30, 60];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatTime = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Format time as "5h 23m 10s" - verbose format for chapter remaining display
const formatTimeVerbose = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(' ');
};

// =============================================================================
// SVG Icons
// =============================================================================

const MoonIcon = () => (
  <Svg width={scale(13)} height={scale(13)} viewBox="0 0 13 13" fill="none">
    <Path
      d="M13 7.08559C12.8861 8.31757 12.4238 9.49165 11.667 10.4704C10.9102 11.4492 9.89037 12.1923 8.72672 12.6126C7.56307 13.0329 6.30378 13.1131 5.09621 12.8439C3.88863 12.5746 2.78271 11.967 1.90785 11.0921C1.033 10.2173 0.425392 9.11137 0.156131 7.90379C-0.11313 6.69622 -0.0329082 5.43693 0.38741 4.27328C0.807727 3.10963 1.55076 2.08975 2.52955 1.33298C3.50835 0.576212 4.68243 0.113851 5.91441 0C5.19313 0.975819 4.84604 2.17811 4.93628 3.38821C5.02652 4.59831 5.54809 5.73582 6.40614 6.59386C7.26418 7.45191 8.40169 7.97348 9.61179 8.06372C10.8219 8.15396 12.0242 7.80687 13 7.08559Z"
      fill="white"
    />
  </Svg>
);

// Double-chevron rewind icon (<<)
const RewindIcon = ({ color = "white" }: { color?: string }) => (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    <Path
      d="M9.65391 13.3207C9.65391 13.8212 9.08125 14.1058 8.68224 13.8036L0.391342 7.52258C0.0713467 7.28016 0.0713462 6.79919 0.391341 6.55677L8.68223 0.275788C9.08125 -0.0264932 9.65391 0.258109 9.65391 0.758693V13.3207Z"
      fill={color}
    />
    <Path
      d="M21.7539 13.3207C21.7539 13.8212 21.1812 14.1058 20.7822 13.8036L12.4913 7.52258C12.1713 7.28016 12.1713 6.79919 12.4913 6.55677L20.7822 0.275788C21.1812 -0.0264932 21.7539 0.258109 21.7539 0.758693V13.3207Z"
      fill={color}
    />
  </Svg>
);

// Double-chevron fast-forward icon (>>)
const FastForwardIcon = ({ color = "white" }: { color?: string }) => (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    <Path
      d="M12.2514 13.3207C12.2514 13.8212 12.824 14.1058 13.223 13.8036L21.5139 7.52258C21.8339 7.28016 21.8339 6.79919 21.5139 6.55677L13.223 0.275788C12.824 -0.0264932 12.2514 0.258109 12.2514 0.758693V13.3207Z"
      fill={color}
    />
    <Path
      d="M0.151367 13.3207C0.151367 13.8212 0.724027 14.1058 1.12304 13.8036L9.41393 7.52258C9.73393 7.28016 9.73393 6.79919 9.41393 6.55677L1.12304 0.275788C0.724028 -0.0264932 0.151367 0.258109 0.151367 0.758693V13.3207Z"
      fill={color}
    />
  </Svg>
);

const DownArrowIcon = ({ color = "rgba(255,255,255,0.4)" }: { color?: string }) => (
  <Svg width={scale(24)} height={scale(14)} viewBox="0 0 24 14" fill="none">
    <Path
      d="M2 2L12 12L22 2"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Bookmark flag icon for timeline - flag on a pole
const BookmarkFlagIcon = ({ size = 24, color = "#2196F3" }: { size?: number; color?: string }) => {
  const flagWidth = size * 0.6;
  const flagHeight = size * 0.4;
  const poleWidth = 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {/* Pole */}
      <Line
        x1={poleWidth / 2}
        y1={0}
        x2={poleWidth / 2}
        y2={size}
        stroke={color}
        strokeWidth={poleWidth}
      />
      {/* Flag - notched pennant shape */}
      <Path
        d={`M${poleWidth} 0 L${poleWidth + flagWidth} ${flagHeight / 2} L${poleWidth} ${flagHeight} Z`}
        fill={color}
      />
    </Svg>
  );
};

const SettingsIcon = ({ color = "white" }: { color?: string }) => (
  <Svg width={scale(22)} height={scale(22)} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// =============================================================================
// Sub-Components
// =============================================================================

interface CDDiscProps {
  coverUrl: string | null;
  size?: number;
  /** Shared rotation value - allows syncing multiple discs */
  rotation: SharedValue<number>;
  /** Whether this disc drives the animation (only one should be primary) */
  isPrimary?: boolean;
  /** Render with blur effect for frosted glass appearance */
  isBlurred?: boolean;
  isPlaying?: boolean;
  isBuffering?: boolean;
  playbackRate?: number;
  reducedMotion?: boolean;
  /** External scrub speed in degrees per second (overrides normal rotation when non-zero) */
  scrubSpeed?: SharedValue<number>;
  /** Spin burst delta in degrees (for skip button feedback) */
  spinBurst?: SharedValue<number>;
}

const CDDisc: React.FC<CDDiscProps> = ({
  coverUrl,
  size = DISC_SIZE,
  rotation,
  isPrimary = true,
  isBlurred = false,
  isPlaying = false,
  isBuffering = false,
  playbackRate = 1,
  reducedMotion = false,
  scrubSpeed,
  spinBurst,
}) => {
  // Animation state - only used by primary disc
  const baseDegreesPerMs = useSharedValue(0);
  const lastFrameTime = useSharedValue(Date.now());
  const oscillationPhase = useSharedValue(0);
  const isOscillating = useSharedValue(false);

  // Calculate base rotation speed - only for primary disc
  useEffect(() => {
    if (!isPrimary) return;
    if (reducedMotion) {
      baseDegreesPerMs.value = 0;
      return;
    }
    const degreesPerSecond = isPlaying ? CD_ROTATION.baseSpeed * playbackRate : 0;
    baseDegreesPerMs.value = degreesPerSecond / 1000;
  }, [isPlaying, playbackRate, reducedMotion, isPrimary]);

  // Update oscillation state - only for primary disc
  useEffect(() => {
    if (!isPrimary) return;
    isOscillating.value = isBuffering && !reducedMotion;
  }, [isBuffering, reducedMotion, isPrimary]);

  // UI thread frame callback - only run on primary disc
  useFrameCallback((frameInfo) => {
    'worklet';
    if (!isPrimary) return;

    const now = frameInfo.timestamp;
    const deltaMs = now - lastFrameTime.value;
    lastFrameTime.value = now;

    const clampedDelta = Math.min(deltaMs, 50);

    // Check for spin burst (skip button feedback)
    if (spinBurst && Math.abs(spinBurst.value) > 0.1) {
      rotation.value = rotation.value + spinBurst.value;
      spinBurst.value = 0;
    }

    // Buffering oscillation
    if (isOscillating.value) {
      oscillationPhase.value = (oscillationPhase.value + clampedDelta * CD_ROTATION.bufferingFrequency) % (2 * Math.PI);
      const oscillation = Math.sin(oscillationPhase.value) * CD_ROTATION.bufferingAmplitude;
      rotation.value = rotation.value + oscillation * 0.08;
      return;
    }

    // Determine rotation speed
    const scrubDegreesPerMs = scrubSpeed ? scrubSpeed.value / 1000 : 0;
    const effectiveSpeed = Math.abs(scrubDegreesPerMs) > 0.001
      ? scrubDegreesPerMs
      : baseDegreesPerMs.value;

    if (Math.abs(effectiveSpeed) > 0.001) {
      rotation.value = (rotation.value + effectiveSpeed * clampedDelta) % 360;
      if (rotation.value < 0) {
        rotation.value += 360;
      }
    }
  }, isPrimary); // Only active when isPrimary

  // Main disc rotation style - both discs use the same shared rotation
  const discStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <ReanimatedAnimated.View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        discStyle,
      ]}
    >
      {coverUrl ? (
        <Image
          source={coverUrl}
          style={[styles.discCover, { borderRadius: size / 2 }]}
          contentFit="cover"
          contentPosition="top"
          blurRadius={isBlurred ? 10 : 0}
        />
      ) : (
        <View style={[styles.discCover, { backgroundColor: '#333', borderRadius: size / 2 }]} />
      )}
    </ReanimatedAnimated.View>
  );
};

interface ProgressBarProps {
  progress: number;
  onSeek?: (value: number) => void;
  chapterMarkers?: number[];
}

// Pre-compute values outside worklet
const THUMB_TRANSLATE_X = -scale(8);

const CDProgressBar: React.FC<ProgressBarProps> = ({ progress, onSeek, chapterMarkers = [] }) => {
  const thumbPosition = useSharedValue(progress);
  const isDragging = useSharedValue(false);
  const barWidth = scale(358);

  // Update thumb when progress changes externally - instant update
  React.useEffect(() => {
    if (!isDragging.value) {
      thumbPosition.value = progress;
    }
  }, [progress]);

  const handleSeekEnd = React.useCallback((value: number) => {
    onSeek?.(value);
  }, [onSeek]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      isDragging.value = true;
    })
    .onUpdate((e) => {
      'worklet';
      const newProgress = Math.max(0, Math.min(100, (e.x / barWidth) * 100));
      thumbPosition.value = newProgress;
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = false;
      runOnJS(handleSeekEnd)(thumbPosition.value);
    });

  const thumbStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      left: `${thumbPosition.value}%`,
      transform: [
        { translateX: THUMB_TRANSLATE_X },
        { scale: isDragging.value ? 1.1 : 1 },
      ],
    };
  });

  const fillStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      width: `${thumbPosition.value}%`,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={styles.progressContainer}
        accessible={true}
        accessibilityRole="adjustable"
        accessibilityLabel={`Playback progress ${Math.round(progress)}%`}
        accessibilityHint="Drag left or right to seek"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(progress),
        }}
      >
        {/* Track background with fill inside */}
        <View style={styles.progressTrack}>
          <View style={styles.progressBorder} />
          {/* Fill */}
          <ReanimatedAnimated.View style={[styles.progressFill, fillStyle]} />
        </View>

        {/* Chapter markers */}
        {chapterMarkers.map((marker, i) => (
          <View
            key={i}
            style={[
              styles.chapterMarker,
              { left: `${marker}%` },
            ]}
          />
        ))}

        {/* Thumb */}
        <ReanimatedAnimated.View style={[styles.progressThumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
};

// =============================================================================
// Timeline Progress Bar (Standard Player Mode)
// =============================================================================

const TIMELINE_WIDTH = SCREEN_WIDTH - scale(44); // Match progress bar padding
const TIMELINE_MARKER_RADIUS = 8;
const TIMELINE_MAJOR_TICK_HEIGHT = 10;
const TIMELINE_MINOR_TICK_HEIGHT = 5;

interface TimelineChapter {
  start: number;
  end: number;
}

interface TimelineBookmark {
  id: string;
  time: number; // seconds
}

interface TimelineProgressBarProps {
  position: number;
  duration: number;
  chapters: TimelineChapter[];
  onSeek: (position: number) => void;
  /** Bookmarks to display as flags on the timeline */
  bookmarks?: TimelineBookmark[];
}

const TimelineProgressBar = React.memo(({ position, duration, chapters, onSeek, bookmarks = [] }: TimelineProgressBarProps) => {
  // Get theme colors
  const themeColors = usePlayerColors();

  // Normalize position to 0-1 based on chapters (equal width per chapter)
  const normalizedProgress = useMemo(() => {
    if (duration <= 0) return 0;

    // If no chapters, treat whole book as one chapter
    if (!chapters.length) {
      return position / duration;
    }

    // Find current chapter
    let currentChapterIndex = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (position >= chapters[i].start) {
        currentChapterIndex = i;
        break;
      }
    }

    const chapter = chapters[currentChapterIndex];
    const chapterDuration = chapter.end - chapter.start;
    const positionInChapter = position - chapter.start;
    const chapterProgress = chapterDuration > 0 ? positionInChapter / chapterDuration : 0;

    // Each chapter takes equal width (1/numChapters)
    const chapterWidth = 1 / chapters.length;
    return (currentChapterIndex * chapterWidth) + (chapterProgress * chapterWidth);
  }, [position, duration, chapters]);

  const markerPosition = useSharedValue(normalizedProgress * TIMELINE_WIDTH);
  const isDragging = useSharedValue(false);

  // Update marker when progress changes (but not while dragging)
  useEffect(() => {
    if (!isDragging.value) {
      markerPosition.value = normalizedProgress * TIMELINE_WIDTH;
    }
  }, [normalizedProgress]);

  // Generate tick marks based on chapters
  // NOTE: Using chapters.length as explicit dependency to ensure re-render when chapters load
  const ticks = useMemo(() => {
    const tickArray: { x: number; isMajor: boolean }[] = [];

    // Treat 0 chapters as 1 chapter (whole book)
    const effectiveChapters = chapters.length || 1;
    const chapterWidth = TIMELINE_WIDTH / effectiveChapters;

    // Adaptive density
    const minorTickMode: 'full' | 'half' | 'none' =
      chapterWidth >= 20 ? 'full' :
      chapterWidth >= 12 ? 'half' :
      'none';

    for (let chapterIndex = 0; chapterIndex < effectiveChapters; chapterIndex++) {
      const chapterStartX = chapterIndex * chapterWidth;

      // Major tick at chapter start
      tickArray.push({ x: chapterStartX, isMajor: true });

      // Minor ticks based on density mode
      if (minorTickMode === 'full') {
        for (let i = 1; i <= 3; i++) {
          tickArray.push({ x: chapterStartX + (chapterWidth * i * 0.25), isMajor: false });
        }
      } else if (minorTickMode === 'half') {
        tickArray.push({ x: chapterStartX + (chapterWidth * 0.5), isMajor: false });
      }
    }

    // Final major tick at end
    tickArray.push({ x: TIMELINE_WIDTH, isMajor: true });

    return tickArray;
  }, [chapters, chapters.length]);

  // Convert normalized progress back to actual position
  const normalizedToPosition = useCallback((normalized: number): number => {
    if (duration <= 0) return 0;

    if (!chapters.length) {
      return normalized * duration;
    }

    const chapterWidth = 1 / chapters.length;
    const chapterIndex = Math.min(Math.floor(normalized / chapterWidth), chapters.length - 1);
    const progressInChapter = (normalized - (chapterIndex * chapterWidth)) / chapterWidth;

    const chapter = chapters[chapterIndex];
    const chapterDuration = chapter.end - chapter.start;
    return chapter.start + (progressInChapter * chapterDuration);
  }, [chapters, duration]);

  const handleSeek = useCallback((normalizedProgress: number) => {
    const clampedProgress = Math.max(0, Math.min(1, normalizedProgress));
    const newPosition = normalizedToPosition(clampedProgress);
    onSeek(newPosition);
  }, [normalizedToPosition, onSeek]);

  // Pan gesture for scrubbing (book view only)
  const scrubGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      isDragging.value = true;
    })
    .onUpdate((event) => {
      'worklet';
      const newX = Math.max(0, Math.min(TIMELINE_WIDTH, event.x));
      markerPosition.value = newX;
    })
    .onEnd((event) => {
      'worklet';
      isDragging.value = false;
      const newProgress = Math.max(0, Math.min(1, event.x / TIMELINE_WIDTH));
      runOnJS(handleSeek)(newProgress);
    });

  // Tap gesture for seeking
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      'worklet';
      const newX = Math.max(0, Math.min(TIMELINE_WIDTH, event.x));
      markerPosition.value = newX;
      const newProgress = newX / TIMELINE_WIDTH;
      runOnJS(handleSeek)(newProgress);
    });

  const combinedGesture = Gesture.Race(scrubGesture, tapGesture);

  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: markerPosition.value - TIMELINE_MARKER_RADIUS }],
  }));

  // Find which tick is closest to marker for highlight
  const currentTickIndex = useMemo(() => {
    if (!ticks.length) return -1;
    const markerX = normalizedProgress * TIMELINE_WIDTH;
    let closestIndex = 0;
    let closestDistance = Math.abs(ticks[0].x - markerX);
    for (let i = 1; i < ticks.length; i++) {
      const distance = Math.abs(ticks[i].x - markerX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }
    return closestIndex;
  }, [ticks, normalizedProgress]);

  // Convert bookmark times to X positions (normalized like the marker)
  const bookmarkPositions = useMemo(() => {
    if (!bookmarks.length || duration <= 0) return [];

    return bookmarks.map((bookmark) => {
      const time = Math.round(bookmark.time); // Round to nearest second

      // Convert time to normalized progress (same logic as normalizedProgress)
      let normalized = 0;
      if (!chapters.length) {
        normalized = time / duration;
      } else {
        let chapterIndex = 0;
        for (let i = chapters.length - 1; i >= 0; i--) {
          if (time >= chapters[i].start) {
            chapterIndex = i;
            break;
          }
        }
        const chapter = chapters[chapterIndex];
        const chapterDuration = chapter.end - chapter.start;
        const positionInChapter = time - chapter.start;
        const chapterProgress = chapterDuration > 0 ? positionInChapter / chapterDuration : 0;
        const chapterWidth = 1 / chapters.length;
        normalized = (chapterIndex * chapterWidth) + (chapterProgress * chapterWidth);
      }

      return {
        id: bookmark.id,
        x: Math.max(0, Math.min(TIMELINE_WIDTH, normalized * TIMELINE_WIDTH)),
      };
    });
  }, [bookmarks, duration, chapters]);

  // Flag dimensions for book view - stem reaches full height like red marker line
  const CONTAINER_HEIGHT = TIMELINE_MARKER_RADIUS * 2 + TIMELINE_MAJOR_TICK_HEIGHT + 4;
  const FLAG_PENNANT_WIDTH = scale(20);  // Width of the flag part
  const FLAG_PENNANT_HEIGHT = scale(10); // Height of the flag part
  const FLAG_POLE_WIDTH = 2;
  const FLAG_COLOR = '#0146F5';          // Solid blue for flag
  const STEM_COLOR = '#64B5F6';          // Light blue for stem

  return (
    <GestureDetector gesture={combinedGesture}>
      <View style={timelineStyles.container}>
        {/* Bookmark flags - render before marker so marker appears on top */}
        {bookmarkPositions.map((bm) => (
          <View
            key={bm.id}
            style={[
              timelineStyles.bookmarkFlag,
              { left: bm.x - FLAG_POLE_WIDTH / 2 },
            ]}
          >
            <Svg width={FLAG_PENNANT_WIDTH + FLAG_POLE_WIDTH} height={CONTAINER_HEIGHT} viewBox={`0 0 ${FLAG_PENNANT_WIDTH + FLAG_POLE_WIDTH} ${CONTAINER_HEIGHT}`}>
              {/* Stem - full height like red center line */}
              <Line
                x1={FLAG_POLE_WIDTH / 2}
                y1={0}
                x2={FLAG_POLE_WIDTH / 2}
                y2={CONTAINER_HEIGHT}
                stroke={STEM_COLOR}
                strokeWidth={FLAG_POLE_WIDTH}
              />
              {/* Flag - notched pennant shape (based on Flag.svg) */}
              <Path
                d={`M${FLAG_POLE_WIDTH} 0 H${FLAG_POLE_WIDTH + FLAG_PENNANT_WIDTH} L${FLAG_POLE_WIDTH + FLAG_PENNANT_WIDTH * 0.78} ${FLAG_PENNANT_HEIGHT / 2} L${FLAG_POLE_WIDTH + FLAG_PENNANT_WIDTH} ${FLAG_PENNANT_HEIGHT} H${FLAG_POLE_WIDTH} Z`}
                fill={FLAG_COLOR}
              />
            </Svg>
          </View>
        ))}

        {/* Red marker circle */}
        <ReanimatedAnimated.View style={[timelineStyles.marker, markerStyle]}>
          <View style={timelineStyles.markerInner} />
        </ReanimatedAnimated.View>

        {/* Tick marks */}
        <Svg width={TIMELINE_WIDTH} height={TIMELINE_MAJOR_TICK_HEIGHT + 4} style={timelineStyles.ticks}>
          {ticks.map((tick, index) => {
            const isCurrentTick = index === currentTickIndex;
            return (
              <Line
                key={index}
                x1={tick.x}
                y1={tick.isMajor ? 0 : TIMELINE_MAJOR_TICK_HEIGHT - TIMELINE_MINOR_TICK_HEIGHT}
                x2={tick.x}
                y2={TIMELINE_MAJOR_TICK_HEIGHT}
                stroke={isCurrentTick ? themeColors.tickActive : themeColors.tickDefault}
                strokeWidth={1}
            />
          );
        })}
        </Svg>
      </View>
    </GestureDetector>
  );
});

const timelineStyles = StyleSheet.create({
  container: {
    width: TIMELINE_WIDTH,
    height: TIMELINE_MARKER_RADIUS * 2 + TIMELINE_MAJOR_TICK_HEIGHT + 4,
    alignSelf: 'center',
  },
  marker: {
    position: 'absolute',
    top: 0,
    width: TIMELINE_MARKER_RADIUS * 2,
    height: TIMELINE_MARKER_RADIUS * 2,
    borderRadius: TIMELINE_MARKER_RADIUS,
    backgroundColor: '#F50101',
    zIndex: 10,
    shadowColor: '#F50101',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  markerInner: {
    width: '100%',
    height: '100%',
    borderRadius: TIMELINE_MARKER_RADIUS,
    backgroundColor: '#F50101',
  },
  ticks: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  bookmarkFlag: {
    position: 'absolute',
    top: 0, // Stem starts from top, reaches bottom
    zIndex: 5,
  },
});

// =============================================================================
// Chapter Timeline Progress Bar (Scrolling Chapter View)
// =============================================================================

// Chapter timeline - time-based scale (zoomed to ~1 chapter per screen)
const CHAPTER_MARKER_X = TIMELINE_WIDTH / 2; // Fixed center position
const CHAPTER_MARKER_CIRCLE_SIZE = scale(100); // Large red circle
const CHAPTER_TICK_HEIGHT = scale(80); // Tallest - chapter boundaries
const TEN_MIN_TICK_HEIGHT = scale(45); // Medium - 10 minute marks
const ONE_MIN_TICK_HEIGHT = scale(24); // Small - 1 minute marks
const FIFTEEN_SEC_TICK_HEIGHT = scale(11); // Smallest - 15 second marks
const CHAPTER_LABEL_Y = scale(16); // Labels above ticks
const MINUTES_PER_SCREEN = 5; // ~5 minutes visible at once (zoomed in)
const PIXELS_PER_SECOND = TIMELINE_WIDTH / (MINUTES_PER_SCREEN * 60);
const CHAPTER_TIMELINE_TOTAL_HEIGHT = scale(220); // Total height from circle to bottom

const ChapterTimelineProgressBar = React.memo(({ position, duration, chapters, onSeek, bookmarks = [] }: TimelineProgressBarProps) => {
  // Get theme colors
  const themeColors = usePlayerColors();

  // Calculate total timeline width based on duration
  const timelineWidth = useMemo(() => {
    return Math.max(TIMELINE_WIDTH, duration * PIXELS_PER_SECOND);
  }, [duration]);

  // Timeline offset to keep current position at center (time-based)
  const timelineOffset = useSharedValue(0);
  const lastPosition = useRef(position);

  // Position-based update (for playback - when NOT direct scrubbing)
  // Direct scrubbing updates timelineOffset directly in the pan gesture
  useEffect(() => {

    const positionX = position * PIXELS_PER_SECOND;
    const newOffset = -positionX + CHAPTER_MARKER_X;

    // Calculate how much position changed
    const positionDelta = Math.abs(position - lastPosition.current);
    lastPosition.current = position;

    // All position changes are instant - no animation
    if (positionDelta > 0.1) {
      timelineOffset.value = newOffset;
    }
  }, [position]);

  // Handle seek from tap or scrub
  const handleSeek = useCallback((seconds: number) => {
    const clampedPosition = Math.max(0, Math.min(duration, seconds));
    onSeek(clampedPosition);
  }, [duration, onSeek]);

  // ============================================================================
  // DIRECT SCRUB MODE (Long-press + Pan)
  // ============================================================================

  // Haptic feedback
  const timelineHaptics = useTimelineHaptics();

  // Snap-to-chapter settings
  const snapSettings = useSnapToChapterSettings();

  // Convert chapters to haptic chapter format
  const hapticChapters: HapticChapter[] = useMemo(() => {
    return chapters.map((ch, index) => ({
      index,
      startTime: ch.start,
      endTime: ch.end,
      title: ch.title,
    }));
  }, [chapters]);

  // Calculate snap position (finds nearest chapter boundary within threshold)
  const calculateSnapPosition = useCallback((rawPosition: number): { position: number; didSnap: boolean } => {
    if (!snapSettings.enabled) return { position: rawPosition, didSnap: false };

    let nearestBoundary = rawPosition;
    let nearestDistance = Infinity;

    for (const chapter of chapters) {
      const distance = Math.abs(rawPosition - chapter.start);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBoundary = chapter.start;
      }
    }

    // Snap if within threshold
    if (nearestDistance <= snapSettings.threshold) {
      return { position: nearestBoundary, didSnap: true };
    }

    return { position: rawPosition, didSnap: false };
  }, [chapters, snapSettings.enabled, snapSettings.threshold]);

  // Scrub state
  const [isDirectScrubbing, setIsDirectScrubbing] = useState(false);
  const [scrubSpeedMode, setScrubSpeedMode] = useState<'normal' | 'half' | 'quarter' | 'fine' | 'fast'>('normal');
  const scrubStartOffset = useSharedValue(0);
  const scrubStartX = useSharedValue(0);
  const scrubStartY = useSharedValue(0);
  const scrubCurrentPosition = useSharedValue(0);
  const timelineScale = useSharedValue(1);
  const lastScrubPosition = useRef(position);

  // Speed mode labels
  const SPEED_MODE_LABELS: Record<string, string> = {
    normal: '',
    half: 'HALF SPEED',
    quarter: 'QUARTER SPEED',
    fine: 'FINE',
    fast: 'FAST (2×)',
  };

  // Calculate speed multiplier from vertical offset
  const getSpeedMultiplier = useCallback((dy: number): { multiplier: number; mode: 'normal' | 'half' | 'quarter' | 'fine' | 'fast' } => {
    if (dy > 120) return { multiplier: 0.1, mode: 'fine' };
    if (dy > 80) return { multiplier: 0.25, mode: 'quarter' };
    if (dy > 40) return { multiplier: 0.5, mode: 'half' };
    if (dy < -40) return { multiplier: 2.0, mode: 'fast' };
    return { multiplier: 1.0, mode: 'normal' };
  }, []);

  // Enter direct scrub mode
  const enterDirectScrub = useCallback(() => {
    setIsDirectScrubbing(true);
    setScrubSpeedMode('normal');
    timelineHaptics.triggerModeChange('enter');
    timelineHaptics.resetTracking();
    lastScrubPosition.current = position;
  }, [position, timelineHaptics]);

  // Exit direct scrub mode
  const exitDirectScrub = useCallback((finalSeconds: number) => {
    setIsDirectScrubbing(false);
    setScrubSpeedMode('normal');

    // Check for snap-to-chapter
    const { position: snapPosition, didSnap } = calculateSnapPosition(finalSeconds);

    if (didSnap) {
      timelineHaptics.triggerSnap();
    }

    timelineHaptics.triggerModeChange('exit');
    handleSeek(snapPosition);
  }, [handleSeek, timelineHaptics, calculateSnapPosition]);

  // Check haptics during scrub
  const checkScrubHaptics = useCallback((newPositionSec: number) => {
    timelineHaptics.checkChapterCrossing(lastScrubPosition.current, newPositionSec, hapticChapters);
    timelineHaptics.checkMinuteCrossing(lastScrubPosition.current, newPositionSec);
    timelineHaptics.checkEdgeReached(newPositionSec, duration);
    lastScrubPosition.current = newPositionSec;
  }, [hapticChapters, duration, timelineHaptics]);

  // FPS monitoring during scrubbing
  useEffect(() => {
    if (isDirectScrubbing) {
      fpsMonitor.start('scrubbing');
    } else {
      fpsMonitor.stop();
    }
  }, [isDirectScrubbing]);

  // Tap gesture for instant seeking (<150ms)
  const tapGesture = Gesture.Tap()
    .maxDuration(150)
    .onEnd((event) => {
      'worklet';
      // Convert tap position to timeline position
      const timelineX = event.x - timelineOffset.value;
      const seconds = timelineX / PIXELS_PER_SECOND;
      // Instant update to tapped position
      const newOffset = -seconds * PIXELS_PER_SECOND + CHAPTER_MARKER_X;
      const minOffset = -timelineWidth + CHAPTER_MARKER_X;
      const maxOffset = CHAPTER_MARKER_X;
      timelineOffset.value = Math.max(minOffset, Math.min(maxOffset, newOffset));

      // Haptic feedback
      runOnJS(timelineHaptics.triggerTapConfirm)();
      runOnJS(handleSeek)(seconds);
    });

  // Long-press + Pan gesture for direct scrubbing
  const longPressPanGesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((event) => {
      'worklet';
      // Visual feedback: Timeline "lifts" slightly
      timelineScale.value = withSpring(1.02, { damping: 20, stiffness: 300 });

      // Store starting values
      scrubStartOffset.value = timelineOffset.value;
      scrubStartX.value = event.x;
      scrubStartY.value = event.y;

      // Calculate starting position in seconds
      const startSeconds = (-timelineOffset.value + CHAPTER_MARKER_X) / PIXELS_PER_SECOND;
      scrubCurrentPosition.value = startSeconds;

      runOnJS(enterDirectScrub)();
    })
    .onUpdate((event) => {
      'worklet';
      const dx = event.x - scrubStartX.value;
      const dy = event.y - scrubStartY.value;

      // Calculate sensitivity based on vertical offset (fine-scrub)
      const { multiplier, mode } = runOnJS(getSpeedMultiplier)(dy);

      // Update speed mode display
      runOnJS(setScrubSpeedMode)(mode);

      // Direct 1:1 mapping with sensitivity adjustment
      // Negative dx = moved finger left = want to see earlier content = offset increases
      const adjustedDx = dx * multiplier;
      const newOffset = scrubStartOffset.value - adjustedDx;

      // Clamp to valid range
      const minOffset = -timelineWidth + CHAPTER_MARKER_X;
      const maxOffset = CHAPTER_MARKER_X;
      timelineOffset.value = Math.max(minOffset, Math.min(maxOffset, newOffset));

      // Calculate new position in seconds for haptics
      const newSeconds = (-timelineOffset.value + CHAPTER_MARKER_X) / PIXELS_PER_SECOND;
      scrubCurrentPosition.value = newSeconds;

      // Check for haptic feedback (chapter/minute crossings)
      runOnJS(checkScrubHaptics)(newSeconds);
    })
    .onEnd(() => {
      'worklet';
      // Visual feedback: Timeline settles
      timelineScale.value = withSpring(1.0, { damping: 20, stiffness: 300 });

      // Calculate final position
      const finalSeconds = scrubCurrentPosition.value;
      const clampedSeconds = Math.max(0, Math.min(duration, finalSeconds));

      runOnJS(exitDirectScrub)(clampedSeconds);
    });

  // Combine gestures: Tap takes priority for quick taps, pan activates after long-press
  const combinedGesture = Gesture.Exclusive(
    longPressPanGesture,
    tapGesture
  );

  // Animated style for scrolling timeline (with scale for scrub feedback)
  const timelineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: timelineOffset.value },
      { scale: timelineScale.value },
    ],
  }));

  // Visible window: 15 minutes in each direction from current position
  const VISIBLE_WINDOW_SECONDS = 15 * 60; // 15 minutes = 900 seconds

  // Use position directly (scrubbing updates timelineOffset in real-time)
  const effectivePosition = position;

  // Generate ticks only within visible window (±15 min from effective position)
  const ticks = useMemo(() => {
    const tickArray: { x: number; tier: 'chapter' | 'tenMin' | 'oneMin' | 'fifteenSec'; label?: string }[] = [];

    const minTime = Math.max(0, effectivePosition - VISIBLE_WINDOW_SECONDS);
    const maxTime = Math.min(duration, effectivePosition + VISIBLE_WINDOW_SECONDS);

    // Tier 1: Chapter ticks with labels (only in visible range)
    // Track last label position to avoid overlapping labels
    const MIN_LABEL_SPACING = scale(55); // Minimum pixels between labels
    const MIN_CHAPTER_DURATION = 60; // Minimum 60 seconds to show label
    let lastLabelX = -Infinity;

    chapters.forEach((chapter, index) => {
      if (chapter.start >= minTime && chapter.start <= maxTime) {
        const x = chapter.start * PIXELS_PER_SECOND;

        // Calculate chapter duration (time until next chapter or end)
        const nextChapter = chapters[index + 1];
        const chapterEnd = nextChapter ? nextChapter.start : duration;
        const chapterDuration = chapterEnd - chapter.start;

        // Only show label if:
        // 1. Chapter is long enough (not a short intro/transition)
        // 2. There's enough space since last label
        const isLongEnough = chapterDuration >= MIN_CHAPTER_DURATION;
        const hasSpace = (x - lastLabelX) >= MIN_LABEL_SPACING;
        const showLabel = isLongEnough && hasSpace;

        tickArray.push({
          x,
          tier: 'chapter',
          label: showLabel ? `CH ${index + 1}` : undefined
        });

        if (showLabel) {
          lastLabelX = x;
        }
      }
    });

    // Tier 2: 10-minute ticks with chapter-relative minute labels
    const tenMinInterval = 10 * 60; // 600 seconds
    const startTenMin = Math.floor(minTime / tenMinInterval) * tenMinInterval;
    for (let t = startTenMin; t <= maxTime; t += tenMinInterval) {
      if (t < minTime) continue;
      // Skip if too close to a chapter tick
      const isNearChapter = chapters.some(ch => Math.abs(ch.start - t) < 30);
      if (!isNearChapter) {
        // Find which chapter this tick belongs to
        let chapterStart = 0;
        for (let i = chapters.length - 1; i >= 0; i--) {
          if (t >= chapters[i].start) {
            chapterStart = chapters[i].start;
            break;
          }
        }
        // Calculate minute within chapter (1-indexed: minute 1, 2, 3...)
        const secondsIntoChapter = t - chapterStart;
        const chapterMinute = secondsIntoChapter > 0 ? Math.floor(secondsIntoChapter / 60) + 1 : 0;

        tickArray.push({
          x: t * PIXELS_PER_SECOND,
          tier: 'tenMin',
          label: chapterMinute > 0 ? `${chapterMinute}` : undefined
        });
      }
    }

    // Tier 3: 1-minute ticks with chapter-relative minute labels
    const oneMinInterval = 60; // 60 seconds
    const startOneMin = Math.floor(minTime / oneMinInterval) * oneMinInterval;
    for (let t = startOneMin; t <= maxTime; t += oneMinInterval) {
      if (t < minTime) continue;
      // Skip if too close to a chapter or 10-min tick
      const isNearChapter = chapters.some(ch => Math.abs(ch.start - t) < 10);
      const isNear10Min = (t % tenMinInterval) < 10 || (tenMinInterval - (t % tenMinInterval)) < 10;
      if (!isNearChapter && !isNear10Min) {
        // Find which chapter this tick belongs to
        let chapterStart = 0;
        for (let i = chapters.length - 1; i >= 0; i--) {
          if (t >= chapters[i].start) {
            chapterStart = chapters[i].start;
            break;
          }
        }
        // Calculate minute within chapter (1-indexed: minute 1, 2, 3...)
        const secondsIntoChapter = t - chapterStart;
        const chapterMinute = secondsIntoChapter > 0 ? Math.floor(secondsIntoChapter / 60) + 1 : 0;

        tickArray.push({
          x: t * PIXELS_PER_SECOND,
          tier: 'oneMin',
          label: chapterMinute > 0 ? `${chapterMinute}` : undefined
        });
      }
    }

    // Tier 4: 15-second ticks
    const fifteenSecInterval = 15; // 15 seconds
    const startFifteenSec = Math.floor(minTime / fifteenSecInterval) * fifteenSecInterval;
    for (let t = startFifteenSec; t <= maxTime; t += fifteenSecInterval) {
      if (t < minTime) continue;
      // Skip if too close to any higher tier tick
      const isNearChapter = chapters.some(ch => Math.abs(ch.start - t) < 5);
      const isNear10Min = (t % tenMinInterval) < 5 || (tenMinInterval - (t % tenMinInterval)) < 5;
      const isNear1Min = (t % oneMinInterval) < 5 || (oneMinInterval - (t % oneMinInterval)) < 5;
      if (!isNearChapter && !isNear10Min && !isNear1Min) {
        tickArray.push({
          x: t * PIXELS_PER_SECOND,
          tier: 'fifteenSec'
        });
      }
    }

    return tickArray;
  }, [chapters, chapters.length, duration, effectivePosition]);

  const svgHeight = CHAPTER_TICKS_AREA_HEIGHT;
  const ticksY = CHAPTER_LABEL_Y + scale(4);

  const getTickHeight = (tier: 'chapter' | 'tenMin' | 'oneMin' | 'fifteenSec') => {
    switch (tier) {
      case 'chapter': return CHAPTER_TICK_HEIGHT;
      case 'tenMin': return TEN_MIN_TICK_HEIGHT;
      case 'oneMin': return ONE_MIN_TICK_HEIGHT;
      case 'fifteenSec': return FIFTEEN_SEC_TICK_HEIGHT;
    }
  };

  // Bookmark flag dimensions for chapter view - stem reaches full height
  const CHAPTER_FLAG_PENNANT_WIDTH = scale(24);  // Width of the flag part
  const CHAPTER_FLAG_PENNANT_HEIGHT = scale(12); // Height of the flag part
  const CHAPTER_FLAG_POLE_WIDTH = 2;
  const CHAPTER_FLAG_COLOR = '#0146F5';          // Solid blue for flag
  const CHAPTER_STEM_COLOR = '#64B5F6';          // Light blue for stem

  // Calculate bookmark positions within visible range
  const visibleBookmarks = useMemo(() => {
    if (!bookmarks.length) return [];
    const minTime = Math.max(0, effectivePosition - VISIBLE_WINDOW_SECONDS);
    const maxTime = Math.min(duration, effectivePosition + VISIBLE_WINDOW_SECONDS);

    return bookmarks
      .filter((bm) => {
        const time = Math.round(bm.time);
        return time >= minTime && time <= maxTime;
      })
      .map((bm) => ({
        id: bm.id,
        x: Math.round(bm.time) * PIXELS_PER_SECOND,
      }));
  }, [bookmarks, effectivePosition, duration]);

  return (
    <View style={chapterTimelineStyles.outerContainer}>
      {/* Marker line - positioned at bottom, extends up */}
      <View style={chapterTimelineStyles.markerLine} />
      <View style={chapterTimelineStyles.markerDot} />

      {/* Speed mode indicator (shown during direct scrub) */}
      {isDirectScrubbing && scrubSpeedMode !== 'normal' && (
        <View style={chapterTimelineStyles.speedIndicator}>
          <Text style={chapterTimelineStyles.speedIndicatorText}>
            {SPEED_MODE_LABELS[scrubSpeedMode]}
          </Text>
        </View>
      )}

      {/* Scrolling timeline area */}
      <GestureDetector gesture={combinedGesture}>
        <View style={chapterTimelineStyles.container}>
          <ReanimatedAnimated.View style={[chapterTimelineStyles.timeline, { width: timelineWidth }, timelineStyle]}>
            <Svg width={timelineWidth} height={svgHeight}>
              {/* Ticks - four tiers */}
              {ticks.map((tick, index) => {
                const tickHeight = getTickHeight(tick.tier);
                const tickY = ticksY + CHAPTER_TICK_HEIGHT - tickHeight;
                const isChapter = tick.tier === 'chapter';
                const hasMinuteLabel = tick.tier === 'oneMin' || tick.tier === 'tenMin';
                return (
                  <React.Fragment key={index}>
                    <Line
                      x1={tick.x}
                      y1={tickY}
                      x2={tick.x}
                      y2={ticksY + CHAPTER_TICK_HEIGHT}
                      stroke={themeColors.tickDefault}
                      strokeWidth={isChapter ? 2.5 : 1}
                    />
                    {tick.label && isChapter && (
                      <SvgText
                        x={tick.x}
                        y={CHAPTER_LABEL_Y}
                        fontSize={scale(11)}
                        fill={themeColors.textPrimary}
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {tick.label}
                      </SvgText>
                    )}
                    {tick.label && hasMinuteLabel && (
                      <SvgText
                        x={tick.x}
                        y={tickY - scale(6)}
                        fontSize={scale(10)}
                        fill={themeColors.textSecondary}
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {tick.label}
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
              {/* Bookmark flags - rendered within the scrolling SVG */}
              {visibleBookmarks.map((bm) => (
                <React.Fragment key={`bookmark-${bm.id}`}>
                  {/* Stem - full height like red center line */}
                  <Line
                    x1={bm.x}
                    y1={0}
                    x2={bm.x}
                    y2={svgHeight}
                    stroke={CHAPTER_STEM_COLOR}
                    strokeWidth={CHAPTER_FLAG_POLE_WIDTH}
                  />
                  {/* Flag - notched pennant shape (based on Flag.svg) */}
                  <Path
                    d={`M${bm.x} 0 H${bm.x + CHAPTER_FLAG_PENNANT_WIDTH} L${bm.x + CHAPTER_FLAG_PENNANT_WIDTH * 0.78} ${CHAPTER_FLAG_PENNANT_HEIGHT / 2} L${bm.x + CHAPTER_FLAG_PENNANT_WIDTH} ${CHAPTER_FLAG_PENNANT_HEIGHT} H${bm.x} Z`}
                    fill={CHAPTER_FLAG_COLOR}
                  />
                </React.Fragment>
              ))}
            </Svg>
          </ReanimatedAnimated.View>
        </View>
      </GestureDetector>
    </View>
  );
});

const CHAPTER_TICKS_AREA_HEIGHT = CHAPTER_LABEL_Y + CHAPTER_TICK_HEIGHT + scale(8);
const CHAPTER_MARKER_LINE_HEIGHT = CHAPTER_TIMELINE_TOTAL_HEIGHT - CHAPTER_MARKER_CIRCLE_SIZE;

const chapterTimelineStyles = StyleSheet.create({
  outerContainer: {
    width: TIMELINE_WIDTH,
    height: CHAPTER_TIMELINE_TOTAL_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    position: 'absolute',
    top: scale(115), // Moved down ~115px to position over timeline ticks
    left: CHAPTER_MARKER_X - CHAPTER_MARKER_CIRCLE_SIZE / 2,
    alignItems: 'center',
    zIndex: 10,
  },
  markerCircle: {
    width: CHAPTER_MARKER_CIRCLE_SIZE,
    height: CHAPTER_MARKER_CIRCLE_SIZE,
    borderRadius: CHAPTER_MARKER_CIRCLE_SIZE / 2,
    backgroundColor: '#F50101',
  },
  markerLine: {
    position: 'absolute',
    bottom: 0, // Anchored at bottom of timeline
    left: CHAPTER_MARKER_X - 1, // Center horizontally (line is 2px wide)
    width: 2,
    height: CHAPTER_TICKS_AREA_HEIGHT, // Extend up through ticks area
    backgroundColor: '#F50101',
    zIndex: 5,
  },
  markerDot: {
    position: 'absolute',
    bottom: CHAPTER_TICKS_AREA_HEIGHT - 3, // At top of line, centered
    left: CHAPTER_MARKER_X - 3, // Center the 6px dot
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F50101',
    zIndex: 6,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    width: TIMELINE_WIDTH,
    height: CHAPTER_TICKS_AREA_HEIGHT,
    overflow: 'hidden',
  },
  timeline: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
  },
  speedIndicator: {
    position: 'absolute',
    top: scale(40),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(8),
    zIndex: 20,
  },
  speedIndicatorText: {
    color: '#FFFFFF',
    fontSize: scale(13),
    fontWeight: '600',
    textAlign: 'center',
  },
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CDPlayerScreen() {
  useScreenLoadTime('CDPlayerScreen');

  // Performance tracking (dev only)
  if (__DEV__) {
    useRenderTracker('CDPlayerScreen');
    useLifecycleTracker('CDPlayerScreen');
  }

  // FPS monitoring for the full player screen
  useFpsMonitor('fullPlayer');

  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const wasVisibleRef = useRef(false); // Track previous visibility to prevent stutter

  // Store state
  const {
    currentBook,
    isPlayerVisible,
    isPlaying,
    isLoading,
    isBuffering,
    duration,
    playbackRate,
    sleepTimer,
    chapters,
    bookmarks,
  } = usePlayerStore(
    useShallow((s) => ({
      currentBook: s.currentBook,
      isPlayerVisible: s.isPlayerVisible,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      isBuffering: s.isBuffering,
      bookmarks: s.bookmarks,
      // NOTE: position removed - causes excessive re-renders (2x/sec)
      // Use usePlaybackPosition() hook below for position-dependent UI
      duration: s.duration,
      playbackRate: s.playbackRate,
      sleepTimer: s.sleepTimer,
      chapters: s.chapters,
    }))
  );

  // Position-dependent state - isolated to minimize re-renders
  // This only re-renders components that actually need position
  const position = usePlayerStore((s) => s.isSeeking ? s.seekPosition : s.position);

  // Actions
  const closePlayer = usePlayerStore((s) => s.closePlayer);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const clearSleepTimer = usePlayerStore((s) => s.clearSleepTimer);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const nextChapter = usePlayerStore((s) => s.nextChapter);
  const prevChapter = usePlayerStore((s) => s.prevChapter);
  const addBookmark = usePlayerStore((s) => s.addBookmark);

  // Skip interval settings
  const skipForwardInterval = usePlayerStore((s) => s.skipForwardInterval ?? 30);
  const skipBackInterval = usePlayerStore((s) => s.skipBackInterval ?? 15);

  // NOTE: sleepTimerState hook removed - was unused and could cause re-renders during countdown
  // sleepTimer is already available from the main useShallow selector above

  const chapterIndex = useCurrentChapterIndex();
  // NOTE: bookProgress removed - was unused and caused extra re-renders on every position tick
  const coverUrl = useCoverUrl(currentBook?.id || '');
  const { isAvailable: isDownloaded } = useIsOfflineAvailable(currentBook?.id || '');
  const queueCount = useQueueCount();
  const clearQueue = useQueueStore((s) => s.clearQueue);

  // Accessibility: respect reduced motion preference
  const reducedMotion = useReducedMotion();

  // Theme colors
  const themeColors = usePlayerColors();
  const isDarkMode = useThemeStore((s) => s.mode === 'dark');

  // Player appearance settings
  const discAnimationSetting = usePlayerStore((s) => s.discAnimationEnabled ?? true);
  const useStandardPlayer = usePlayerStore((s) => s.useStandardPlayer ?? false);
  // Combine user setting with system reduced motion - disable if either is true
  const discAnimationEnabled = discAnimationSetting && !reducedMotion;

  // Disc rotation control
  // Shared rotation value - both sharp and blurred discs use this for sync
  const discRotation = useSharedValue(0);
  // scrubSpeed: degrees per second when scrubbing (negative = backward)
  // spinBurst: instant rotation delta for skip button feedback
  const discScrubSpeed = useSharedValue(0);
  const discSpinBurst = useSharedValue(0);

  // Local state
  const [activeSheet, setActiveSheet] = useState<SheetType>('none');
  const [progressMode, setProgressMode] = useState<ProgressMode>('chapter');

  // Deferred initialization - wait for navigation animation to complete
  // This improves perceived performance by not blocking the initial render
  const [interactionsReady, setInteractionsReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setInteractionsReady(true);
    });
    return () => handle.cancel();
  }, []);

  // Book metadata
  const metadata = currentBook?.media?.metadata as any;
  const title = metadata?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const description = metadata?.description || '';
  // Narrator: try narratorName, then narrators array
  const narrator = metadata?.narratorName ||
    (metadata?.narrators?.length > 0
      ? metadata.narrators.map((n: any) => typeof n === 'string' ? n : n.name).filter(Boolean).join(', ')
      : '');
  const currentChapter = chapters[chapterIndex];

  // Get normalized chapter names based on user settings
  const normalizedChapters = useNormalizedChapters(chapters, { bookTitle: title });
  const currentNormalizedChapter = normalizedChapters[chapterIndex];

  // Calculate disc center Y position dynamically based on insets
  // Header: insets.top + scale(10) padding + headerRow (scale(44) button + scale(12) margin) + title (~scale(18)) + author (scale(6) margin + scale(16)) + disc margin scale(10)
  const headerHeight = insets.top + scale(10) + scale(44) + scale(12) + scale(18) + scale(6) + scale(16) + scale(10);
  const discCenterY = headerHeight + (DISC_SIZE / 2);

  // Progress calculation based on mode
  const currentChapterData = chapters[chapterIndex];
  const chapterStart = currentChapterData?.start || 0;
  const chapterEnd = currentChapterData?.end || duration;
  const chapterDuration = chapterEnd - chapterStart;
  const chapterPosition = position - chapterStart;

  // Progress percentage based on mode
  const progressPercent = useMemo(() => {
    if (progressMode === 'chapter') {
      const percent = chapterDuration > 0 ? (chapterPosition / chapterDuration) * 100 : 0;
      return Math.max(0, Math.min(100, percent));
    }
    const percent = duration > 0 ? (position / duration) * 100 : 0;
    return Math.max(0, Math.min(100, percent));
  }, [progressMode, chapterPosition, chapterDuration, position, duration]);

  // Chapter markers as percentages for book mode
  const chapterMarkers = useMemo(() => {
    if (progressMode !== 'book' || duration <= 0) return [];
    return chapters.map((ch: any) => (ch.start / duration) * 100);
  }, [progressMode, chapters, duration]);

  // Format sleep timer display - live countdown with seconds
  const formatSleepTimer = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return 'Off';

    // For timers > 1 hour, show hours and minutes
    if (seconds >= 3600) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }

    // For timers > 5 minutes, show minutes and seconds
    if (seconds >= 300) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // For timers <= 5 minutes, show live countdown MM:SS
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  
  // Pan responder for swipe down
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 20 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          // Snap back instantly
          slideAnim.setValue(0);
        }
      },
    })
  ).current;

  // Instant open - no animation
  React.useEffect(() => {
    if (isPlayerVisible && currentBook) {
      if (!wasVisibleRef.current) {
        slideAnim.setValue(0);
      }
      wasVisibleRef.current = true;
    } else {
      wasVisibleRef.current = false;
    }
  }, [isPlayerVisible, currentBook?.id]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleClose = useCallback(() => {
    setActiveSheet('none');
    closePlayer();
  }, [closePlayer]);

  // Navigate to book details
  const handleTitlePress = useCallback(() => {
    if (!currentBook) return;
    haptics.selection();
    handleClose();
    navigation.navigate('BookDetail', { id: currentBook.id });
  }, [currentBook, handleClose, navigation]);

  const handleSeek = useCallback((percent: number) => {
    let newPosition: number;
    if (progressMode === 'chapter') {
      // In chapter mode, percent is relative to current chapter
      newPosition = chapterStart + (percent / 100) * chapterDuration;
    } else {
      // In book mode, percent is relative to full book
      newPosition = (percent / 100) * duration;
    }
    seekTo?.(newPosition);
  }, [progressMode, chapterStart, chapterDuration, duration, seekTo]);

  
  // Chapter select
  const handleChapterSelect = useCallback((chapterStart: number) => {
    haptics.selection();
    seekTo?.(chapterStart);
    setActiveSheet('none');
  }, [seekTo]);

  // Skip backward using configured interval
  // NOTE: Uses getState() to avoid callback recreation on position updates
  const handleSkipBack = useCallback(() => {
    haptics.skip();  // Use category-specific haptic for playback controls
    const currentPos = usePlayerStore.getState().position;
    const newPosition = Math.max(0, currentPos - skipBackInterval);
    seekTo?.(newPosition);
    // Spin disc backward for visual feedback (90 degrees)
    discSpinBurst.value = -90;
  }, [skipBackInterval, seekTo, discSpinBurst]);

  // Skip forward using configured interval
  // NOTE: Uses getState() to avoid callback recreation on position updates
  const handleSkipForward = useCallback(() => {
    haptics.skip();  // Use category-specific haptic for playback controls
    const state = usePlayerStore.getState();
    const newPosition = Math.min(state.duration, state.position + skipForwardInterval);
    seekTo?.(newPosition);
    // Spin disc forward for visual feedback (90 degrees)
    discSpinBurst.value = 90;
  }, [skipForwardInterval, seekTo, discSpinBurst]);

  // Long-press: Skip to previous chapter
  const handlePrevChapter = useCallback(() => {
    haptics.chapterChange();  // Use chapter-specific haptic
    prevChapter?.();
    // Spin disc backward for visual feedback (180 degrees for chapter jump)
    discSpinBurst.value = -180;
  }, [prevChapter, discSpinBurst]);

  // Long-press: Skip to next chapter
  const handleNextChapter = useCallback(() => {
    haptics.chapterChange();  // Use chapter-specific haptic
    nextChapter?.();
    // Spin disc forward for visual feedback (180 degrees for chapter jump)
    discSpinBurst.value = 180;
  }, [nextChapter, discSpinBurst]);

  // Bookmark toast and note input state
  const [showBookmarkToast, setShowBookmarkToast] = useState(false);
  const [lastCreatedBookmarkId, setLastCreatedBookmarkId] = useState<string | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteInputValue, setNoteInputValue] = useState('');
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [deletedBookmark, setDeletedBookmark] = useState<{ bookmark: any; timeout: NodeJS.Timeout } | null>(null);
  const updateBookmark = usePlayerStore((s) => s.updateBookmark);
  const removeBookmark = usePlayerStore((s) => s.removeBookmark);

  // Add bookmark at current position with toast feedback
  const handleAddBookmark = useCallback(() => {
    const state = usePlayerStore.getState();
    const currentPos = state.position;
    const chapter = chapters[chapterIndex];
    const chapterTitle = chapter?.title || `Chapter ${chapterIndex + 1}`;

    // Generate bookmark ID for tracking
    const bookmarkId = `bm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    addBookmark?.({
      title: `Bookmark at ${formatTime(currentPos)}`,
      note: null,
      time: currentPos,
      chapterTitle,
    });

    // Show toast with "Add note" option
    setLastCreatedBookmarkId(bookmarkId);
    setShowBookmarkToast(true);

    // Auto-hide toast after 4 seconds
    setTimeout(() => {
      setShowBookmarkToast(false);
      setLastCreatedBookmarkId(null);
    }, 4000);
  }, [chapters, chapterIndex, addBookmark]);

  // Handle adding note from toast
  const handleAddNoteFromToast = useCallback(() => {
    setShowBookmarkToast(false);
    // Find the most recently added bookmark
    const latestBookmark = bookmarks[bookmarks.length - 1];
    if (latestBookmark) {
      setEditingBookmarkId(latestBookmark.id);
      setNoteInputValue(latestBookmark.note || '');
      setShowNoteInput(true);
    }
  }, [bookmarks]);

  // Save note
  const handleSaveNote = useCallback(() => {
    if (editingBookmarkId) {
      updateBookmark(editingBookmarkId, { note: noteInputValue || null });
      haptics.selection();
    }
    setShowNoteInput(false);
    setNoteInputValue('');
    setEditingBookmarkId(null);
  }, [editingBookmarkId, noteInputValue, updateBookmark]);

  // Delete bookmark with undo
  const handleDeleteBookmark = useCallback((bookmark: any) => {
    // Clear any existing undo timeout
    if (deletedBookmark?.timeout) {
      clearTimeout(deletedBookmark.timeout);
    }

    // Remove from store
    removeBookmark(bookmark.id);

    // Set up undo with 5 second window
    const timeout = setTimeout(() => {
      setDeletedBookmark(null);
    }, 5000);

    setDeletedBookmark({ bookmark, timeout });
  }, [removeBookmark, deletedBookmark]);

  // Undo delete
  const handleUndoDelete = useCallback(() => {
    if (deletedBookmark) {
      clearTimeout(deletedBookmark.timeout);
      // Re-add the bookmark
      addBookmark?.({
        title: deletedBookmark.bookmark.title,
        note: deletedBookmark.bookmark.note,
        time: deletedBookmark.bookmark.time,
        chapterTitle: deletedBookmark.bookmark.chapterTitle,
      });
      setDeletedBookmark(null);
    }
  }, [deletedBookmark, addBookmark]);

  // Format date for bookmark display
  const formatBookmarkDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const renderChaptersSheet = () => (
    <View style={[styles.sheet, styles.chaptersSheet, { backgroundColor: themeColors.sheetBackground }]}>
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>Chapters</Text>
        <TouchableOpacity
          onPress={() => setActiveSheet('none')}
          style={styles.sheetClose}
          accessibilityLabel="Close chapters"
          accessibilityRole="button"
        >
          <X size={24} color={themeColors.iconPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.chaptersList} showsVerticalScrollIndicator={false}>
        {normalizedChapters.map((chapter, index: number) => {
          const isCurrentChapter = index === chapterIndex;
          const chapterTitle = chapter.displayTitle || `Chapter ${index + 1}`;
          const chapterDuration = formatTime(chapter.end - chapter.start);

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.chapterItem,
                isCurrentChapter && { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0' },
              ]}
              onPress={() => handleChapterSelect(chapter.start)}
              accessibilityLabel={`${chapterTitle}, ${chapterDuration}${isCurrentChapter ? ', currently playing' : ''}`}
              accessibilityRole="button"
              accessibilityHint="Double tap to jump to this chapter"
            >
              <Text style={[styles.chapterNumber, { color: themeColors.textTertiary }]}>{index + 1}</Text>
              <View style={styles.chapterInfo}>
                <Text
                  style={[
                    styles.chapterTitle,
                    { color: themeColors.textPrimary },
                    isCurrentChapter && styles.chapterTitleActive,
                  ]}
                  numberOfLines={1}
                >
                  {chapterTitle}
                </Text>
                <Text style={[styles.chapterDuration, { color: themeColors.textSecondary }]}>
                  {chapterDuration}
                </Text>
              </View>
              {isCurrentChapter && (
                <Volume2 size={16} color={ACCENT_COLOR} strokeWidth={2} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // Custom speed input state - show current value if not a quick option
  const isSpeedQuickOption = SPEED_QUICK_OPTIONS.includes(playbackRate);
  const [customSpeedInput, setCustomSpeedInput] = useState(
    isSpeedQuickOption ? '' : String(playbackRate)
  );

  // Custom sleep input state - show current minutes if not a quick option
  const currentSleepMinutes = sleepTimer ? Math.ceil(sleepTimer / 60) : 0;
  const isSleepQuickOption = SLEEP_QUICK_OPTIONS.includes(currentSleepMinutes);
  const [customSleepInput, setCustomSleepInput] = useState(
    sleepTimer && !isSleepQuickOption ? String(currentSleepMinutes) : ''
  );

  // Update custom inputs when values change externally
  useEffect(() => {
    if (!SPEED_QUICK_OPTIONS.includes(playbackRate)) {
      setCustomSpeedInput(String(playbackRate));
    } else {
      setCustomSpeedInput('');
    }
  }, [playbackRate]);

  useEffect(() => {
    const mins = sleepTimer ? Math.ceil(sleepTimer / 60) : 0;
    if (sleepTimer && !SLEEP_QUICK_OPTIONS.includes(mins)) {
      setCustomSleepInput(String(mins));
    } else {
      setCustomSleepInput('');
    }
  }, [sleepTimer]);

  const handleCustomSpeedSubmit = useCallback(() => {
    Keyboard.dismiss();
    const parsed = parseFloat(customSpeedInput);
    if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 4) {
      setPlaybackRate(Math.round(parsed * 100) / 100);
      haptics.selection();
    }
  }, [customSpeedInput, setPlaybackRate]);

  const handleCustomSleepSubmit = useCallback(() => {
    Keyboard.dismiss();
    const parsed = parseInt(customSleepInput, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 720) {
      setSleepTimer(parsed);
      haptics.selection();
    }
  }, [customSleepInput, setSleepTimer]);

  // Format sleep timer as mm:ss for live countdown
  const formatSleepCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSettingsSheet = () => (
    <View style={[styles.sheet, { backgroundColor: themeColors.sheetBackground }]}>
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>Settings</Text>
        <TouchableOpacity onPress={() => setActiveSheet('none')} style={styles.sheetClose}>
          <X size={24} color={themeColors.iconPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Progress Bar: Book/Chapter Toggle */}
      <View style={styles.settingsSection}>
        <Text style={[styles.settingsSectionTitle, { color: themeColors.textTertiary }]}>Progress Bar</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0' },
              progressMode === 'book' && { backgroundColor: themeColors.buttonBackground },
            ]}
            onPress={() => {
              setProgressMode('book');
              haptics.selection();
            }}
          >
            <Text style={[
              styles.toggleOptionText,
              { color: themeColors.textSecondary },
              progressMode === 'book' && { color: themeColors.buttonText, fontWeight: '600' },
            ]}>Book</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0' },
              progressMode === 'chapter' && { backgroundColor: themeColors.buttonBackground },
            ]}
            onPress={() => {
              setProgressMode('chapter');
              haptics.selection();
            }}
          >
            <Text style={[
              styles.toggleOptionText,
              { color: themeColors.textSecondary },
              progressMode === 'chapter' && { color: themeColors.buttonText, fontWeight: '600' },
            ]}>Chapter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Speed */}
      <View style={styles.settingsSection}>
        <View style={styles.settingsTitleRow}>
          <Gauge size={16} color={themeColors.textTertiary} strokeWidth={2} />
          <Text style={[styles.settingsSectionTitle, { marginBottom: 0, marginLeft: 6, color: themeColors.textTertiary }]}>Speed</Text>
          <Text style={[styles.settingStatusText, { color: themeColors.textPrimary }]}>{playbackRate}x</Text>
        </View>
        <View style={styles.optionsRow}>
          {SPEED_QUICK_OPTIONS.map((speed) => (
            <TouchableOpacity
              key={speed}
              style={[
                styles.quickOption,
                { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0' },
                playbackRate === speed && { backgroundColor: themeColors.buttonBackground },
              ]}
              onPress={() => {
                setPlaybackRate(speed);
                haptics.selection();
              }}
            >
              <Text style={[
                styles.quickOptionText,
                { color: themeColors.textSecondary },
                playbackRate === speed && { color: themeColors.buttonText, fontWeight: '600' },
              ]}>
                {speed}x
              </Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.customInputContainer, { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0', borderColor: themeColors.border }]}>
            <TextInput
              style={[styles.customInput, { color: themeColors.textPrimary }]}
              value={customSpeedInput}
              onChangeText={setCustomSpeedInput}
              onSubmitEditing={handleCustomSpeedSubmit}
              onBlur={handleCustomSpeedSubmit}
              placeholder="0.1-4"
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
        </View>
      </View>

      {/* Sleep Timer */}
      <View style={styles.settingsSection}>
        <View style={styles.settingsTitleRow}>
          <Moon size={16} color={themeColors.textTertiary} strokeWidth={2} />
          <Text style={[styles.settingsSectionTitle, { marginBottom: 0, marginLeft: 6, color: themeColors.textTertiary }]}>Sleep Timer</Text>
          <Text style={[styles.settingStatusText, { color: sleepTimer ? '#E53935' : themeColors.textPrimary }]}>
            {sleepTimer ? `${Math.ceil(sleepTimer / 60)}m` : 'Off'}
          </Text>
          {sleepTimer && (
            <TouchableOpacity
              style={styles.offButtonSmall}
              onPress={() => {
                clearSleepTimer();
                haptics.selection();
              }}
            >
              <X size={14} color="#E53935" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.optionsRow}>
          {SLEEP_QUICK_OPTIONS.map((mins) => (
            <TouchableOpacity
              key={mins}
              style={[
                styles.quickOption,
                { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0' },
                sleepTimer && Math.ceil(sleepTimer / 60) === mins && { backgroundColor: themeColors.buttonBackground },
              ]}
              onPress={() => {
                setSleepTimer(mins);
                haptics.selection();
              }}
            >
              <Text style={[
                styles.quickOptionText,
                { color: themeColors.textSecondary },
                sleepTimer && Math.ceil(sleepTimer / 60) === mins && { color: themeColors.buttonText, fontWeight: '600' },
              ]}>
                {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.customInputContainer, { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0', borderColor: themeColors.border }]}>
            <TextInput
              style={[styles.customInput, { color: themeColors.textPrimary }]}
              value={customSleepInput}
              onChangeText={setCustomSleepInput}
              onSubmitEditing={handleCustomSleepSubmit}
              onBlur={handleCustomSleepSubmit}
              placeholder="min"
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="number-pad"
              returnKeyType="done"
            />
          </View>
        </View>
      </View>

      {/* Action Buttons - Stacked */}
      <View style={styles.settingsActionsColumn}>
        <TouchableOpacity
          style={[styles.settingsActionButtonFull, { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0' }]}
          onPress={() => {
            haptics.selection();
            setActiveSheet('bookmarks');
          }}
        >
          <Bookmark size={18} color={themeColors.iconPrimary} strokeWidth={2} />
          <Text style={[styles.settingsActionText, { color: themeColors.textPrimary }]}>Bookmarks</Text>
          {bookmarks.length > 0 && (
            <View style={[styles.settingsActionBadge, { backgroundColor: themeColors.buttonBackground }]}>
              <Text style={[styles.settingsActionBadgeText, { color: themeColors.buttonText }]}>{bookmarks.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingsActionButtonFull, { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F0F0F0' }, queueCount === 0 && styles.settingsActionButtonDisabled]}
          onPress={() => {
            if (queueCount > 0) {
              haptics.impact('medium');
              clearQueue();
            }
          }}
        >
          <Trash2 size={18} color={queueCount > 0 ? themeColors.iconPrimary : themeColors.textTertiary} strokeWidth={2} />
          <Text style={[styles.settingsActionText, { color: themeColors.textPrimary }, queueCount === 0 && { color: themeColors.textTertiary }]}>
            Clear Queue
          </Text>
          {queueCount > 0 && (
            <View style={[styles.settingsActionBadge, { backgroundColor: themeColors.buttonBackground }]}>
              <Text style={[styles.settingsActionBadgeText, { color: themeColors.buttonText }]}>{queueCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Bookmarks sheet renderer
  const renderBookmarksSheet = () => (
    <View style={[styles.sheet, { backgroundColor: themeColors.sheetBackground }]}>
      <View style={styles.sheetHeader}>
        <TouchableOpacity
          onPress={() => setActiveSheet('settings')}
          style={styles.sheetBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.sheetBackText, { color: themeColors.textSecondary }]}>← Settings</Text>
        </TouchableOpacity>
        <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>Bookmarks</Text>
        <TouchableOpacity onPress={() => setActiveSheet('none')} style={styles.sheetClose}>
          <X size={24} color={themeColors.iconPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.bookmarksScrollView} showsVerticalScrollIndicator={false}>
        {bookmarks.length === 0 ? (
          <View style={styles.bookmarksEmpty}>
            <Bookmark size={48} color={themeColors.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.bookmarksEmptyText, { color: themeColors.textPrimary }]}>No bookmarks yet</Text>
            <Text style={[styles.bookmarksEmptySubtext, { color: themeColors.textSecondary }]}>
              Tap the bookmark button while listening to save your place.
            </Text>
            <Text style={[styles.bookmarksEmptyHint, { color: themeColors.textTertiary }]}>
              Perfect for favorite quotes, important passages, or where you left off.
            </Text>
          </View>
        ) : (
          bookmarks.map((bookmark) => (
            <View key={bookmark.id} style={[styles.bookmarkCard, { backgroundColor: isDarkMode ? themeColors.backgroundTertiary : '#F8F8F8' }]}>
              {/* Main content - tap to play */}
              <TouchableOpacity
                style={styles.bookmarkCardContent}
                onPress={() => {
                  seekTo(bookmark.time);
                  haptics.selection();
                  setActiveSheet('none');
                }}
                onLongPress={() => {
                  setEditingBookmarkId(bookmark.id);
                  setNoteInputValue(bookmark.note || '');
                  setShowNoteInput(true);
                  haptics.impact('medium');
                }}
              >
                {/* Cover thumbnail */}
                {coverUrl && (
                  <Image
                    source={coverUrl}
                    style={styles.bookmarkCover}
                    contentFit="cover"
                  />
                )}
                <View style={styles.bookmarkInfo}>
                  <Text style={[styles.bookmarkChapter, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {bookmark.chapterTitle || 'Unknown Chapter'}
                  </Text>
                  <Text style={[styles.bookmarkTime, { color: themeColors.accentRed }]}>
                    {formatTime(bookmark.time)}
                  </Text>
                  {bookmark.note && (
                    <Text style={[styles.bookmarkNote, { color: themeColors.textSecondary }]} numberOfLines={2}>
                      "{bookmark.note}"
                    </Text>
                  )}
                  <Text style={[styles.bookmarkDate, { color: themeColors.textTertiary }]}>
                    {formatBookmarkDate(bookmark.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Action buttons */}
              <View style={styles.bookmarkActions}>
                <TouchableOpacity
                  style={[styles.bookmarkPlayButton, { backgroundColor: themeColors.buttonBackground }]}
                  onPress={() => {
                    seekTo(bookmark.time);
                    haptics.selection();
                    setActiveSheet('none');
                  }}
                >
                  <Play size={16} color={themeColors.buttonText} fill={themeColors.buttonText} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bookmarkDeleteButton}
                  onPress={() => {
                    handleDeleteBookmark(bookmark);
                    haptics.impact('light');
                  }}
                >
                  <Trash2 size={16} color={themeColors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  if (!isPlayerVisible || !currentBook) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: useStandardPlayer ? themeColors.background : colors.backgroundPrimary,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <StatusBar barStyle={themeColors.statusBar} />

      {/* Background blur layer - only for CD player mode */}
      {!useStandardPlayer && (
        <View style={styles.backgroundContainer}>
          {coverUrl && (
            <Image
              source={coverUrl}
              style={StyleSheet.absoluteFill}
              blurRadius={50}
              contentFit="cover"
            />
          )}
          {/* BlurView overlay for Android (blurRadius only works on iOS) */}
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,1)']}
            locations={[0, 0.35, 0.6]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* Streaming / Settings row with centered arrow */}
        <View style={styles.headerRow}>
          {/* Left - Source indicator */}
          <View style={styles.sourceIndicator}>
            {isDownloaded ? (
              <CheckCircle size={scale(14)} color="#34C759" strokeWidth={2} />
            ) : (
              <Cloud size={scale(14)} color={useStandardPlayer ? themeColors.iconSecondary : "rgba(255,255,255,0.5)"} strokeWidth={2} />
            )}
            <Text style={[
              styles.sourceText,
              isDownloaded && styles.sourceTextDownloaded,
              useStandardPlayer && { color: themeColors.textSecondary },
            ]}>
              {isDownloaded ? 'Downloaded' : 'Streaming'}
            </Text>
          </View>
          {/* Center - Down arrow (tap to close) - absolutely positioned for true center */}
          <TouchableOpacity
            style={styles.arrowButtonCentered}
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Close player"
          >
            <DownArrowIcon color={useStandardPlayer ? themeColors.iconMuted : "rgba(255,255,255,0.4)"} />
          </TouchableOpacity>
          {/* Spacer to balance settings button */}
          <View style={styles.headerSpacer} />
          {/* Right - Settings */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setActiveSheet('settings')}
            activeOpacity={0.7}
          >
            <SettingsIcon color={useStandardPlayer ? themeColors.iconPrimary : "#FFF"} />
          </TouchableOpacity>
        </View>
        {/* CD Mode: Centered title/author */}
        {!useStandardPlayer && (
          <>
            <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </TouchableOpacity>
            <Text style={styles.author} numberOfLines={1}>{author}</Text>
          </>
        )}
        {/* Standard Mode: Book Detail style */}
        {useStandardPlayer && (
          <View style={styles.standardTitleSection}>
            <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
              <Text style={[styles.standardTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>{title}</Text>
            </TouchableOpacity>
            <View style={styles.standardMetaRow}>
              <View style={styles.standardMetaCell}>
                <Text style={[styles.standardMetaLabel, { color: themeColors.textTertiary }]}>WRITTEN BY</Text>
                <TouchableOpacity
                  onPress={() => {
                    const firstAuthor = author.split(',')[0].trim();
                    (navigation as any).navigate('AuthorDetail', { authorName: firstAuthor });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.standardMetaValue, { color: themeColors.textSecondary }]} numberOfLines={1}>{author}</Text>
                </TouchableOpacity>
              </View>
              {narrator ? (
                <View style={styles.standardMetaCell}>
                  <Text style={[styles.standardMetaLabel, { color: themeColors.textTertiary }]}>NARRATED BY</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const firstNarrator = narrator.split(',')[0].trim();
                      (navigation as any).navigate('NarratorDetail', { narratorName: firstNarrator });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.standardMetaValue, { color: themeColors.textSecondary }]} numberOfLines={1}>{narrator}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        )}
        {/* Standard Player: Chapter title & time remaining - just under header */}
        {useStandardPlayer && (
          <View style={styles.standardChapterRowTop}>
            <TouchableOpacity onPress={() => setActiveSheet('chapters')} style={styles.standardChapterTouch}>
              <Text style={[styles.standardChapterTextTop, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {currentNormalizedChapter?.displayTitle || `Chapter ${chapterIndex + 1}`}
              </Text>
            </TouchableOpacity>
            <Text style={styles.standardChapterTimeTop}>
              {formatTimeVerbose(position)}
            </Text>
          </View>
        )}
      </View>

      {/* CD Player Mode - Disc Animation */}
      {!useStandardPlayer && (
        <>
          {/* Sharp CD Disc - top portion, hard clip (no radial fade) */}
          {/* Height is DISC_SIZE/2 + 20px to lower the glass line and hide any seam */}
          <View style={[styles.discContainer, { height: DISC_SIZE / 2 + scale(20), overflow: 'hidden' }]}>
            <CDDisc
              coverUrl={coverUrl}
              rotation={discRotation}
              isPrimary={true}
              isPlaying={isPlaying && discAnimationEnabled && interactionsReady}
              isBuffering={isBuffering && !isDownloaded && interactionsReady}
              playbackRate={playbackRate}
              reducedMotion={reducedMotion ?? false}
              scrubSpeed={discScrubSpeed}
              spinBurst={discSpinBurst}
            />
            {/* Playing indicator for reduced motion mode */}
            {reducedMotion && isPlaying && (
              <View style={styles.playingBadge}>
                <Play size={scale(10)} color="#000" fill="#000" strokeWidth={0} />
                <Text style={styles.playingBadgeText}>Playing</Text>
              </View>
            )}
            {/* Speed badge when not 1.0x */}
            {playbackRate !== 1 && (
              <View style={styles.speedBadgeOnDisc}>
                <Text style={styles.speedBadgeOnDiscText}>{playbackRate}x</Text>
              </View>
            )}
          </View>

          {/* Shadow gradient above blur - simulates shadow under the holder */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)']}
            style={[styles.holderShadow, { top: discCenterY - scale(30) }]}
          />

          {/* Blurred CD Disc - clipped to bottom half, extends to bottom of screen */}
          {/* Note: top is discCenterY - 2 to create overlap and hide seam between sharp/blurred halves */}
          <View style={[styles.blurredDiscContainer, { top: discCenterY - 2, bottom: 0 }]}>
            {MaskedView ? (
              <MaskedView
                style={{ width: DISC_SIZE, height: DISC_SIZE / 2 }}
                maskElement={
                  <Svg width={DISC_SIZE} height={DISC_SIZE} style={{ marginTop: -(DISC_SIZE / 2) }}>
                    <Defs>
                      <RadialGradient id="edgeFade" cx="50%" cy="50%" r="50%">
                        <Stop offset="0" stopColor="white" stopOpacity="1" />
                        <Stop offset="0.9" stopColor="white" stopOpacity="1" />
                        <Stop offset="1" stopColor="white" stopOpacity="0" />
                      </RadialGradient>
                    </Defs>
                    <Circle cx={DISC_SIZE / 2} cy={DISC_SIZE / 2} r={DISC_SIZE / 2 + scale(5)} fill="url(#edgeFade)" />
                  </Svg>
                }
              >
                <View style={{ marginTop: - (DISC_SIZE / 2), alignItems: 'center' }}>
                  <CDDisc
                    coverUrl={coverUrl}
                    size={DISC_SIZE + scale(5)}
                    rotation={discRotation}
                    isPrimary={false}
                    isBlurred={true}
                    reducedMotion={reducedMotion ?? false}
                  />
                </View>
              </MaskedView>
            ) : (
              /* Fallback when MaskedView native module not available */
              <View style={{ marginTop: -(DISC_SIZE / 2), alignItems: 'center' }}>
                <CDDisc
                  coverUrl={coverUrl}
                  size={DISC_SIZE + scale(5)}
                  rotation={discRotation}
                  isPrimary={false}
                  isBlurred={true}
                  reducedMotion={reducedMotion ?? false}
                />
              </View>
            )}
            {/* Dark overlay on top of blurred disc */}
            <View style={styles.blurDarkOverlay} />
            {/* Bottom fade gradient - adds extra darkening below disc */}
            {/* Combined with blurDarkOverlay, creates smooth fade to black */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', '#000']}
              locations={[0, 0.3, 0.5, 0.8]}
              style={styles.blurBottomGradient}
            />
            {/* Glass line at top */}
            <View style={styles.blurTopLine} />
          </View>
        </>
      )}

      {/* Pills - CD mode only (Standard Player has controls in settings/overlay) */}
      {!useStandardPlayer && (
        <View style={[styles.pillsOverlay, { top: discCenterY + scale(12) }]}>
          <View style={styles.pillsRow}>
            {/* Left column: Sleep + Queue stacked */}
            <View style={styles.pillsColumn}>
              <TouchableOpacity
                onPress={() => setActiveSheet('sleep')}
                style={styles.pillButton}
                activeOpacity={0.7}
                accessibilityLabel={sleepTimer && sleepTimer > 0
                  ? `Sleep timer active, ${formatSleepTimer(sleepTimer)} remaining`
                  : 'Set sleep timer'}
                accessibilityRole="button"
              >
                <View style={styles.pillBorder} />
                <MoonIcon />
                {sleepTimer !== null && sleepTimer > 0 ? (
                  <View style={styles.timerCountdownContainer}>
                    <Text style={[styles.pillText, styles.pillTextActive]}>
                      {formatSleepTimer(sleepTimer)}
                    </Text>
                    <View style={styles.timerActiveDot} />
                  </View>
                ) : (
                  <Text style={styles.pillText}>Off</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveSheet('queue')}
                style={[styles.pillButton, styles.queuePill]}
                activeOpacity={0.7}
                accessibilityLabel={queueCount > 0 ? `Queue with ${queueCount} items` : 'Queue empty'}
                accessibilityRole="button"
              >
                <View style={styles.pillBorder} />
                <Layers size={scale(14)} color={queueCount > 0 ? colors.accent : '#fff'} strokeWidth={2} />
                {queueCount > 0 && (
                  <View style={styles.queueBadge}>
                    <Text style={styles.queueBadgeText}>{queueCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            {/* Right: Speed */}
            <TouchableOpacity
              onPress={() => setActiveSheet('speed')}
              style={[styles.pillButton, styles.speedPill]}
              activeOpacity={0.7}
              accessibilityLabel={`Playback speed ${playbackRate}x. Tap to change.`}
              accessibilityRole="button"
            >
              <View style={styles.pillBorder} />
              <Text style={[styles.pillTextSmall, playbackRate !== 1 && styles.pillTextActive]}>
                {playbackRate === 1 ? '1x' : `${playbackRate}x`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Center gray ring and black hole - above blur (disc mode only) */}
      {!useStandardPlayer && (
        <View style={[styles.discCenterOverlay, { top: discCenterY }]}>
          <View style={styles.discGrayRingStatic}>
            <View style={styles.discHoleStatic} />
          </View>
        </View>
      )}

      {/* Chrome spindle - above blur (disc mode only) */}
      {!useStandardPlayer && (
        <View style={[styles.discSpindleOverlay, { top: discCenterY }]}>
          <Image
            source={require('@/assets/svg/player/chrome-spindle.svg')}
            style={styles.chromeSpindleImage}
            contentFit="contain"
          />
        </View>
      )}

      {/* Buffering indicator - only show when streaming (not for downloaded files) */}
      {isBuffering && !isDownloaded && (
        <View style={[styles.bufferingBadgeContainer, { top: useStandardPlayer ? scale(200) : discCenterY + scale(60) }]}>
          <View style={styles.bufferingBadge}>
            <Hourglass size={scale(10)} color="#FFF" strokeWidth={2} />
            <Text style={styles.bufferingBadgeText}>Buffering...</Text>
          </View>
        </View>
      )}

      {/* Content area - positioned based on player mode */}
      <View style={[styles.contentArea, { marginTop: useStandardPlayer ? scale(20) : -(DISC_SIZE * 0.45) }]}>
        {/* Overview Section - hidden for now */}
        {false && description ? (
          <View style={styles.overviewSection}>
            <Text style={styles.overviewTitle}>Overview</Text>
            <View style={styles.overviewDivider} />
            <Text style={styles.overviewText} numberOfLines={5}>
              {description}
            </Text>
          </View>
        ) : null}

        {/* Flex spacer - pushes bottom content to bottom (Standard Player) */}
        {useStandardPlayer && <View style={{ flex: 1 }} />}

        {/* Flex spacer - CD Player mode */}
        {!useStandardPlayer && <View style={{ flex: 1 }} />}

        {/* Standard Player: Chapter & Time - moved to just under header */}

        {/* Progress Bar with time labels */}
        <View style={[styles.progressWrapper, useStandardPlayer && styles.progressWrapperStandard]}>
          {/* Time row - CD mode only (Standard mode shows above scrub button) */}
          {!useStandardPlayer && (
            <View style={styles.progressTimeRow}>
              <Text style={styles.progressTimeText}>
                {formatTime(position)}
              </Text>
              <Text style={styles.progressTimeText}>{formatTime(duration)}</Text>
            </View>
          )}
          {useStandardPlayer ? (
            // Standard Player progress bars based on mode
            progressMode === 'book' ? (
              // Book mode: Full timeline with chapter-normalized segments
              <TimelineProgressBar
                key={`timeline-book-${chapters.length}`}
                position={position}
                duration={duration}
                chapters={chapters}
                onSeek={seekTo}
                bookmarks={bookmarks}
              />
            ) : (
              // Chapter mode: Scrolling timeline with long-press + pan scrubbing
              <ChapterTimelineProgressBar
                key={`timeline-chapter-${chapters.length}`}
                position={position}
                duration={duration}
                chapters={chapters}
                onSeek={seekTo}
                bookmarks={bookmarks}
              />
            )
          ) : (
            <CDProgressBar progress={progressPercent} onSeek={handleSeek} chapterMarkers={chapterMarkers} />
          )}
        </View>

        {/* Standard Player Mode - Full width cover */}
        {useStandardPlayer && (
          <View style={styles.standardCoverContainerFull}>
            {coverUrl ? (
              <Image
                source={coverUrl}
                style={styles.standardCoverFull}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.standardCoverFull, { backgroundColor: '#333' }]} />
            )}
            {/* Speed badge when not 1.0x */}
            {playbackRate !== 1 && (
              <View style={styles.speedBadgeStandard}>
                <Text style={styles.speedBadgeOnDiscText}>{playbackRate}x</Text>
              </View>
            )}
            {/* Overlay buttons - Queue (left) and Bookmark (right) */}
            <View style={styles.coverOverlayButtons}>
              <TouchableOpacity
                onPress={() => setActiveSheet('queue')}
                style={[styles.coverOverlayButton, { backgroundColor: themeColors.sheetBackground }]}
                activeOpacity={0.7}
                accessibilityLabel={queueCount > 0 ? `Queue with ${queueCount} items` : 'Queue empty'}
                accessibilityRole="button"
              >
                <Layers size={scale(18)} color={themeColors.iconPrimary} strokeWidth={2} />
                {queueCount > 0 && (
                  <View style={styles.coverButtonBadge}>
                    <Text style={styles.coverButtonBadgeText}>{queueCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddBookmark}
                style={[styles.coverOverlayButton, { backgroundColor: themeColors.sheetBackground }]}
                activeOpacity={0.7}
                accessibilityLabel="Add bookmark"
                accessibilityRole="button"
              >
                <Bookmark size={scale(18)} color={themeColors.iconPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Standard Player Controls - at bottom */}
        {useStandardPlayer && (
          <View style={[styles.standardControlsBar, { backgroundColor: themeColors.buttonBackground }]}>
            {/* Skip Back */}
            <TouchableOpacity
              style={styles.standardControlButton}
              onPress={handleSkipBack}
              onLongPress={handlePrevChapter}
              delayLongPress={400}
              activeOpacity={0.7}
              accessibilityLabel={`Skip back ${skipBackInterval} seconds`}
              accessibilityRole="button"
            >
              <RewindIcon color={themeColors.buttonText} />
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.standardControlDivider, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />

            {/* Play/Pause - or Sleep Timer when active */}
            <TouchableOpacity
              style={styles.standardControlButton}
              onPress={() => (isPlaying ? pause() : play())}
              activeOpacity={0.7}
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              accessibilityRole="button"
            >
              {sleepTimer ? (
                <View style={styles.sleepTimerControl}>
                  {/* Small play/pause icon */}
                  {isPlaying ? (
                    <Svg width={scale(14)} height={scale(14)} viewBox="0 0 24 24" fill="none">
                      <Rect x="6" y="5" width="4" height="14" fill="#E53935" />
                      <Rect x="14" y="5" width="4" height="14" fill="#E53935" />
                    </Svg>
                  ) : (
                    <Svg width={scale(14)} height={scale(14)} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M8 5.14v13.72a1 1 0 001.5.86l10.14-6.86a1 1 0 000-1.72L9.5 4.28a1 1 0 00-1.5.86z"
                        fill="#E53935"
                      />
                    </Svg>
                  )}
                  {/* Time remaining in red bold - live seconds countdown */}
                  <Text style={styles.sleepTimerText}>
                    {formatSleepCountdown(sleepTimer)}
                  </Text>
                </View>
              ) : isPlaying ? (
                <Svg width={scale(28)} height={scale(28)} viewBox="0 0 24 24" fill="none">
                  <Rect x="6" y="5" width="4" height="14" fill="#E53935" />
                  <Rect x="14" y="5" width="4" height="14" fill="#E53935" />
                </Svg>
              ) : (
                <Svg width={scale(28)} height={scale(28)} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M8 5.14v13.72a1 1 0 001.5.86l10.14-6.86a1 1 0 000-1.72L9.5 4.28a1 1 0 00-1.5.86z"
                    fill="#E53935"
                  />
                </Svg>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.standardControlDivider, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />

            {/* Skip Forward */}
            <TouchableOpacity
              style={styles.standardControlButton}
              onPress={handleSkipForward}
              onLongPress={handleNextChapter}
              delayLongPress={400}
              activeOpacity={0.7}
              accessibilityLabel={`Skip forward ${skipForwardInterval} seconds`}
              accessibilityRole="button"
            >
              <FastForwardIcon color={themeColors.buttonText} />
            </TouchableOpacity>
          </View>
        )}

        {/* Chapter & Remaining Time Row - CD mode only */}
        {!useStandardPlayer && (
          <View style={styles.infoRow}>
            <TouchableOpacity onPress={() => setActiveSheet('chapters')}>
              <Text style={styles.chapter} numberOfLines={1}>
                {currentNormalizedChapter?.displayTitle || `Chapter ${chapterIndex + 1}`}
              </Text>
            </TouchableOpacity>
            <Text style={styles.chapterRemaining}>
              {formatTimeVerbose(position)}
            </Text>
          </View>
        )}

        {/* CD Player Mode - Controls */}
        {!useStandardPlayer && (
          <View style={styles.controlsRow}>
            {/* Skip Back */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipBack}
              onLongPress={handlePrevChapter}
              delayLongPress={400}
              activeOpacity={0.7}
              accessibilityLabel={`Skip back ${skipBackInterval} seconds. Long press for previous chapter`}
              accessibilityRole="button"
            >
              <RewindIcon />
              <Text style={styles.skipButtonLabel}>{skipBackInterval}s</Text>
            </TouchableOpacity>

            {/* Skip Forward */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipForward}
              onLongPress={handleNextChapter}
              delayLongPress={400}
              activeOpacity={0.7}
              accessibilityLabel={`Skip forward ${skipForwardInterval} seconds. Long press for next chapter`}
              accessibilityRole="button"
            >
              <FastForwardIcon />
              <Text style={styles.skipButtonLabel}>{skipForwardInterval}s</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scrub Speed Scale - CD mode only */}
        {!useStandardPlayer && (
          <View style={styles.scrubScaleContainer}>
            <View style={styles.scrubScaleItem}>
              <Text style={styles.scrubScaleText}>5x</Text>
              <View style={styles.scrubScaleLine} />
            </View>
            <View style={styles.scrubScaleItem}>
              <Text style={styles.scrubScaleText}>0.5x</Text>
              <View style={styles.scrubScaleLine} />
            </View>
            <View style={styles.scrubScaleItem}>
              <Text style={styles.scrubScaleText}>0.5x</Text>
              <View style={styles.scrubScaleLine} />
            </View>
            <View style={styles.scrubScaleItem}>
              <Text style={styles.scrubScaleText}>5x</Text>
              <View style={styles.scrubScaleLine} />
            </View>
          </View>
        )}

        {/* Bottom padding - just safe area for Standard Player (controls overlap cover) */}
        <View style={{ height: useStandardPlayer ? insets.bottom : insets.bottom + scale(100) }} />
      </View>

      {/* Inline Bottom Sheets (chapters, settings, queue, sleep, speed) */}
      {activeSheet !== 'none' && activeSheet !== 'speedPanel' && activeSheet !== 'sleepPanel' && (
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setActiveSheet('none')}
        >
          <View style={[styles.sheetContainer, { marginBottom: insets.bottom + scale(90) }]}>
            {activeSheet === 'chapters' && renderChaptersSheet()}
            {activeSheet === 'settings' && renderSettingsSheet()}
            {activeSheet === 'queue' && (
              <QueuePanel
                onClose={() => setActiveSheet('none')}
                maxHeight={SCREEN_HEIGHT * 0.6}
              />
            )}
            {activeSheet === 'sleep' && (
              <SleepTimerSheet onClose={() => setActiveSheet('none')} />
            )}
            {activeSheet === 'speed' && (
              <SpeedSheet onClose={() => setActiveSheet('none')} />
            )}
            {activeSheet === 'bookmarks' && renderBookmarksSheet()}
          </View>
        </TouchableOpacity>
      )}

      {/* Bookmark Created Toast - Modernist white/black */}
      {showBookmarkToast && (
        <View style={[styles.bookmarkToast, { bottom: insets.bottom + scale(100) }]}>
          <Bookmark size={20} color="#000000" strokeWidth={2} />
          <Text style={styles.bookmarkToastText}>Bookmark added</Text>
          <TouchableOpacity onPress={handleAddNoteFromToast}>
            <Text style={styles.bookmarkToastAction}>Add note</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowBookmarkToast(false)} style={styles.bookmarkToastClose}>
            <X size={18} color="#666666" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      {/* Bookmark Deleted Toast with Undo - Modernist white/black */}
      {deletedBookmark && (
        <View style={[styles.bookmarkToast, styles.bookmarkDeletedToast, { bottom: insets.bottom + scale(100) }]}>
          <Trash2 size={20} color="#000000" strokeWidth={2} />
          <Text style={styles.bookmarkToastText}>Bookmark deleted</Text>
          <TouchableOpacity onPress={handleUndoDelete}>
            <Text style={styles.bookmarkToastAction}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Note Input Modal - Modernist white/black */}
      {showNoteInput && (
        <TouchableOpacity
          style={styles.noteInputOverlay}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            setShowNoteInput(false);
          }}
        >
          <View
            style={[styles.noteInputContainer, { paddingBottom: insets.bottom + scale(24) }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Handle bar */}
            <View style={styles.noteInputHandle} />

            <View style={styles.noteInputHeader}>
              <Text style={styles.noteInputTitle}>Add Note</Text>
              <TouchableOpacity
                onPress={() => setShowNoteInput(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color="#000000" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.noteInput}
              value={noteInputValue}
              onChangeText={setNoteInputValue}
              placeholder="What makes this moment special?"
              placeholderTextColor="#999999"
              multiline
              autoFocus
              maxLength={500}
            />
            <View style={styles.noteInputFooter}>
              <Text style={styles.noteCharCount}>{noteInputValue.length}/500</Text>
              <TouchableOpacity style={styles.noteInputSaveButton} onPress={handleSaveNote}>
                <Text style={styles.noteInputSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}

    </Animated.View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.backgroundPrimary,
  },
  containerStandard: {
    backgroundColor: '#FFFFFF',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  arrowCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  arrowButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(8),
  },
  arrowButtonCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(8),
  },
  headerSpacer: {
    width: scale(44),  // Same as settings button
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 0,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: scale(22),
    marginBottom: scale(4),
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    minWidth: layout.minTouchTarget,
  },
  sourceText: {
    color: colors.textTertiary,
    fontSize: scale(11),
    fontWeight: '500',
  },
  sourceTextDownloaded: {
    color: colors.success,
  },
  settingsButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: scale(15),
    fontWeight: '500',
    textAlign: 'center',
  },
  author: {
    color: colors.textTertiary,
    fontSize: scale(14),
    fontWeight: '400',
    marginTop: scale(6),
    textAlign: 'center',
  },
  // Standard player mode styles (white background, dark text)
  titleStandard: {
    color: '#000',
  },
  authorStandard: {
    color: 'rgba(0,0,0,0.6)',
  },
  // Standard player - Book Detail style title/author
  standardTitleSection: {
    alignItems: 'flex-start',
    paddingHorizontal: scale(22),
    marginTop: scale(8),
  },
  standardTitle: {
    fontSize: scale(22),
    fontWeight: '700',
    color: '#000',
    marginBottom: scale(12),
  },
  standardMetaRow: {
    flexDirection: 'row',
    gap: scale(24),
  },
  standardMetaCell: {
    flex: 1,
  },
  standardMetaLabel: {
    fontSize: scale(11),
    fontWeight: '600',
    color: 'rgba(0,0,0,0.4)',
    letterSpacing: 0.5,
    marginBottom: scale(4),
  },
  standardMetaValue: {
    fontSize: scale(15),
    fontWeight: '500',
    color: '#000',
  },
  sourceTextStandard: {
    color: 'rgba(0,0,0,0.5)',
  },
  discContainer: {
    alignItems: 'center',
    marginTop: scale(10), // Close to header
    zIndex: 3, // Below blur
  },
  disc: {
    borderRadius: 9999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discCover: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  discGrayRing: {
    position: 'absolute',
    backgroundColor: GRAY_RING_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discHole: {
    position: 'absolute',
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discCenterDot: {
    backgroundColor: colors.accent,
  },
  holderShadow: {
    position: 'absolute',
    // top is set dynamically
    left: 0,
    right: 0,
    height: scale(30),
    zIndex: 4, // Below blur, above disc
  },
  blurredDiscContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 6,  // Above sharp disc, below spindle
    overflow: 'hidden',  // Clip blur at top edge
  },
  blurDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0, // Extend to bottom of container
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  blurBottomGradient: {
    position: 'absolute',
    top: 0, // Start from the glass line at top
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurTopLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  discCenterOverlay: {
    position: 'absolute',
    // top is set dynamically
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 7,  // Above blurred disc
  },
  discGrayRingStatic: {
    width: DISC_SIZE * 0.32,
    height: DISC_SIZE * 0.32,
    borderRadius: (DISC_SIZE * 0.32) / 2,
    backgroundColor: GRAY_RING_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -(DISC_SIZE * 0.16),
  },
  discHoleStatic: {
    width: DISC_SIZE * 0.20,
    height: DISC_SIZE * 0.20,
    borderRadius: (DISC_SIZE * 0.20) / 2,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discSpindleOverlay: {
    position: 'absolute',
    // top is set dynamically
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 8, // Above everything
  },
  chromeSpindleImage: {
    width: DISC_SIZE * 0.24,
    height: DISC_SIZE * 0.24,
    marginTop: -(DISC_SIZE * 0.12),
  },
  contentArea: {
    flex: 1,
    zIndex: 10,
    paddingTop: scale(10),
  },
  overviewSection: {
    paddingHorizontal: scale(22),
    marginBottom: scale(10),
  },
  overviewTitle: {
    color: colors.textPrimary,
    fontSize: scale(13),
    fontWeight: '400',
    letterSpacing: 0,
    marginBottom: scale(10),
  },
  overviewDivider: {
    height: 1,
    backgroundColor: colors.overlay.medium,
    borderRadius: scale(14),
    marginBottom: scale(5),
  },
  overviewText: {
    color: colors.textSecondary,
    fontSize: scale(12),
    lineHeight: scale(18),
    fontWeight: '400',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(22),
    marginTop: scale(6),
    marginBottom: scale(8),
  },
  chapter: {
    color: colors.textSecondary,
    fontSize: scale(13),
    letterSpacing: 0.28,
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  time: {
    color: colors.textTertiary,
    fontSize: scale(13),
    letterSpacing: 0.28,
    fontVariant: ['tabular-nums'],
  },
  chapterRemaining: {
    color: colors.accent,
    fontSize: scale(14),
    letterSpacing: 0.28,
    fontVariant: ['tabular-nums'],
    fontWeight: '400',
  },
  // Standard player mode (white background) - dark text
  chapterStandard: {
    color: 'rgba(0,0,0,0.6)',
  },
  chapterRemainingStandard: {
    color: '#E53935', // Keep accent red for remaining time
  },
  progressTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(6),
  },
  progressTimeText: {
    color: colors.textTertiary,
    fontSize: scale(9),
    letterSpacing: 0.18,
    fontVariant: ['tabular-nums'],
  },
  progressTimeTextStandard: {
    color: 'rgba(0,0,0,0.5)',
  },
  progressWrapper: {
    paddingHorizontal: scale(22),
    marginBottom: scale(4),
  },
  progressWrapperStandard: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  progressContainer: {
    height: scale(16),
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  progressTrack: {
    height: scale(2),
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: scale(14),
    position: 'relative',
    overflow: 'hidden',
  },
  progressBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(80,80,80,0.5)',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: scale(2),
    backgroundColor: colors.progressFill,
    borderRadius: scale(14),
  },
  chapterMarker: {
    position: 'absolute',
    top: scale(6),
    width: 1,
    height: scale(4),
    backgroundColor: colors.textMuted,
    zIndex: 5,
  },
  progressShadow: {
    display: 'none', // Hide shadow for thin bar
  },
  progressThumb: {
    position: 'absolute',
    top: 0,
    width: scale(16),
    height: scale(16),
    backgroundColor: colors.accent,
    borderRadius: scale(8),
    shadowColor: colors.backgroundPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pillsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: scale(22),
  },
  pillsColumn: {
    flexDirection: 'column',
    gap: scale(8),
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: scale(14),
    paddingVertical: scale(8),
    paddingHorizontal: scale(14),
    minHeight: scale(36),
    position: 'relative',
    overflow: 'hidden',
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(80,80,80,0.5)',
  },
  pillText: {
    color: colors.textPrimary,
    fontSize: scale(14),
  },
  pillTextActive: {
    color: colors.accent,
  },
  pillTextSmall: {
    color: colors.textPrimary,
    fontSize: scale(13),
  },
  speedPill: {
    minWidth: scale(40),
    paddingHorizontal: scale(12),
  },
  queuePill: {
    minWidth: scale(40),
    paddingHorizontal: scale(12),
  },
  queueBadge: {
    backgroundColor: colors.accent,
    borderRadius: scale(8),
    paddingHorizontal: scale(5),
    paddingVertical: scale(1),
    marginLeft: scale(2),
  },
  queueBadgeText: {
    fontSize: scale(10),
    fontWeight: '700',
    color: colors.backgroundPrimary,
  },
  scrubButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonBorder: {
    width: scale(76),
    height: scale(76),
    borderRadius: scale(38),
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay.light,
    overflow: 'visible',
  },
  // Standard player mode - scrub button above progress bar
  standardScrubContainer: {
    alignItems: 'center',
    marginBottom: scale(0),
  },
  standardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  standardTimeText: {
    color: '#000',
    fontSize: scale(24),
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  standardTimeSeparator: {
    color: 'rgba(0,0,0,0.3)',
    fontSize: scale(24),
    fontWeight: '300',
    marginHorizontal: scale(8),
  },
  playButtonBorderStandard: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderColor: '#000',
  },
  controlsRowStandard: {
    justifyContent: 'center',
    gap: scale(60),
  },
  skipButtonStandard: {
    opacity: 1,
  },
  skipButtonLabelStandard: {
    color: 'rgba(0,0,0,0.5)',
  },
  // Standard player 3-button control bar - overlaps cover
  standardControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    marginHorizontal: 0,
    marginTop: -scale(64), // Overlap the cover
    marginBottom: 0,
    height: scale(64),
  },
  standardControlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  standardControlDivider: {
    width: 1,
    height: scale(32),
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  // Standard player chapter row above progress bar
  standardChapterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(22),
    marginBottom: scale(0),
  },
  standardChapterTouch: {
    flex: 1,
    marginRight: scale(16),
  },
  standardChapterText: {
    color: '#000',
    fontSize: scale(14),
    fontWeight: '400',
  },
  standardChapterTime: {
    color: '#E53935',
    fontSize: scale(14),
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  // Standard player chapter row at top (under header)
  standardChapterRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(22),
    marginTop: scale(16),
  },
  standardChapterTextTop: {
    color: '#000',
    fontSize: scale(15),
    fontWeight: '500',
  },
  standardChapterTimeTop: {
    color: '#E53935',
    fontSize: scale(15),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Full width cover for standard player - extra tall
  standardCoverContainerFull: {
    flex: 20,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  standardCoverFull: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  // Cover overlay buttons (queue left, bookmark right)
  coverOverlayButtons: {
    position: 'absolute',
    bottom: scale(80), // Above the control bar
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(40),
  },
  coverOverlayButton: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  coverButtonBadge: {
    position: 'absolute',
    top: -scale(4),
    right: -scale(4),
    backgroundColor: colors.accent,
    borderRadius: scale(10),
    minWidth: scale(18),
    height: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(4),
  },
  coverButtonBadgeText: {
    color: '#000',
    fontSize: scale(10),
    fontWeight: '700',
  },

  // Bottom Sheet styles
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  // Sheet container - no background (individual sheets set their own)
  sheetContainer: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    borderBottomLeftRadius: scale(24),
    borderBottomRightRadius: scale(24),
    overflow: 'hidden',
  },
  fullScreenPanel: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  sheet: {
    padding: spacing.lg,
    backgroundColor: '#FFFFFF',
    paddingTop: scale(20),
    paddingBottom: scale(24),
  },
  chaptersSheet: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(20),
  },
  sheetTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.5,
  },
  sheetClose: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Options Grid (Speed)
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    width: (SCREEN_WIDTH - 80) / 3,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: colors.accent,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.backgroundPrimary,
  },

  // Options List (Sleep)
  optionsList: {
    gap: 4,
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  listOptionActive: {
    backgroundColor: colors.accentSubtle,
  },
  listOptionText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  listOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },

  // Chapters List - Modernist white/black
  chaptersList: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
  },
  chapterItemActive: {
    backgroundColor: '#F0F0F0',
  },
  chapterNumber: {
    width: scale(28),
    fontSize: scale(14),
    color: '#999999',
  },
  chapterInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  chapterTitle: {
    fontSize: scale(15),
    color: '#000000',
    marginBottom: 2,
  },
  chapterTitleActive: {
    color: '#000000',
    fontWeight: '600',
  },
  chapterDuration: {
    fontSize: scale(12),
    color: '#666666',
  },

  // Settings Sheet - Modernist white/black
  settingsSection: {
    marginBottom: scale(20),
  },
  settingsSectionTitle: {
    fontSize: scale(12),
    fontWeight: '600',
    color: '#888888',
    marginBottom: scale(14),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingsOptions: {
    gap: 4,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  settingsOptionActive: {
    backgroundColor: colors.accentSubtle,
  },
  settingsOptionText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  settingsOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  settingsOptionValue: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Speed grid for Standard Player settings
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  speedGridOption: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
    borderRadius: scale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    minWidth: scale(60),
    alignItems: 'center',
  },
  speedGridOptionActive: {
    backgroundColor: colors.accent,
  },
  speedGridText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: colors.textPrimary,
  },
  speedGridTextActive: {
    color: '#000',
    fontWeight: '700',
  },

  // Settings panel - new two-column layout
  settingsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  settingsColumn: {
    flex: 1,
  },
  settingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  toggleOption: {
    flex: 1,
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    borderRadius: scale(10),
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#000000',
  },
  toggleOptionText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: '#333333',
  },
  toggleOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  speedOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  speedQuickOption: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(10),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedQuickOptionActive: {
    backgroundColor: colors.accent,
  },
  speedQuickText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.textPrimary,
  },
  speedQuickTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  speedGearButton: {
    padding: scale(8),
    marginLeft: 2,
  },
  sleepTimerStatus: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.accent,
    marginLeft: 'auto',
  },
  sleepOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  sleepQuickOption: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sleepQuickOptionActive: {
    backgroundColor: colors.accent,
  },
  sleepQuickText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.textPrimary,
  },
  sleepQuickTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  sleepCustomButton: {
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sleepCustomText: {
    fontSize: scale(12),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sleepOffButton: {
    padding: scale(8),
  },
  // Modernist unified settings styles
  settingStatusText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#000000',
    marginLeft: 'auto',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale(8),
    marginTop: scale(12),
  },
  quickOption: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: scale(8),
    backgroundColor: '#F0F0F0',
  },
  quickOptionActive: {
    backgroundColor: '#000000',
  },
  quickOptionText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: '#333333',
  },
  quickOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  customInputContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: scale(54),
  },
  customInput: {
    fontSize: scale(13),
    fontWeight: '500',
    color: '#000000',
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    textAlign: 'center',
  },
  offButtonSmall: {
    padding: scale(4),
    marginLeft: scale(8),
  },
  settingsActionsColumn: {
    gap: scale(10),
    marginTop: scale(12),
  },
  settingsActionButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderRadius: scale(12),
    backgroundColor: '#F0F0F0',
  },
  // Sleep timer in play button
  sleepTimerControl: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepTimerText: {
    fontSize: scale(14),
    fontWeight: '700',
    color: '#E53935',
    marginTop: scale(2),
  },
  settingsActionsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: scale(12),
  },
  settingsActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderRadius: scale(12),
    backgroundColor: '#F0F0F0',
  },
  settingsActionButtonDisabled: {
    opacity: 0.4,
  },
  settingsActionText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: '#000000',
  },
  settingsActionTextDisabled: {
    color: '#999999',
  },
  settingsActionBadge: {
    backgroundColor: '#000000',
    borderRadius: scale(10),
    minWidth: scale(22),
    height: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(6),
  },
  settingsActionBadgeText: {
    fontSize: scale(11),
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Bookmarks sheet styles - Modernist white/black
  sheetBackButton: {
    paddingVertical: scale(6),
    paddingHorizontal: scale(10),
  },
  sheetBackText: {
    fontSize: scale(14),
    color: '#666666',
  },
  bookmarksScrollView: {
    maxHeight: hp(40),
  },
  bookmarksEmpty: {
    alignItems: 'center',
    paddingVertical: scale(48),
  },
  bookmarksEmptyText: {
    fontSize: scale(17),
    fontWeight: '600',
    color: '#000000',
    marginTop: scale(20),
  },
  bookmarksEmptySubtext: {
    fontSize: scale(14),
    color: '#666666',
    marginTop: scale(10),
    textAlign: 'center',
    paddingHorizontal: scale(20),
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bookmarkInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  bookmarkTitle: {
    fontSize: scale(15),
    fontWeight: '500',
    color: '#000000',
  },
  bookmarkChapter: {
    fontSize: scale(13),
    color: '#333333',
    fontWeight: '500',
    marginTop: 2,
  },
  bookmarkTime: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000000',
    marginTop: scale(2),
  },
  bookmarksEmptyHint: {
    fontSize: scale(13),
    color: '#999999',
    marginTop: scale(6),
    textAlign: 'center',
    paddingHorizontal: scale(20),
  },
  // Enhanced bookmark cards - Modernist white/black
  bookmarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bookmarkCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookmarkCover: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(6),
    marginRight: spacing.md,
  },
  bookmarkNote: {
    fontSize: scale(13),
    fontStyle: 'italic',
    color: '#666666',
    marginTop: scale(4),
  },
  bookmarkDate: {
    fontSize: scale(12),
    color: '#999999',
    marginTop: scale(4),
  },
  bookmarkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginLeft: spacing.md,
  },
  bookmarkPlayButton: {
    padding: scale(10),
    backgroundColor: '#F0F0F0',
    borderRadius: scale(20),
  },
  bookmarkDeleteButton: {
    padding: scale(10),
  },
  // Bookmark toast
  // Modernist Toast - Clean white/black design
  bookmarkToast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: scale(18),
    paddingHorizontal: scale(20),
    borderRadius: scale(16),
    gap: scale(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  bookmarkDeletedToast: {
    // Same white design for consistency
  },
  bookmarkToastText: {
    flex: 1,
    fontSize: scale(16),
    fontWeight: '500',
    color: '#000000',
    letterSpacing: -0.2,
  },
  bookmarkToastAction: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#000000',
    textDecorationLine: 'underline',
  },
  bookmarkToastClose: {
    padding: scale(6),
    marginLeft: scale(4),
  },
  // Modernist Note Input Modal - Clean white/black design
  noteInputOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  noteInputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: scale(28),
    borderTopRightRadius: scale(28),
    paddingTop: scale(12),
    paddingHorizontal: scale(24),
    paddingBottom: scale(20),
  },
  noteInputHandle: {
    alignSelf: 'center',
    width: scale(36),
    height: scale(4),
    backgroundColor: '#E0E0E0',
    borderRadius: scale(2),
    marginBottom: scale(20),
  },
  noteInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(24),
  },
  noteInputTitle: {
    fontSize: scale(22),
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.5,
  },
  noteInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: scale(16),
    paddingVertical: scale(18),
    paddingHorizontal: scale(18),
    fontSize: scale(17),
    color: '#000000',
    minHeight: scale(140),
    textAlignVertical: 'top',
    lineHeight: scale(24),
  },
  noteInputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scale(20),
  },
  noteCharCount: {
    fontSize: scale(13),
    color: '#999999',
    fontWeight: '400',
  },
  noteInputSaveButton: {
    backgroundColor: '#000000',
    paddingVertical: scale(14),
    paddingHorizontal: scale(32),
    borderRadius: scale(24),
  },
  noteInputSaveText: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  // Controls Row with Skip Buttons at edges
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(30),
    marginTop: scale(8),
  },
  skipButton: {
    width: scale(48),
    height: scale(60),
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    opacity: 0.8,
  },
  skipButtonLabel: {
    color: colors.textTertiary,
    fontSize: scale(11),
    fontWeight: '500',
    marginTop: scale(2),
  },
  // Scrub Speed Scale
  scrubScaleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(30),
    marginTop: scale(16),
  },
  scrubScaleItem: {
    alignItems: 'center',
  },
  scrubScaleText: {
    color: 'rgba(91,91,91,0.7)',
    fontSize: scale(10),
    fontVariant: ['tabular-nums'],
    marginBottom: scale(4),
  },
  scrubScaleLine: {
    width: 1,
    height: scale(12),
    backgroundColor: 'rgba(60,60,60,0.8)',
  },

  // Playing badge for reduced motion mode
  playingBadge: {
    position: 'absolute',
    bottom: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: colors.accent,
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  playingBadgeText: {
    color: colors.backgroundPrimary,
    fontSize: scale(11),
    fontWeight: '700',
  },

  // Speed badge on disc
  speedBadgeOnDisc: {
    position: 'absolute',
    top: scale(20),
    right: scale(20),
    backgroundColor: colors.accent,
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(10),
  },
  speedBadgeOnDiscText: {
    color: colors.backgroundPrimary,
    fontSize: scale(11),
    fontWeight: '700',
  },

  // Buffering badge container - positioned absolutely above all layers
  bufferingBadgeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
    elevation: 50,
  },
  bufferingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bufferingBadgeText: {
    color: colors.textSecondary,
    fontSize: scale(11),
    fontWeight: '500',
  },

  // Timer countdown indicator
  timerCountdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  timerActiveDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: colors.accent,
  },

  // Standard Player Mode styles
  standardCoverContainer: {
    alignItems: 'center',
    marginTop: scale(8),
    marginBottom: scale(12),
  },
  standardCover: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  speedBadgeStandard: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    backgroundColor: colors.accent,
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(10),
  },
  standardPillsPosition: {
    position: 'relative',
    top: 0,
    marginTop: scale(10),
    marginBottom: scale(10),
  },
});

export default CDPlayerScreen;
