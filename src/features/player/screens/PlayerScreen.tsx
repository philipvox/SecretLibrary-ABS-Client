/**
 * src/features/player/screens/PlayerScreen.tsx
 *
 * Refactored full-screen player with glass morphism design.
 *
 * Key changes:
 * - Uses robust seek control hook with lock mechanism for race-condition-free seeking
 * - Removed all local playback state (isRewinding, seekDelta, etc.)
 * - Uses store selectors for derived state
 * - Simplified handlers that just dispatch to store
 * - UI-only local state for animations and panels
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Text,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, Rect, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { getColors } from 'react-native-image-colors';

// Store and selectors
import {
  usePlayerStore,
  useCurrentChapterIndex,
  useChapterProgress,
  useBookProgress,
} from '../stores/playerStore';

// Robust seek control hook
import { useRobustSeekControl } from '../hooks/useRobustSeekControl';

import { useMyLibraryStore } from '@/features/library/stores/myLibraryStore';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';
import { getTitle } from '@/shared/utils/metadata';
import { matchToPalette } from '@/shared/utils/colorPalette';

import {
  SCREEN_HEIGHT,
  CARD_MARGIN,
  CARD_WIDTH,
  COVER_SIZE,
  RADIUS,
} from '../constants';
import { isColorLight, pickMostSaturated, formatTime } from '../utils';
import {
  GlassPanel,
  PlayerButton,
  CassetteTape,
} from '../components';
import {
  DetailsPanel,
  SpeedPanel,
  SleepPanel,
  ChaptersPanel,
  SettingsPanel,
} from '../panels';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Glass panel layout constants
const GAP = 5;
const BUTTON_WIDTH = 128;
const BUTTON_HEIGHT = 136;
const DISPLAY_WIDTH = BUTTON_WIDTH * 3 + GAP * 2;
const DISPLAY_PADDING = 5;
const ARTWORK_SIZE = DISPLAY_WIDTH - DISPLAY_PADDING * 2;

// Artwork inset shadow config (plastic cover effect)
const ART_SHADOW = {
  top:    { opacity: 0.6, depth: 0.12 },
  bottom: { opacity: 0.5, depth: 0.10 },
  left:   { opacity: 0.55, depth: 0.10 },
  right:  { opacity: 0.55, depth: 0.10 },
  sheen:  { opacity: 0.08, depth: 0.05 },
  border: { opacity: 0.4, width: 1 },
};

const PANEL_CONFIG = {
  marginHorizontal: 5,
  borderRadius: 5,
  innerPadding: 10,
};

type FlipMode = 'details' | 'speed' | 'sleep' | 'chapters' | 'settings';

export function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // ===========================================================================
  // STORE STATE (Single Source of Truth)
  // ===========================================================================

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
    closePlayer,
    play,
    pause,
  } = usePlayerStore();

  // Robust seek control - handles all seek operations with lock mechanism
  const {
    isSeeking,
    isChangingChapter,
    seekDirection,
    seekDelta,
    seekPosition,
    seekAbsolute,
    startContinuousSeek,
    stopContinuousSeek,
    cancelSeek,
    nextChapter,
    prevChapter,
  } = useRobustSeekControl();

  // Derived state via selectors
  const chapterIndex = useCurrentChapterIndex();
  const chapterProgress = useChapterProgress();
  const bookProgress = useBookProgress();

  // Use seek position during seeking for display, otherwise actual position
  const displayPosition = isSeeking ? seekPosition : position;

  // ===========================================================================
  // UI-ONLY LOCAL STATE (animations, colors, panel mode)
  // ===========================================================================

  const [cardColor, setCardColor] = useState('#F55F05');
  const [isLight, setIsLight] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flipMode, setFlipMode] = useState<FlipMode>('details');

  // Panel state
  const [tempSpeed, setTempSpeed] = useState(1);
  const [tempSleepMins, setTempSleepMins] = useState(15);
  const [sleepInputValue, setSleepInputValue] = useState('15');
  const [controlMode, setControlMode] = useState<'rewind' | 'chapter'>('rewind');
  const [progressMode, setProgressMode] = useState<'bar' | 'chapters'>('chapters');

  // Animation refs
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;

  // Library store for favorites
  const { isInLibrary, addToLibrary, removeFromLibrary } = useMyLibraryStore();
  const isFavorite = currentBook ? isInLibrary(currentBook.id) : false;

  const coverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : '';

  // ===========================================================================
  // DERIVED VALUES
  // ===========================================================================

  const title = currentBook ? getTitle(currentBook) : '';
  const chapters = storeChapters.length > 0 ? storeChapters : (currentBook?.media?.chapters || []);

  let bookDuration = currentBook?.media?.duration || 0;
  if (bookDuration <= 0 && storeDuration > 0) bookDuration = storeDuration;
  if (bookDuration <= 0 && chapters.length > 0) {
    bookDuration = chapters[chapters.length - 1].end || 0;
  }

  const currentChapter = chapters[chapterIndex];
  const chapterTitle = `Chapter ${chapterIndex + 1}`;

  const textColor = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)';

  // Check if book is finished
  const isBookFinished = bookProgress >= 0.99;

  // Determine if we're rewinding or fast-forwarding based on store state
  const isRewinding = isSeeking && seekDirection === 'backward';
  const isFastForwarding = isSeeking && seekDirection === 'forward';

  // ===========================================================================
  // EFFECTS (UI-only, no playback state sync!)
  // ===========================================================================

  // Color extraction
  useEffect(() => {
    if (!coverUrl || !currentBook) return;
    let mounted = true;

    const extractColors = async () => {
      try {
        const result = await getColors(coverUrl, {
          fallback: theme.colors.neutral[200],
          cache: true,
          key: currentBook.id,
        });

        if (!mounted) return;

        let dominant = theme.colors.neutral[200];

        if (result.platform === 'ios') {
          dominant = result.detail || result.primary || result.secondary || theme.colors.neutral[200];
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
          dominant = pickMostSaturated(candidates) || result.dominant || theme.colors.neutral[200];
        }

        const paletteColor = matchToPalette(dominant);
        setCardColor(paletteColor);
        setIsLight(isColorLight(paletteColor));
      } catch (err) {
        console.log('Color extraction error:', err);
      }
    };

    extractColors();
    return () => { mounted = false; };
  }, [coverUrl, currentBook?.id]);

  // Slide animation
  useEffect(() => {
    if (isPlayerVisible && currentBook) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [isPlayerVisible, currentBook?.id]);

  // ===========================================================================
  // HANDLERS (just dispatch to store)
  // ===========================================================================

  const handleHeartPress = useCallback(() => {
    if (!currentBook) return;
    const currentlyFavorite = isInLibrary(currentBook.id);
    if (currentlyFavorite) {
      removeFromLibrary(currentBook.id);
    } else {
      addToLibrary(currentBook.id);
    }
  }, [currentBook, isInLibrary, addToLibrary, removeFromLibrary]);

  const handleClose = useCallback(() => {
    // Cancel any ongoing seeking
    if (isSeeking) {
      cancelSeek();
    }

    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      closePlayer();
      setIsFlipped(false);
      setFlipMode('details');
      flipAnim.setValue(0);
    });
  }, [closePlayer, slideAnim, flipAnim, isSeeking, cancelSeek]);

  const handleNavigateToAuthor = useCallback((authorName: string) => {
    handleClose();
    setTimeout(() => {
      navigation.navigate('AuthorDetail' as never, { authorName } as never);
    }, 100);
  }, [navigation, handleClose]);

  const handleNavigateToNarrator = useCallback((narratorName: string) => {
    handleClose();
    setTimeout(() => {
      navigation.navigate('NarratorDetail' as never, { narratorName } as never);
    }, 100);
  }, [navigation, handleClose]);

  const handleNavigateToSeries = useCallback((seriesName: string) => {
    handleClose();
    setTimeout(() => {
      navigation.navigate('SeriesDetail' as never, { seriesName } as never);
    }, 100);
  }, [navigation, handleClose]);

  const handleFlip = useCallback((mode: FlipMode = 'details') => {
    if (isFlipped && flipMode === mode) {
      setIsFlipped(false);
      Animated.timing(flipAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start();
    } else if (isFlipped && flipMode !== mode) {
      setFlipMode(mode);
      if (mode === 'speed') setTempSpeed(playbackRate);
    } else {
      setFlipMode(mode);
      if (mode === 'speed') setTempSpeed(playbackRate);
      setIsFlipped(true);
      Animated.timing(flipAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    }
  }, [isFlipped, flipMode, playbackRate, flipAnim]);

  const handleFlipBack = useCallback(() => {
    setIsFlipped(false);
    Animated.timing(flipAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start();
  }, [flipAnim]);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) await pause();
    else await play();
  }, [isPlaying, pause, play]);

  const handleRestart = useCallback(async () => {
    await seekAbsolute(0);
    await play();
  }, [seekAbsolute, play]);

  // ---------------------------------------------------------------------------
  // Continuous Seeking Handlers (Rewind/FF)
  // The robust seek hook handles pause/play state internally
  // ---------------------------------------------------------------------------

  const handleRewindPressIn = useCallback(async () => {
    await startContinuousSeek('backward');
  }, [startContinuousSeek]);

  const handleRewindPressOut = useCallback(async () => {
    await stopContinuousSeek();
  }, [stopContinuousSeek]);

  const handleFFPressIn = useCallback(async () => {
    await startContinuousSeek('forward');
  }, [startContinuousSeek]);

  const handleFFPressOut = useCallback(async () => {
    await stopContinuousSeek();
  }, [stopContinuousSeek]);

  // ---------------------------------------------------------------------------
  // Chapter Navigation Handlers
  // ---------------------------------------------------------------------------

  const handlePrevChapter = useCallback(async () => {
    await prevChapter();
  }, [prevChapter]);

  const handleNextChapter = useCallback(async () => {
    await nextChapter();
  }, [nextChapter]);

  // ---------------------------------------------------------------------------
  // Combined Button Handlers (based on controlMode)
  // ---------------------------------------------------------------------------

  const handleLeftPressIn = useCallback(() => {
    if (controlMode !== 'chapter') {
      handleRewindPressIn();
    }
  }, [controlMode, handleRewindPressIn]);

  const handleLeftPressOut = useCallback(() => {
    if (controlMode !== 'chapter') {
      handleRewindPressOut();
    }
  }, [controlMode, handleRewindPressOut]);

  const handleLeftPress = useCallback(() => {
    if (controlMode === 'chapter') {
      handlePrevChapter();
    }
  }, [controlMode, handlePrevChapter]);

  const handleRightPressIn = useCallback(() => {
    if (controlMode !== 'chapter') {
      handleFFPressIn();
    }
  }, [controlMode, handleFFPressIn]);

  const handleRightPressOut = useCallback(() => {
    if (controlMode !== 'chapter') {
      handleFFPressOut();
    }
  }, [controlMode, handleFFPressOut]);

  const handleRightPress = useCallback(() => {
    if (controlMode === 'chapter') {
      handleNextChapter();
    }
  }, [controlMode, handleNextChapter]);

  // ===========================================================================
  // RENDER EARLY RETURN
  // ===========================================================================

  if (!isPlayerVisible || !currentBook) return null;

  // Flip animations
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // Calculate display height (removed header row height)
  const displayHeight = DISPLAY_PADDING + ARTWORK_SIZE + 8 + 52 + 8 + 80 + 8 + 24 + DISPLAY_PADDING;

  // ===========================================================================
  // MAIN RENDER
  // ===========================================================================

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={[styles.mainContent, { paddingTop: insets.top + 16 }]}>
        <View style={styles.playerWrapper}>
          {/* Display Panel */}
          <View style={styles.displayWrapper}>
            <GlassPanel width={DISPLAY_WIDTH} height={displayHeight} variant="display">
              <View style={styles.displayContent}>
                {/* Top content */}
                <View>
                  {/* Artwork container with flip */}
                  <View style={styles.artworkContainer}>
                    {/* Front - Cover Image */}
                    <Animated.View
                      style={[styles.artworkFace, { opacity: frontOpacity }]}
                      pointerEvents={isFlipped ? 'none' : 'auto'}
                    >
                      <TouchableOpacity onPress={() => handleFlip('details')} activeOpacity={0.9}>
                        <Image
                          source={coverUrl}
                          style={styles.artwork}
                          contentFit="cover"
                          transition={100}
                        />
                        {/* Inner shadow overlay - plastic cover effect */}
                        <View style={[styles.artworkInnerShadow, { borderWidth: ART_SHADOW.border.width, borderColor: `rgba(0,0,0,${ART_SHADOW.border.opacity})` }]} pointerEvents="none">
                          <Svg width="100%" height="100%" preserveAspectRatio="none">
                            <Defs>
                              {/* Edge shadows */}
                              <LinearGradient id="artTop" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor="black" stopOpacity={ART_SHADOW.top.opacity} />
                                <Stop offset={ART_SHADOW.top.depth / 2} stopColor="black" stopOpacity={ART_SHADOW.top.opacity * 0.4} />
                                <Stop offset={ART_SHADOW.top.depth} stopColor="black" stopOpacity="0" />
                              </LinearGradient>
                              <LinearGradient id="artBottom" x1="0" y1="1" x2="0" y2="0">
                                <Stop offset="0" stopColor="black" stopOpacity={ART_SHADOW.bottom.opacity} />
                                <Stop offset={ART_SHADOW.bottom.depth / 2} stopColor="black" stopOpacity={ART_SHADOW.bottom.opacity * 0.4} />
                                <Stop offset={ART_SHADOW.bottom.depth} stopColor="black" stopOpacity="0" />
                              </LinearGradient>
                              <LinearGradient id="artLeft" x1="0" y1="0" x2="1" y2="0">
                                <Stop offset="0" stopColor="black" stopOpacity={ART_SHADOW.left.opacity} />
                                <Stop offset={ART_SHADOW.left.depth / 2} stopColor="black" stopOpacity={ART_SHADOW.left.opacity * 0.4} />
                                <Stop offset={ART_SHADOW.left.depth} stopColor="black" stopOpacity="0" />
                              </LinearGradient>
                              <LinearGradient id="artRight" x1="1" y1="0" x2="0" y2="0">
                                <Stop offset="0" stopColor="black" stopOpacity={ART_SHADOW.right.opacity} />
                                <Stop offset={ART_SHADOW.right.depth / 2} stopColor="black" stopOpacity={ART_SHADOW.right.opacity * 0.4} />
                                <Stop offset={ART_SHADOW.right.depth} stopColor="black" stopOpacity="0" />
                              </LinearGradient>
                              {/* Plastic sheen highlight */}
                              <LinearGradient id="artSheen" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor="white" stopOpacity={ART_SHADOW.sheen.opacity} />
                                <Stop offset={ART_SHADOW.sheen.depth / 2} stopColor="white" stopOpacity={ART_SHADOW.sheen.opacity * 0.3} />
                                <Stop offset={ART_SHADOW.sheen.depth} stopColor="white" stopOpacity="0" />
                              </LinearGradient>
                            </Defs>
                            {/* Edge shadows */}
                            <Rect x="0" y="0" width="100%" height="100%" fill="url(#artTop)" />
                            <Rect x="0" y="0" width="100%" height="100%" fill="url(#artBottom)" />
                            <Rect x="0" y="0" width="100%" height="100%" fill="url(#artLeft)" />
                            <Rect x="0" y="0" width="100%" height="100%" fill="url(#artRight)" />
                            {/* Top highlight */}
                            <Rect x="0" y="0" width="100%" height="100%" fill="url(#artSheen)" />
                          </Svg>
                        </View>
                      </TouchableOpacity>

                      {/* Back button on cover */}
                      <TouchableOpacity style={styles.backButton} onPress={handleClose}>
                        <Icon name="chevron-down" size={24} color="rgba(255,255,255,0.9)" set="ionicons" />
                      </TouchableOpacity>

                      {/* Settings icon on cover */}
                      <TouchableOpacity
                        style={styles.settingsButton}
                        onPress={() => handleFlip('settings')}
                      >
                        <Icon name="settings-outline" size={20} color="rgba(255,255,255,0.7)" set="ionicons" />
                      </TouchableOpacity>
                    </Animated.View>

                    {/* Back - Panel */}
                    <Animated.View
                      style={[styles.artworkFace, styles.artworkBack, { opacity: backOpacity }]}
                      pointerEvents={isFlipped ? 'auto' : 'none'}
                    >
                      <TouchableOpacity style={styles.flipCloseButton} onPress={handleFlipBack}>
                        <Icon name="close" size={20} color="rgba(255,255,255,0.5)" set="ionicons" />
                      </TouchableOpacity>

                      {flipMode === 'details' && (
                        <DetailsPanel
                          book={currentBook}
                          duration={bookDuration}
                          chaptersCount={chapters.length}
                          isLight={false}
                          onNavigateToAuthor={handleNavigateToAuthor}
                          onNavigateToNarrator={handleNavigateToNarrator}
                          onNavigateToSeries={handleNavigateToSeries}
                        />
                      )}

                      {flipMode === 'speed' && (
                        <SpeedPanel
                          tempSpeed={tempSpeed}
                          setTempSpeed={setTempSpeed}
                          onApply={() => {
                            usePlayerStore.getState().setPlaybackRate(tempSpeed);
                            handleFlipBack();
                          }}
                          onClose={handleFlipBack}
                          isLight={false}
                        />
                      )}

                      {flipMode === 'sleep' && (
                        <SleepPanel
                          tempSleepMins={tempSleepMins}
                          setTempSleepMins={setTempSleepMins}
                          sleepInputValue={sleepInputValue}
                          setSleepInputValue={setSleepInputValue}
                          onClear={() => {
                            usePlayerStore.getState().clearSleepTimer?.();
                            handleFlipBack();
                          }}
                          onStart={() => {
                            if (tempSleepMins > 0) {
                              usePlayerStore.getState().setSleepTimer?.(tempSleepMins);
                            }
                            handleFlipBack();
                          }}
                          isLight={false}
                        />
                      )}

                      {flipMode === 'chapters' && (
                        <ChaptersPanel
                          chapters={chapters}
                          currentChapter={currentChapter}
                          onChapterSelect={(start) => {
                            seekAbsolute(start);
                            handleFlipBack();
                          }}
                          onClose={handleFlipBack}
                          isLight={false}
                        />
                      )}

                      {flipMode === 'settings' && (
                        <SettingsPanel
                          controlMode={controlMode}
                          progressMode={progressMode}
                          onControlModeChange={setControlMode}
                          onProgressModeChange={setProgressMode}
                          onViewChapters={() => setFlipMode('chapters')}
                          onViewDetails={() => setFlipMode('details')}
                          isLight={false}
                        />
                      )}
                    </Animated.View>
                  </View>

                  {/* Title row */}
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={2}>{title}</Text>
                    <TouchableOpacity onPress={() => handleFlip('chapters')}>
                      <Text style={styles.chapter}>{chapterTitle}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Cassette Tape Progress */}
                  <View style={styles.waveformContainer}>
                    <CassetteTape
                      progress={progressMode === 'chapters' ? chapterProgress : bookProgress}
                      isPlaying={isPlaying}
                      isRewinding={isRewinding}
                      isFastForwarding={isFastForwarding}
                      isChangingChapter={isChangingChapter}
                      accentColor={cardColor}
                      bookId={currentBook?.id}
                      chapterIndex={chapterIndex}
                    />
                  </View>
                </View>

                {/* Bottom controls row */}
                <View style={styles.controlsRow}>
                  <Text style={styles.time}>{formatTime(displayPosition)}</Text>
                  <TouchableOpacity style={styles.controlItem} onPress={() => handleFlip('sleep')}>
                    <Icon
                      name={sleepTimer ? "moon" : "moon-outline"}
                      size={20}
                      color={sleepTimer ? cardColor : "rgba(255,255,255,0.5)"}
                      set="ionicons"
                    />
                    {sleepTimer && sleepTimer > 0 && (
                      <Text style={[styles.controlText, { color: cardColor }]}>
                        {Math.ceil(sleepTimer / 60)}m
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.controlItem} onPress={handleHeartPress}>
                    <Icon
                      name={isFavorite ? "heart" : "heart-outline"}
                      size={22}
                      color={isFavorite ? cardColor : "rgba(255,255,255,0.5)"}
                      set="ionicons"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleFlip('speed')}>
                    <Text style={styles.speed}>{Number(playbackRate.toFixed(2))}x</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassPanel>
          </View>

          {/* Button Row */}
          <View style={styles.buttonRow}>
            <PlayerButton
              variant={controlMode === 'chapter' ? 'skip-back' : 'rewind'}
              onPress={handleLeftPress}
              onPressIn={controlMode === 'chapter' ? undefined : handleLeftPressIn}
              onPressOut={controlMode === 'chapter' ? undefined : handleLeftPressOut}
              isActive={controlMode !== 'chapter' && isRewinding}
              seekDelta={controlMode !== 'chapter' && isRewinding ? seekDelta : undefined}
            />
            <PlayerButton
              variant={controlMode === 'chapter' ? 'skip-forward' : 'fastforward'}
              onPress={handleRightPress}
              onPressIn={controlMode === 'chapter' ? undefined : handleRightPressIn}
              onPressOut={controlMode === 'chapter' ? undefined : handleRightPressOut}
              isActive={controlMode !== 'chapter' && isFastForwarding}
              seekDelta={controlMode !== 'chapter' && isFastForwarding ? seekDelta : undefined}
            />
            <PlayerButton
              variant={isBookFinished ? 'restart' : 'play'}
              onPress={isBookFinished ? handleRestart : handlePlayPause}
              isPlaying={isPlaying}
              isLoading={isLoading}
              accentColor={cardColor}
            />
          </View>
        </View>
      </View>
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
  mainContent: {
    flex: 1,
    alignItems: 'center',
  },
  playerWrapper: {
    // gap controlled by displayWrapper marginBottom
  },
  displayWrapper: {
    marginBottom: 5,
    // Drop shadow onto buttons below
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 1000,
  },
  displayContent: {
    flex: 1,
    padding: DISPLAY_PADDING,
    justifyContent: 'space-between',
  },
  artworkContainer: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    marginBottom: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  artworkFace: {
    position: 'absolute',
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 5,
  },
  artworkBack: {
    backgroundColor: '#333',
    padding: 12,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  artworkInnerShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 11,
    overflow: 'hidden',
  },
  backButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  title: {
    fontFamily: 'System',
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    lineHeight: 26,
    maxWidth: 200,
  },
  chapter: {
    fontFamily: 'Courier',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 10,
  },
  waveformContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  time: {
    fontFamily: 'System',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontVariant: ['tabular-nums'],
  },
  controlItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  controlText: {
    fontFamily: 'System',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  speed: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 5,
  },
});