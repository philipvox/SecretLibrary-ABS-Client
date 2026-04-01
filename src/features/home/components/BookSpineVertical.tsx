/**
 * src/features/home/components/BookSpineVertical.tsx
 *
 * Vertical book spine with 12 generative composition layouts.
 * Genre-specific paper backgrounds, typography, and decorative elements.
 * Cloth textures overlaid for physical book feel.
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Pressable, View, ViewStyle } from 'react-native';
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
import { useSpineCacheStore } from '../stores/spineCache';
import { useStarPositionStore } from '@/shared/stores/starPositionStore';
import {
  getSpineDimensions,
  calculateBookDimensions,
  MIN_TOUCH_TARGET,
} from '../utils/spine/adapter';
import { getGenreVisualConfig } from '../utils/spine/genreVisualConfig';
import { COMPOSITIONS, pickComposition } from '../utils/spine/compositions';
import { hashString, hashToPick } from '../utils/spine/core/hashing';
import { secretLibraryColors } from '@/shared/theme/secretLibrary';
import { isLightColor } from '../services/colorExtractor';

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
  /** Force procedural rendering only — skip spine image overlays */
  proceduralOnly?: boolean;
  style?: ViewStyle;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DOWNLOAD_INDICATOR_COLOR = secretLibraryColors.orange;
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

// =============================================================================
// HELPERS
// =============================================================================

function pickTexture(bookId: string): number {
  let h = 0;
  for (let i = 0; i < bookId.length; i++) {
    h = ((h << 5) - h + bookId.charCodeAt(i)) | 0;
  }
  return BOOK_TEXTURES[Math.abs(h) % BOOK_TEXTURES.length];
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
  proceduralOnly = false,
  style: styleProp,
}: BookSpineVerticalProps) {
  // --- Spine image support (community + server, independent) ---
  const useServerSpines = useSpineCacheStore((state) => state.useServerSpines);
  const useCommunitySpines = useSpineCacheStore((state) => state.useCommunitySpines);
  const setServerSpineDimensions = useSpineCacheStore((state) => state.setServerSpineDimensions);
  // Derive per-book booleans — always call hooks, compute result after
  const hasServerSpineInManifest = useLibraryCache(
    useCallback((state) => state.booksWithServerSpines.has(book.id), [book.id])
  );
  const hasCommunitySpineInManifest = useLibraryCache(
    useCallback((state) => state.booksWithCommunitySpines.has(book.id), [book.id])
  );
  const bookHasServerSpine = useServerSpines && hasServerSpineInManifest;
  const bookHasCommunitySpine = useCommunitySpines && hasCommunitySpineInManifest;
  const cachedDimEntry = useSpineCacheStore(
    useCallback((state) => state.serverSpineDimensions[book.id], [book.id])
  );
  const cachedSpineDimensions = useMemo(() => {
    if (!cachedDimEntry || (Date.now() - cachedDimEntry.cachedAt >= 24 * 60 * 60 * 1000)) return undefined;
    return { width: cachedDimEntry.width, height: cachedDimEntry.height };
  }, [cachedDimEntry?.width, cachedDimEntry?.height, cachedDimEntry?.cachedAt]);
  const hasSpineOverride = useSpineCacheStore(
    useCallback((state) => !!state.spineOverrides[book.id], [book.id])
  );
  const spineImageUrlRaw = useSpineUrl(book.id);
  // Try spine image if either source has it, or if user explicitly picked one
  // proceduralOnly skips all spine images (used in spine picker preview)
  const shouldTrySpineImage = !proceduralOnly && (bookHasCommunitySpine || bookHasServerSpine || hasSpineOverride);
  const spineImageUrl = shouldTrySpineImage ? spineImageUrlRaw : null;
  const [spineImageFailed, setSpineImageFailed] = useState(false);


  useEffect(() => {
    setSpineImageFailed(false);
  }, [spineImageUrl]);

  // --- Gold star stickers ---
  const bookStars = useStarPositionStore((s) => s.positions[book.id]);
  const hasStars = Array.isArray(bookStars) && bookStars.length > 0;

  // --- Cover accent color (extracted from cover art) ---
  const accentColor = useSpineCacheStore(
    useCallback((state) => state.accentColors[book.id], [book.id])
  );
  // Subscribe to colorVersion so spines re-render when background extraction completes
  const _colorVersion = useSpineCacheStore((state) => state.colorVersion);

  // --- Genre visual config ---
  const genres = useMemo(() => book.genres || EMPTY_GENRES, [book.genres]);
  const visualConfig = useMemo(() => getGenreVisualConfig(genres), [genres]);
  const genreBgColor = useMemo(() => hashToPick(book.id + '-bg', visualConfig.backgrounds), [book.id, visualConfig]);
  const bgColor = accentColor || genreBgColor;
  const isDark = useMemo(() => accentColor ? !isLightColor(accentColor) : visualConfig.isDark, [accentColor, visualConfig.isDark]);
  const titleFont = useMemo(() => hashToPick(book.id + '-tf', visualConfig.titleFonts), [book.id, visualConfig]);
  const authorFont = useMemo(() => hashToPick(book.id + '-af', visualConfig.authorFonts), [book.id, visualConfig]);
  const compositionIndex = useMemo(() => pickComposition(book.id, book.title), [book.id, book.title]);

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

  // --- Texture (deterministic per book) ---
  const bookTexture = useMemo(() => pickTexture(book.id), [book.id]);

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
      accessibilityLabel={`Open ${book.title} by ${book.author}`}
      accessibilityRole="button"
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
            backgroundColor: bgColor,
          },
          styleProp,
        ]}
      >
        {/* === PROCEDURAL SPINE (always rendered as immediate fallback) === */}
        <>
          {/* Download indicator */}
          {book.isDownloaded && (
            <View style={[styles.downloadIndicator, {
              height: DOWNLOAD_INDICATOR_HEIGHT,
              backgroundColor: DOWNLOAD_INDICATOR_COLOR,
            }]} />
          )}

          {/* Solid paper background */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} />

          {/* Top shadow */}
          <LinearGradient
            colors={[`rgba(0,0,0,${isDark ? 0.25 : 0.04})`, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5 }}
            pointerEvents="none"
          />

          {/* Composition content (title + author + decorations) */}
          <View style={[StyleSheet.absoluteFill, isHorizontalDisplay && { transform: [{ rotate: '180deg' }] }]} pointerEvents="none">
            {COMPOSITIONS[compositionIndex]({
              w: width,
              h: height,
              title: book.title,
              author: book.author,
              titleFont,
              authorFont,
              isDark,
              hash: hashString(book.id),
              isHorizontalDisplay,
            })}
          </View>

          {/* Progress bar overlay at bottom */}
          {showProgress && (
            <View style={[styles.progressBar, { width }]}>
              <View style={{
                height: 2,
                width: `${Math.min(progressPercent, 100)}%` as ViewStyle['width'],
                backgroundColor: progressPercent >= 100 ? '#4CAF50' : '#E8A000',
                borderRadius: 1,
              }} />
            </View>
          )}

          {/* Book cloth texture — multiply over everything */}
          <Image
            source={bookTexture}
            style={[StyleSheet.absoluteFill, { mixBlendMode: 'multiply', opacity: 0.07 } as any]}
            contentFit="fill"
            cachePolicy="memory-disk"
            pointerEvents="none"
          />

          {/* Thin white spine-edge highlight on left */}
          <LinearGradient
            colors={[`rgba(255,255,255,${isDark ? 0.05 : 0.28})`, 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '15%' as ViewStyle['width'] }}
            pointerEvents="none"
          />

          {/* Thin black shadow on right */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', `rgba(0,0,0,${isDark ? 0.22 : 0.07})`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '12%' as ViewStyle['width'] }}
            pointerEvents="none"
          />
        </>

        {/* === SERVER SPINE (layered on top of procedural) === */}
        {canDisplayServerSpine && (
          <Image
            source={{ uri: spineImageUrl! }}
            style={[StyleSheet.absoluteFill, { borderRadius: CORNER_RADIUS }]}
            contentFit="fill"
            cachePolicy="memory-disk"
            onLoad={handleSpineImageLoad}
            onError={handleSpineImageError}
          />
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
              cachePolicy="memory-disk"
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
    prevProps.book.title === nextProps.book.title &&
    prevProps.book.author === nextProps.book.author &&
    prevProps.book.progress === nextProps.book.progress &&
    prevProps.book.isDownloaded === nextProps.book.isDownloaded &&
    prevProps.book.genres === nextProps.book.genres &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.leanAngle === nextProps.leanAngle &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isPushedLeft === nextProps.isPushedLeft &&
    prevProps.isPushedRight === nextProps.isPushedRight &&
    prevProps.showShadow === nextProps.showShadow &&
    prevProps.isHorizontalDisplay === nextProps.isHorizontalDisplay &&
    prevProps.proceduralOnly === nextProps.proceduralOnly
  );
});
