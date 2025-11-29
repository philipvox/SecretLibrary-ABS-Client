/**
 * src/features/player/screens/PlayerScreen.tsx
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors } from 'react-native-image-colors';
import { usePlayerStore } from '../stores/playerStore';
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
  AudioWaveform,
  PlayerHeader,
  PlayerControls,
  PlayerProgress,
} from '../components';
import {
  DetailsPanel,
  SpeedPanel,
  SleepPanel,
  ChaptersPanel,
  SettingsPanel,
} from '../panels';

type FlipMode = 'details' | 'speed' | 'sleep' | 'chapters' | 'settings';

export function PlayerScreen() {
  const insets = useSafeAreaInsets();
  
  // UI state
  const [cardColor, setCardColor] = useState(theme.colors.neutral[300]);
  const [isLight, setIsLight] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flipMode, setFlipMode] = useState<FlipMode>('details');
  
  // Panel state
  const [tempSpeed, setTempSpeed] = useState(1);
  const [tempSleepMins, setTempSleepMins] = useState(15);
  const [sleepInputValue, setSleepInputValue] = useState('15');
  const [controlMode, setControlMode] = useState<'rewind' | 'chapter'>('rewind');
  const [progressMode, setProgressMode] = useState<'bar' | 'chapters'>('bar');
  
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
  } = usePlayerStore();

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

  // Sync seeking position
  useEffect(() => {
    seekingPos.current = position;
  }, [position]);

  if (!isPlayerVisible || !currentBook) return null;

  // Derived values
  const title = getTitle(currentBook);
  const chapters = currentBook.media?.chapters || [];
  
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

  // Handlers
  const handleClose = () => {
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
  };

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
    const currentIdx = currentChapter ? chapters.indexOf(currentChapter) : 0;
    await seekTo(currentIdx > 0 ? chapters[currentIdx - 1].start : 0);
  };

  const handleNextChapter = async () => {
    if (chapters.length === 0) return;
    const currentIdx = currentChapter ? chapters.indexOf(currentChapter) : 0;
    if (currentIdx < chapters.length - 1) {
      await seekTo(chapters[currentIdx + 1].start);
    }
  };

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

  const handleLeftPressIn = () => { if (controlMode === 'rewind') startRewind(); };
  const handleLeftPressOut = () => { if (controlMode === 'rewind') stopRewind(); };
  const handleLeftPress = () => { if (controlMode === 'chapter') handlePrevChapter(); };
  const handleRightPressIn = () => { if (controlMode === 'rewind') startFastForward(); };
  const handleRightPressOut = () => { if (controlMode === 'rewind') stopFastForward(); };
  const handleRightPress = () => { if (controlMode === 'chapter') handleNextChapter(); };

  const handleProgressScrub = async (percent: number) => {
    await seekTo(percent * bookDuration);
  };

  const handleChapterScrub = async (percent: number) => {
    await seekTo(chapterStart + percent * chapterDuration);
  };

  // Flip animations
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={[styles.mainContent, { paddingTop: insets.top + 8 }]}>
        {/* Card */}
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <PlayerHeader
            title={title}
            chapterTitle={chapterTitle}
            position={position}
            duration={bookDuration}
            textColor={textColor}
            secondaryColor={secondaryColor}
            onChapterPress={() => handleFlip('chapters')}
            onClose={handleClose}
          />

          {/* Flippable Cover */}
          <View style={styles.coverContainer}>
            {/* Front */}
            <Animated.View 
              style={[styles.coverFace, { opacity: frontOpacity }]}
              pointerEvents={isFlipped ? 'none' : 'auto'}
            >
              <TouchableOpacity onPress={() => handleFlip('details')} activeOpacity={0.9}>
                <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
              </TouchableOpacity>
            </Animated.View>

            {/* Back */}
           <Animated.View 
             style={[
               styles.coverFace,
               styles.coverBack,
               { 
                 backgroundColor: cardColor,
                 opacity: backOpacity,
               }
             ]}
              pointerEvents={isFlipped ? 'auto' : 'none'}
            >
              <TouchableOpacity style={styles.flipCloseButton} onPress={handleFlipBack}>
                <Icon name="close" size={24} color={isLight ? '#fff' : '#000'} set="ionicons" />
              </TouchableOpacity>

              {flipMode === 'details' && (
                <DetailsPanel
                  book={currentBook}
                  title={title}
                  duration={bookDuration}
                  chaptersCount={chapters.length}
                  isLight={isLight}
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
                  isLight={isLight}
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
                  isLight={isLight}
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
                  isLight={isLight}
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
                  isLight={isLight}
                />
              )}
            </Animated.View>
          </View>

          {/* Waveform */}
          <AudioWaveform color={waveColor} isPlaying={isPlaying} />

          {/* Time row */}
          <View style={styles.timeRow}>
            <View style={styles.timeLeft}>
              <TouchableOpacity 
                style={[styles.speedButton, { backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)' }]}
                onPress={() => handleFlip('speed')}
              >
                <Text style={[styles.speedLabel, { color: textColor }]}>{playbackRate}x</Text>
              </TouchableOpacity>
              <Text style={[styles.currentTime, { color: secondaryColor }]}>{formatTime(position)}</Text>
            </View>
            <Text style={[styles.totalTime, { color: secondaryColor }]}>{formatTime(bookDuration)}</Text>
          </View>
        </View>

        {/* Controls */}
        <PlayerControls
          isPlaying={isPlaying}
          isLoading={isLoading || false}
          isRewinding={isRewinding}
          isFastForwarding={isFastForwarding}
          seekDelta={seekDelta}
          controlMode={controlMode}
          cardColor={cardColor}
          textColor={textColor}
          onPlayPause={handlePlayPause}
          onLeftPress={handleLeftPress}
          onLeftPressIn={handleLeftPressIn}
          onLeftPressOut={handleLeftPressOut}
          onRightPress={handleRightPress}
          onRightPressIn={handleRightPressIn}
          onRightPressOut={handleRightPressOut}
        />
      </View>

      {/* Bottom progress */}
      <PlayerProgress
        progress={progress}
        chapterProgress={chapterProgress}
        chapterIndex={chapterIndex}
        totalChapters={chapters.length}
        progressMode={progressMode}
        sleepTimer={sleepTimer}
        cardColor={cardColor}
        onSleepPress={() => handleFlip('sleep')}
        onSettingsPress={() => handleFlip('settings')}
        onProgressScrub={handleProgressScrub}
        onChapterScrub={handleChapterScrub}
        bottomInset={insets.bottom}
      />
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
    backgroundColor: '#000000',
  },
  mainContent: {
    flex: 1,
  },
  card: {
    marginHorizontal: CARD_MARGIN,
    borderRadius: RADIUS,
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  coverContainer: {
    alignItems: 'center',
    marginBottom: 16,
    width: COVER_SIZE,
    height: COVER_SIZE,
    alignSelf: 'center',
  },
  coverFace: {
    position: 'absolute',
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: RADIUS,
  },
  coverBack: {
    padding: 16,
    overflow: 'visible',  // Allow buttons to escape
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: RADIUS,
    backgroundColor: '#000',
  },
  flipCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: -14,
  },
  timeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speedButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  speedLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentTime: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  totalTime: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
