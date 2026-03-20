/**
 * src/features/home/components/BookSpineVertical.tsx
 *
 * Vertical book spine — heavily blurred cover as full background,
 * rotated title + horizontal author overlaid on top.
 * System fonts for maximum readability.
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Pressable, View, Text, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { haptics } from '@/core/native/haptics';
import { useSpineUrl, useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { useSpineCacheStore } from '../stores/spineCache';
import { useStarPositionStore } from '@/features/book-detail/stores/starPositionStore';
import {
  getSpineDimensions,
  calculateBookDimensions,
  MIN_TOUCH_TARGET,
} from '../utils/spine/adapter';
import { getGenreFallbackColor } from '../services/colorExtractor';

// =============================================================================
// TYPES
// =============================================================================

export interface BookSpineVerticalData {
  id: string;
  title: string;
  author: string;
  progress?: number;
  genres?: string[];
  tags?: string[];
  duration?: number;
  seriesName?: string;
  seriesSequence?: number;
  lastPlayedAt?: string;
  isDownloaded?: boolean;
  backgroundColor?: string;
  textColor?: string;
}

interface BookSpineVerticalProps {
  book: BookSpineVerticalData;
  width?: number;
  height?: number;
  leanAngle?: number;
  isActive?: boolean;
  isPushedLeft?: boolean;
  isPushedRight?: boolean;
  onPress?: (book: BookSpineVerticalData) => void;
  onLongPress?: (book: BookSpineVerticalData) => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  showShadow?: boolean;
  isHorizontalDisplay?: boolean;
  style?: ViewStyle;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DOWNLOAD_INDICATOR_COLOR = '#FF6B35';
const DOWNLOAD_INDICATOR_HEIGHT = 1;
const CORNER_RADIUS = 5;
const DEFAULT_DURATION = 10 * 60 * 60;
const STAR_STICKER_IMAGE = require('@assets/stars/star5.webp');
const BOOK_TEXTURES = [
  require('@assets/textures/book-texture-1.webp'),
  require('@assets/textures/book-texture-2.webp'),
  require('@assets/textures/book-texture-3.webp'),
  require('@assets/textures/book-texture-4.webp'),
  require('@assets/textures/book-texture-5.webp'),
  require('@assets/textures/book-texture-6.webp'),
  require('@assets/textures/book-texture-7.webp'),
  require('@assets/textures/book-texture-8.webp'),
  require('@assets/textures/book-texture-9.webp'),
  require('@assets/textures/book-texture-10.webp'),
  require('@assets/textures/book-texture-11.webp'),
  require('@assets/textures/book-texture-12.webp'),
  require('@assets/textures/book-texture-13.webp'),
];
const SPRING_CONFIG = { damping: 15, stiffness: 200 };
const EMPTY_GENRES: string[] = [];

// Layout proportions for text overlay
const TITLE_ZONE_RATIO = 0.75;
const BLUR_RADIUS = 250;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Split a title into one or two lines for spine display.
 *
 * Rules:
 * - 1-3 words: always one line
 * - 4+ words: split at the point that best balances character count between lines,
 *   but only if splitting actually improves balance (the shorter line must be at
 *   least 40% the length of the longer line, otherwise keep it as one line).
 */
function splitSpineTitle(title: string): [string] | [string, string] {
  const words = title.split(' ');
  if (words.length <= 3) return [title];

  // Find the split point that minimizes the difference in character count
  const totalLen = title.length;
  let bestSplit = 1;
  let bestDiff = Infinity;
  let runningLen = 0;

  for (let i = 0; i < words.length - 1; i++) {
    runningLen += (i > 0 ? 1 : 0) + words[i].length; // chars in line 1
    const line2Len = totalLen - runningLen - 1; // remaining chars (minus the space)
    const diff = Math.abs(runningLen - line2Len);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i + 1; // split after this word
    }
  }

  const line1 = words.slice(0, bestSplit).join(' ');
  const line2 = words.slice(bestSplit).join(' ');

  // Only split if it's reasonably balanced — shorter line must be ≥40% of longer
  const shorter = Math.min(line1.length, line2.length);
  const longer = Math.max(line1.length, line2.length);
  if (shorter / longer < 0.4) return [title];

  return [line1, line2];
}

function pickTexture(bookId: string): number {
  let h = 0;
  for (let i = 0; i < bookId.length; i++) {
    h = ((h << 5) - h + bookId.charCodeAt(i)) | 0;
  }
  return BOOK_TEXTURES[Math.abs(h) % BOOK_TEXTURES.length];
}

function buildCoverUrl(bookId: string): string | null {
  try {
    return apiClient.getItemCoverUrl(bookId);
  } catch {
    return null;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BookSpineVertical({
  book,
  width: propWidth,
  height: propHeight,
  leanAngle = 0,
  isActive = false,
  isPushedLeft = false,
  isPushedRight = false,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  showShadow = false,
  isHorizontalDisplay = false,
  style: styleProp,
}: BookSpineVerticalProps) {
  // --- Server spine support ---
  const useServerSpines = useSpineCacheStore((state) => state.useServerSpines);
  const setServerSpineDimensions = useSpineCacheStore((state) => state.setServerSpineDimensions);
  const booksWithServerSpines = useLibraryCache((state) => state.booksWithServerSpines);
  const bookHasServerSpine = booksWithServerSpines.has(book.id);
  const cachedDimEntry = useSpineCacheStore(
    (state) => state.serverSpineDimensions[book.id]
  );
  const cachedSpineDimensions = cachedDimEntry && (Date.now() - cachedDimEntry.cachedAt < 24 * 60 * 60 * 1000)
    ? { width: cachedDimEntry.width, height: cachedDimEntry.height }
    : undefined;
  const spineImageUrlRaw = useSpineUrl(book.id);
  const shouldTryServerSpine = useServerSpines && bookHasServerSpine;
  const spineImageUrl = shouldTryServerSpine ? spineImageUrlRaw : null;
  const [spineImageFailed, setSpineImageFailed] = useState(false);

  useEffect(() => {
    setSpineImageFailed(false);
  }, [spineImageUrl]);

  // --- Gold star stickers ---
  const bookStars = useStarPositionStore((s) => s.positions[book.id]);
  const hasStars = Array.isArray(bookStars) && bookStars.length > 0;

  // --- Accent color ---
  const cachedAccentColor = useSpineCacheStore((state) => state.accentColors[book.id]);
  const _colorVersion = useSpineCacheStore((state) => state.colorVersion);
  const genres = useMemo(() => book.genres || EMPTY_GENRES, [book.genres]);
  const accentColor = cachedAccentColor || getGenreFallbackColor(genres, book.id);

  // --- Dimensions ---
  const duration = book.duration || DEFAULT_DURATION;

  const dimensions = useMemo(() => {
    const hasGenreData = genres.length > 0 || (book.tags && book.tags.length > 0);
    if (hasGenreData) {
      const calculated = calculateBookDimensions({
        id: book.id,
        genres,
        tags: book.tags,
        duration,
        seriesName: book.seriesName,
      });
      if (propWidth && propHeight) {
        return { width: propWidth, height: propHeight, touchPadding: 0 };
      }
      const touchPadding = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - calculated.width) / 2));
      return { width: calculated.width, height: calculated.height, touchPadding };
    }
    if (propWidth && propHeight) {
      return { width: propWidth, height: propHeight, touchPadding: 0 };
    }
    return getSpineDimensions(book.id, genres, duration, book.seriesName);
  }, [book.id, genres, book.tags, duration, book.seriesName, propWidth, propHeight]);

  const isUsingServerSpine = spineImageUrl && !spineImageFailed;
  const canDisplayServerSpine = !!isUsingServerSpine;

  const { width, height } = useMemo(() => {
    if (canDisplayServerSpine && cachedSpineDimensions) {
      const { width: sw, height: sh } = cachedSpineDimensions;
      const maxW = propWidth || 100;
      const maxH = propHeight || 400;
      const sf = Math.min(maxW / sw, maxH / sh);
      return { width: Math.round(sw * sf), height: Math.round(sh * sf) };
    }
    if (propWidth && propHeight) return { width: propWidth, height: propHeight };
    return { width: dimensions.width, height: dimensions.height };
  }, [propWidth, propHeight, canDisplayServerSpine, cachedSpineDimensions?.width, cachedSpineDimensions?.height, dimensions.width, dimensions.height]);

  const touchPadding = dimensions.touchPadding ?? 0;

  // --- Cover URL ---
  const coverUrl = useMemo(() => buildCoverUrl(book.id), [book.id]);

  // --- Title formatting ---
  const titleLines = useMemo(() => splitSpineTitle(book.title), [book.title]);

  // --- Texture (deterministic per book) ---
  const bookTexture = useMemo(() => pickTexture(book.id), [book.id]);

  // --- Layout zones ---
  const pad = Math.max(4, Math.round(width * 0.1)); // consistent padding on all sides
  const titleH = Math.round(height * TITLE_ZONE_RATIO);

  // --- Progress ---
  const progress = book.progress ?? 0;
  const progressPercent = Math.round(progress * 100);
  const showProgress = progressPercent > 0;

  // --- Touch ---
  const hitSlop = useMemo(() => ({
    top: 0, bottom: 0, left: touchPadding, right: touchPadding,
  }), [touchPadding]);

  // --- Animations ---
  const pressProgress = useSharedValue(0);
  const hoverProgress = useSharedValue(0);
  const pushX = useSharedValue(0);

  useEffect(() => {
    hoverProgress.value = withSpring(isActive ? 1 : 0, SPRING_CONFIG);
  }, [isActive, hoverProgress]);

  useEffect(() => {
    if (isPushedLeft) pushX.value = withSpring(-6, SPRING_CONFIG);
    else if (isPushedRight) pushX.value = withSpring(6, SPRING_CONFIG);
    else pushX.value = withSpring(0, SPRING_CONFIG);
  }, [isPushedLeft, isPushedRight, pushX]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressProgress.value, [0, 1], [1, 0.95], Extrapolation.CLAMP);
    const lift = interpolate(hoverProgress.value, [0, 1], [0, -8], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: pushX.value },
        { translateY: lift },
        { scale },
        { rotate: `${leanAngle}deg` },
      ],
    };
  });

  const handlePress = useCallback(() => {
    haptics.impact('light');
    onPress?.(book);
  }, [onPress, book]);

  const handleLongPress = useCallback(() => {
    haptics.impact('medium');
    onLongPress?.(book);
  }, [onLongPress, book]);

  const handlePressIn = useCallback(() => {
    pressProgress.value = withSpring(1, SPRING_CONFIG);
    onPressIn?.();
  }, [pressProgress, onPressIn]);

  const handlePressOut = useCallback(() => {
    pressProgress.value = withSpring(0, SPRING_CONFIG);
    onPressOut?.();
  }, [pressProgress, onPressOut]);

  // --- Server spine image handlers ---
  const handleSpineImageLoad = useCallback((e: any) => {
    const { width: imgW, height: imgH } = e.source || {};
    if (imgW && imgH) {
      setServerSpineDimensions(book.id, imgW, imgH);
    }
  }, [book.id, setServerSpineDimensions]);

  const handleSpineImageError = useCallback(() => {
    setSpineImageFailed(true);
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <AnimatedPressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
      style={[
        {
          width,
          height,
          marginHorizontal: touchPadding,
        },
        showShadow && styles.shadow,
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.spineContainer,
          {
            width,
            height,
            borderRadius: CORNER_RADIUS,
            backgroundColor: '#1A1A1A',
          },
          styleProp,
        ]}
      >
        {/* === SERVER SPINE (when available) === */}
        {canDisplayServerSpine && (
          <Image
            source={{ uri: spineImageUrl! }}
            style={{ width, height, borderRadius: CORNER_RADIUS }}
            contentFit="fill"
            transition={150}
            cachePolicy="memory-disk"
            onLoad={handleSpineImageLoad}
            onError={handleSpineImageError}
          />
        )}

        {/* === PROCEDURAL SPINE === */}
        {!canDisplayServerSpine && (
          <>
            {/* Download indicator */}
            {book.isDownloaded && (
              <View style={[styles.downloadIndicator, {
                height: DOWNLOAD_INDICATOR_HEIGHT,
                backgroundColor: DOWNLOAD_INDICATOR_COLOR,
              }]} />
            )}

            {/* Blurred cover as full background */}
            {coverUrl ? (
              <Image
                source={{ uri: coverUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="center"
                blurRadius={BLUR_RADIUS}
                recyclingKey={`${book.id}-posterize`}
              />
            ) : null}

            {/* Accent color overlay */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: accentColor, opacity: 0.4 }]} />

            {/* Spacer pushes title+author to bottom */}
            <View style={{ flex: 1 }} />

            {/* Title — rotated 90° CCW, near bottom */}
            <View style={{
              height: titleH,
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
            }}>
              <View style={{
                width: titleH - pad * 3,
                height: width - pad * 4,
                transform: [{ rotate: isHorizontalDisplay ? '90deg' : '-90deg' }],
                justifyContent: 'center',
              }}>
                {titleLines.map((line, i) => (
                  <Text
                    key={i}
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '700',
                      fontSize: Math.max(8, (width - pad * 4) * 0.55),
                      textAlign: titleLines.length === 1 ? 'center' : 'left',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.3}
                  >
                    {line}
                  </Text>
                ))}
              </View>
            </View>

            {/* Author — centered, matching padding */}
            <View style={{
              paddingHorizontal: pad,
              paddingBottom: pad,
              paddingTop: pad,
            }}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontWeight: '400',
                  fontSize: Math.min(14, Math.max(7, width * 0.22)),
                  textAlign: 'center',
                }}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {book.author}
              </Text>
            </View>

            {/* Progress bar overlay at bottom */}
            {showProgress && (
              <View style={[styles.progressBar, { width }]}>
                <View style={{
                  height: 2,
                  width: `${Math.min(progressPercent, 100)}%` as any,
                  backgroundColor: progressPercent >= 100 ? '#4CAF50' : '#F3B60C',
                  borderRadius: 1,
                }} />
              </View>
            )}

            {/* Book cloth texture — multiply over everything */}
            <Image
              source={bookTexture}
              style={[StyleSheet.absoluteFill, { mixBlendMode: 'multiply', opacity: 0.7 } as any]}
              contentFit="fill"
              pointerEvents="none"
            />

            {/* Thin white spine-edge highlight on left */}
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 2, width: Math.max(4, width * 0.1) }}
              pointerEvents="none"
            />

            {/* Thin black shadow on right */}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, bottom: 0, right: 2, width: Math.max(4, width * 0.1) }}
              pointerEvents="none"
            />
          </>
        )}

        {/* Gold star sticker overlay */}
        {hasStars && (() => {
          const star = bookStars![0];
          const starSize = Math.min(Math.max(width * 0.6, 16), 32);
          const xOffset = ((star.x / 100) - 0.5) * width;
          const yPos = (star.y / 100) * height;
          return (
            <Image
              source={STAR_STICKER_IMAGE}
              style={{
                position: 'absolute',
                width: starSize,
                height: starSize,
                top: yPos - starSize / 2,
                left: (width - starSize) / 2 + xOffset,
                transform: [{ rotate: `${star.rotation}deg` }],
              }}
              contentFit="contain"
              pointerEvents="none"
            />
          );
        })()}
      </View>
    </AnimatedPressable>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  spineContainer: {
    overflow: 'hidden',
  },
  downloadIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
  },
});

export default React.memo(BookSpineVertical, (prevProps, nextProps) => {
  return (
    prevProps.book.id === nextProps.book.id &&
    prevProps.book.progress === nextProps.book.progress &&
    prevProps.book.isDownloaded === nextProps.book.isDownloaded &&
    prevProps.book.backgroundColor === nextProps.book.backgroundColor &&
    prevProps.book.textColor === nextProps.book.textColor &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.leanAngle === nextProps.leanAngle &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isPushedLeft === nextProps.isPushedLeft &&
    prevProps.isPushedRight === nextProps.isPushedRight &&
    prevProps.showShadow === nextProps.showShadow &&
    prevProps.isHorizontalDisplay === nextProps.isHorizontalDisplay
  );
});
