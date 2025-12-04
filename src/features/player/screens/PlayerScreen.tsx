/**
 * src/features/player/screens/PlayerScreen.tsx
 *
 * Redesigned full-screen player matching Anima design.
 * Features: CassetteTape progress, panels for speed/sleep/details
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
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { Image as RNImage } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors } from 'react-native-image-colors';

// Store and hooks
import {
  usePlayerStore,
  useCurrentChapterIndex,
  useChapterProgress,
  useBookProgress,
} from '../stores/playerStore';
import { useRobustSeekControl } from '../hooks/useRobustSeekControl';
import { useMyLibraryStore } from '@/features/library/stores/myLibraryStore';
import { apiClient } from '@/core/api';
import { getTitle } from '@/shared/utils/metadata';
import { formatTime, isColorLight, pickMostSaturated } from '../utils';
import { matchToPalette } from '@/shared/utils/colorPalette';
import { theme } from '@/shared/theme';

// Components
import { CassetteTape } from '../components/CassetteTape';
import { DetailsPanel, SpeedPanel, SleepPanel } from '../panels';

// Assets
const playButtonImage = require('../assets/play-player.png');
const pauseButtonImage = require('../assets/pause-player.png');
const rewindButtonImage = require('../assets/rewind-player.png');
const fastforwardButtonImage = require('../assets/fastforward-player.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

// Design constants from Anima
const COVER_SIZE = scale(285);
const BUTTON_SIZE = scale(130); // All buttons same size
const PLAY_BUTTON_SIZE = scale(140); // All buttons same size

const BUTTON_GAP = scale(0);
const CASSETTE_HEIGHT = scale(87);
const GRAY_CONTAINER_HEIGHT = scale(188); // From Anima: 188px for cassette + info tiles

// SVG Icons
const DownloadIcon = ({ size = 24, color = '#B3B3B3' }) => (
  <Svg width={size} height={size} viewBox="0 0 21 21" fill="none">
    <Path
      d="M18.375 13.125V16.625C18.375 17.0891 18.1906 17.5342 17.8624 17.8624C17.5342 18.1906 17.0891 18.375 16.625 18.375H4.375C3.91087 18.375 3.46575 18.1906 3.13756 17.8624C2.80937 17.5342 2.625 17.0891 2.625 16.625V13.125M6.125 8.75L10.5 13.125M10.5 13.125L14.875 8.75M10.5 13.125V2.625"
      stroke={color}
      strokeWidth={1.97}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const HeartIcon = ({ size = 24, color = '#34C759', filled = false }) => (
  <Svg width={size} height={size} viewBox="0 0 18 15" fill="none">
    <Path
      d="M15.9611 1.25119C15.5385 0.854523 15.0367 0.539863 14.4845 0.32518C13.9323 0.110498 13.3404 0 12.7426 0C12.1448 0 11.5529 0.110498 11.0007 0.32518C10.4484 0.539863 9.9467 0.854523 9.52412 1.25119L8.6471 2.07401L7.77009 1.25119C6.9165 0.450331 5.75878 0.000415111 4.55161 0.000415119C3.34445 0.000415128 2.18673 0.450331 1.33314 1.25119C0.479544 2.05204 8.99406e-09 3.13823 0 4.27081C-8.99406e-09 5.40339 0.479544 6.48958 1.33314 7.29044L8.6471 14.1525L15.9611 7.29044C16.3839 6.89396 16.7192 6.42322 16.9481 5.9051C17.1769 5.38698 17.2947 4.83164 17.2947 4.27081C17.2947 3.70998 17.1769 3.15464 16.9481 2.63652C16.7192 2.1184 16.3839 1.64766 15.9611 1.25119Z"
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth={1.5}
    />
  </Svg>
);

type PanelMode = 'none' | 'details' | 'speed' | 'sleep' | 'progress';

// Format seek delta for display
const formatSeekDelta = (seconds: number): string => {
  const absSeconds = Math.abs(seconds);
  const sign = seconds >= 0 ? '+' : '-';
  if (absSeconds < 60) {
    return `${sign}${Math.round(absSeconds)}s`;
  }
  const mins = Math.floor(absSeconds / 60);
  const secs = Math.round(absSeconds % 60);
  return secs > 0 ? `${sign}${mins}m ${secs}s` : `${sign}${mins}m`;
};

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
    closePlayer,
    play,
    pause,
    setPlaybackRate,
    setSleepTimer,
    clearSleepTimer,
  } = usePlayerStore();

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
  const chapterProgress = useChapterProgress();
  const bookProgress = useBookProgress();

  const displayPosition = isSeeking ? seekPosition : position;

  // Library store
  const { isInLibrary, addToLibrary, removeFromLibrary } = useMyLibraryStore();
  const isFavorite = currentBook ? isInLibrary(currentBook.id) : false;

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
  const coverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : '';
  const title = currentBook ? getTitle(currentBook) : '';
  const media = currentBook?.media as any;
  const chapters = storeChapters.length > 0 ? storeChapters : (media?.chapters || []);
  const chapterNumber = chapterIndex + 1;

  let bookDuration = media?.duration || 0;
  if (bookDuration <= 0 && storeDuration > 0) bookDuration = storeDuration;

  const timeRemaining = formatTime(Math.max(0, bookDuration - displayPosition));
  const sleepTimerMinutes = sleepTimer ? Math.ceil(sleepTimer / 60) : null;

  // Seeking state for cassette
  const isRewinding = isSeeking && seekDirection === 'backward';
  const isFastForwarding = isSeeking && seekDirection === 'forward';

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
    if (!coverUrl || !currentBook) return;
    let mounted = true;

    const extractColors = async () => {
      try {
        const result = await getColors(coverUrl, {
          fallback: '#C8FF00',
          cache: true,
          key: currentBook.id,
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
    if (isPlaying) await pause();
    else await play();
  }, [isPlaying, pause, play]);

  const handleHeartPress = useCallback(() => {
    if (!currentBook) return;
    if (isInLibrary(currentBook.id)) {
      removeFromLibrary(currentBook.id);
    } else {
      addToLibrary(currentBook.id);
    }
  }, [currentBook, isInLibrary, addToLibrary, removeFromLibrary]);

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

  if (!isPlayerVisible || !currentBook) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      {...panResponder.panHandlers}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Background - Same style as HomeBackground */}
      <View style={StyleSheet.absoluteFill}>
        {/* Base color */}
        <View style={styles.baseColor} />

        {/* Blurred cover image */}
        {coverUrl && (
          <View style={styles.imageContainer}>
            <RNImage
              source={{ uri: coverUrl }}
              style={styles.backgroundImage}
              resizeMode="cover"
              blurRadius={15}
            />
            <BlurView intensity={50} style={StyleSheet.absoluteFill} tint="dark" />
            {/* Brightness overlay */}
            <View style={styles.brightnessOverlay} />
          </View>
        )}

        {/* Gradient overlay to black at bottom */}
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

      {/* Main content */}
      <View style={[styles.content, { paddingTop: insets.top + scale(10) }]}>
        {/* Top icons row */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.topIcon} onPress={() => { /* TODO: Download functionality */ }}>
            <DownloadIcon size={scale(24)} color={accentColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topIcon} onPress={handleHeartPress}>
            <HeartIcon size={scale(18)} color="#34C759" filled={isFavorite} />
          </TouchableOpacity>
        </View>

        {/* Cover area OR Panel (panels replace cover) */}
        {panelMode === 'none' ? (
          /* Cover artwork - tappable for details */
          <TouchableOpacity
            style={styles.coverContainer}
            onPress={handleCoverPress}
            activeOpacity={0.9}
          >
            <Image
              source={coverUrl}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
            />
          </TouchableOpacity>
        ) : (
          /* Panel content - full width, background shows through */
          <View style={styles.panelArea}>
            <TouchableOpacity
              style={styles.panelCloseArea}
              onPress={() => setPanelMode('none')}
              activeOpacity={1}
            >
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
            <View style={styles.panelInner}>
              {panelMode === 'details' && (
                <DetailsPanel
                  book={currentBook}
                  duration={bookDuration}
                  chaptersCount={chapters.length}
                  isLight={false}
                />
              )}
              {panelMode === 'speed' && (
                <SpeedPanel
                  tempSpeed={tempSpeed}
                  setTempSpeed={setTempSpeed}
                  onApply={handleApplySpeed}
                  onClose={() => setPanelMode('none')}
                  isLight={false}
                />
              )}
              {panelMode === 'sleep' && (
                <SleepPanel
                  tempSleepMins={tempSleepMins}
                  setTempSleepMins={setTempSleepMins}
                  sleepInputValue={sleepInputValue}
                  setSleepInputValue={setSleepInputValue}
                  onClear={handleClearSleep}
                  onStart={handleStartSleep}
                  isLight={false}
                />
              )}
              {panelMode === 'progress' && (
                <View style={styles.progressPanel}>
                  <Text style={styles.progressTitle}>Progress</Text>
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${bookProgress * 100}%`, backgroundColor: accentColor }
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.progressTimes}>
                    <Text style={styles.progressTimeText}>{formatTime(displayPosition)}</Text>
                    <Text style={styles.progressTimeText}>{formatTime(bookDuration)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Unified Cassette + Info Container (Rectangle 21 style) */}
        <View style={styles.cassetteInfoWrapper}>
          {/* Gray background container */}
          <View style={styles.cassetteInfoBackground}>
            {/* Border highlight */}
            <View style={styles.borderHighlight} />
          </View>

          {/* Cassette Tape Progress */}
          <View style={styles.cassetteContainer}>
            <CassetteTape
              progress={bookProgress}
              isPlaying={isPlaying}
              isRewinding={isRewinding}
              isFastForwarding={isFastForwarding}
              accentColor={accentColor}
              bookId={currentBook?.id}
              chapterIndex={chapterIndex}
            />
          </View>

          {/* Info Tiles */}
          <View style={styles.infoTilesContainer}>
            {/* Left pill - Title & Chapter */}
            <View style={styles.leftPill}>
              <View style={styles.blurLayer} pointerEvents="none">
                <Text style={[styles.titleText, styles.blurText]} numberOfLines={2}>
                  {title}
                </Text>
                <View style={styles.chapterContainer}>
                  <Text style={[styles.chapterText, styles.blurText]}>Chpt.</Text>
                  <Text style={[styles.chapterText, styles.blurText]}>{chapterNumber}</Text>
                </View>
              </View>
              <Text style={styles.titleText} numberOfLines={2}>
                {title}
              </Text>
              <View style={styles.chapterContainer}>
                <Text style={styles.chapterText}>Chpt.</Text>
                <Text style={styles.chapterText}>{chapterNumber}</Text>
              </View>
            </View>

            {/* Right pill - Time, Speed, Sleep */}
            <View style={styles.rightPill}>
              <TouchableOpacity onPress={handleTimePress} style={styles.timeRow}>
                {/* Show seek delta when seeking, otherwise show time remaining */}
                {isSeeking && seekDelta !== 0 ? (
                  <Text style={[styles.timeText, styles.seekDeltaText]}>
                    {formatSeekDelta(seekDelta)}
                  </Text>
                ) : (
                  <Text style={styles.timeText}>{timeRemaining}</Text>
                )}
                {/* 8-bit play icon - only show when playing */}
                {isPlaying && !isSeeking && (
                  <View style={styles.pixelPlayIcon}>
                    <View style={styles.pixelRow}>
                      <View style={styles.pixel} />
                    </View>
                    <View style={styles.pixelRow}>
                      <View style={styles.pixel} />
                      <View style={styles.pixel} />
                    </View>
                    <View style={styles.pixelRow}>
                      <View style={styles.pixel} />
                      <View style={styles.pixel} />
                      <View style={styles.pixel} />
                    </View>
                    <View style={styles.pixelRow}>
                      <View style={styles.pixel} />
                      <View style={styles.pixel} />
                    </View>
                    <View style={styles.pixelRow}>
                      <View style={styles.pixel} />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.bottomRow}>
                <TouchableOpacity onPress={handleSpeedPress}>
                  <Text style={styles.speedText}>{playbackRate.toFixed(2)}x</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSleepPress}>
                  <Text style={styles.sleepTimerText}>
                    {sleepTimerMinutes ? `${sleepTimerMinutes}m` : '∞'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Playback controls - below the gray container, all in a row */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.controlButton}
            onPressIn={handleRewindPressIn}
            onPressOut={handleRewindPressOut}
            activeOpacity={0.8}
          >
            <Image
              source={rewindButtonImage}
              style={styles.controlButtonImage}
              contentFit="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPressIn={handleFFPressIn}
            onPressOut={handleFFPressOut}
            activeOpacity={0.8}
          >
            <Image
              source={fastforwardButtonImage}
              style={styles.controlButtonImage}
              contentFit="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            activeOpacity={0.8}
          >
            <Image
              source={isPlaying ? pauseButtonImage : playButtonImage}
              style={styles.playButtonImage}
              contentFit="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const FONT_SIZE = 20;
const LINE_HEIGHT = 21;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  baseColor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.65,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
    transform: [{ scale: 1.1 }],
    opacity: 0.8,
  },
  brightnessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },

  // Top row
  topRow: {
    width: SCREEN_WIDTH,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(32),
    marginBottom: scale(20),
  },
  topIcon: {
    width: scale(32),
    height: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Cover
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: scale(9),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: scale(40),
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },

  // Unified cassette + info wrapper (Rectangle 21 style)
  cassetteInfoWrapper: {
    width: SCREEN_WIDTH - scale(20),
    paddingHorizontal: scale(10),
    paddingTop: scale(12),
    paddingBottom: scale(12),
    marginBottom: scale(-10),
    zIndex:100,
  },
  cassetteInfoBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#262626',
    borderRadius: scale(5),
    // Subtle gradients for depth effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,

  },
  borderHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: scale(5),
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },

  // Cassette
  cassetteContainer: {
    width: '100%',
    height: CASSETTE_HEIGHT,
    marginBottom: scale(10),
  },

  // Info tiles
  infoTilesContainer: {
    flexDirection: 'row',
    gap: scale(7),
  },
  leftPill: {
    flex: 1,
    height: scale(61),
    backgroundColor: '#000000',
    borderRadius: scale(5),
    paddingHorizontal: scale(11),
    paddingVertical: scale(7),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: scale(11),
    paddingVertical: scale(7),
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.6,
  },
  blurText: {
    textShadowColor: 'rgba(255, 255, 255, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  rightPill: {
    width: scale(135),
    height: scale(61),
    backgroundColor: '#000000',
    borderRadius: scale(5),
    paddingHorizontal: scale(11),
    paddingVertical: scale(6),
    justifyContent: 'space-between',
  },
  titleText: {
    flex: 1,
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: scale(LINE_HEIGHT),
    textShadowColor: 'rgba(255, 255, 255, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  chapterContainer: {
    alignItems: 'flex-end',
  },
  chapterText: {
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: scale(LINE_HEIGHT),
    textAlign: 'right',
    textShadowColor: 'rgba(255, 255, 255, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: scale(LINE_HEIGHT),
    textShadowColor: 'rgba(255, 255, 255, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  seekDeltaText: {
    color: '#C8FF00',
    textShadowColor: 'rgba(200, 255, 0, 1)',
  },
  // 8-bit pixel play icon - smaller version
  pixelPlayIcon: {
    width: scale(6),
    height: scale(9),
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: scale(4),
  },
  pixelRow: {
    flexDirection: 'row',
  },
  pixel: {
    width: scale(2),
    height: scale(2),
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speedText: {
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: scale(LINE_HEIGHT),
    textShadowColor: 'rgba(255, 255, 255, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  sleepTimerText: {
    fontFamily: 'PixelOperator',
    fontSize: scale(FONT_SIZE),
    fontWeight: '400',
    color: '#F12802',
    lineHeight: scale(LINE_HEIGHT),
    textShadowColor: 'rgba(241, 40, 2, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  // Controls - below the gray container
  controlsContainer: {
    width: SCREEN_WIDTH + scale(100),
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'flex-start',
    marginLeft: scale(130),
    gap: BUTTON_GAP,
  },
  controlButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    marginLeft: scale(-3),
  },
  controlButtonImage: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    marginLeft: scale(-20),
    marginTop: scale(-7),
  },
  playButtonImage: {
    width: '100%',
    height: '100%',
  },

  // Panel area (full width, background shows through)
  panelArea: {
    width: SCREEN_WIDTH - scale(32),
    height: COVER_SIZE,
    marginBottom: scale(40),
  },
  panelCloseArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: scale(40),
    height: scale(40),
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeX: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 20,
    fontWeight: '300',
  },
  panelInner: {
    flex: 1,
    paddingTop: scale(8),
    paddingHorizontal: scale(4),
  },

  // Progress panel
  progressPanel: {
    flex: 1,
    justifyContent: 'center',
  },
  progressTitle: {
    fontFamily: 'PixelOperator',
    fontSize: scale(24),
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: scale(20),
  },
  progressBarContainer: {
    paddingHorizontal: scale(10),
    marginBottom: scale(12),
  },
  progressBarBg: {
    height: scale(8),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#C8FF00',
    borderRadius: scale(4),
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(10),
  },
  progressTimeText: {
    fontFamily: 'PixelOperator',
    fontSize: scale(16),
    color: '#FFFFFF',
  },

  // Old panel styles (can be removed later)
  panelContent: {
    width: SCREEN_WIDTH - scale(40),
    maxHeight: SCREEN_HEIGHT * 0.6,
    backgroundColor: '#1a1a1a',
    borderRadius: scale(12),
    padding: scale(16),
  },
});
