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
  Easing,
  UIManager,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaskedViewImport from '@react-native-masked-view/masked-view';
import Svg, { Path, Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

import ReanimatedAnimated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  runOnJS,
  useFrameCallback,
  SharedValue,
} from 'react-native-reanimated';
import { DURATION, CD_ROTATION } from '@/shared/animation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import { useNavigation } from '@react-navigation/native';

import { usePlayerStore, useCurrentChapterIndex, useBookProgress, useSleepTimerState } from '../stores/playerStore';
import { useJoystickSeekSettings } from '../stores/joystickSeekStore';
import { SleepTimerSheet, SpeedSheet } from '../sheets';
import { QueuePanel } from '@/features/queue/components/QueuePanel';
import { useQueueCount } from '@/features/queue/stores/queueStore';
import { useReducedMotion } from 'react-native-reanimated';
import { useCoverUrl } from '@/core/cache';
import { useIsOfflineAvailable } from '@/core/hooks/useDownloads';
import { CoverPlayButton, JogState } from '@/shared/components/CoverPlayButton';
import { haptics } from '@/core/native/haptics';
import { colors, spacing, radius, scale, wp, hp, layout } from '@/shared/theme';

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

type SheetType = 'none' | 'chapters' | 'settings' | 'queue';
type ProgressMode = 'chapter' | 'book';

// =============================================================================
// CONSTANTS
// =============================================================================

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2];

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

const formatScrubOffset = (seconds: number): string => {
  const sign = seconds >= 0 ? '+' : '-';
  const absSeconds = Math.abs(seconds);
  const m = Math.floor(absSeconds / 60);
  const s = Math.floor(absSeconds % 60);

  // Human-readable format: +20s, -1m 23s, +5m 0s
  if (m === 0) {
    return `${sign}${s}s`;
  }
  return `${sign}${m}m ${s}s`;
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
const RewindIcon = () => (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    <Path
      d="M9.65391 13.3207C9.65391 13.8212 9.08125 14.1058 8.68224 13.8036L0.391342 7.52258C0.0713467 7.28016 0.0713462 6.79919 0.391341 6.55677L8.68223 0.275788C9.08125 -0.0264932 9.65391 0.258109 9.65391 0.758693V13.3207Z"
      fill="white"
    />
    <Path
      d="M21.7539 13.3207C21.7539 13.8212 21.1812 14.1058 20.7822 13.8036L12.4913 7.52258C12.1713 7.28016 12.1713 6.79919 12.4913 6.55677L20.7822 0.275788C21.1812 -0.0264932 21.7539 0.258109 21.7539 0.758693V13.3207Z"
      fill="white"
    />
  </Svg>
);

// Double-chevron fast-forward icon (>>)
const FastForwardIcon = () => (
  <Svg width={scale(22)} height={scale(15)} viewBox="0 0 22 15" fill="none">
    <Path
      d="M12.2514 13.3207C12.2514 13.8212 12.824 14.1058 13.223 13.8036L21.5139 7.52258C21.8339 7.28016 21.8339 6.79919 21.5139 6.55677L13.223 0.275788C12.824 -0.0264932 12.2514 0.258109 12.2514 0.758693V13.3207Z"
      fill="white"
    />
    <Path
      d="M0.151367 13.3207C0.151367 13.8212 0.724027 14.1058 1.12304 13.8036L9.41393 7.52258C9.73393 7.28016 9.73393 6.79919 9.41393 6.55677L1.12304 0.275788C0.724028 -0.0264932 0.151367 0.258109 0.151367 0.758693V13.3207Z"
      fill="white"
    />
  </Svg>
);

const DownArrowIcon = () => (
  <Svg width={scale(24)} height={scale(14)} viewBox="0 0 24 14" fill="none">
    <Path
      d="M2 2L12 12L22 2"
      stroke="rgba(255,255,255,0.4)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SettingsIcon = () => (
  <Svg width={scale(22)} height={scale(22)} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z"
      stroke="white"
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
      baseDegreesPerMs.value = withTiming(0, { duration: DURATION.moderate });
      return;
    }
    const degreesPerSecond = isPlaying ? CD_ROTATION.baseSpeed * playbackRate : 0;
    baseDegreesPerMs.value = withTiming(degreesPerSecond / 1000, { duration: DURATION.moderate });
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
          blurRadius={isBlurred ? 25 : 0}
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

  // Update thumb when progress changes externally - use withTiming for smooth animation
  React.useEffect(() => {
    if (!isDragging.value) {
      // Use very short timing for responsive feel during seeking
      thumbPosition.value = withTiming(progress, { duration: DURATION.press });
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
        { scale: withTiming(isDragging.value ? 1.1 : 1, { duration: DURATION.press }) },
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
      <View style={styles.progressContainer}>
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
// MAIN COMPONENT
// =============================================================================

export function CDPlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Store state
  const {
    currentBook,
    isPlayerVisible,
    isPlaying,
    isLoading,
    isBuffering,
    position,
    duration,
    playbackRate,
    sleepTimer,
    chapters,
  } = usePlayerStore(
    useShallow((s) => ({
      currentBook: s.currentBook,
      isPlayerVisible: s.isPlayerVisible,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      isBuffering: s.isBuffering,
      position: s.position,
      duration: s.duration,
      playbackRate: s.playbackRate,
      sleepTimer: s.sleepTimer,
      chapters: s.chapters,
    }))
  );

  // Actions
  const closePlayer = usePlayerStore((s) => s.closePlayer);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const clearSleepTimer = usePlayerStore((s) => s.clearSleepTimer);
  const seekTo = usePlayerStore((s) => s.seekTo);

  // Sleep timer state
  const sleepTimerState = useSleepTimerState();

  const chapterIndex = useCurrentChapterIndex();
  const bookProgress = useBookProgress();
  const coverUrl = useCoverUrl(currentBook?.id || '');
  const { isAvailable: isDownloaded } = useIsOfflineAvailable(currentBook?.id || '');
  const queueCount = useQueueCount();

  // Accessibility: respect reduced motion preference
  const reducedMotion = useReducedMotion();

  // Joystick seek settings
  const joystickSettings = useJoystickSeekSettings();

  // Disc rotation control
  // Shared rotation value - both sharp and blurred discs use this for sync
  const discRotation = useSharedValue(0);
  // scrubSpeed: degrees per second when joystick is being dragged (negative = backward)
  // spinBurst: instant rotation delta for skip button feedback
  const discScrubSpeed = useSharedValue(0);
  const discSpinBurst = useSharedValue(0);

  // Local state
  const [activeSheet, setActiveSheet] = useState<SheetType>('none');
  const [progressMode, setProgressMode] = useState<ProgressMode>('chapter');
  const [scrubOffset, setScrubOffset] = useState<number | null>(null);
  const [showSleepSheet, setShowSleepSheet] = useState(false);
  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const [jogState, setJogState] = useState<JogState | null>(null);

  // Book metadata
  const metadata = currentBook?.media?.metadata as any;
  const title = metadata?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const description = metadata?.description || '';
  const currentChapter = chapters[chapterIndex];

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

  // Progress percentage based on mode (includes scrubOffset during joystick seeking)
  const progressPercent = useMemo(() => {
    const effectivePosition = scrubOffset !== null ? position + scrubOffset : position;
    const effectiveChapterPosition = scrubOffset !== null ? chapterPosition + scrubOffset : chapterPosition;

    if (progressMode === 'chapter') {
      const percent = chapterDuration > 0 ? (effectiveChapterPosition / chapterDuration) * 100 : 0;
      return Math.max(0, Math.min(100, percent));
    }
    const percent = duration > 0 ? (effectivePosition / duration) * 100 : 0;
    return Math.max(0, Math.min(100, percent));
  }, [progressMode, chapterPosition, chapterDuration, position, duration, scrubOffset]);

  // Chapter markers as percentages for book mode
  const chapterMarkers = useMemo(() => {
    if (progressMode !== 'book' || duration <= 0) return [];
    return chapters.map((ch: any) => (ch.start / duration) * 100);
  }, [progressMode, chapters, duration]);

  // Format sleep timer display
  const formatSleepTimer = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return 'Off';
    const mins = Math.ceil(seconds / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
    }
    return `${mins}m`;
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
          // Snap back with quick timing
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 150,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Animation on open
  React.useEffect(() => {
    if (isPlayerVisible && currentBook) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [isPlayerVisible, currentBook?.id]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleClose = useCallback(() => {
    setActiveSheet('none');
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 150,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => closePlayer());
  }, [closePlayer, slideAnim]);

  // Navigate to book details
  const handleTitlePress = useCallback(() => {
    if (!currentBook) return;
    haptics.selection();
    handleClose();
    // Small delay to let the close animation finish
    setTimeout(() => {
      navigation.navigate('BookDetail', { id: currentBook.id });
    }, 250);
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

  // Skip backward 30 seconds
  const handleSkipBack = useCallback(() => {
    haptics.impact('light');
    const newPosition = Math.max(0, position - 30);
    seekTo?.(newPosition);
    // Spin disc backward for visual feedback (90 degrees)
    discSpinBurst.value = -90;
  }, [position, seekTo, discSpinBurst]);

  // Skip forward 30 seconds
  const handleSkipForward = useCallback(() => {
    haptics.impact('light');
    const newPosition = Math.min(duration, position + 30);
    seekTo?.(newPosition);
    // Spin disc forward for visual feedback (90 degrees)
    discSpinBurst.value = 90;
  }, [position, duration, seekTo, discSpinBurst]);

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const renderChaptersSheet = () => (
    <View style={[styles.sheet, styles.chaptersSheet]}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Chapters</Text>
        <TouchableOpacity onPress={() => setActiveSheet('none')} style={styles.sheetClose}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.chaptersList} showsVerticalScrollIndicator={false}>
        {chapters.map((chapter: any, index: number) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.chapterItem,
              index === chapterIndex && styles.chapterItemActive,
            ]}
            onPress={() => handleChapterSelect(chapter.start)}
          >
            <Text style={styles.chapterNumber}>{index + 1}</Text>
            <View style={styles.chapterInfo}>
              <Text
                style={[
                  styles.chapterTitle,
                  index === chapterIndex && styles.chapterTitleActive,
                ]}
                numberOfLines={1}
              >
                {chapter.title || `Chapter ${index + 1}`}
              </Text>
              <Text style={styles.chapterDuration}>
                {formatTime(chapter.end - chapter.start)}
              </Text>
            </View>
            {index === chapterIndex && (
              <Ionicons name="volume-high" size={16} color={ACCENT_COLOR} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderSettingsSheet = () => (
    <View style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Player Settings</Text>
        <TouchableOpacity onPress={() => setActiveSheet('none')} style={styles.sheetClose}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Progress Bar</Text>
        <View style={styles.settingsOptions}>
          <TouchableOpacity
            style={[
              styles.settingsOption,
              progressMode === 'chapter' && styles.settingsOptionActive,
            ]}
            onPress={() => setProgressMode('chapter')}
          >
            <Text style={[
              styles.settingsOptionText,
              progressMode === 'chapter' && styles.settingsOptionTextActive,
            ]}>
              Chapter
            </Text>
            {progressMode === 'chapter' && (
              <Ionicons name="checkmark" size={20} color={ACCENT_COLOR} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.settingsOption,
              progressMode === 'book' && styles.settingsOptionActive,
            ]}
            onPress={() => setProgressMode('book')}
          >
            <Text style={[
              styles.settingsOptionText,
              progressMode === 'book' && styles.settingsOptionTextActive,
            ]}>
              Book (with chapter markers)
            </Text>
            {progressMode === 'book' && (
              <Ionicons name="checkmark" size={20} color={ACCENT_COLOR} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  if (!isPlayerVisible || !currentBook) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      {...panResponder.panHandlers}
    >
      <StatusBar barStyle="light-content" />

      {/* Background blur layer - same pattern as HomeScreen */}
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
          colors={['transparent', 'rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
          locations={[0, 0.1, 0.54]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* Streaming / Settings row with centered arrow */}
        <View style={styles.headerRow}>
          {/* Left - Source indicator */}
          <View style={styles.sourceIndicator}>
            <Ionicons
              name={isDownloaded ? 'checkmark-circle' : 'cloud-outline'}
              size={scale(14)}
              color={isDownloaded ? '#34C759' : 'rgba(255,255,255,0.5)'}
            />
            <Text style={[styles.sourceText, isDownloaded && styles.sourceTextDownloaded]}>
              {isDownloaded ? 'Downloaded' : 'Streaming'}
            </Text>
          </View>
          {/* Center - Down arrow */}
          <View style={styles.arrowCenter}>
            <DownArrowIcon />
          </View>
          {/* Right - Settings */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setActiveSheet('settings')}
            activeOpacity={0.7}
          >
            <SettingsIcon />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </TouchableOpacity>
        <Text style={styles.author} numberOfLines={1}>{author}</Text>
      </View>

      {/* Sharp CD Disc - top half visible with radial edge fade */}
      <View style={[styles.discContainer, { height: DISC_SIZE / 2, overflow: 'hidden' }]}>
        {MaskedView ? (
          <MaskedView
            style={{ width: DISC_SIZE, height: DISC_SIZE / 2 }}
            maskElement={
              <Svg width={DISC_SIZE} height={DISC_SIZE}>
                <Defs>
                  <RadialGradient id="topEdgeFade" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="white" stopOpacity="1" />
                    <Stop offset="0.75" stopColor="white" stopOpacity="1" />
                    <Stop offset="1" stopColor="white" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={DISC_SIZE / 2} cy={DISC_SIZE / 2} r={DISC_SIZE / 2} fill="url(#topEdgeFade)" />
              </Svg>
            }
          >
            <CDDisc
              coverUrl={coverUrl}
              rotation={discRotation}
              isPrimary={true}
              isPlaying={isPlaying}
              isBuffering={isBuffering && !isDownloaded}
              playbackRate={playbackRate}
              reducedMotion={reducedMotion ?? false}
              scrubSpeed={discScrubSpeed}
              spinBurst={discSpinBurst}
            />
          </MaskedView>
        ) : (
          <CDDisc
            coverUrl={coverUrl}
            rotation={discRotation}
            isPrimary={true}
            isPlaying={isPlaying}
            isBuffering={isBuffering && !isDownloaded}
            playbackRate={playbackRate}
            reducedMotion={reducedMotion ?? false}
            scrubSpeed={discScrubSpeed}
            spinBurst={discSpinBurst}
          />
        )}
        {/* Playing indicator for reduced motion mode */}
        {reducedMotion && isPlaying && (
          <View style={styles.playingBadge}>
            <Ionicons name="play" size={scale(10)} color="#000" />
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

      {/* Blurred CD Disc - clipped to bottom half, with radial edge fade */}
      <View style={[styles.blurredDiscContainer, { top: discCenterY, height: DISC_SIZE / 2, overflow: 'hidden' }]}>
        {MaskedView ? (
          <MaskedView
            style={{ width: DISC_SIZE, height: DISC_SIZE / 2 }}
            maskElement={
              <Svg width={DISC_SIZE} height={DISC_SIZE} style={{ marginTop: -(DISC_SIZE / 2) }}>
                <Defs>
                  <RadialGradient id="edgeFade" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="white" stopOpacity="1" />
                    <Stop offset="0.75" stopColor="white" stopOpacity="1" />
                    <Stop offset="1" stopColor="white" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={DISC_SIZE / 2} cy={DISC_SIZE / 2} r={DISC_SIZE / 2} fill="url(#edgeFade)" />
              </Svg>
            }
          >
            <View style={{ marginTop: -(DISC_SIZE / 2), alignItems: 'center' }}>
              <CDDisc
                coverUrl={coverUrl}
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
              rotation={discRotation}
              isPrimary={false}
              isBlurred={true}
              reducedMotion={reducedMotion ?? false}
            />
          </View>
        )}
        {/* Dark overlay on top of blurred disc */}
        <View style={styles.blurDarkOverlay} />
        {/* Glass line at top */}
        <View style={styles.blurTopLine} />
      </View>

      {/* Center gray ring and black hole - above blur */}
      <View style={[styles.discCenterOverlay, { top: discCenterY }]}>
        <View style={styles.discGrayRingStatic}>
          <View style={styles.discHoleStatic} />
        </View>
      </View>

      {/* Chrome spindle - above blur */}
      <View style={[styles.discSpindleOverlay, { top: discCenterY }]}>
        <Image
          source={require('@/assets/svg/player/chrome-spindle.svg')}
          style={styles.chromeSpindleImage}
          contentFit="contain"
        />
      </View>

      {/* Buffering indicator - only show when streaming (not for downloaded files) */}
      {isBuffering && !isDownloaded && (
        <View style={[styles.bufferingBadgeContainer, { top: discCenterY + scale(60) }]}>
          <View style={styles.bufferingBadge}>
            <Ionicons name="hourglass-outline" size={scale(10)} color="#FFF" />
            <Text style={styles.bufferingBadgeText}>Buffering...</Text>
          </View>
        </View>
      )}

      {/* Content area - positioned to appear in blurred zone */}
      <View style={[styles.contentArea, { marginTop: -(DISC_SIZE * 0.45) }]}>
        {/* Pills Row - Above Overview */}
        <View style={styles.pillsRow}>
          {/* Left column: Sleep + Queue stacked */}
          <View style={styles.pillsColumn}>
            <TouchableOpacity
              onPress={() => setShowSleepSheet(true)}
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
              <Ionicons name="albums-outline" size={scale(14)} color={queueCount > 0 ? colors.accent : '#fff'} />
              {queueCount > 0 && (
                <View style={styles.queueBadge}>
                  <Text style={styles.queueBadgeText}>{queueCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          {/* Right: Speed */}
          <TouchableOpacity
            onPress={() => setShowSpeedSheet(true)}
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

        {/* Flex spacer to push controls to bottom */}
        <View style={{ flex: 1 }} />

        {/* Progress Bar with time labels */}
        <View style={styles.progressWrapper}>
          <View style={styles.progressTimeRow}>
            <Text style={[styles.progressTimeText, scrubOffset !== null && styles.scrubTimeText]}>
              {formatTime(scrubOffset !== null ? Math.max(0, position + scrubOffset) : position)}
            </Text>
            <Text style={styles.progressTimeText}>{formatTime(duration)}</Text>
          </View>
          <CDProgressBar progress={progressPercent} onSeek={handleSeek} chapterMarkers={chapterMarkers} />
        </View>

        {/* Chapter & Remaining Time Row - Below Progress Bar */}
        <View style={styles.infoRow}>
          <TouchableOpacity onPress={() => setActiveSheet('chapters')}>
            <Text style={styles.chapter} numberOfLines={1}>
              {currentChapter?.title || `Chapter ${chapterIndex + 1}`}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.chapterRemaining, scrubOffset !== null && styles.scrubOffsetText]}>
            {scrubOffset !== null
              ? formatScrubOffset(scrubOffset)
              : `-${formatTime(Math.max(0, chapterEnd - position))}`}
          </Text>
        </View>

        {/* Jog Overlay - Direction arrows and offset when scrubbing */}
        {jogState?.isActive && jogState.direction && (
          <View style={styles.jogOverlay}>
            <View style={styles.jogIndicator}>
              {jogState.direction === 'backward' ? (
                <RewindIcon />
              ) : (
                <FastForwardIcon />
              )}
              <Text style={styles.jogSpeedText}>{formatScrubOffset(jogState.offset)}</Text>
            </View>
            <Text style={styles.jogTimePreview}>
              {formatTime(jogState.currentPosition)} → {formatTime(jogState.targetPosition)}
            </Text>
          </View>
        )}

        {/* Playback Controls - Skip at edges, Play in center */}
        <View style={styles.controlsRow}>
          {/* Skip Back 30s - far left */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipBack}
            activeOpacity={0.7}
            accessibilityLabel="Skip back 30 seconds"
            accessibilityRole="button"
          >
            <RewindIcon />
          </TouchableOpacity>

          {/* Joystick Scrub Button with amber border - center */}
          <View
            style={styles.scrubButtonContainer}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            accessibilityRole="button"
            accessibilityHint="Tap to play or pause. Drag left or right to scrub through the audio."
          >
            <View style={styles.playButtonBorder}>
              <CoverPlayButton
                size={70}
                onScrubSpeedChange={(speed) => {
                  discScrubSpeed.value = speed;
                }}
                onScrubOffsetChange={(offset, isScrubbing) => {
                  setScrubOffset(isScrubbing ? offset : null);
                }}
                onJogStateChange={setJogState}
                joystickSettings={joystickSettings}
              />
            </View>
          </View>

          {/* Skip Forward 30s - far right */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipForward}
            activeOpacity={0.7}
            accessibilityLabel="Skip forward 30 seconds"
            accessibilityRole="button"
          >
            <FastForwardIcon />
          </TouchableOpacity>
        </View>

        {/* Scrub Speed Scale */}
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

        {/* Bottom padding to clear nav bar */}
        <View style={{ height: insets.bottom + scale(100) }} />
      </View>

      {/* Inline Bottom Sheets (chapters, settings, queue) */}
      {activeSheet !== 'none' && (
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
          </View>
        </TouchableOpacity>
      )}

      {/* Shared Sheet Components (sleep, speed) */}
      <SleepTimerSheet visible={showSleepSheet} onClose={() => setShowSleepSheet(false)} />
      <SpeedSheet visible={showSpeedSheet} onClose={() => setShowSpeedSheet(false)} />
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
  header: {
    alignItems: 'center',
    paddingHorizontal: scale(20),
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
  },
  blurDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: DISC_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  scrubOffsetText: {
    fontSize: scale(16),
    fontWeight: '600',
  },
  scrubTimeText: {
    color: colors.accent,
    fontWeight: '600',
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
  progressWrapper: {
    paddingHorizontal: scale(22),
    marginBottom: scale(4),
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
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: scale(22),
    marginBottom: scale(10),
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

  // Bottom Sheet styles
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  sheetContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  sheet: {
    padding: spacing.lg,
  },
  chaptersSheet: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
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

  // Chapters List
  chaptersList: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  chapterItemActive: {
    backgroundColor: colors.accentSubtle,
  },
  chapterNumber: {
    width: 28,
    fontSize: 14,
    color: colors.textTertiary,
  },
  chapterInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  chapterTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  chapterTitleActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  chapterDuration: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Settings Sheet
  settingsSection: {
    marginBottom: 16,
  },
  settingsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    height: scale(48),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    opacity: 0.8,
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

  // Jog overlay styles
  jogOverlay: {
    alignItems: 'center',
    marginBottom: scale(8),
  },
  jogIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  jogSpeedText: {
    color: colors.accent,
    fontSize: scale(18),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  jogTimePreview: {
    color: colors.textSecondary,
    fontSize: scale(12),
    fontVariant: ['tabular-nums'],
    marginTop: scale(6),
  },
});

export default CDPlayerScreen;
