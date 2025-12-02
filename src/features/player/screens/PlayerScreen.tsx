/**
 * src/features/player/screens/PlayerScreen.tsx
 * 
 * Full-screen player with glass morphism design.
 * Preserves all existing functionality, applies new styling.
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
import { usePlayerStore } from '../stores/playerStore';
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
  REWIND_STEP,
  REWIND_INTERVAL,
  FF_STEP,
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
const DISPLAY_PADDING = 12;
const ARTWORK_SIZE = DISPLAY_WIDTH - DISPLAY_PADDING * 2;

// Artwork inset shadow config (plastic cover effect)
// opacity: darkness at edge (0-1)
// depth: how far shadow extends inward (0-1, where 0.1 = 10% of artwork size)
const ART_SHADOW = {
  top:    { opacity: 0.6, depth: 0.12 },
  bottom: { opacity: 0.5, depth: 0.10 },
  left:   { opacity: 0.55, depth: 0.10 },
  right:  { opacity: 0.55, depth: 0.10 },
  sheen:  { opacity: 0.08, depth: 0.05 },  // top highlight
  border: { opacity: 0.4, width: 1 },      // frame edge
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

  // UI state
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
  
  // Rewind/FF state
  const [isRewinding, setIsRewinding] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [seekDelta, setSeekDelta] = useState(0);
  
  // Refs
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const rewindInterval = useRef<NodeJS.Timeout | null>(null);
  const ffInterval = useRef<NodeJS.Timeout | null>(null);
  const seekingPos = useRef(0);
  const wasPlaying = useRef(false);
  const isSeeking = useRef(false);
  const startPosition = useRef(0);

  // Store
  const {
    currentBook,
    isPlayerVisible,
    isPlaying,
    isLoading,
    position,
    duration: storeDuration,
    playbackRate,
    sleepTimer,
    closePlayer,
    play,
    pause,
    seekTo,
    chapters: storeChapters,
  } = usePlayerStore();

  // Library store for favorites
  const { isInLibrary, addToLibrary, removeFromLibrary } = useMyLibraryStore();
  const isFavorite = currentBook ? isInLibrary(currentBook.id) : false;

  const handleHeartPress = useCallback(() => {
    if (!currentBook) return;
    const currentlyFavorite = isInLibrary(currentBook.id);
    if (currentlyFavorite) {
      removeFromLibrary(currentBook.id);
    } else {
      addToLibrary(currentBook.id);
    }
  }, [currentBook, isInLibrary, addToLibrary, removeFromLibrary]);

  const coverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : '';

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

  // Cleanup
  useEffect(() => {
    return () => {
      if (rewindInterval.current) clearInterval(rewindInterval.current);
      if (ffInterval.current) clearInterval(ffInterval.current);
    };
  }, []);

  // Sync seeking position (but not while actively rewinding/ff)
  useEffect(() => {
    if (!isRewinding && !isFastForwarding) {
      seekingPos.current = position;
    }
  }, [position, isRewinding, isFastForwarding]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleClose = useCallback(() => {
    if (rewindInterval.current) clearInterval(rewindInterval.current);
    if (ffInterval.current) clearInterval(ffInterval.current);
    setIsRewinding(false);
    setIsFastForwarding(false);
    setSeekDelta(0);

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
  }, [closePlayer, slideAnim, flipAnim]);

  const handleNavigateToAuthor = useCallback((authorName: string) => {
    handleClose();
    setTimeout(() => {
      navigation.navigate('AuthorDetail' as never, { authorName } as never);
    }, 150);
  }, [navigation, handleClose]);

  const handleNavigateToNarrator = useCallback((narratorName: string) => {
    handleClose();
    setTimeout(() => {
      navigation.navigate('NarratorDetail' as never, { narratorName } as never);
    }, 150);
  }, [navigation, handleClose]);

  const handleNavigateToSeries = useCallback((seriesName: string) => {
    handleClose();
    setTimeout(() => {
      navigation.navigate('SeriesDetail' as never, { seriesName } as never);
    }, 150);
  }, [navigation, handleClose]);

  if (!isPlayerVisible || !currentBook) return null;

  // Derived values
  const title = getTitle(currentBook);
  // Use store chapters (from session API) first, fallback to book chapters
  const chapters = storeChapters.length > 0 ? storeChapters : (currentBook.media?.chapters || []);
  
  let bookDuration = currentBook.media?.duration || 0;
  if (bookDuration <= 0 && storeDuration > 0) bookDuration = storeDuration;
  if (bookDuration <= 0 && chapters.length > 0) {
    bookDuration = chapters[chapters.length - 1].end || 0;
  }

  const currentChapter = chapters.find((ch, idx) => {
    const next = chapters[idx + 1];
    return position >= ch.start && (!next || position < next.start);
  });
  const chapterIndex = currentChapter ? chapters.indexOf(currentChapter) + 1 : 1;
  const chapterTitle = `Chapter ${chapterIndex}`;

  const progress = bookDuration > 0 ? position / bookDuration : 0;
  const chapterStart = currentChapter?.start || 0;
  const chapterEnd = currentChapter?.end || bookDuration;
  const chapterDuration = chapterEnd - chapterStart;
  const chapterProgress = chapterDuration > 0 
    ? Math.max(0, Math.min(1, (position - chapterStart) / chapterDuration))
    : 0;

  const textColor = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)';
  const waveColor = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';

  // ===========================================================================
  // OTHER HANDLERS
  // ===========================================================================

  const handleFlip = (mode: FlipMode = 'details') => {
    if (isFlipped && flipMode === mode) {
      setIsFlipped(false);
      Animated.timing(flipAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else if (isFlipped && flipMode !== mode) {
      setFlipMode(mode);
      if (mode === 'speed') setTempSpeed(playbackRate);
    } else {
      setFlipMode(mode);
      if (mode === 'speed') setTempSpeed(playbackRate);
      setIsFlipped(true);
      Animated.timing(flipAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  };

  const handleFlipBack = () => {
    setIsFlipped(false);
    Animated.timing(flipAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const handlePlayPause = async () => {
    if (isPlaying) await pause();
    else await play();
  };

  const handlePrevChapter = async () => {
    if (chapters.length === 0) return;
    
    let currentIdx = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (position >= chapters[i].start) {
        currentIdx = i;
        break;
      }
    }
    
    const currentChapterStart = chapters[currentIdx]?.start || 0;
    const targetIdx = (position - currentChapterStart > 3) ? currentIdx : Math.max(0, currentIdx - 1);
    await seekTo(chapters[targetIdx].start);
  };

  const handleNextChapter = async () => {
    if (chapters.length === 0) return;
    
    let currentIdx = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (position >= chapters[i].start) {
        currentIdx = i;
        break;
      }
    }
    
    if (currentIdx < chapters.length - 1) {
      await seekTo(chapters[currentIdx + 1].start);
    }
  };

  const handleRestart = async () => {
    await seekTo(0);
    play();
  };

  // Check if book is finished
  const isBookFinished = progress >= 0.99;

  // Rewind handlers
  const startRewind = async () => {
    if (isRewinding) return;
    setIsRewinding(true);
    wasPlaying.current = isPlaying;
    startPosition.current = position;
    seekingPos.current = position;
    isSeeking.current = false;
    setSeekDelta(0);
    await pause();
    
    const doRewind = () => {
      if (isSeeking.current) return;
      isSeeking.current = true;
      seekingPos.current = Math.max(0, seekingPos.current - REWIND_STEP);
      setSeekDelta(seekingPos.current - startPosition.current);
      
      seekTo(seekingPos.current).finally(() => {
        isSeeking.current = false;
        if (seekingPos.current <= 0 && rewindInterval.current) {
          clearInterval(rewindInterval.current);
          rewindInterval.current = null;
          setIsRewinding(false);
          setSeekDelta(0);
        }
      });
    };
    
    doRewind();
    rewindInterval.current = setInterval(doRewind, REWIND_INTERVAL);
  };

  const stopRewind = async () => {
    if (rewindInterval.current) clearInterval(rewindInterval.current);
    rewindInterval.current = null;
    setIsRewinding(false);
    setSeekDelta(0);
    if (wasPlaying.current) await play();
  };

  const startFastForward = async () => {
    if (isFastForwarding) return;
    setIsFastForwarding(true);
    wasPlaying.current = isPlaying;
    startPosition.current = position;
    seekingPos.current = position;
    isSeeking.current = false;
    setSeekDelta(0);
    await pause();
    
    const doFF = () => {
      if (isSeeking.current) return;
      isSeeking.current = true;
      seekingPos.current = Math.min(bookDuration - 1, seekingPos.current + FF_STEP);
      setSeekDelta(seekingPos.current - startPosition.current);
      
      seekTo(seekingPos.current).finally(() => {
        isSeeking.current = false;
        if (seekingPos.current >= bookDuration - 1 && ffInterval.current) {
          clearInterval(ffInterval.current);
          ffInterval.current = null;
          setIsFastForwarding(false);
          setSeekDelta(0);
        }
      });
    };
    
    doFF();
    ffInterval.current = setInterval(doFF, REWIND_INTERVAL);
  };

  const stopFastForward = async () => {
    if (ffInterval.current) clearInterval(ffInterval.current);
    ffInterval.current = null;
    setIsFastForwarding(false);
    setSeekDelta(0);
    if (wasPlaying.current) await play();
  };

  const handleLeftPressIn = () => { startRewind(); };
  const handleLeftPressOut = () => { stopRewind(); };
  const handleRightPressIn = () => { startFastForward(); };
  const handleRightPressOut = () => { stopFastForward(); };

  const handleProgressScrub = async (percent: number) => {
    const newPosition = Math.max(0, Math.min(bookDuration, percent * bookDuration));
    await seekTo(newPosition);
  };

  const handleChapterScrub = async (percent: number) => {
    const newPosition = Math.max(chapterStart, Math.min(chapterEnd, chapterStart + percent * chapterDuration));
    await seekTo(newPosition);
  };

  // Flip animations
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // Calculate display height (header + artwork + title + cassette + controls)
  const displayHeight = DISPLAY_PADDING + 28 + ARTWORK_SIZE + 8 + 52 + 8 + 80 + 8 + 24 + DISPLAY_PADDING;

  // ===========================================================================
  // MAIN RENDER
  // ===========================================================================

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      <View style={[styles.mainContent, { paddingTop: insets.top + 8 }]}>
        <View style={styles.playerWrapper}>
          {/* Display Panel */}
          <View style={styles.displayWrapper}>
            <GlassPanel width={DISPLAY_WIDTH} height={displayHeight} variant="display">
            <View style={styles.displayContent}>
              {/* Back button row */}
              <View style={styles.cardHeaderRow}>
                <TouchableOpacity style={styles.backButton} onPress={handleClose}>
                  <Icon name="chevron-down" size={24} color="rgba(255,255,255,0.7)" set="ionicons" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleFlip('settings')}>
                  <Icon name="settings-outline" size={20} color="rgba(255,255,255,0.5)" set="ionicons" />
                </TouchableOpacity>
              </View>

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
                        transition={300} 
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
                        seekTo(start);
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
                  progress={progressMode === 'chapters' ? chapterProgress : progress}
                  isPlaying={isPlaying}
                  isRewinding={isRewinding}
                  isFastForwarding={isFastForwarding}
                  accentColor={cardColor}
                  bookId={currentBook?.id}
                  chapterIndex={chapterIndex}
                />
              </View>
              </View>

              {/* Bottom controls row */}
              <View style={styles.controlsRow}>
                <Text style={styles.time}>{formatTime(position)}</Text>
                <TouchableOpacity style={styles.controlItem} onPress={() => handleFlip('sleep')}>
                  <Icon 
                    name={sleepTimer ? "moon" : "moon-outline"} 
                    size={14} 
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
                    size={16} 
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
              onPress={controlMode === 'chapter' ? handlePrevChapter : () => {}}
              onPressIn={controlMode === 'chapter' ? undefined : handleLeftPressIn}
              onPressOut={controlMode === 'chapter' ? undefined : handleLeftPressOut}
              isActive={controlMode !== 'chapter' && isRewinding}
              seekDelta={controlMode !== 'chapter' && isRewinding ? seekDelta : undefined}
            />
            <PlayerButton
              variant={controlMode === 'chapter' ? 'skip-forward' : 'fastforward'}
              onPress={controlMode === 'chapter' ? handleNextChapter : () => {}}
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
    backgroundColor: '#1a1a1a',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  displayContent: {
    flex: 1,
    padding: DISPLAY_PADDING,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  backButton: {
    padding: 2,
  },
  artworkContainer: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    marginBottom: 8,
    borderRadius: 11,
    overflow: 'hidden',
  },
  artworkFace: {
    position: 'absolute',
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 11,
  },
  artworkBack: {
    backgroundColor: '#333',
    padding: 12,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 11,
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
    marginBottom: 8,
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
    marginTop: 4,
  },
  waveformContainer: {
    position: 'relative',
    width: '100%',
    height: 80,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 5,
  },
});