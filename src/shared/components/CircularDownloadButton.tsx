/**
 * src/shared/components/CircularDownloadButton.tsx
 *
 * Download button with circular progress indicator.
 * - Shows download icon when not downloaded
 * - Shows size progress (downloaded/total) while downloading
 * - Shows stopwatch/queue icon when pending (another download in progress)
 * - Shows checkmark when complete
 * - Does NOT allow deleting downloads (only in Settings)
 * - Does NOT allow duplicate downloads
 */

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  withTiming,
  useDerivedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useDownloadStatus, useDownloads } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { LibraryItem } from '@/core/types';
import { haptics } from '@/core/native/haptics';
import { formatBytes } from '@/shared/utils/format';
import { scale } from '@/shared/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularDownloadButtonProps {
  book: LibraryItem;
  size?: number;
  strokeWidth?: number;
}

// Download icon path
const DownloadIconPath = () => (
  <Path
    d="M18.375 13.125V16.625C18.375 17.0891 18.1906 17.5342 17.8624 17.8624C17.5342 18.1906 17.0891 18.375 16.625 18.375H4.375C3.91087 18.375 3.46575 18.1906 3.13756 17.8624C2.80937 17.5342 2.625 17.0891 2.625 16.625V13.125M6.125 8.75L10.5 13.125M10.5 13.125L14.875 8.75M10.5 13.125V2.625"
    stroke="#B3B3B3"
    strokeWidth={1.97}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

// Checkmark icon path
const CheckmarkPath = ({ color = '#4ADE80' }: { color?: string }) => (
  <Path
    d="M5 11L9 15L16 6"
    stroke={color}
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

// Stopwatch/Queue icon path (hourglass style)
const QueueIconPath = ({ color = '#FFB800' }: { color?: string }) => (
  <G>
    {/* Hourglass shape */}
    <Path
      d="M6 4H15M6 17H15M7 4V7L10.5 10.5L7 14V17M14 4V7L10.5 10.5L14 14V17"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </G>
);

export function CircularDownloadButton({
  book,
  size = scale(40),
  strokeWidth = 3,
}: CircularDownloadButtonProps) {
  const {
    isDownloaded,
    isDownloading,
    isPending,
    isPaused,
    hasError,
    progress,
    bytesDownloaded,
    totalBytes,
  } = useDownloadStatus(book.id);

  // Check if there's currently an active download (for queue indicator)
  const { downloadingCount } = useDownloads();
  const isAnotherDownloading = downloadingCount > 0 && !isDownloading;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Animated progress value
  const animatedProgress = useDerivedValue(() => {
    return withTiming(progress, { duration: 300 });
  }, [progress]);

  // Animated stroke dash offset
  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = interpolate(
      animatedProgress.value,
      [0, 1],
      [circumference, 0],
      Extrapolation.CLAMP
    );
    return {
      strokeDashoffset,
    };
  });

  const handlePress = async () => {
    const title = (book.media?.metadata as any)?.title || 'Unknown';
    console.log(`[CircularDownloadButton] Pressed for: "${title}" (${book.id})`);
    console.log(`[CircularDownloadButton] Current state: isDownloaded=${isDownloaded}, isDownloading=${isDownloading}, isPending=${isPending}, isPaused=${isPaused}, hasError=${hasError}, progress=${(progress * 100).toFixed(1)}%`);

    // If already downloaded, do nothing (delete only allowed in Settings)
    if (isDownloaded) {
      console.log(`[CircularDownloadButton] Already downloaded - no action (delete only in Settings)`);
      return;
    }

    // NN/g: Haptic feedback confirms action was registered
    haptics.buttonPress();

    // If downloading, pause it
    if (isDownloading) {
      console.log(`[CircularDownloadButton] Action: Pause download`);
      haptics.toggle(); // Medium haptic for pause
      await downloadManager.pauseDownload(book.id);
      return;
    }

    // If paused, resume it
    if (isPaused) {
      console.log(`[CircularDownloadButton] Action: Resume download`);
      haptics.toggle(); // Medium haptic for resume
      await downloadManager.resumeDownload(book.id);
      return;
    }

    // If pending (queued), cancel it
    if (isPending) {
      console.log(`[CircularDownloadButton] Action: Cancel pending download`);
      haptics.warning(); // Warning haptic for cancel
      await downloadManager.cancelDownload(book.id);
      return;
    }

    // If error, retry
    if (hasError) {
      console.log(`[CircularDownloadButton] Action: Retry download (priority 10)`);
      await downloadManager.queueDownload(book, 10);
      return;
    }

    // Not downloaded - queue it
    console.log(`[CircularDownloadButton] Action: Queue new download`);
    haptics.success(); // Success haptic for starting download
    await downloadManager.queueDownload(book);
  };

  // Determine what to render
  const renderContent = () => {
    // Downloaded - show checkmark (no action on press)
    if (isDownloaded) {
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 21 21">
            <G transform="translate(0, 0)">
              <CheckmarkPath color="#4ADE80" />
            </G>
          </Svg>
        </View>
      );
    }

    // Downloading - show circular progress with size info
    if (isDownloading || isPaused) {
      const progressColor = isPaused ? '#FF9800' : '#4ADE80';
      const isPreparingDownload = progress === 0 && bytesDownloaded === 0;
      const downloadedStr = formatBytes(bytesDownloaded, 1);
      const totalStr = formatBytes(totalBytes, 1);

      return (
        <View style={[styles.progressContainer, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            {/* Background circle */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              stroke={progressColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              animatedProps={animatedProps}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>
          {/* Size text - show "..." when preparing */}
          <View style={styles.centerContent}>
            {isPreparingDownload ? (
              <Text style={[styles.sizeText, { fontSize: size * 0.22 }]}>...</Text>
            ) : (
              <>
                <Text style={[styles.sizeText, { fontSize: size * 0.18 }]} numberOfLines={2}>
                  {downloadedStr}
                </Text>
                <Text style={[styles.totalText, { fontSize: size * 0.14 }]} numberOfLines={1}>
                  /{totalStr}
                </Text>
              </>
            )}
          </View>
        </View>
      );
    }

    // Pending (queued) - show stopwatch/queue icon
    if (isPending) {
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 21 21">
            <QueueIconPath color="#FFB800" />
          </Svg>
        </View>
      );
    }

    // Error - show red download icon
    if (hasError) {
      return (
        <View style={[styles.iconContainer, { width: size, height: size }]}>
          <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 21 21">
            <Path
              d="M18.375 13.125V16.625C18.375 17.0891 18.1906 17.5342 17.8624 17.8624C17.5342 18.1906 17.0891 18.375 16.625 18.375H4.375C3.91087 18.375 3.46575 18.1906 3.13756 17.8624C2.80937 17.5342 2.625 17.0891 2.625 16.625V13.125M6.125 8.75L10.5 13.125M10.5 13.125L14.875 8.75M10.5 13.125V2.625"
              stroke="#F44336"
              strokeWidth={1.97}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
      );
    }

    // Default - show download icon
    return (
      <View style={[styles.iconContainer, { width: size, height: size }]}>
        <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 21 21">
          <DownloadIconPath />
        </Svg>
      </View>
    );
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={isDownloaded ? 1.0 : 0.7}
      style={styles.button}
      disabled={isDownloaded}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centerContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeText: {
    color: '#4ADE80',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  totalText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});
