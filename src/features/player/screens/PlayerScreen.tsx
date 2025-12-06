/**
 * src/features/player/screens/PlayerScreen.tsx
 *
 * Full-screen player using unified PlayerModule component.
 * Features: blurred background, panels for speed/sleep/details/chapters
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as RNImage } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors } from 'react-native-image-colors';

// Store and hooks
import {
  usePlayerStore,
  useCurrentChapterIndex,
  useBookProgress,
  useViewingBook,
  usePlayingBook,
  useIsViewingDifferentBook,
} from '../stores/playerStore';
import { useRobustSeekControl } from '../hooks/useRobustSeekControl';
import { useCoverUrl } from '@/core/cache';
import { getTitle } from '@/shared/utils/metadata';
import { pickMostSaturated } from '../utils';
import { matchToPalette } from '@/shared/utils/colorPalette';

// Components
import { PlayerModule } from '../components/PlayerModule';
import { DetailsPanel, SpeedPanel, SleepPanel, ChaptersPanel, ProgressPanel } from '../panels';
import { QueuePreview } from '@/features/queue';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

type PanelMode = 'none' | 'details' | 'speed' | 'sleep' | 'chapters' | 'progress';

export function PlayerScreen() {
  const insets = useSafeAreaInsets();

  // Store state
  const {
    currentBook,
    isPlayerVisible,
    isPlaying,
    isLoading,
    position,
    duration: storeDuration,
    playbackRate,
    sleepTimer,
    chapters: storeChapters,
    viewingChapters,
    closePlayer,
    play,
    pause,
    setPlaybackRate,
    setSleepTimer,
    clearSleepTimer,
    playViewingBook,
    seekTo,
    controlMode,
    progressMode,
    setControlMode,
    setProgressMode,
    nextChapter,
    prevChapter,
  } = usePlayerStore();

  // Viewing vs Playing book
  const viewingBook = useViewingBook();
  const playingBook = usePlayingBook();
  const isViewingDifferent = useIsViewingDifferentBook();

  // Use viewingBook for display, fallback to currentBook
  const displayBook = viewingBook || currentBook;

  // Seek control
  const {
    isSeeking,
    seekDirection,
    seekPosition,
    seekDelta,
    startContinuousSeek,
    stopContinuousSeek,
    cancelSeek,
  } = useRobustSeekControl();

  // Selectors
  const chapterIndex = useCurrentChapterIndex();
  const bookProgress = useBookProgress();

  const displayPosition = isSeeking ? seekPosition : position;

  // Cover URL
  const coverUrl = useCoverUrl(displayBook?.id || '');

  // Animation
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Panel state
  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  const [tempSpeed, setTempSpeed] = useState(1);
  const [tempSleepMins, setTempSleepMins] = useState(15);
  const [sleepInputValue, setSleepInputValue] = useState('15');

  // Color extraction
  const [accentColor, setAccentColor] = useState('#C8FF00');

  // Derived values
  const media = displayBook?.media as any;
  const chapters = viewingChapters.length > 0 ? viewingChapters : (storeChapters.length > 0 ? storeChapters : (media?.chapters || []));

  let bookDuration = media?.duration || 0;
  if (bookDuration <= 0 && storeDuration > 0) bookDuration = storeDuration;

  const sleepTimerMinutes = sleepTimer ? Math.ceil(sleepTimer / 60) : null;

  // Progress for PlayerModule
  const playerProgress = displayBook ? {
    currentTime: displayPosition,
    duration: bookDuration,
    progress: bookProgress,
    isFinished: false,
    lastUpdate: Date.now(),
  } : null;

  // Pan responder for swipe down to close
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
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Color extraction
  useEffect(() => {
    if (!coverUrl || !displayBook) return;
    let mounted = true;

    const extractColors = async () => {
      try {
        const result = await getColors(coverUrl, {
          fallback: '#C8FF00',
          cache: true,
          key: displayBook.id,
        });

        if (!mounted) return;

        let dominant = '#C8FF00';
        if (result.platform === 'ios') {
          dominant = result.detail || result.primary || result.secondary || '#C8FF00';
        } else if (result.platform === 'android') {
          const candidates = [
            result.vibrant,
            result.darkVibrant,
            result.lightVibrant,
            result.muted,
            result.darkMuted,
            result.lightMuted,
            result.dominant,
          ];
          dominant = pickMostSaturated(candidates) || result.dominant || '#C8FF00';
        }

        setAccentColor(matchToPalette(dominant));
      } catch (err) {
        console.log('Color extraction error:', err);
      }
    };

    extractColors();
    return () => { mounted = false; };
  }, [coverUrl, displayBook?.id]);

  // Slide animation
  useEffect(() => {
    if (isPlayerVisible && displayBook) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [isPlayerVisible, displayBook?.id]);

  // Handlers
  const handleClose = useCallback(() => {
    if (isSeeking) cancelSeek();
    setPanelMode('none');
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => closePlayer());
  }, [closePlayer, slideAnim, isSeeking, cancelSeek]);

  const handlePlayPause = useCallback(async () => {
    if (isViewingDifferent) {
      await playViewingBook();
      return;
    }
    if (isPlaying) await pause();
    else await play();
  }, [isPlaying, pause, play, isViewingDifferent, playViewingBook]);

  const handleRewindPressIn = useCallback(async () => {
    if (controlMode === 'chapter') {
      // Chapter mode: immediate chapter skip on press
      await prevChapter();
    } else {
      // Rewind mode: continuous time skip
      await startContinuousSeek('backward');
    }
  }, [controlMode, startContinuousSeek, prevChapter]);

  const handleRewindPressOut = useCallback(async () => {
    if (controlMode === 'rewind') {
      await stopContinuousSeek();
    }
    // Chapter mode doesn't need press out handling
  }, [controlMode, stopContinuousSeek]);

  const handleFFPressIn = useCallback(async () => {
    if (controlMode === 'chapter') {
      // Chapter mode: immediate chapter skip on press
      await nextChapter();
    } else {
      // Rewind mode: continuous time skip
      await startContinuousSeek('forward');
    }
  }, [controlMode, startContinuousSeek, nextChapter]);

  const handleFFPressOut = useCallback(async () => {
    if (controlMode === 'rewind') {
      await stopContinuousSeek();
    }
    // Chapter mode doesn't need press out handling
  }, [controlMode, stopContinuousSeek]);

  const handleSpeedPress = useCallback(() => {
    setTempSpeed(playbackRate);
    setPanelMode(panelMode === 'speed' ? 'none' : 'speed');
  }, [playbackRate, panelMode]);

  const handleSleepPress = useCallback(() => {
    setPanelMode(panelMode === 'sleep' ? 'none' : 'sleep');
  }, [panelMode]);

  const handleCoverPress = useCallback(() => {
    setPanelMode(panelMode === 'details' ? 'none' : 'details');
  }, [panelMode]);

  const handleChapterPress = useCallback(() => {
    setPanelMode(panelMode === 'chapters' ? 'none' : 'chapters');
  }, [panelMode]);

  const handleTimePress = useCallback(() => {
    setPanelMode(panelMode === 'progress' ? 'none' : 'progress');
  }, [panelMode]);

  const handleApplySpeed = useCallback(() => {
    setPlaybackRate?.(tempSpeed);
    setPanelMode('none');
  }, [tempSpeed, setPlaybackRate]);

  const handleStartSleep = useCallback(() => {
    if (tempSleepMins > 0) {
      setSleepTimer?.(tempSleepMins);
    }
    setPanelMode('none');
  }, [tempSleepMins, setSleepTimer]);

  const handleClearSleep = useCallback(() => {
    clearSleepTimer?.();
    setPanelMode('none');
  }, [clearSleepTimer]);

  const handleChapterSelect = useCallback((chapterStart: number) => {
    seekTo?.(chapterStart);
    setPanelMode('none');
  }, [seekTo]);

  const handleClosePanel = useCallback(() => {
    setPanelMode('none');
  }, []);

  // Render panel content
  const renderPanelContent = () => {
    switch (panelMode) {
      case 'details':
        return (
          <DetailsPanel
            book={displayBook!}
            duration={bookDuration}
            chaptersCount={chapters.length}
            isLight={false}
            onClose={handleClose}
          />
        );
      case 'speed':
        return (
          <SpeedPanel
            tempSpeed={tempSpeed}
            setTempSpeed={setTempSpeed}
            onApply={handleApplySpeed}
            onClose={handleClosePanel}
            isLight={false}
          />
        );
      case 'sleep':
        return (
          <SleepPanel
            tempSleepMins={tempSleepMins}
            setTempSleepMins={setTempSleepMins}
            sleepInputValue={sleepInputValue}
            setSleepInputValue={setSleepInputValue}
            onClear={handleClearSleep}
            onStart={handleStartSleep}
            isLight={false}
          />
        );
      case 'chapters':
        return (
          <ChaptersPanel
            chapters={chapters}
            currentChapter={chapters[chapterIndex]}
            onChapterSelect={handleChapterSelect}
            onClose={handleClosePanel}
            isLight={false}
          />
        );
      case 'progress':
        return (
          <ProgressPanel
            isLight={false}
            controlMode={controlMode}
            progressMode={progressMode}
            onControlModeChange={setControlMode}
            onProgressModeChange={setProgressMode}
            onViewChapters={() => setPanelMode('chapters')}
            onViewDetails={() => setPanelMode('details')}
          />
        );
      default:
        return null;
    }
  };

  if (!isPlayerVisible || !displayBook) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      {...panResponder.panHandlers}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Background - Blurred cover + gradient */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.baseColor} />
        {coverUrl && (
          <View style={styles.imageContainer}>
            <RNImage
              source={{ uri: coverUrl }}
              style={styles.backgroundImage}
              resizeMode="cover"
              blurRadius={15}
            />
            <BlurView intensity={50} style={StyleSheet.absoluteFill} tint="dark" />
            <View style={styles.brightnessOverlay} />
          </View>
        )}
        <LinearGradient
          colors={[
            'rgba(0, 0, 0, 0.1)',
            'rgba(0, 0, 0, 0.3)',
            'rgba(0, 0, 0, 0.7)',
            '#000000',
          ]}
          locations={[0, 0.35, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* NN/g: Explicit close button for gesture discoverability */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        {/* Swipe indicator pill */}
        <View style={styles.swipeIndicator} />

        {/* Close button - minimum 44×44px touch target */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-down" size={28} color="rgba(255, 255, 255, 0.8)" />
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={[
          styles.scrollContentContainer,
          { paddingTop: scale(20), paddingBottom: insets.bottom + scale(100) }
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <PlayerModule
          book={displayBook}
          progress={playerProgress}
          isPlaying={isPlaying && !isViewingDifferent}
          isLoading={isLoading}
          playbackSpeed={playbackRate}
          sleepTimer={sleepTimerMinutes}
          onCoverPress={handleCoverPress}
          onPlay={handlePlayPause}
          onSkipBack={handleRewindPressOut}
          onSkipForward={handleFFPressOut}
          onSkipBackPressIn={handleRewindPressIn}
          onSkipBackPressOut={handleRewindPressOut}
          onSkipForwardPressIn={handleFFPressIn}
          onSkipForwardPressOut={handleFFPressOut}
          onSpeedPress={handleSpeedPress}
          onSleepPress={handleSleepPress}
          onChapterPress={handleChapterPress}
          onTimePress={handleTimePress}
          isSeeking={isSeeking}
          seekDelta={seekDelta}
          seekDirection={seekDirection}
          panelMode={panelMode}
          panelContent={renderPanelContent()}
          onClosePanel={handleClosePanel}
          variant="fullscreen"
        />

        {/* Queue preview - shows when panel not open */}
        {panelMode === 'none' && (
          <View style={styles.queueSection}>
            <QueuePreview variant="full" />
          </View>
        )}
      </ScrollView>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  // NN/g: Header with close button and swipe hint
  headerBar: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  swipeIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 8,
  },
  closeButton: {
    // NN/g: Minimum 44×44px touch target
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  baseColor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    transform: [{ scale: 1.1 }],
    opacity: 0.8,
  },
  brightnessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    alignItems: 'center',
  },
  queueSection: {
    width: '100%',
    marginTop: scale(24),
  },
});
