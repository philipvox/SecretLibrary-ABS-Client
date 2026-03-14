/**
 * src/features/home/components/BookSpineVertical.tsx
 *
 * Vertical book spine component for the Secret Library bookshelf view.
 * Books stand upright with title reading bottom-to-top.
 *
 * Features:
 * - SVG-based rendering for crisp text at any size
 * - Dynamic text sizing that FILLS the container
 * - Genre-based typography selection
 * - Duration-based thickness
 * - Series consistency (same style, height, icon)
 * - Random layout variations (tilt, slight height offset)
 * - Progress percentage at bottom
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Pressable, View, Text } from 'react-native';
import { Image } from 'expo-image';
// SVG removed - using pure React Native for custom font support
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSecretLibraryColors } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { useSpineUrl, useLibraryCache } from '@/core/cache';
import { useSpineCacheStore } from '../stores/spineCache';
import { useStarPositionStore } from '@/features/book-detail/stores/starPositionStore';
// MIGRATED: Core functions now using new system via adapter
import {
  getSeriesStyle,
  getTypographyForGenres,
  getSpineDimensions,
  calculateBookDimensions,
  MIN_TOUCH_TARGET,
  hashString,
} from '../utils/spine/adapter';
// TEMPLATE SYSTEM: Genre-specific spine templates with size-based configs
import {
  matchBookToTemplate,
  applyTemplateConfig,
  shouldUseTemplates,
  getTemplateInfo,
} from '../utils/spine/templateAdapter';

// TODO: Migrate these to new system
import {
  SpineTypography,
  getPlatformFont,
  getFontLineHeight,
  FONT_LINE_HEIGHTS,
} from '../utils/spineCalculations';

// =============================================================================
// TYPES
// =============================================================================

export interface BookSpineVerticalData {
  id: string;
  title: string;
  author: string;
  progress?: number;
  // Fields for dynamic styling (genre-based dimensions)
  genres?: string[];
  tags?: string[]; // For tag modifiers (cozy-fantasy, epic-fantasy, etc.)
  duration?: number; // in seconds
  seriesName?: string;
  seriesSequence?: number; // Book number in series (e.g., 1 for first book)
  lastPlayedAt?: string; // ISO date string
  isDownloaded?: boolean; // Show orange top border if downloaded
  // Colors (from cache or calculated)
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
  /** Show drop shadow (default: false - disabled for clean stroke design) */
  showShadow?: boolean;
  /**
   * Indicates the spine is being displayed horizontally (rotated 90°).
   * When true, skips two-row title and stacked author overrides since
   * the container is rotated and dimensions don't reflect actual display.
   */
  isHorizontalDisplay?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Colors imported from spineCalculations.ts (single source of truth)
const DEFAULT_SPINE_BG = '#F5F5F5'; // Light grey background for stroke design
const DEFAULT_TEXT_COLOR = '#000000'; // Black text on white background
const DOWNLOAD_INDICATOR_COLOR = '#FF6B35'; // Orange accent for downloaded books
const DOWNLOAD_INDICATOR_HEIGHT = 1;

// Spacing and margins - balanced for readability and fitting text
const INNER_MARGIN = 1; // Margin from section edge - prevents clipping on rotated text
const EDGE_PADDING = 0; // Padding from spine edge for text positioning
const TOP_PADDING = 8; // Padding from top of spine - room for ascenders
const BOTTOM_PADDING = 4; // Padding from bottom - tight
const SECTION_GAP = 2; // Gap between sections (author/title) - very tight for professional look
const ASCENDER_BUFFER = 3; // Extra space for font ascenders that extend above cap height

const CORNER_RADIUS = 5; // Slight rounded corners on spine edges

// Gold star sticker for rated books
const STAR_STICKER_IMAGE = require('@assets/stars/star5.webp');

// Cloth texture overlay for procedural spine backgrounds
const SPINE_TEXTURE_IMAGE = require('@assets/textures/spine-cloth.png');

const SPRING_CONFIG = { damping: 15, stiffness: 200 };
const EMPTY_GENRES: string[] = []; // Stable reference for books without genres

// Debug flag - set to true to show section boundaries
const DEBUG_SECTIONS = __DEV__ && false; // Toggle to see section bounds

// =============================================================================
// TEMPLATE-DIRECT RENDERING
// =============================================================================

/**
 * TemplateSpineRenderer - A clean, isolated component for template-driven spines.
 *
 * This mirrors SpineTemplatePreviewScreen's SpinePreview component EXACTLY.
 * It bypasses ALL the composition/solver complexity when templates are active.
 *
 * Key differences from the main BookSpineVertical rendering path:
 * - Uses heightPercent DIRECTLY for section allocation
 * - Applies fontSize DIRECTLY to Text components (no solver recalculation)
 * - Uses adjustsFontSizeToFit for overflow handling (shrinks but doesn't grow)
 * - Clean orientation handling via simple transforms
 */
import { getConfigForSize } from '../utils/spine/templateAdapter';
import type { AppliedTemplateConfig } from '../utils/spine/templateAdapter';

interface TemplateSpineProps {
  templateConfig: AppliedTemplateConfig;
  titleText: string;
  authorText: string;
  spineWidth: number;
  spineHeight: number;
  topOffset: number;
  spineTextColor: string;
  resolvedFontFamily: string; // Font family already resolved via getPlatformFont()
  debugSections?: boolean;
}

function TemplateSpineRenderer({
  templateConfig,
  titleText,
  authorText,
  spineWidth,
  spineHeight,
  topOffset,
  spineTextColor,
  resolvedFontFamily,
  debugSections = false,
}: TemplateSpineProps) {
  // Get adaptive configs (these already have the right values from templateAdapter)
  const adaptiveTitleConfig = templateConfig.title;
  const adaptiveAuthorConfig = templateConfig.author;

  // Apply text case transformations
  const processedTitle = (() => {
    let text = titleText;
    switch (adaptiveTitleConfig.case) {
      case 'uppercase': text = text.toUpperCase(); break;
      case 'lowercase': text = text.toLowerCase(); break;
      default: break;
    }

    // Apply words-per-line wrapping if specified
    if (adaptiveTitleConfig.wordsPerLine && adaptiveTitleConfig.orientation === 'horizontal') {
      const words = text.split(' ');
      const lines: string[] = [];
      for (let i = 0; i < words.length; i += adaptiveTitleConfig.wordsPerLine) {
        lines.push(words.slice(i, i + adaptiveTitleConfig.wordsPerLine).join(' '));
      }
      text = lines.join('\n');
    }

    return text;
  })();

  const processedAuthor = (() => {
    switch (adaptiveAuthorConfig.case) {
      case 'uppercase': return authorText.toUpperCase();
      case 'lowercase': return authorText.toLowerCase();
      default: return authorText;
    }
  })();

  // Calculate usable height (after top offset for download indicator)
  // No progress section inside spine - progress is shown externally below the book
  const usableHeight = spineHeight - topOffset;

  // Calculate section heights DIRECTLY from heightPercent (like SpinePreview)
  // This is the KEY difference - no fontSize-derived heights, no solver
  const titleHeight = (usableHeight * adaptiveTitleConfig.heightPercent) / 100;
  const authorHeight = (usableHeight * adaptiveAuthorConfig.heightPercent) / 100;

  // Calculate Y positions based on placement (like SpinePreview)
  let titleY: number;
  let authorY: number;

  if (adaptiveTitleConfig.placement === 'center') {
    // Center the content block (title + author) on the spine
    const contentHeight = titleHeight + authorHeight;
    const startY = topOffset + (usableHeight - contentHeight) / 2;

    if (adaptiveAuthorConfig.placement === 'top') {
      authorY = startY;
      titleY = authorY + authorHeight;
    } else {
      titleY = startY;
      authorY = titleY + titleHeight;
    }
  } else if (adaptiveTitleConfig.placement === 'top') {
    // Position at top
    if (adaptiveAuthorConfig.placement === 'top') {
      authorY = topOffset;
      titleY = authorY + authorHeight;
    } else {
      titleY = topOffset;
      authorY = titleY + titleHeight;
    }
  } else {
    // Position at bottom (default) - put title at bottom with author above
    if (adaptiveAuthorConfig.placement === 'top') {
      authorY = topOffset;
      titleY = authorY + authorHeight;
    } else {
      titleY = topOffset;
      authorY = titleY + titleHeight;
    }
  }

  // Use resolved font family (already processed via getPlatformFont)
  const fontFamily = resolvedFontFamily;

  // Render title section based on orientation
  const renderTitle = () => {
    const paddingH = adaptiveTitleConfig.paddingHorizontal ?? 3;
    const paddingV = adaptiveTitleConfig.paddingVertical ?? 0;

    if (adaptiveTitleConfig.orientation === 'stacked-letters') {
      // Stacked letters - each letter on its own line
      return (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: adaptiveTitleConfig.lineHeightScale
            ? -(adaptiveTitleConfig.fontSize * 0.7) * (1 - adaptiveTitleConfig.lineHeightScale)
            : adaptiveTitleConfig.fontSize * -0.2,
        }}>
          {processedTitle.replace(/\s+/g, '').split('').slice(0, adaptiveTitleConfig.maxLines ?? 20).map((letter, i) => (
            <Text
              key={i}
              style={{
                fontSize: adaptiveTitleConfig.fontSize * 0.7,
                fontWeight: adaptiveTitleConfig.weight,
                fontFamily,
                color: spineTextColor,
                includeFontPadding: false,
                textAlign: 'center',
              }}
            >
              {letter}
            </Text>
          ))}
        </View>
      );
    }

    if (adaptiveTitleConfig.orientation === 'stacked-words') {
      // Stacked words - each word on its own line, tightly packed
      const words = processedTitle.split(' ').slice(0, adaptiveTitleConfig.maxLines ?? 10);
      const wordFontSize = adaptiveTitleConfig.fontSize * 0.6;
      // Tight negative gap to pack words close together (like real book spines)
      const wordGap = adaptiveTitleConfig.lineHeightScale
        ? -(wordFontSize * (1 - adaptiveTitleConfig.lineHeightScale))
        : -(wordFontSize * 0.3); // 30% overlap for tight packing

      return (
        <View style={{
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {words.map((word, i) => (
            <Text
              key={i}
              style={{
                fontSize: wordFontSize,
                fontWeight: adaptiveTitleConfig.weight,
                fontFamily,
                color: spineTextColor,
                includeFontPadding: false,
                textAlign: 'center',
                marginTop: i === 0 ? 0 : wordGap, // Negative margin for tight packing
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {word}
            </Text>
          ))}
        </View>
      );
    }

    if (adaptiveTitleConfig.orientation === 'horizontal') {
      // Horizontal text (no rotation)
      return (
        <Text
          style={{
            fontSize: adaptiveTitleConfig.fontSize,
            fontWeight: adaptiveTitleConfig.weight,
            fontFamily,
            color: spineTextColor,
            textAlign: adaptiveTitleConfig.align === 'left' ? 'left' :
                      adaptiveTitleConfig.align === 'right' ? 'right' : 'center',
            includeFontPadding: false,
            ...(adaptiveTitleConfig.lineHeight
              ? { lineHeight: adaptiveTitleConfig.lineHeight }
              : adaptiveTitleConfig.lineHeightScale
              ? { lineHeight: adaptiveTitleConfig.fontSize * adaptiveTitleConfig.lineHeightScale }
              : {}),
          }}
          numberOfLines={adaptiveTitleConfig.maxLines ?? 2}
          adjustsFontSizeToFit
        >
          {processedTitle}
        </Text>
      );
    }

    if (adaptiveTitleConfig.orientation === 'vertical-two-row') {
      // Vertical text with two-line wrap
      const rotatedWidth = titleHeight - (paddingV * 2);
      const rotatedHeight = spineWidth - (paddingH * 2);

      const words = processedTitle.split(' ');
      const splitPercent = adaptiveTitleConfig.textSplitPercent ?? 50;
      const splitPoint = Math.ceil(words.length * (splitPercent / 100));
      const line1 = words.slice(0, splitPoint).join(' ');
      const line2 = words.slice(splitPoint).join(' ');
      const displayText = line2 ? `${line1}\n${line2}` : line1;

      return (
        <View
          style={{
            width: rotatedWidth,
            height: rotatedHeight,
            justifyContent: 'center',
            transform: [{ rotate: '-90deg' }],
          }}
        >
          <Text
            style={{
              fontSize: adaptiveTitleConfig.fontSize,
              fontWeight: adaptiveTitleConfig.weight,
              fontFamily,
              color: spineTextColor,
              textAlign: adaptiveTitleConfig.align === 'left' ? 'left' :
                        adaptiveTitleConfig.align === 'right' ? 'right' : 'center',
              includeFontPadding: false,
              ...(adaptiveTitleConfig.letterSpacing !== undefined ? { letterSpacing: adaptiveTitleConfig.letterSpacing } : {}),
              ...(adaptiveTitleConfig.lineHeight ? { lineHeight: adaptiveTitleConfig.lineHeight } : {}),
            }}
            numberOfLines={adaptiveTitleConfig.maxLines ?? 2}
            adjustsFontSizeToFit
          >
            {displayText}
          </Text>
        </View>
      );
    }

    // Default: vertical-up or vertical-down
    const rotatedWidth = titleHeight - (paddingV * 2);
    const rotatedHeight = spineWidth - (paddingH * 2);
    const rotation = adaptiveTitleConfig.orientation === 'vertical-down' ? '90deg' : '-90deg';

    return (
      <View
        style={{
          width: rotatedWidth,
          height: rotatedHeight,
          justifyContent: adaptiveTitleConfig.align === 'top' ? 'flex-start' :
                         adaptiveTitleConfig.align === 'bottom' ? 'flex-end' : 'center',
          transform: [{ rotate: rotation }],
        }}
      >
        <Text
          style={{
            fontSize: adaptiveTitleConfig.fontSize,
            fontWeight: adaptiveTitleConfig.weight,
            fontFamily,
            color: spineTextColor,
            textAlign: adaptiveTitleConfig.align === 'left' ? 'left' :
                      adaptiveTitleConfig.align === 'right' ? 'right' : 'center',
            includeFontPadding: false,
            // NOTE: lineHeight intentionally omitted for vertical orientations
            // React Native centers the line box (fontSize + padding), not visual text
            // This causes misalignment with rotated text; without lineHeight, text centers naturally
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {processedTitle}
        </Text>
      </View>
    );
  };

  // Render author section based on orientation
  const renderAuthor = () => {
    const paddingH = adaptiveAuthorConfig.paddingHorizontal ?? 3;
    const paddingV = adaptiveAuthorConfig.paddingVertical ?? 0;
    const displayAuthor = adaptiveAuthorConfig.treatment === 'prefixed' ? `by ${processedAuthor}` : processedAuthor;

    if (adaptiveAuthorConfig.orientation === 'stacked-letters') {
      // Stacked letters
      return (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: adaptiveAuthorConfig.lineHeightScale
            ? -(adaptiveAuthorConfig.fontSize * 0.8) * (1 - adaptiveAuthorConfig.lineHeightScale)
            : adaptiveAuthorConfig.fontSize * -0.15,
        }}>
          {processedAuthor.replace(/\s+/g, '').split('').map((letter, i) => (
            <Text
              key={i}
              style={{
                fontSize: adaptiveAuthorConfig.fontSize * 0.8,
                fontWeight: adaptiveAuthorConfig.weight,
                fontFamily,
                color: spineTextColor,
                includeFontPadding: false,
                letterSpacing: adaptiveAuthorConfig.letterSpacing ?? 0,
              }}
            >
              {letter}
            </Text>
          ))}
        </View>
      );
    }

    if (adaptiveAuthorConfig.orientation === 'stacked-words') {
      // Stacked words - always exactly 2 rows: first name / last name(s)
      const words = processedAuthor.split(' ');
      const stackedLines = words.length <= 2
        ? words // ["First", "Last"] or ["Single"]
        : [words[0], words.slice(1).join(' ')]; // ["First", "Middle Last"] → 2 rows

      return (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: adaptiveAuthorConfig.lineHeightScale
            ? -adaptiveAuthorConfig.fontSize * (1 - adaptiveAuthorConfig.lineHeightScale)
            : adaptiveAuthorConfig.fontSize * -0.1,
        }}>
          {stackedLines.map((line, i) => (
            <Text
              key={i}
              style={{
                fontSize: adaptiveAuthorConfig.fontSize,
                fontWeight: adaptiveAuthorConfig.weight,
                fontFamily,
                color: spineTextColor,
                includeFontPadding: false,
                letterSpacing: adaptiveAuthorConfig.letterSpacing ?? 0,
              }}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {line}
            </Text>
          ))}
        </View>
      );
    }

    if (adaptiveAuthorConfig.orientation === 'vertical-two-row') {
      // Vertical two-row
      const rotatedWidth = authorHeight - (paddingV * 2);
      const rotatedHeight = spineWidth - (paddingH * 2);

      const words = processedAuthor.split(' ');
      const splitPercent = adaptiveAuthorConfig.textSplitPercent ?? 50;
      const splitPoint = Math.ceil(words.length * (splitPercent / 100));
      const line1 = words.slice(0, splitPoint).join(' ');
      const line2 = words.slice(splitPoint).join(' ');
      const displayText = line2 ? `${line1}\n${line2}` : line1;

      return (
        <View
          style={{
            width: rotatedWidth,
            height: rotatedHeight,
            justifyContent: 'center',
            transform: [{ rotate: '-90deg' }],
          }}
        >
          <Text
            style={{
              fontSize: adaptiveAuthorConfig.fontSize,
              fontWeight: adaptiveAuthorConfig.weight,
              fontFamily,
              color: spineTextColor,
              textAlign: adaptiveAuthorConfig.align === 'left' ? 'left' :
                        adaptiveAuthorConfig.align === 'right' ? 'right' : 'center',
              includeFontPadding: false,
              ...(adaptiveAuthorConfig.letterSpacing !== undefined ? { letterSpacing: adaptiveAuthorConfig.letterSpacing } : {}),
              ...(adaptiveAuthorConfig.lineHeight ? { lineHeight: adaptiveAuthorConfig.lineHeight } : {}),
            }}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {displayText}
          </Text>
        </View>
      );
    }

    // Horizontal or vertical
    const isVertical = adaptiveAuthorConfig.orientation === 'vertical-up' ||
                      adaptiveAuthorConfig.orientation === 'vertical-down';

    if (isVertical) {
      const rotatedWidth = authorHeight - (paddingV * 2);
      const rotatedHeight = spineWidth - (paddingH * 2);
      const rotation = adaptiveAuthorConfig.orientation === 'vertical-down' ? '90deg' : '-90deg';

      return (
        <View
          style={{
            width: rotatedWidth,
            height: rotatedHeight,
            justifyContent: adaptiveAuthorConfig.align === 'top' ? 'flex-start' :
                           adaptiveAuthorConfig.align === 'bottom' ? 'flex-end' : 'center',
            transform: [{ rotate: rotation }],
          }}
        >
          <Text
            style={{
              fontSize: adaptiveAuthorConfig.fontSize,
              fontWeight: adaptiveAuthorConfig.weight,
              fontFamily,
              color: spineTextColor,
              textAlign: adaptiveAuthorConfig.align === 'left' ? 'left' :
                        adaptiveAuthorConfig.align === 'right' ? 'right' : 'center',
              includeFontPadding: false,
              // NOTE: lineHeight intentionally omitted for vertical orientations
              // React Native centers the line box (fontSize + padding), not visual text
              // This causes misalignment with rotated text; without lineHeight, text centers naturally
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {displayAuthor}
          </Text>
        </View>
      );
    }

    // Horizontal
    return (
      <View style={{ justifyContent: 'center', flex: 1 }}>
        <Text
          style={{
            fontSize: adaptiveAuthorConfig.fontSize,
            fontWeight: adaptiveAuthorConfig.weight,
            fontFamily,
            color: spineTextColor,
            textAlign: adaptiveAuthorConfig.align === 'left' ? 'left' :
                      adaptiveAuthorConfig.align === 'right' ? 'right' : 'center',
            includeFontPadding: false,
            ...(adaptiveAuthorConfig.lineHeight
              ? { lineHeight: adaptiveAuthorConfig.lineHeight }
              : adaptiveAuthorConfig.lineHeightScale
              ? { lineHeight: adaptiveAuthorConfig.fontSize * adaptiveAuthorConfig.lineHeightScale }
              : {}),
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {displayAuthor}
        </Text>
      </View>
    );
  };

  return (
    <>
      {/* Author section */}
      <View
        style={{
          position: 'absolute',
          top: authorY,
          left: 0,
          right: 0,
          height: authorHeight,
          backgroundColor: debugSections ? 'rgba(255, 0, 0, 0.3)' : 'transparent',
          paddingHorizontal: adaptiveAuthorConfig.paddingHorizontal ?? 3,
          paddingVertical: adaptiveAuthorConfig.paddingVertical ?? 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {renderAuthor()}
      </View>

      {/* Title section */}
      <View
        style={{
          position: 'absolute',
          top: titleY,
          left: 0,
          right: 0,
          height: titleHeight,
          backgroundColor: debugSections ? 'rgba(0, 0, 255, 0.3)' : 'transparent',
          paddingHorizontal: adaptiveTitleConfig.paddingHorizontal ?? 3,
          paddingVertical: adaptiveTitleConfig.paddingVertical ?? 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {renderTitle()}
      </View>

      {/* Decorative elements */}
      {templateConfig.decoration?.element === 'divider-line' && (
        <View
          style={{
            position: 'absolute',
            top: titleY + titleHeight,
            left: 6,
            right: 6,
            height: templateConfig.decoration.lineStyle === 'thick' ? 2 : 1,
            backgroundColor: spineTextColor,
          }}
        />
      )}
      {/* NOTE: Progress is shown BELOW the book externally, not inside the spine */}
    </>
  );
}

// Default dimensions when metadata not available
const DEFAULT_HEIGHT = 320;
const DEFAULT_WIDTH = 45; // Default for unknown duration (matches MEDIAN_WIDTH)
const DEFAULT_DURATION = 10 * 60 * 60; // 10 hours default (~45px width)

// Section percentages - must add to 100%
// Layout: TITLE (dominant) → AUTHOR (supporting) → PROGRESS (minimal)
const TITLE_PERCENT_BASE = 68;  // Title is primary - gets most space
const AUTHOR_PERCENT_BASE = 26; // Author is secondary - compact
const PROGRESS_PERCENT = 6;     // Progress percentage at bottom

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format time ago in compact format (max 3 chars, except months which can be 4)
 * Examples: 30s, 15m, 1h, 2d, 3w, 11mt, 2y
 */
function formatTimeAgoCompact(dateString: string | undefined): string | null {
  if (!dateString) return null;

  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return null; // Future date

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${Math.min(years, 99)}y`;
  if (months > 0) return `${Math.min(months, 11)}mt`;
  if (weeks > 0) return `${Math.min(weeks, 99)}w`;
  if (days > 0) return `${Math.min(days, 99)}d`;
  if (hours > 0) return `${Math.min(hours, 99)}h`;
  if (minutes > 0) return `${Math.min(minutes, 99)}m`;
  return `${Math.min(seconds, 99)}s`;
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
}: BookSpineVerticalProps) {
  // Theme-aware colors
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;

  // Server-side spine image support
  // Try to load pre-generated spine image from server, fall back to procedural rendering
  const useServerSpines = useSpineCacheStore((state) => state.useServerSpines);
  const setServerSpineDimensions = useSpineCacheStore((state) => state.setServerSpineDimensions);
  // Pre-flight check: manifest tells us which books have server spines (avoids 404s)
  const booksWithServerSpines = useLibraryCache((state) => state.booksWithServerSpines);
  const bookHasServerSpine = booksWithServerSpines.has(book.id);
  // Per-book dimension selector — only re-renders when THIS book's dimensions change
  // (not when any other book's dimensions change)
  const cachedDimEntry = useSpineCacheStore(
    (state) => state.serverSpineDimensions[book.id]
  );
  const cachedSpineDimensions = cachedDimEntry && (Date.now() - cachedDimEntry.cachedAt < 24 * 60 * 60 * 1000)
    ? { width: cachedDimEntry.width, height: cachedDimEntry.height }
    : undefined;
  const spineImageUrlRaw = useSpineUrl(book.id);
  const spinePlaceholderUrlRaw = useSpineUrl(book.id, { thumb: true });
  const shouldTryServerSpine = useServerSpines && bookHasServerSpine;
  const spineImageUrl = shouldTryServerSpine ? spineImageUrlRaw : null;
  const spinePlaceholderUrl = shouldTryServerSpine ? spinePlaceholderUrlRaw : null;
  const [spineImageFailed, setSpineImageFailed] = useState(false);

  // Reset failure state when URL changes
  useEffect(() => {
    setSpineImageFailed(false);
  }, [spineImageUrl]);

  // Gold star stickers
  const bookStars = useStarPositionStore((s) => s.positions[book.id]);
  const hasStars = Array.isArray(bookStars) && bookStars.length > 0;

  // Get genres and duration with fallbacks
  // Stabilize genres reference — avoid creating new empty array every render
  const genres = useMemo(() => book.genres || EMPTY_GENRES, [book.genres]);
  const duration = book.duration || DEFAULT_DURATION;

  // Determine if book is in a series
  const isInSeries = !!book.seriesName;
  const seriesStyle = isInSeries ? getSeriesStyle(book.seriesName!) : null;

  // Get typography: series books use series-consistent style, others use genre-based
  // This ensures all books in a series look visually unified
  const typography: SpineTypography = useMemo(() => {
    // Get genre-specific typography for styling hints
    const genreTypography = getTypographyForGenres(genres, book.id);

    // Series books: use series typography as base, but merge genre-specific styling
    // This keeps series consistent while applying genre "feel" (transforms, position, FONT)
    if (seriesStyle?.typography) {
      return {
        ...seriesStyle.typography,
        // Override with genre-specific settings for the "genre feel"
        fontFamily: genreTypography.fontFamily,  // Use genre's font for variety!
        titleTransform: genreTypography.titleTransform,
        authorTransform: genreTypography.authorTransform,
        authorPosition: genreTypography.authorPosition,
        authorOrientationBias: genreTypography.authorOrientationBias,
        contrast: genreTypography.contrast,
      };
    }
    // Non-series books: use genre-based typography directly
    return genreTypography;
  }, [seriesStyle?.typography, genres, book.id]);

  // DEBUG: Log typography values for each spine
  // SpineTypography debug logging removed (too noisy with large libraries)

  // Check if colored spines are enabled (currently disabled for stroke design)
  const useColoredSpines = useSpineCacheStore((state) => state.useColoredSpines);

  // Get spine colors - use book colors if provided, otherwise fall back to theme defaults
  // Dark mode: dark background with white text/stroke
  // Light mode: light grey background with black text/stroke
  const { spineBgColor, spineTextColor, spineStrokeColor } = useMemo(() => {
    return {
      spineBgColor: 'transparent',
      spineTextColor: '#FFFFFF',
      spineStrokeColor: 'rgba(255,255,255,0.3)',
    };
  }, []);

  // Calculate dimensions using genre-based system (includes touch padding for 44px minimum target)
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

      // If prop dimensions provided, use those
      if (propWidth && propHeight) {
        return { width: propWidth, height: propHeight, touchPadding: 0 };
      }

      // Calculate touch padding for 44px minimum
      const touchPadding = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - calculated.width) / 2));
      return {
        width: calculated.width,
        height: calculated.height,
        touchPadding,
      };
    }

    // No genre data - use prop dimensions or fallback
    if (propWidth && propHeight) {
      return { width: propWidth, height: propHeight, touchPadding: 0 };
    }

    // Fallback to simple calculation
    const simpleDims = getSpineDimensions(book.id, genres, duration, book.seriesName);
    return simpleDims;
  }, [book.id, book.title, genres, book.tags, duration, book.seriesName, propWidth, propHeight]);

  // Calculate dimensions based on spine source:
  // - Server spines: Use actual server dimensions, scaled proportionally to fit max height
  // - Procedural spines: Use calculated dimensions based on genre/duration
  const isUsingServerSpine = spineImageUrl && !spineImageFailed;

  // Render server spine when we have cached dimensions (for correct sizing)
  const shouldRenderServerSpine = isUsingServerSpine && cachedSpineDimensions;
  // Show server spine as soon as dimensions are ready — transition={150} prevents flash
  // (Previously waited for spineImageLoaded, causing an extra render cycle)
  const canDisplayServerSpine = !!shouldRenderServerSpine;

  // Show procedural spine as fallback while server spine loads (empty spine is worse than flash)
  // Once server spine is ready, it will overlay the procedural content
  const isWaitingForServerSpine = false; // Disabled: procedural fallback is better than empty spine

  // Calculate width and height together to maintain proper proportions
  // CRITICAL: Server spine dimensions ALWAYS take priority when available
  // This ensures correct aspect ratio even if parent passed stale dimensions
  const { width, height } = useMemo(() => {
    // Server spines: ALWAYS use server dimensions when available to preserve exact aspect ratio
    // This takes priority over props because props might have been calculated before server dims were cached
    if (canDisplayServerSpine && cachedSpineDimensions) {
      const { width: serverWidth, height: serverHeight } = cachedSpineDimensions;

      // Use props as max bounds if provided, otherwise use defaults
      const maxWidth = propWidth || 100;
      const maxHeight = propHeight || 400;

      // Calculate scale factors needed to fit within each bound
      const widthScale = maxWidth / serverWidth;
      const heightScale = maxHeight / serverHeight;

      // Use the smaller scale factor to ensure both dimensions fit
      // Apply same factor to BOTH dimensions to preserve aspect ratio exactly
      const scaleFactor = Math.min(widthScale, heightScale);

      return {
        width: Math.round(serverWidth * scaleFactor),
        height: Math.round(serverHeight * scaleFactor),
      };
    }

    // Props provided but no server dims yet - use props (procedural dimensions)
    if (propWidth && propHeight) {
      return { width: propWidth, height: propHeight };
    }

    // Fallback: Procedural spines (no props, no server dims)
    return {
      width: dimensions.width,
      height: dimensions.height,
    };
  }, [propWidth, propHeight, canDisplayServerSpine, cachedSpineDimensions?.width, cachedSpineDimensions?.height, dimensions.width, dimensions.height]);
  const touchPadding = dimensions.touchPadding ?? 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE SYSTEM INTEGRATION
  // Apply genre-specific templates with size-based configurations
  // Templates drive composition and override typography settings
  // ═══════════════════════════════════════════════════════════════════════════
  const useTemplateSystem = shouldUseTemplates(genres);
  const baseTemplateConfig = useMemo(() => {
    if (!useTemplateSystem) return null;
    // Pass book title for deterministic font selection from fontFamilies
    return applyTemplateConfig(genres, width, book.title);
  }, [useTemplateSystem, genres, width, book.title]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE OVERRIDES: Apply stacked authors and two-row titles
  // - Authors: stacked-words for all books under 30 hours with multi-word names
  // - Titles: vertical-two-row for titles with 4+ words (50% split)
  // NOTE: Only applies when spine is displayed vertically (not rotated horizontal)
  // ═══════════════════════════════════════════════════════════════════════════
  const templateConfig = useMemo(() => {
    if (!baseTemplateConfig) return null;

    const LONG_BOOK_THRESHOLD_SECONDS = 30 * 3600; // 30 hours in seconds
    const isLongBook = duration >= LONG_BOOK_THRESHOLD_SECONDS;
    const authorHasMultipleNames = book.author.split(' ').length >= 2;
    const titleWordCount = book.title.split(' ').length;

    // Only apply overrides when spine is displayed vertically (standing up)
    // isHorizontalDisplay prop is set when the spine container is rotated 90°
    // (e.g., in stack/horizontal view mode)
    const isVerticalSpine = !isHorizontalDisplay;
    const titleNeedsTwoRows = titleWordCount >= 4 && isVerticalSpine; // 4+ words AND vertical

    let modifiedConfig = baseTemplateConfig;
    let authorOverride = false;
    let titleOverride = false;

    // Apply stacked-words override for authors (all books under 30 hours, vertical spines only)
    if (!isLongBook && authorHasMultipleNames && isVerticalSpine) {
      authorOverride = true;
      modifiedConfig = {
        ...modifiedConfig,
        author: {
          ...modifiedConfig.author,
          orientation: 'stacked-words' as const,
        },
      };
    }

    // Apply two-row override for long titles (4+ words, 50% split, vertical spines only)
    // Reduce font size to ~45% to fit two lines in the narrow spine width
    if (titleNeedsTwoRows) {
      titleOverride = true;
      const twoRowFontSize = Math.round(modifiedConfig.title.fontSize * 0.45);
      modifiedConfig = {
        ...modifiedConfig,
        title: {
          ...modifiedConfig.title,
          orientation: 'vertical-two-row' as const,
          textSplitPercent: 50, // Split words 50/50 between rows
          fontSize: twoRowFontSize, // Reduce font size for two lines
          lineHeight: undefined, // Clear lineHeight to let it auto-calculate
        },
      };
    }

    return modifiedConfig;
  }, [baseTemplateConfig, duration, book.author, book.title, isHorizontalDisplay]);

  // Generate the generative composition for editorial-style layouts
  // When templates are active, composition is generated FROM template config
  const composition = useMemo(() => {
    if (!templateConfig) return null;

    // When displaying horizontally (rotated in stack view), force vertical-up orientation
    const titleOrientation = isHorizontalDisplay
      ? 'vertical-up'
      : templateConfig.title.orientation;

    return {
      title: {
        text: book.title,
        orientation: titleOrientation as any,
        case: templateConfig.title.case,
        weight: templateConfig.title.weight,
        scale: 'normal',
        letterSpacing: templateConfig.title.letterSpacing,
      },
      author: {
        text: book.author,
        orientation: templateConfig.author.orientation as any,
        case: templateConfig.author.case,
        weight: templateConfig.author.weight,
        treatment: templateConfig.author.treatment,
        scale: 'normal',
        splitNames: false,
      },
      layout: {
        density: 'balanced' as any,
        alignment: 'centered' as any,
        authorPosition: templateConfig.author.placement as 'top' | 'bottom',
      },
      decoration: templateConfig.decoration,
    };
  }, [book.title, book.author, templateConfig, isHorizontalDisplay]);

  // HitSlop for touch target compliance (44px minimum)
  const hitSlop = useMemo(() => ({
    top: 0,
    bottom: 0,
    left: touchPadding,
    right: touchPadding,
  }), [touchPadding]);

  // Animation values
  const pressProgress = useSharedValue(0);
  const hoverProgress = useSharedValue(0);
  const pushX = useSharedValue(0);

  // Update animation states
  useEffect(() => {
    if (isActive) {
      hoverProgress.value = withSpring(1, SPRING_CONFIG);
    } else {
      hoverProgress.value = withSpring(0, SPRING_CONFIG);
    }
  }, [isActive, hoverProgress]);

  useEffect(() => {
    if (isPushedLeft) {
      pushX.value = withSpring(-6, SPRING_CONFIG);
    } else if (isPushedRight) {
      pushX.value = withSpring(6, SPRING_CONFIG);
    } else {
      pushX.value = withSpring(0, SPRING_CONFIG);
    }
  }, [isPushedLeft, isPushedRight, pushX]);

  // Progress info for layout decisions
  const progress = book.progress ?? 0;
  const progressPercent = Math.round(progress * 100);
  const isFinished = progressPercent >= 100;
  const showProgress = progressPercent > 0;

  // Calculate section percentages based on what's shown
  // IMPORTANT: Apply scale multipliers to HEIGHT ALLOCATION before layout solver runs
  // This allows dramatic scaling to work (shout=2.5x gets more space, whisper=0.5x gets less)
  // CRITICAL FIX (v0.7.21): When templates active, calculate heights FROM fontSize, not from heightPercent
  const { authorPercent, titlePercent, progressSectionPercent } = useMemo(() => {
    const hasProgressSection = showProgress; // Series number no longer shown on spine

    // Template-driven heights: calculate FROM fontSize (FIXED - was using heightPercent directly)
    // The bug was: heightPercent was used as absolute allocation, which inverted small/large sizing
    // The fix: Use fontSize as primary, heightPercent as density hint
    if (templateConfig) {
      // Calculate minimum heights needed for fontSize + padding + line spacing
      const titleFontSize = templateConfig.title.fontSize;
      const authorFontSize = templateConfig.author.fontSize;

      // Estimate lines needed (assume 1-2 lines for title, 1-2 for author)
      const titleLineHeight = titleFontSize * (templateConfig.title.lineHeight ? templateConfig.title.lineHeight / titleFontSize : 1.3);
      const authorLineHeight = authorFontSize * (templateConfig.author.lineHeight ? templateConfig.author.lineHeight / authorFontSize : 1.3);

      // Min height = fontSize * lineHeight * maxLines + padding
      const titleMinHeight = titleLineHeight * 2 + (templateConfig.title.paddingVertical || 8) * 2;
      const authorMinHeight = authorLineHeight * 2 + (templateConfig.author.paddingVertical || 6) * 2;
      const progressMinHeight = hasProgressSection ? 30 : 0; // Fixed height for progress/series

      // Total minimum height needed
      const totalMinHeight = titleMinHeight + authorMinHeight + progressMinHeight;

      // If we have extra space, distribute it using heightPercent as WEIGHT
      const availableExtraSpace = Math.max(0, height - totalMinHeight - 40); // 40 for margins/gaps

      const titleWeight = templateConfig.title.heightPercent;
      const authorWeight = templateConfig.author.heightPercent;
      const totalWeight = titleWeight + authorWeight;

      const titleExtraSpace = (availableExtraSpace * titleWeight) / totalWeight;
      const authorExtraSpace = (availableExtraSpace * authorWeight) / totalWeight;

      const titleFinalHeight = titleMinHeight + titleExtraSpace;
      const authorFinalHeight = authorMinHeight + authorExtraSpace;
      const progressFinalHeight = progressMinHeight;

      const totalHeight = titleFinalHeight + authorFinalHeight + progressFinalHeight;

      return {
        titlePercent: (titleFinalHeight / totalHeight) * 100,
        authorPercent: (authorFinalHeight / totalHeight) * 100,
        progressSectionPercent: (progressFinalHeight / totalHeight) * 100,
      };
    }

    // Fallback for no template (shouldn't happen, but safe default)
    return {
      titlePercent: TITLE_PERCENT_BASE,
      authorPercent: AUTHOR_PERCENT_BASE,
      progressSectionPercent: showProgress ? PROGRESS_PERCENT : 0,
    };
  }, [showProgress, templateConfig, height]);

  // Calculate usable area (subtract gaps from total)
  const topOffset = (book.isDownloaded ? DOWNLOAD_INDICATOR_HEIGHT : 0) + TOP_PADDING;
  const numGaps = progressSectionPercent > 0 ? 2 : 1;  // Gaps between sections
  const totalGapHeight = SECTION_GAP * numGaps;

  // CRITICAL: When displaying horizontally (rotated 90°), swap width/height for layout calculations
  // because the spine's height becomes its visual width when lying flat
  const effectiveWidth = isHorizontalDisplay ? height : width;
  const effectiveHeight = isHorizontalDisplay ? width : height;

  // Subtract ascender buffer from usable height to prevent text clipping at top
  const usableHeight = effectiveHeight - topOffset - BOTTOM_PADDING - totalGapHeight - ASCENDER_BUFFER;

  // Calculate section heights from usable area (gaps already subtracted)
  const titleHeight = (usableHeight * titlePercent) / 100;
  const authorHeight = (usableHeight * authorPercent) / 100;
  const progressHeight = progressSectionPercent > 0 ? (usableHeight * progressSectionPercent) / 100 : 0;

  // Position sections based on author position
  // Priority: composition.layout.authorPosition > hasAuthorBox > typography.authorPosition
  const hasAuthorBox = typography.authorBox === 'horizontal-only' || typography.authorBox === 'always';
  const compositionSaysBottom = composition?.layout?.authorPosition === 'bottom';
  const compositionSaysTop = composition?.layout?.authorPosition === 'top';

  const authorFirst =
    compositionSaysTop ||
    (!compositionSaysBottom && hasAuthorBox) ||
    (!compositionSaysBottom && !compositionSaysTop && typography.authorPosition === 'top') ||
    (!compositionSaysBottom && !compositionSaysTop && typography.authorPosition === 'top-horizontal') ||
    (!compositionSaysBottom && !compositionSaysTop && typography.authorPosition === 'top-vertical-down');

  let authorY: number, titleY: number, progressY: number;
  if (authorFirst) {
    // AUTHOR → TITLE → PROGRESS (author at top)
    // Add ascender buffer for top section to prevent clipping
    authorY = topOffset + ASCENDER_BUFFER;
    titleY = authorY + authorHeight + SECTION_GAP;
    progressY = titleY + titleHeight + (progressHeight > 0 ? SECTION_GAP : 0);
  } else {
    // TITLE → AUTHOR → PROGRESS (title at top - default)
    // Add ascender buffer for top section to prevent clipping
    titleY = topOffset + ASCENDER_BUFFER;
    authorY = titleY + titleHeight + SECTION_GAP;
    progressY = authorY + authorHeight + (progressHeight > 0 ? SECTION_GAP : 0);
  }

  // Calculate centers for each section
  // Use effectiveWidth for X centering since dimensions may be swapped when horizontal
  const titleCenterX = effectiveWidth / 2;
  const titleCenterY = titleY + titleHeight / 2;
  const authorCenterX = effectiveWidth / 2;
  const authorCenterY = authorY + authorHeight / 2;
  const progressCenterX = effectiveWidth / 2;
  const progressCenterY = progressY + progressHeight / 2;

  // Text content with case transforms from template
  const titleContent = useMemo(() => {
    const textCase = composition?.title.case || (typography.titleTransform === 'uppercase' ? 'uppercase' : 'mixed');
    const text = composition?.title.text || book.title;
    if (textCase === 'uppercase') return text.toUpperCase();
    if (textCase === 'lowercase') return text.toLowerCase();
    return text;
  }, [composition, typography.titleTransform, book.title]);

  const authorContent = useMemo(() => {
    const text = composition?.author.text || book.author;
    const textCase = composition?.author.case || (typography.authorTransform === 'uppercase' ? 'uppercase' : 'mixed');
    if (textCase === 'uppercase') return text.toUpperCase();
    if (textCase === 'lowercase') return text.toLowerCase();
    return text;
  }, [composition, typography.authorTransform, book.author]);

  // Available width after edge padding (uses effectiveWidth calculated earlier)
  const availableWidth = effectiveWidth - (EDGE_PADDING * 2);

  // Aspect ratio for layout decisions (uses effective dimensions)
  const aspectRatio = useMemo(() => effectiveHeight / effectiveWidth, [effectiveHeight, effectiveWidth]);

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED TITLE LAYOUT - Uses constraint satisfaction solver
  // Tries: 1-line, 2-line, 3-line × horizontal/vertical
  // Picks highest-scoring solution that meets constraints
  // Letter spacing is passed to solver for accurate width calculation
  // ═══════════════════════════════════════════════════════════════════════════
  const titleLetterSpacing = typography.titleLetterSpacing ?? typography.letterSpacing ?? 0;

  const titleLayout = useMemo(() => {
    if (!templateConfig) {
      return {
        lines: [{ text: titleContent, fontSize: 14, x: 0, y: titleHeight / 2 }],
        orientation: 'vertical-up',
        rotation: -90,
        satisfiesHard: true,
        score: 100,
      };
    }

    const targetFontSize = templateConfig.title.fontSize;
    const templateOrientation = templateConfig.title.orientation;

    return {
      lines: [{
        text: titleContent,
        fontSize: targetFontSize,
        x: 0,
        y: titleHeight / 2,
      }],
      orientation: templateOrientation,
      rotation: templateOrientation === 'vertical-up' ? -90 :
                templateOrientation === 'vertical-down' ? 90 : 0,
      satisfiesHard: true,
      score: 100,
    };
  }, [titleContent, titleHeight, templateConfig]);

  const authorLetterSpacing = typography.authorLetterSpacing ?? (typography.letterSpacing ?? 0) * 0.5;

  const authorLayout = useMemo(() => {
    if (!templateConfig) {
      return {
        lines: [{ text: authorContent, fontSize: 10, x: 0, y: authorHeight / 2 }],
        orientation: 'horizontal',
        rotation: 0,
        satisfiesHard: true,
        score: 100,
      };
    }

    const targetFontSize = templateConfig.author.fontSize;
    const templateOrientation = templateConfig.author.orientation;

    return {
      lines: [{
        text: authorContent,
        fontSize: targetFontSize,
        x: 0,
        y: authorHeight / 2,
      }],
      orientation: templateOrientation,
      rotation: templateOrientation === 'vertical-up' ? -90 :
                templateOrientation === 'vertical-down' ? 90 : 0,
      satisfiesHard: true,
      score: 100,
    };
  }, [authorContent, authorHeight, templateConfig]);



  // Handlers
  const handlePressIn = useCallback(() => {
    pressProgress.value = withSpring(1, SPRING_CONFIG);
    haptics.selection();
    onPressIn?.();
  }, [onPressIn, pressProgress]);

  const handlePressOut = useCallback(() => {
    pressProgress.value = withSpring(0, SPRING_CONFIG);
    onPressOut?.();
  }, [onPressOut, pressProgress]);

  const handlePress = useCallback(() => {
    haptics.buttonPress();
    onPress?.(book);
  }, [book, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(book);
  }, [book, onLongPress]);

  // Animated styles - selective lean for some books
  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      hoverProgress.value,
      [0, 1],
      [0, -12],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      pressProgress.value,
      [0, 1],
      [1, 0.98],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: pushX.value },
        { translateY },
        { rotate: `${leanAngle}deg` },
        { scale },
      ],
      zIndex: isActive ? 10 : 0,
    };
  }, [isActive, leanAngle]);

  // Progress font size - fits visual width with padding, slightly larger
  const progressFontSize = Math.min(effectiveWidth * 0.45, 20);

  // Checkmark size for finished books
  const checkmarkSize = Math.min(effectiveWidth * 0.5, 16);

  // Series icon index (used for series consistency even though not displayed on spine)
  const iconIndex = seriesStyle?.iconIndex ?? 0;

  // Last played time (compact format) - larger font for visibility
  const lastPlayedText = formatTimeAgoCompact(book.lastPlayedAt);
  const lastPlayedFontSize = Math.min(effectiveWidth * 0.32, 12);

  // Top label parts for justified layout: time on left, progress on right
  const topLabelLeft = lastPlayedText || null;
  // Hide percentage for books under 1 hour (too small to show meaningfully)
  const isShortBook = (book.duration || 0) < 3600;
  const topLabelRight = useMemo(() => {
    if (isFinished) return '✓';
    if (showProgress && !isShortBook) return `${progressPercent}%`;
    return null;
  }, [isFinished, showProgress, progressPercent, isShortBook]);
  const hasTopLabel = topLabelLeft || topLabelRight;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER - Pure React Native (no SVG) for custom font support
  // ═══════════════════════════════════════════════════════════════════════════

  // Get resolved font family for RN Text
  // Prefer template font family over typography-based font
  const fontFamily = templateConfig?.title.fontFamily || typography.fontFamily;
  const resolvedFontFamily = getPlatformFont(fontFamily);

  // Font-specific line heights for tight display typography
  const fontLineHeights = FONT_LINE_HEIGHTS[resolvedFontFamily] || FONT_LINE_HEIGHTS['default'];
  const titleLineHeightMultiplier = typography.titleLineHeight ?? fontLineHeights.title;
  const authorLineHeightMultiplier = typography.authorLineHeight ?? fontLineHeights.author;
  const tightLineHeightMultiplier = fontLineHeights.tight;

  // Title font weight
  const titleFontWeight = typography.titleWeight || typography.fontWeight || '600';

  // Author font weight
  const authorFontWeight = typography.authorWeight || typography.fontWeight || '400';

  return (
    <AnimatedPressable
      style={[showShadow && styles.shadow, animatedStyle]}
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={400}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
    >
      {/* Justified label above spine: time on left, progress on right */}
      {/* Adjust top position for tilted books to avoid overlap */}
      {hasTopLabel && (
        <View style={[
          styles.lastPlayedContainer,
          styles.justifiedRow,
          { top: -18 - Math.abs(leanAngle) * 2.5, paddingHorizontal: 4 }
        ]}>
          <Text style={[styles.lastPlayedText, { fontSize: lastPlayedFontSize, color: colors.gray }]}>
            {topLabelLeft || ''}
          </Text>
          <Text style={[styles.lastPlayedText, { fontSize: lastPlayedFontSize, color: colors.gray }]}>
            {topLabelRight || ''}
          </Text>
        </View>
      )}


      {/* Main spine container */}
      <View
        style={[
          styles.spineContainer,
          {
            width,
            height,
            backgroundColor: canDisplayServerSpine ? 'transparent' : spineBgColor,
            borderColor: canDisplayServerSpine ? 'transparent' : spineStrokeColor,
            borderWidth: canDisplayServerSpine ? 0 : 1,
            borderRadius: CORNER_RADIUS,
          },
        ]}
      >
        {/* ═══════════════════════════════════════════════════════════════════════
            SERVER-SIDE SPINE IMAGE RENDERING PATH
            When a pre-generated spine image is available from the server, use it.
            Falls back to procedural rendering if image fails to load.

            FIX: Pre-load the full image in a hidden element BEFORE showing it.
            Only render the visible Image after pre-loading is complete.
            This completely eliminates the black flash during loading.
            ═══════════════════════════════════════════════════════════════════════ */}
        {/* Hidden image for FIRST LOAD ONLY — captures dimensions when not yet cached */}
        {spineImageUrl && !spineImageFailed && !cachedSpineDimensions && (
          <Image
            key={`prefetch-${spineImageUrl}`}
            source={{ uri: spineImageUrl }}
            style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
            cachePolicy="memory-disk"
            onLoad={(e) => {
              const srcWidth = e.source?.width;
              const srcHeight = e.source?.height;
              if (srcWidth && srcHeight) {
                setServerSpineDimensions(book.id, srcWidth, srcHeight);
              }
            }}
            onError={() => setSpineImageFailed(true)}
          />
        )}
        {/* Server spine image — renders when dimensions are cached.
            transition={150} handles the visual fade-in (no black flash). */}
        {shouldRenderServerSpine && (
          <Image
            key={spineImageUrl}
            source={{ uri: spineImageUrl }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius: CORNER_RADIUS,
            }}
            contentFit="fill"
            cachePolicy="memory-disk"
            transition={150}
            onLoad={(e) => {
              // Update dimensions on load (handles spine refresh with new dims)
              const srcWidth = e.source?.width;
              const srcHeight = e.source?.height;
              if (srcWidth && srcHeight) {
                setServerSpineDimensions(book.id, srcWidth, srcHeight);
              }
            }}
            onError={() => setSpineImageFailed(true)}
          />
        )}
        {/* Download indicator overlay - shown on top when server spine is displayed */}
        {canDisplayServerSpine && book.isDownloaded && (
          <View
            style={[
              styles.downloadIndicator,
              {
                height: DOWNLOAD_INDICATOR_HEIGHT,
                backgroundColor: DOWNLOAD_INDICATOR_COLOR,
                borderTopLeftRadius: CORNER_RADIUS,
                borderTopRightRadius: CORNER_RADIUS,
              },
            ]}
          />
        )}
        {/* Procedural content - shown only when:
            1. Server spine is NOT ready to display, AND
            2. We're NOT waiting for server spine to load (if user wants server spines)
            This prevents procedural spines from flashing before server spines load */}
        {!canDisplayServerSpine && !isWaitingForServerSpine && (
          <>
        {/* Download indicator - orange bar at top */}
        {book.isDownloaded && (
          <View
            style={[
              styles.downloadIndicator,
              {
                height: DOWNLOAD_INDICATOR_HEIGHT,
                backgroundColor: DOWNLOAD_INDICATOR_COLOR,
                borderTopLeftRadius: CORNER_RADIUS,
                borderTopRightRadius: CORNER_RADIUS,
              },
            ]}
          />
        )}

        {/* Template-driven rendering */}
        {templateConfig && (
          <TemplateSpineRenderer
            templateConfig={templateConfig}
            titleText={book.title}
            authorText={book.author}
            spineWidth={effectiveWidth}
            spineHeight={effectiveHeight}
            topOffset={topOffset}
            spineTextColor={spineTextColor}
            resolvedFontFamily={resolvedFontFamily}
            debugSections={DEBUG_SECTIONS}
          />
        )}
        {/* Gold star sticker overlay — uses first star's position/rotation from cover */}
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
          </>
        )}
      </View>

      {/* Progress is now shown at the top combined with last played time */}
    </AnimatedPressable>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  shadow: {
    // Shadow for depth (optional via showShadow prop)
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  spineContainer: {
    overflow: 'hidden',  // Keep this - clips at spine edges with rounded corners
  },
  downloadIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  titleSection: {
    // No overflow hidden - allow text to breathe within section
  },
  authorSection: {
    // No overflow hidden - prevents text clipping
  },
  progressSection: {
    // No overflow hidden - let content display fully
  },
  iconContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastPlayedContainer: {
    position: 'absolute',
    top: -18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  justifiedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastPlayedText: {
    fontWeight: '600',
  },
});

// PERF: Memoize to prevent re-renders when parent list re-renders
// Only re-render if book data, dimensions, or interactive state changes
export default React.memo(BookSpineVertical, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
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
