/**
 * src/features/book-detail/components/ActionButtonsRow.tsx
 *
 * Three-button action row for Book Detail screen:
 * - Primary Action (Download/Downloading/Downloaded)
 * - Play Action (Stream/Play/Resume/Play Again)
 * - Queue Action (Add/In Queue)
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LibraryItem } from '@/core/types';
import { useIsComplete, useToggleComplete } from '@/features/completion';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

// Format bytes to human readable string
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Format seconds to readable time (e.g., "2:34:12")
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ActionButtonsRowProps {
  book: LibraryItem;
  // Download state
  isDownloaded: boolean;
  isDownloading: boolean;
  isPending: boolean;
  isPaused: boolean;
  downloadProgress: number;
  bytesDownloaded: number;
  totalBytes: number;
  fileSize?: number;
  // Playback state
  isPlaying: boolean;
  isLoaded: boolean;
  currentPosition: number;
  progress: number; // 0-1
  duration: number;
  // Queue state
  isInQueue: boolean;
  queuePosition: number;
  // Callbacks
  onDownload: () => void;
  onPauseDownload: () => void;
  onResumeDownload: () => void;
  onCancelDownload: () => void;
  onDeleteDownload: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStream: () => void;
  onPlayFromBeginning: () => void;
  onAddToQueue: () => void;
  onRemoveFromQueue: () => void;
  onMoveToTop: () => void;
}

export function ActionButtonsRow({
  book,
  isDownloaded,
  isDownloading,
  isPending,
  isPaused,
  downloadProgress,
  bytesDownloaded,
  totalBytes,
  fileSize,
  isPlaying,
  isLoaded,
  currentPosition,
  progress,
  duration,
  isInQueue,
  queuePosition,
  onDownload,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
  onDeleteDownload,
  onPlay,
  onPause,
  onStream,
  onPlayFromBeginning,
  onAddToQueue,
  onRemoveFromQueue,
  onMoveToTop,
}: ActionButtonsRowProps) {
  const [showQueueMenu, setShowQueueMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const insets = useSafeAreaInsets();

  // Completion tracking
  const isMarkedComplete = useIsComplete(book.id);
  const toggleComplete = useToggleComplete();

  const isCompleted = progress >= 0.95 || isMarkedComplete;
  const hasProgress = progress > 0 && !isCompleted;
  const showDownloadProgress = isDownloading || isPending || isPaused;

  // Download button press
  const handleDownloadPress = useCallback(() => {
    if (showDownloadProgress) {
      if (isPaused) {
        onResumeDownload();
      } else {
        onPauseDownload();
      }
    } else if (isDownloaded) {
      setShowDownloadMenu(true);
    } else {
      onDownload();
    }
  }, [showDownloadProgress, isPaused, isDownloaded, onPauseDownload, onResumeDownload, onDownload]);

  // Play button press
  const handlePlayPress = useCallback(() => {
    if (isLoaded && isPlaying) {
      onPause();
    } else if (isDownloaded) {
      onPlay();
    } else {
      onStream();
    }
  }, [isLoaded, isPlaying, isDownloaded, onPause, onPlay, onStream]);

  // Queue button press
  const handleQueuePress = useCallback(() => {
    if (isInQueue) {
      setShowQueueMenu(true);
    } else {
      onAddToQueue();
    }
  }, [isInQueue, onAddToQueue]);

  // Toggle completion
  const handleToggleComplete = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowMoreMenu(false);
    await toggleComplete(book.id);
  }, [book.id, toggleComplete]);

  // Get play button text and subtext
  const getPlayButtonContent = () => {
    if (isLoaded && isPlaying) {
      return { text: 'Pause', subtext: null };
    }
    if (!isDownloaded) {
      return { text: 'Stream', subtext: 'May buffer' };
    }
    if (isCompleted) {
      return { text: 'Play Again', subtext: null };
    }
    if (hasProgress) {
      return { text: 'Resume', subtext: `from ${formatTime(currentPosition)}` };
    }
    return { text: 'Play', subtext: null };
  };

  const playContent = getPlayButtonContent();

  return (
    <View style={styles.container}>
      {/* Primary Action Button (Download) */}
      {showDownloadProgress ? (
        <DownloadProgressButton
          progress={downloadProgress}
          bytesDownloaded={bytesDownloaded}
          totalBytes={totalBytes}
          isPaused={isPaused}
          isPending={isPending}
          onPress={handleDownloadPress}
          onLongPress={() => setShowDownloadMenu(true)}
        />
      ) : (
        <TouchableOpacity
          style={[
            styles.primaryButton,
            isDownloaded && styles.primaryButtonDownloaded,
          ]}
          onPress={handleDownloadPress}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isDownloaded ? 'checkmark-circle' : 'arrow-down-circle-outline'}
            size={scale(18)}
            color={isDownloaded ? ACCENT : 'rgba(255,255,255,0.7)'}
          />
          <View style={styles.buttonTextContainer}>
            <Text style={[styles.buttonText, isDownloaded && styles.buttonTextAccent]}>
              {isDownloaded ? 'Downloaded' : 'Download'}
            </Text>
            {!isDownloaded && fileSize != null && fileSize > 0 ? (
              <Text style={styles.buttonSubtext}>{formatBytes(fileSize)}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      )}

      {/* Play Button */}
      <TouchableOpacity
        style={[
          styles.playButton,
          (isLoaded && isPlaying) && styles.playButtonActive,
          !isDownloaded && styles.playButtonOutlined,
        ]}
        onPress={handlePlayPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name={(isLoaded && isPlaying) ? 'pause' : 'play'}
          size={scale(18)}
          color={(isLoaded && isPlaying) ? '#000' : (isDownloaded ? '#fff' : 'rgba(255,255,255,0.7)')}
        />
        <View style={styles.buttonTextContainer}>
          <Text style={[
            styles.playButtonText,
            (isLoaded && isPlaying) && styles.playButtonTextActive,
            !isDownloaded && styles.playButtonTextOutlined,
          ]}>
            {playContent.text}
          </Text>
          {playContent.subtext && (
            <Text style={[
              styles.buttonSubtext,
              !isDownloaded && styles.buttonSubtextOutlined,
            ]}>
              {playContent.subtext}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Queue Button */}
      <TouchableOpacity
        style={[
          styles.queueButton,
          isInQueue && styles.queueButtonActive,
        ]}
        onPress={handleQueuePress}
        activeOpacity={0.7}
      >
        {isInQueue ? (
          <>
            <Ionicons name="checkmark" size={scale(16)} color="#000" />
            <Text style={styles.queuePositionText}>#{queuePosition}</Text>
          </>
        ) : (
          <Ionicons name="add" size={scale(22)} color="rgba(255,255,255,0.7)" />
        )}
      </TouchableOpacity>

      {/* More Options Button */}
      <TouchableOpacity
        style={[
          styles.moreButton,
          isMarkedComplete && styles.moreButtonComplete,
        ]}
        onPress={() => setShowMoreMenu(true)}
        activeOpacity={0.7}
      >
        {isMarkedComplete ? (
          <Ionicons name="checkmark-circle" size={scale(20)} color={ACCENT} />
        ) : (
          <Ionicons name="ellipsis-horizontal" size={scale(20)} color="rgba(255,255,255,0.7)" />
        )}
      </TouchableOpacity>

      {/* Queue Action Menu */}
      <Modal
        visible={showQueueMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQueueMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowQueueMenu(false)}>
          <View style={[styles.menuContent, { paddingBottom: insets.bottom + scale(20) }]}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Queue Options</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowQueueMenu(false);
                onMoveToTop();
              }}
            >
              <Ionicons name="arrow-up" size={scale(20)} color="#fff" />
              <Text style={styles.menuItemText}>Play Next</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowQueueMenu(false);
                onRemoveFromQueue();
              }}
            >
              <Ionicons name="close" size={scale(20)} color="#ff6b6b" />
              <Text style={[styles.menuItemText, { color: '#ff6b6b' }]}>Remove from Queue</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Download Action Menu */}
      <Modal
        visible={showDownloadMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDownloadMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowDownloadMenu(false)}>
          <View style={[styles.menuContent, { paddingBottom: insets.bottom + scale(20) }]}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Download Options</Text>

            {(isDownloading || isPaused) && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowDownloadMenu(false);
                  onCancelDownload();
                }}
              >
                <Ionicons name="close-circle-outline" size={scale(20)} color="#ff6b6b" />
                <Text style={[styles.menuItemText, { color: '#ff6b6b' }]}>Cancel Download</Text>
              </TouchableOpacity>
            )}

            {isDownloaded && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowDownloadMenu(false);
                  onDeleteDownload();
                }}
              >
                <Ionicons name="trash-outline" size={scale(20)} color="#ff6b6b" />
                <Text style={[styles.menuItemText, { color: '#ff6b6b' }]}>Delete Download</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* More Options Menu */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMoreMenu(false)}>
          <View style={[styles.menuContent, { paddingBottom: insets.bottom + scale(20) }]}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>More Options</Text>

            {/* Mark Complete / Mark Incomplete */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleToggleComplete}
            >
              <Ionicons
                name={isMarkedComplete ? 'close-circle-outline' : 'checkmark-circle-outline'}
                size={scale(20)}
                color={isMarkedComplete ? '#ff6b6b' : ACCENT}
              />
              <Text style={[styles.menuItemText, { color: isMarkedComplete ? '#ff6b6b' : ACCENT }]}>
                {isMarkedComplete ? 'Mark as Incomplete' : 'Mark as Complete'}
              </Text>
            </TouchableOpacity>

            {/* Play from Beginning (if has progress) */}
            {(hasProgress || isCompleted) && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  onPlayFromBeginning();
                }}
              >
                <Ionicons name="play-skip-back-outline" size={scale(20)} color="#fff" />
                <Text style={styles.menuItemText}>Play from Beginning</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// Download Progress Button sub-component
function DownloadProgressButton({
  progress,
  bytesDownloaded,
  totalBytes,
  isPaused,
  isPending,
  onPress,
  onLongPress,
}: {
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  isPaused: boolean;
  isPending: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const progressStyle = useAnimatedStyle(() => ({
    width: `${withTiming(progress * 100, { duration: 200 })}%`,
  }));

  const getStatusText = () => {
    if (isPending) return 'Preparing...';
    if (isPaused) return 'Paused';
    return `${Math.round(progress * 100)}%`;
  };

  const getProgressText = () => {
    if (isPending || totalBytes === 0) return 'Calculating...';
    return `${formatBytes(bytesDownloaded)} / ${formatBytes(totalBytes)}`;
  };

  return (
    <TouchableOpacity
      style={styles.downloadProgressButton}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.downloadProgressHeader}>
        <View style={styles.downloadStatusRow}>
          {isPending ? (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={styles.downloadSpinner} />
          ) : isPaused ? (
            <Ionicons name="play" size={scale(14)} color="rgba(255,255,255,0.6)" />
          ) : (
            <Ionicons name="pause" size={scale(14)} color="rgba(255,255,255,0.6)" />
          )}
          <Text style={styles.downloadStatusText}>{getStatusText()}</Text>
        </View>
      </View>

      <View style={styles.downloadProgressTrack}>
        <Animated.View
          style={[
            styles.downloadProgressFill,
            progressStyle,
            isPaused && styles.downloadProgressFillPaused,
          ]}
        />
      </View>

      <Text style={styles.downloadBytesText}>{getProgressText()}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: scale(20),
    paddingVertical: scale(16),
    gap: scale(10),
  },

  // Primary Button (Download)
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(52),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(12),
    gap: scale(8),
    paddingHorizontal: scale(12),
  },
  primaryButtonDownloaded: {
    backgroundColor: 'rgba(193,244,12,0.1)',
  },

  // Play Button
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(52),
    backgroundColor: ACCENT,
    borderRadius: scale(12),
    gap: scale(8),
    paddingHorizontal: scale(12),
  },
  playButtonActive: {
    backgroundColor: '#fff',
  },
  playButtonOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Queue Button
  queueButton: {
    width: scale(52),
    height: scale(52),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(12),
  },
  queueButtonActive: {
    backgroundColor: ACCENT,
    flexDirection: 'row',
    gap: scale(2),
  },
  queuePositionText: {
    fontSize: scale(12),
    fontWeight: '700',
    color: '#000',
  },

  // More Button
  moreButton: {
    width: scale(44),
    height: scale(52),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(12),
  },
  moreButtonComplete: {
    backgroundColor: 'rgba(193,244,12,0.1)',
  },

  // Button text
  buttonTextContainer: {
    alignItems: 'flex-start',
  },
  buttonText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  buttonTextAccent: {
    color: ACCENT,
  },
  buttonSubtext: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(1),
  },
  buttonSubtextOutlined: {
    color: 'rgba(255,255,255,0.4)',
  },

  // Play button text
  playButtonText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#000',
  },
  playButtonTextActive: {
    color: '#000',
  },
  playButtonTextOutlined: {
    color: 'rgba(255,255,255,0.9)',
  },

  // Download Progress Button
  downloadProgressButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(12),
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    justifyContent: 'center',
  },
  downloadProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  downloadStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  downloadSpinner: {
    transform: [{ scale: 0.8 }],
  },
  downloadStatusText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  downloadProgressTrack: {
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(2),
  },
  downloadProgressFillPaused: {
    backgroundColor: '#FF9800',
  },
  downloadBytesText: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.4)',
    marginTop: scale(4),
  },

  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: scale(20),
    borderTopRightRadius: scale(20),
    paddingTop: scale(12),
  },
  menuHandle: {
    width: scale(40),
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: scale(2),
    alignSelf: 'center',
    marginBottom: scale(16),
  },
  menuTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: scale(16),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: scale(20),
    gap: scale(12),
  },
  menuItemText: {
    fontSize: scale(15),
    color: '#fff',
  },
});
