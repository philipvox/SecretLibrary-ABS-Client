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

import React, { useMemo, useCallback, useEffect } from 'react';
import { StyleSheet, Pressable, View, Text } from 'react-native';
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
import { useSpineCacheStore } from '../stores/spineCache';
// MIGRATED: Core functions now using new system via adapter
import {
  getSeriesStyle,
  getTypographyForGenres,
  getSpineDimensions,
  calculateBookDimensions,
  MIN_TOUCH_TARGET,
  generateSpineComposition,
  SpineComposition,
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
  resolveAuthorBox,
  AuthorBoxConfig,
  getPlatformFont,
  getFontLineHeight,
  FONT_LINE_HEIGHTS,
} from '../utils/spineCalculations';
import {
  solveTitleLayout,
  solveAuthorLayout,
  LayoutSolution,
} from '../utils/layoutSolver';

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
const SPRING_CONFIG = { damping: 15, stiffness: 200 };

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

  // Debug log
  if (__DEV__) {
    console.log(
      `[TEMPLATE RENDER] title: ${titleHeight.toFixed(0)}px @ ${adaptiveTitleConfig.fontSize}pt ` +
      `(${adaptiveTitleConfig.orientation}), author: ${authorHeight.toFixed(0)}px @ ${adaptiveAuthorConfig.fontSize}pt ` +
      `(${adaptiveAuthorConfig.orientation}), authorPlacement: ${adaptiveAuthorConfig.placement}`
    );
  }

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

// =============================================================================
// COMPOSITION RENDERING HELPERS
// =============================================================================

// NOTE: Font size scaling was removed - it caused clipping issues.
// The layout solver calculates optimal sizes; variation comes from weight, case, and spacing.

/**
 * Process author text based on composition treatment.
 */
function processAuthorText(author: string, treatment: string): string {
  switch (treatment) {
    case 'last-name-only': {
      const parts = author.split(' ');
      return parts[parts.length - 1] || author;
    }
    case 'initials': {
      const parts = author.split(' ');
      return parts.map(p => p[0]).join('.') + '.';
    }
    case 'first-initial-last': {
      const parts = author.split(' ');
      if (parts.length < 2) return author;
      return `${parts[0][0]}. ${parts[parts.length - 1]}`;
    }
    case 'abbreviated': {
      const parts = author.split(' ');
      if (parts.length < 2) return author;
      return `${parts[0][0]}. ${parts.slice(1).map(p => p[0]).join('.')}`;
    }
    case 'full':
    default:
      return author;
  }
}

/**
 * Get font weight value for composition weight.
 */
function getCompositionFontWeightValue(weight: string): string {
  switch (weight) {
    case 'light': return '300';
    case 'regular': return '400';
    case 'medium': return '500';
    case 'semibold': return '600';
    case 'bold': return '700';
    case 'black': return '900';
    default: return '500';
  }
}

/**
 * Apply case transformation to text.
 */
function applyTextCase(text: string, textCase: string): string {
  switch (textCase) {
    case 'uppercase': return text.toUpperCase();
    case 'lowercase': return text.toLowerCase();
    case 'title-case':
      return text.replace(/\w\S*/g, t =>
        t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()
      );
    case 'sentence-case':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case 'mixed':
    default:
      return text;
  }
}

// Decorative line rendering removed - using pure React Native

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
 * Get rotation jitter for author text based on book ID hash.
 * Creates subtle rotation variety (±5°) while keeping text readable.
 *
 * @param bookId - Book ID to hash for deterministic randomness
 * @param baseRotation - Base rotation angle (e.g., -90 for vertical-up)
 * @returns Modified rotation with subtle jitter
 */
function getRotationJitter(bookId: string, baseRotation: number): number {
  // Simple hash function for deterministic randomness
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    const char = bookId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Generate jitter range: -5 to +5 degrees
  const jitter = ((hash % 11) - 5); // Results in -5 to +5

  // For vertical text, add small jitter
  // Don't add jitter to horizontal (0°) - keep horizontal crisp
  if (Math.abs(baseRotation) > 45) {
    return baseRotation + jitter;
  }

  return baseRotation;
}

/**
 * Determine author rotation direction based on book hash.
 * 70% vertical-up (-90°), 30% vertical-down (+90°) for variety.
 *
 * @param bookId - Book ID for hash
 * @param defaultRotation - Default rotation from layout solver
 * @returns Rotation angle with direction variety
 */
function getAuthorRotationDirection(bookId: string, defaultRotation: number): number {
  // Only vary vertical rotations
  if (Math.abs(defaultRotation) < 45) {
    return defaultRotation; // Keep horizontal as-is
  }

  // Hash the book ID to determine direction
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = ((hash << 3) - hash) + bookId.charCodeAt(i);
  }

  // 30% chance to flip direction (makes the shelf more visually interesting)
  // Use different hash bits than jitter to avoid correlation
  const flipDirection = (Math.abs(hash >> 4) % 10) < 3;

  if (flipDirection && defaultRotation < 0) {
    return 90; // Flip from vertical-up to vertical-down
  } else if (flipDirection && defaultRotation > 0) {
    return -90; // Flip from vertical-down to vertical-up
  }

  return defaultRotation;
}

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
  onPressIn,
  onPressOut,
  showShadow = false,
  isHorizontalDisplay = false,
}: BookSpineVerticalProps) {
  // Theme-aware colors
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;

  // Get genres and duration with fallbacks
  const genres = book.genres || [];
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
  useEffect(() => {
    if (__DEV__) {
      console.log(`[SpineTypography] "${book.title?.substring(0, 25)}"`, {
        genres: genres?.slice(0, 2),
        authorPosition: typography.authorPosition,
        authorOrientationBias: typography.authorOrientationBias,
        titleTransform: typography.titleTransform,
        authorBox: typography.authorBox,
        fontFamily: typography.fontFamily,
        fromSeries: !!seriesStyle?.typography,
      });
    }
  }, [book.title, genres, typography, seriesStyle?.typography]);

  // Check if colored spines are enabled (currently disabled for stroke design)
  const useColoredSpines = useSpineCacheStore((state) => state.useColoredSpines);

  // Get spine colors - use book colors if provided, otherwise fall back to theme defaults
  // Dark mode: dark background with white text/stroke
  // Light mode: light grey background with black text/stroke
  const { spineBgColor, spineTextColor, spineStrokeColor } = useMemo(() => {
    // Use book-specific colors if provided (from cache enrichment)
    if (book.backgroundColor && book.textColor) {
      return {
        spineBgColor: book.backgroundColor,
        spineTextColor: book.textColor,
        spineStrokeColor: book.textColor,
      };
    }
    // Fall back to theme colors
    return {
      spineBgColor: colors.white,      // #F5F5F5 light, #1A1A1A dark
      spineTextColor: colors.black,        // #000000 light, #FFFFFF dark
      spineStrokeColor: colors.black,      // #000000 light, #FFFFFF dark
    };
  }, [book.backgroundColor, book.textColor, colors.white, colors.black]);

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
  }, [book.id, genres, book.tags, duration, book.seriesName, propWidth, propHeight]);

  const width = propWidth ?? dimensions.width;
  const height = propHeight ?? dimensions.height;
  const touchPadding = dimensions.touchPadding ?? 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE SYSTEM INTEGRATION
  // Apply genre-specific templates with size-based configurations
  // Templates drive composition and override typography settings
  // ═══════════════════════════════════════════════════════════════════════════
  const useTemplateSystem = shouldUseTemplates(genres);
  const baseTemplateConfig = useMemo(() => {
    if (!useTemplateSystem || genres.length === 0) return null;
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

    // DEBUG: Log overrides
    if (__DEV__) {
      console.log(
        `[Template Override] "${book.title?.substring(0, 20)}" → ` +
        `author=${authorOverride ? 'stacked' : 'no'}, ` +
        `title=${titleOverride ? 'two-row' : 'no'} (${titleWordCount} words, ${isVerticalSpine ? 'vertical' : 'horizontal'})`
      );
    }

    return modifiedConfig;
  }, [baseTemplateConfig, duration, book.author, book.title, isHorizontalDisplay]);

  // Log template usage for debugging
  useEffect(() => {
    if (__DEV__) {
      if (templateConfig) {
        console.log(
          `[Template] "${book.title?.substring(0, 25)}" → ${getTemplateInfo(genres, width)} ` +
          `(title: ${templateConfig.title.orientation} ${templateConfig.title.fontSize}pt, ` +
          `author: ${templateConfig.author.orientation} ${templateConfig.author.fontSize}pt, ` +
          `author placement: ${templateConfig.author.placement})`
        );
      } else {
        console.log(
          `[Template] "${book.title?.substring(0, 25)}" → NO MATCH (genres: ${genres.join(', ') || 'none'})`
        );
      }
    }
  }, [templateConfig, book.title, genres, width]);

  // Generate the generative composition for editorial-style layouts
  // When templates are active, composition is generated FROM template config
  const composition = useMemo(() => {
    if (genres.length === 0) return null;

    // Template system provides the base composition
    if (templateConfig) {
      // CRITICAL: When displaying horizontally (rotated in stack view), force vertical-up orientation
      // Stacked-words and two-row orientations don't work well when the spine is lying flat
      const titleOrientation = isHorizontalDisplay
        ? 'vertical-up'
        : templateConfig.title.orientation;

      return {
        title: {
          text: book.title,
          orientation: titleOrientation as any,
          case: templateConfig.title.case,
          weight: templateConfig.title.weight,
          scale: 'normal', // Templates control size via fontSize directly
          letterSpacing: templateConfig.title.letterSpacing,
        },
        author: {
          text: book.author,
          orientation: templateConfig.author.orientation as any,
          case: templateConfig.author.case,
          weight: templateConfig.author.weight,
          treatment: templateConfig.author.treatment,
          scale: 'normal', // Templates control size via fontSize directly
          splitNames: false, // Templates don't use split names (yet)
        },
        layout: {
          density: 'balanced' as any, // Templates handle density via heightPercent
          alignment: 'centered' as any,
          authorPosition: templateConfig.author.placement as 'top' | 'bottom', // Use template's author placement
        },
        decoration: templateConfig.decoration,
      };
    }

    // Fallback to generative composition system
    // Pass VISUAL width for smart layout constraints (horizontal only on wide spines)
    // When isHorizontalDisplay is true, the visual width is actually the height prop
    const visualWidth = isHorizontalDisplay ? height : width;
    const generatedComp = generateSpineComposition(
      book.id,
      book.title,
      book.author,
      genres,
      book.seriesName && book.seriesSequence
        ? { name: book.seriesName, number: book.seriesSequence }
        : undefined,
      visualWidth  // Pass visual width for smart orientation constraints
    );

    // Log generated composition for debugging
    if (__DEV__ && generatedComp) {
      console.log(
        `[Composition] "${book.title?.substring(0, 25)}" ` +
        `visualWidth: ${visualWidth}px (raw: ${width}x${height}, horiz: ${isHorizontalDisplay}), ` +
        `titleOrient: ${generatedComp.title?.orientation || 'unknown'}, ` +
        `authorOrient: ${generatedComp.author?.orientation || 'unknown'}, ` +
        `authorPos: ${generatedComp.layout?.authorPosition || 'unknown'}`
      );
    }

    return generatedComp;
  }, [book.id, book.title, book.author, genres, book.seriesName, book.seriesSequence, templateConfig, width, height, typography.authorOrientationBias, isHorizontalDisplay]);

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

  // Get composition scale values EARLY (before layout calculations)
  const compositionTitleScale = composition?.title.scale || 'normal';
  const compositionAuthorScale = composition?.author.scale || 'small';

  // Calculate scale multiplier from composition
  // More dramatic range for visual interest: 0.5x to 2.5x (5x difference!)
  const getScaleMultiplier = (scale: string): number => {
    switch (scale) {
      case 'whisper': return 0.5;   // Very subtle, minimal
      case 'tiny': return 0.65;      // Small but readable
      case 'small': return 0.8;      // Slightly reduced
      case 'normal': return 1.0;     // Baseline
      case 'balanced': return 1.2;   // Slightly emphasized
      case 'statement': return 1.5;  // Bold, prominent
      case 'shout': return 2.5;      // Maximum drama!
      default: return 1.0;
    }
  };
  const titleScaleMultiplier = getScaleMultiplier(compositionTitleScale);
  const authorScaleMultiplier = getScaleMultiplier(compositionAuthorScale);

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

      if (__DEV__) {
        console.log(
          `[HEIGHT CALC] "${book.title?.substring(0, 20)}" ` +
          `title: ${titleFontSize}pt → ${titleFinalHeight.toFixed(0)}px (${((titleFinalHeight/totalHeight)*100).toFixed(0)}%), ` +
          `author: ${authorFontSize}pt → ${authorFinalHeight.toFixed(0)}px (${((authorFinalHeight/totalHeight)*100).toFixed(0)}%)`
        );
      }

      return {
        titlePercent: (titleFinalHeight / totalHeight) * 100,
        authorPercent: (authorFinalHeight / totalHeight) * 100,
        progressSectionPercent: (progressFinalHeight / totalHeight) * 100,
      };
    }

    // Composition-driven heights: use scale multipliers
    const baseTitlePercent = hasProgressSection
      ? TITLE_PERCENT_BASE
      : TITLE_PERCENT_BASE + (PROGRESS_PERCENT / 2);
    const baseAuthorPercent = hasProgressSection
      ? AUTHOR_PERCENT_BASE
      : AUTHOR_PERCENT_BASE + (PROGRESS_PERCENT / 2);

    const titleWeight = baseTitlePercent * titleScaleMultiplier;
    const authorWeight = baseAuthorPercent * authorScaleMultiplier;
    const progressWeight = hasProgressSection ? PROGRESS_PERCENT : 0;

    // Normalize to 100% (redistribute space based on relative weights)
    const totalWeight = titleWeight + authorWeight + progressWeight;

    const result = {
      titlePercent: (titleWeight / totalWeight) * 100,
      authorPercent: (authorWeight / totalWeight) * 100,
      progressSectionPercent: (progressWeight / totalWeight) * 100,
    };

    if (__DEV__ && (titleScaleMultiplier !== 1.0 || authorScaleMultiplier !== 1.0)) {
      console.log(
        `[Scaling] "${book.title.substring(0, 20)}" ` +
        `title=${compositionTitleScale}(${titleScaleMultiplier}x) → ${result.titlePercent.toFixed(1)}%, ` +
        `author=${compositionAuthorScale}(${authorScaleMultiplier}x) → ${result.authorPercent.toFixed(1)}%`
      );
    }

    return result;
  }, [showProgress, titleScaleMultiplier, authorScaleMultiplier, compositionTitleScale, compositionAuthorScale, book.title, templateConfig]);

  // Calculate usable area (subtract gaps from total)
  const topOffset = (book.isDownloaded ? DOWNLOAD_INDICATOR_HEIGHT : 0) + TOP_PADDING;
  const numGaps = progressSectionPercent > 0 ? 2 : 1;  // Gaps between sections
  const totalGapHeight = SECTION_GAP * numGaps;

  // CRITICAL: When displaying horizontally (rotated 90°), swap width/height for layout calculations
  // because the spine's height becomes its visual width when lying flat
  const effectiveWidth = isHorizontalDisplay ? height : width;
  const effectiveHeight = isHorizontalDisplay ? width : height;

  // DEBUG: Log dimension swapping
  if (__DEV__) {
    console.log(
      `[DIMENSIONS] "${book.title?.substring(0, 25)}" ` +
      `raw: ${width}x${height}, ` +
      `effective: ${effectiveWidth}x${effectiveHeight}, ` +
      `isHorizontalDisplay: ${isHorizontalDisplay}, ` +
      `composition.title.orientation: ${composition?.title?.orientation || 'none'}`
    );
  }

  // Subtract ascender buffer from usable height to prevent text clipping at top
  const usableHeight = effectiveHeight - topOffset - BOTTOM_PADDING - totalGapHeight - ASCENDER_BUFFER;

  // Calculate section heights from usable area (gaps already subtracted)
  const titleHeight = (usableHeight * titlePercent) / 100;
  const authorHeight = (usableHeight * authorPercent) / 100;
  const progressHeight = progressSectionPercent > 0 ? (usableHeight * progressSectionPercent) / 100 : 0;

  // Position sections based on author position
  // Priority: composition.layout.authorPosition > hasAuthorBox > typography.authorPosition
  // CRITICAL SAFETY: NEVER put stacked authors at top (looks wrong - dominates the spine)
  const hasAuthorBox = typography.authorBox === 'horizontal-only' || typography.authorBox === 'always';
  const authorHasStackedOrientation =
    composition?.author?.orientation === 'stacked-words' ||
    composition?.author?.orientation === 'stacked-letters';

  // CRITICAL DEBUG: Log composition structure for these problematic books
  if (__DEV__ && (book.title.includes('Kings') || book.title.includes('Witches'))) {
    console.log(
      `[COMPOSITION DEBUG] "${book.title}" composition:`,
      JSON.stringify({
        exists: !!composition,
        authorOrientation: composition?.author?.orientation,
        layoutAuthorPos: composition?.layout?.authorPosition,
        hasAuthorBox,
        typographyAuthorPos: typography.authorPosition,
      }, null, 2)
    );
  }

  // Calculate authorFirst WITHOUT stacked check first
  // CRITICAL: Composition has HIGHEST priority - if it says 'bottom', don't override!
  const compositionSaysBottom = composition?.layout?.authorPosition === 'bottom';
  const compositionSaysTop = composition?.layout?.authorPosition === 'top';

  const authorFirstBeforeSafetyCheck =
    compositionSaysTop || // Composition says top - use it
    (!compositionSaysBottom && hasAuthorBox) || // Only use authorBox if composition doesn't explicitly say bottom
    (!compositionSaysBottom && !compositionSaysTop && typography.authorPosition === 'top') || // Typography is lowest priority
    (!compositionSaysBottom && !compositionSaysTop && typography.authorPosition === 'top-horizontal') ||
    (!compositionSaysBottom && !compositionSaysTop && typography.authorPosition === 'top-vertical-down');

  // SAFETY: Override authorFirst if author has stacked orientation
  // Stacked authors MUST stay at bottom (traditional spine hierarchy)
  const authorFirst = authorFirstBeforeSafetyCheck && !authorHasStackedOrientation;

  // Debug log to understand positioning decisions
  if (__DEV__) {
    console.log(
      `[POSITION] "${book.title?.substring(0, 20)}" ` +
      `authorFirst=${authorFirst} ` +
      `(beforeSafety=${authorFirstBeforeSafetyCheck}, hasStacked=${authorHasStackedOrientation}, ` +
      `authorOrient=${composition?.author?.orientation || 'none'})`
    );
  }

  if (__DEV__ && authorHasStackedOrientation && authorFirstBeforeSafetyCheck) {
    console.log(
      `[SAFETY] "${book.title?.substring(0, 25)}" has stacked author (${composition?.author?.orientation}) ` +
      `- forcing to BOTTOM despite authorPosition=${composition?.layout?.authorPosition || typography.authorPosition}`
    );
  }

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

  // Text content with transforms
  // When composition is available, use composition-driven transforms
  // Otherwise fall back to typography-based transforms
  const titleContent = useMemo(() => {
    if (composition) {
      return applyTextCase(composition.title.text, composition.title.case);
    }
    return typography.titleTransform === 'uppercase'
      ? book.title.toUpperCase()
      : book.title;
  }, [composition, typography.titleTransform, book.title]);

  const authorContent = useMemo(() => {
    if (composition) {
      // Apply treatment first (abbreviation, initials, etc.)
      const treatedAuthor = processAuthorText(composition.author.text, composition.author.treatment);
      // Then apply case transformation
      return applyTextCase(treatedAuthor, composition.author.case);
    }
    return typography.authorTransform === 'uppercase'
      ? book.author.toUpperCase()
      : book.author;
  }, [composition, typography.authorTransform, book.author]);

  // Get composition-driven styling overrides (weight only - don't scale font sizes!)
  const compositionTitleWeight = composition ? getCompositionFontWeightValue(composition.title.weight) : null;
  const compositionAuthorWeight = composition ? getCompositionFontWeightValue(composition.author.weight) : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPOSITION-DRIVEN RENDERING
  // When composition specifies special orientations, use them instead of solver
  // ═══════════════════════════════════════════════════════════════════════════
  // Safety check: Only use stacked-letters/words for appropriate title lengths
  // This prevents clipping if a long title somehow gets these orientations
  const titleLettersOnly = titleContent.replace(/\s+/g, '');
  const titleWords = titleContent.trim().split(/\s+/);
  const longestWord = titleWords.reduce((max, w) => Math.max(max, w.length), 0);

  // CRITICAL: Skip stacked orientations when displaying horizontally (rotated in stack view)
  // Stacked letters/words don't work well when the spine is lying flat
  const useStackedLetters = composition?.title.orientation === 'stacked-letters'
    && titleLettersOnly.length <= 8  // MAX 8 letters for stacking (like "WHY" or "DUNE")
    && !isHorizontalDisplay;  // Never stack when horizontal
  const useStackedWords = composition?.title.orientation === 'stacked-words'
    && titleWords.length >= 2
    && titleWords.length <= 4
    && longestWord <= 12  // Each word must fit horizontally
    && !isHorizontalDisplay;  // Never stack when horizontal
  const compositionTitleOrientation = composition?.title.orientation;
  const compositionAuthorOrientation = composition?.author.orientation;
  const compositionLineStyle = composition?.decoration.lineStyle || 'none';
  const compositionDecorElement = composition?.decoration.element || 'none';

  // Author split names: stack first/last name vertically for editorial look
  // DEFAULT: Enable for all medium/large spines (width > 60px, ~10+ hour audiobooks)
  // EXCEPTION: Respect explicit horizontal orientation from genre profile
  const baseSplitNames = composition?.author.splitNames || false;
  const isMediumOrLargeSpine = effectiveWidth > 60;
  const authorHasMultipleNames = book.author.split(' ').length >= 2;
  // Only disable stacking if genre explicitly requests horizontal author orientation
  const isExplicitlyHorizontal = typography.authorOrientationBias === 'horizontal';
  const authorSplitNames = baseSplitNames ||
    (isMediumOrLargeSpine && authorHasMultipleNames && !isExplicitlyHorizontal);

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

  const titleLayout: LayoutSolution = useMemo(() => {
    const titleBox = {
      width: availableWidth - (INNER_MARGIN * 2),
      height: titleHeight - (INNER_MARGIN * 2),
    };

    if (__DEV__) {
      console.log(
        `[TITLEBOX] "${book.title?.substring(0, 25)}" ` +
        `box: ${titleBox.width.toFixed(0)}x${titleBox.height.toFixed(0)}, ` +
        `available: ${availableWidth.toFixed(0)}, ` +
        `titleHeight: ${titleHeight.toFixed(0)}, ` +
        `effective: ${effectiveWidth}x${effectiveHeight}`
      );
    }

    // CRITICAL FIX (v0.7.21): When templates active, SKIP SOLVER and use template fontSize directly
    // The bug was: solver recalculated fontSize from section height, overriding template intent
    // The fix: Apply template fontSize directly (like SpineTemplatePreviewScreen does)
    if (templateConfig) {
      const targetFontSize = templateConfig.title.fontSize;
      const templateOrientation = templateConfig.title.orientation;

      if (__DEV__) {
        console.log(
          `[TEMPLATE DIRECT] "${book.title?.substring(0, 20)}" title: ` +
          `${targetFontSize}pt, orientation: ${templateOrientation}`
        );
      }

      // Create a simple layout that uses template fontSize AS-IS
      // IMPORTANT: Preserve exact orientation (vertical-up, vertical-down, etc.) for finalTitleOrientation logic
      // Text component's adjustsFontSizeToFit will handle overflow (shrinks but doesn't grow)
      return {
        lines: [{
          text: titleContent,
          fontSize: targetFontSize,
          x: 0,
          y: titleHeight / 2, // Center vertically in the section
        }],
        orientation: templateOrientation, // PRESERVE EXACT ORIENTATION (don't convert!)
        rotation: templateOrientation === 'vertical-up' ? -90 :
                  templateOrientation === 'vertical-down' ? 90 : 0,
        satisfiesHard: true,
        score: 100,
      };
    }

    // Composition-driven: use layout solver as before
    const scaledConstraints = {
      minFontSize: 10 * titleScaleMultiplier,
      maxFontSize: 48 * titleScaleMultiplier,
      maxOverflow: 0,
      preferredFontRange: [24 * titleScaleMultiplier, 48 * titleScaleMultiplier] as [number, number],
      preferredLineCount: [1, 2] as [number, number],
      minBalanceRatio: 0.4,
    };

    const result = solveTitleLayout(
      titleContent,
      titleBox,
      typography.fontFamily,
      aspectRatio,
      effectiveWidth,  // Use effective width for correct layout decisions when horizontal
      scaledConstraints,
      titleLetterSpacing // pass letter spacing for accurate width calculation
    );

    if (__DEV__ && result.lines.length > 0) {
      const maxFontSize = Math.max(...result.lines.map(l => l.fontSize));
      console.log(
        `[TitleRender] "${titleContent.substring(0, 20)}" ` +
        `scale=${compositionTitleScale}(${titleScaleMultiplier}x) ` +
        `→ fontSize=${maxFontSize.toFixed(1)}pt (max=${scaledConstraints.maxFontSize}pt)`
      );
    }

    return result;
  }, [titleContent, availableWidth, titleHeight, typography.fontFamily, aspectRatio, effectiveWidth, titleLetterSpacing, titleScaleMultiplier, templateConfig, compositionTitleScale]);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPOSITION ORIENTATION OVERRIDE
  // Use composition system's smart constraints if available
  // ═══════════════════════════════════════════════════════════════════════════
  const finalTitleOrientation = useMemo(() => {
    if (!composition) return titleLayout.orientation;

    const compositionOrientation = composition.title.orientation;

    // Map composition orientations to layout solver's 'vertical' or 'horizontal'
    let result: string;
    if (compositionOrientation === 'vertical-up' || compositionOrientation === 'vertical-down') {
      result = 'vertical';
    } else if (compositionOrientation === 'vertical-two-row') {
      result = 'vertical-two-row';
    } else if (compositionOrientation === 'stacked-letters' || compositionOrientation === 'stacked-words') {
      result = 'stacked';
    } else {
      result = 'horizontal';
    }

    if (__DEV__) {
      console.log(
        `[ORIENTATION] "${book.title?.substring(0, 25)}" ` +
        `composition: ${compositionOrientation}, final: ${result}, ` +
        `titleLayout.fontSize: ${titleLayout.lines?.[0]?.fontSize || 'none'}pt`
      );
    }

    return result;
  }, [composition, titleLayout.orientation, book.title, titleLayout.lines]);

  const finalTitleRotation = useMemo(() => {
    if (!composition) return '-90deg'; // Default vertical-up

    const compositionOrientation = composition.title.orientation;

    if (compositionOrientation === 'vertical-down') {
      return '90deg'; // Clockwise
    } else if (compositionOrientation === 'vertical-up') {
      return '-90deg'; // Counter-clockwise
    } else {
      return '0deg'; // Horizontal
    }
  }, [composition]);

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED AUTHOR LAYOUT - Uses constraint satisfaction solver
  // Tries: horizontal-single, horizontal-stacked, vertical-single, vertical-split
  // Picks highest-scoring solution that meets constraints
  // When typography prefers author boxes or has horizontal bias, prefer horizontal layouts
  // Letter spacing is passed to solver for accurate width calculation
  // ═══════════════════════════════════════════════════════════════════════════
  const authorLetterSpacing = typography.authorLetterSpacing ?? (typography.letterSpacing ?? 0) * 0.5;

  const preferHorizontalAuthor = useMemo(() => {
    // Explicit box preference overrides bias
    if (typography.authorBox === 'horizontal-only' || typography.authorBox === 'always') {
      return true;
    }
    // Use authorOrientationBias from typography
    if (typography.authorOrientationBias === 'horizontal') {
      return true;
    }
    // Vertical bias explicitly prefers vertical (no horizontal boost)
    if (typography.authorOrientationBias === 'vertical') {
      return false;
    }
    // Neutral or undefined - let solver decide naturally
    return false;
  }, [typography.authorBox, typography.authorOrientationBias]);

  const authorLayout: LayoutSolution = useMemo(() => {
    const authorBox = {
      width: availableWidth - (INNER_MARGIN * 2),
      height: authorHeight * 0.90,
    };

    // CRITICAL FIX (v0.7.21): When templates active, SKIP SOLVER and use template fontSize directly
    if (templateConfig) {
      const targetFontSize = templateConfig.author.fontSize;
      const templateOrientation = templateConfig.author.orientation;

      if (__DEV__) {
        console.log(
          `[TEMPLATE DIRECT] "${book.title?.substring(0, 20)}" author: ` +
          `${targetFontSize}pt, orientation: ${templateOrientation}`
        );
      }

      // Create a simple layout that uses template fontSize AS-IS
      // IMPORTANT: Preserve exact orientation for finalAuthorOrientation logic
      return {
        lines: [{
          text: authorContent,
          fontSize: targetFontSize,
          x: 0,
          y: authorHeight / 2, // Center vertically in the section
        }],
        orientation: templateOrientation, // PRESERVE EXACT ORIENTATION
        rotation: templateOrientation === 'vertical-up' ? -90 :
                  templateOrientation === 'vertical-down' ? 90 : 0,
        satisfiesHard: true,
        score: 100,
      };
    }

    // Composition-driven: use layout solver as before
    const scaledConstraints = {
      minFontSize: 10 * authorScaleMultiplier,
      maxFontSize: 24 * authorScaleMultiplier,
      maxOverflow: 0,
      preferredFontRange: [14 * authorScaleMultiplier, 20 * authorScaleMultiplier] as [number, number],
      preferredLineCount: [1, 2] as [number, number],
      minBalanceRatio: 0.4,
    };

    const result = solveAuthorLayout(
      authorContent,
      authorBox,
      typography.fontFamily,
      aspectRatio,
      effectiveWidth,  // Use effective width for correct layout decisions when horizontal
      scaledConstraints,
      preferHorizontalAuthor,
      authorLetterSpacing // pass letter spacing for accurate width calculation
    );

    if (__DEV__ && result.lines.length > 0) {
      const maxFontSize = Math.max(...result.lines.map(l => l.fontSize));
      console.log(
        `[AuthorRender] "${authorContent.substring(0, 20)}" ` +
        `scale=${compositionAuthorScale}(${authorScaleMultiplier}x) ` +
        `→ fontSize=${maxFontSize.toFixed(1)}pt (max=${scaledConstraints.maxFontSize}pt)`
      );
    }

    return result;
  }, [authorContent, availableWidth, authorHeight, typography.fontFamily, aspectRatio, effectiveWidth, preferHorizontalAuthor, authorLetterSpacing, authorScaleMultiplier, compositionAuthorScale, templateConfig]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHOR BOX - Optional box around author name (horizontal layouts only)
  // Appears for commercial genres (thriller, crime, business, etc.)
  // ═══════════════════════════════════════════════════════════════════════════
  const authorBoxConfig: AuthorBoxConfig | null = useMemo(() => {
    return resolveAuthorBox(typography, authorLayout.orientation, book.tags);
  }, [typography, authorLayout.orientation, book.tags]);

  // Calculate box position based on layout bounds
  const authorBoxBounds = useMemo(() => {
    if (!authorBoxConfig || !authorLayout.bounds) {
      return null;
    }

    const bounds = authorLayout.bounds;
    const padding = authorBoxConfig.padding;

    // Translate bounds from layout coordinates to SVG coordinates
    // Layout coordinates (0,0) = top-left of the solver box
    // Solver box starts at x = EDGE_PADDING + INNER_MARGIN in SVG coords
    // Solver box starts at y = authorY + INNER_MARGIN in SVG coords
    const authorBoxOriginX = EDGE_PADDING + INNER_MARGIN;
    const authorBoxOriginY = authorY + INNER_MARGIN;

    return {
      x: authorBoxOriginX + bounds.x - padding.x,
      y: authorBoxOriginY + bounds.y - padding.y,
      width: bounds.width + padding.x * 2,
      height: bounds.height + padding.y * 2,
    };
  }, [authorBoxConfig, authorLayout.bounds, authorY]);

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
  const titleFontWeight = compositionTitleWeight || typography.titleWeight || typography.fontWeight || '600';

  // Author font weight
  const authorFontWeight = compositionAuthorWeight || typography.authorWeight || typography.fontWeight || '400';

  return (
    <AnimatedPressable
      style={[showShadow && styles.shadow, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
    >
      {/* Last played time above spine */}
      {lastPlayedText && (
        <View style={styles.lastPlayedContainer}>
          <Text style={[styles.lastPlayedText, { fontSize: lastPlayedFontSize, color: colors.gray }]}>
            {lastPlayedText}
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
            backgroundColor: spineBgColor,
            borderColor: spineStrokeColor,
            borderRadius: CORNER_RADIUS,
          },
        ]}
      >
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

        {/* ═══════════════════════════════════════════════════════════════════════
            TEMPLATE-DIRECT RENDERING PATH
            When templates are active, use the clean SpinePreview-style renderer.
            This bypasses all composition/solver complexity.
            ═══════════════════════════════════════════════════════════════════════ */}
        {templateConfig ? (
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
        ) : (
          /* ═══════════════════════════════════════════════════════════════════════
             COMPOSITION-BASED RENDERING PATH (fallback for non-template books)
             Uses layout solver for dynamic sizing
             ═══════════════════════════════════════════════════════════════════════ */
          <>
        {/* Decorative top line - positioned at BOTTOM of first section (faces inward toward center)
            Not at the very top edge of spine */}
        {(compositionDecorElement === 'top-line' || compositionDecorElement === 'partial-border') && (
          <View
            style={{
              position: 'absolute',
              // Position at bottom of first section (authorFirst ? author : title)
              top: authorFirst
                ? (authorY + authorHeight - 2)  // Bottom of author section
                : (titleY + titleHeight - 2),   // Bottom of title section
              left: EDGE_PADDING + 4,
              right: EDGE_PADDING + 4,
              height: compositionLineStyle === 'thick' ? 2 : 1,
              backgroundColor: spineTextColor,
            }}
          />
        )}

        {/* Title section */}
        <View
          style={[
            styles.titleSection,
            {
              position: 'absolute',
              left: EDGE_PADDING,
              top: titleY,
              width: availableWidth,
              height: titleHeight,
            },
          ]}
        >
          {useStackedLetters ? (
            // ═══════════════════════════════════════════════════════════════
            // STACKED LETTERS: W-H-Y style - each letter on its own line
            // Creates dramatic, poster-like typography
            // Only for titles ≤8 letters (safety checked above)
            // ═══════════════════════════════════════════════════════════════
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingVertical: 2,
              }}
            >
              {(() => {
                const letters = titleLettersOnly.split('');
                const letterCount = letters.length;
                // Calculate font size: fit all letters in height, and each letter in width
                // Use AGGRESSIVE sizing like publisher spines - fill nearly all available space
                const maxLetterHeight = (titleHeight - 6) / letterCount;
                const letterFontSize = Math.min(
                  availableWidth * 0.92,  // Use 92% of width for bold impact
                  maxLetterHeight * 0.96  // Use 96% of height per letter for dramatic stacking
                );

                // For stacked letters, lineHeight must be at least fontSize to prevent clipping
                // Use Math.max to ensure minimum of 1.0x multiplier
                const stackedLineHeight = letterFontSize * Math.max(1.0, tightLineHeightMultiplier);

                return letters.map((letter, i) => (
                  <Text
                    key={i}
                    style={{
                      fontFamily: resolvedFontFamily,
                      fontSize: letterFontSize,
                      fontWeight: titleFontWeight as any,
                      color: spineTextColor,
                      lineHeight: stackedLineHeight,
                      textAlign: 'center',
                      includeFontPadding: false,
                    }}
                  >
                    {letter}
                  </Text>
                ));
              })()}
            </View>
          ) : useStackedWords ? (
            // ═══════════════════════════════════════════════════════════════
            // STACKED WORDS: Each word on its own line, horizontal
            // Good for multi-word titles like "ERSTE LIEBE"
            // Only for 2-4 words with each word ≤12 chars (safety checked above)
            // ═══════════════════════════════════════════════════════════════
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingVertical: 2,
              }}
            >
              {(() => {
                const wordCount = titleWords.length;
                // Calculate font size: fit all words in height, each word in width
                const maxWordHeight = (titleHeight - 20) / wordCount;

                return titleWords.map((word, i) => {
                  // Size based on word length - longer words get smaller font
                  const wordFontSize = Math.min(
                    availableWidth * 0.85 / (word.length * 0.55),  // Fit width
                    maxWordHeight * 0.8  // Fit height
                  );

                  return (
                    <Text
                      key={i}
                      style={{
                        fontFamily: resolvedFontFamily,
                        fontSize: Math.max(8, wordFontSize),
                        fontWeight: titleFontWeight as any,
                        fontStyle: typography.fontStyle || 'normal',
                        color: spineTextColor,
                        textAlign: 'center',
                        lineHeight: Math.max(10, wordFontSize * tightLineHeightMultiplier),  // Font-specific tight stacking
                        includeFontPadding: false,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.4}
                    >
                      {word}
                    </Text>
                  );
                });
              })()}
            </View>
          ) : (finalTitleOrientation === 'vertical-two-row' ||
               // FALLBACK: Force two-row for 4+ word titles on vertical spines
               (book.title.split(' ').length >= 4 && !isHorizontalDisplay)) ? (
            // ═══════════════════════════════════════════════════════════════
            // VERTICAL TWO-ROW: Split title across two lines, rotated
            // For long titles (4+ words) that need more room
            // ═══════════════════════════════════════════════════════════════
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: titleHeight * 0.95,
                  transform: [{ rotate: '-90deg' }],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {(() => {
                  // Split title into two rows (50% of words each)
                  const words = titleContent.split(' ');
                  const splitPoint = Math.ceil(words.length / 2);
                  const line1 = words.slice(0, splitPoint).join(' ');
                  const line2 = words.slice(splitPoint).join(' ');
                  const lines = line2 ? [line1, line2] : [line1];

                  // Calculate font size to fit both lines
                  const baseFontSize = templateConfig?.title.fontSize || 24;
                  const twoRowFontSize = lines.length > 1 ? baseFontSize * 0.6 : baseFontSize;

                  return lines.map((lineText, i) => (
                    <Text
                      key={i}
                      style={{
                        fontFamily: resolvedFontFamily,
                        fontSize: twoRowFontSize,
                        fontWeight: titleFontWeight as any,
                        fontStyle: typography.fontStyle || 'normal',
                        color: spineTextColor,
                        textAlign: 'center',
                        lineHeight: twoRowFontSize * 1.1,
                        includeFontPadding: false,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.3}
                    >
                      {lineText}
                    </Text>
                  ));
                })()}
              </View>
            </View>
          ) : finalTitleOrientation === 'vertical' ? (
            // ═══════════════════════════════════════════════════════════════
            // VERTICAL TITLE: Traditional spine style, reads bottom-to-top
            // ═══════════════════════════════════════════════════════════════
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  // For horizontal display, use more space for title (full height minus padding)
                  // For vertical display, use the title section height
                  width: isHorizontalDisplay ? (height - 40) : (titleHeight * 0.95),
                  transform: [{ rotate: finalTitleRotation }],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {titleLayout.lines.map((line, i) => {
                  const letterSpacingEm = composition?.title.letterSpacing ?? typography.letterSpacing ?? 0;
                  const letterSpacingPx = letterSpacingEm * line.fontSize;

                  return (
                    <Text
                      key={i}
                      style={{
                        fontFamily: resolvedFontFamily,
                        fontSize: line.fontSize,
                        fontWeight: titleFontWeight as any,
                        fontStyle: typography.fontStyle || 'normal',
                        color: spineTextColor,
                        letterSpacing: letterSpacingPx > 0 ? letterSpacingPx : undefined,
                        textAlign: 'center',
                        lineHeight: line.fontSize * titleLineHeightMultiplier,  // Font-specific title line height
                        includeFontPadding: false,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.3}
                    >
                      {line.text}
                    </Text>
                  );
                })}
              </View>
            </View>
          ) : (
            // ═══════════════════════════════════════════════════════════════
            // HORIZONTAL TITLE: Stack lines vertically
            // ═══════════════════════════════════════════════════════════════
            titleLayout.lines.map((line, i) => {
              const letterSpacingEm = composition?.title.letterSpacing ?? typography.letterSpacing ?? 0;
              const letterSpacingPx = letterSpacingEm * line.fontSize;
              // Add extra height for ascenders (fonts extend ~15% above cap height)
              const lineContainerHeight = line.fontSize * 1.2;

              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    // Center the container at line.y, but give it extra height for ascenders
                    top: line.y - lineContainerHeight / 2,
                    height: lineContainerHeight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: resolvedFontFamily,
                      fontSize: line.fontSize,
                      fontWeight: titleFontWeight as any,
                      fontStyle: typography.fontStyle || 'normal',
                      color: spineTextColor,
                      letterSpacing: letterSpacingPx > 0 ? letterSpacingPx : undefined,
                      textAlign: 'center',
                      lineHeight: line.fontSize * titleLineHeightMultiplier,  // Font-specific title line height
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.3}
                  >
                    {line.text}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Decorative divider line between title and author - always BETWEEN sections */}
        {compositionDecorElement === 'divider-line' && (
          <View
            style={{
              position: 'absolute',
              // Position between first and second section (not at edges)
              // authorFirst: divider at bottom of author section
              // !authorFirst: divider at bottom of title section
              top: authorFirst
                ? (authorY + authorHeight + SECTION_GAP / 2)  // Between author and title
                : (titleY + titleHeight + SECTION_GAP / 2),   // Between title and author
              left: EDGE_PADDING + 8,
              right: EDGE_PADDING + 8,
              height: compositionLineStyle === 'thick' ? 2 : 1,
              backgroundColor: spineTextColor,
            }}
          />
        )}

        {/* Author section */}
        <View
          style={[
            styles.authorSection,
            {
              position: 'absolute',
              left: EDGE_PADDING,
              top: authorY,
              width: availableWidth,
              height: authorHeight,
            },
          ]}
        >
          {/* Author box border (if applicable)
              Borders face INWARD toward center of spine:
              - TOP position: no top border (only bottom, left, right)
              - CENTER position: all borders allowed
              - BOTTOM position: no bottom border (only top, left, right)

              Uses the author box's ACTUAL position relative to spine edges
          */}
          {authorBoxConfig && authorBoxBounds && (() => {
            // Check position of author box relative to spine boundaries
            // Use a percentage of spine height as threshold (top 25% = near top, bottom 25% = near bottom)
            const boxTop = authorBoxBounds.y;
            const boxBottom = authorBoxBounds.y + authorBoxBounds.height;
            const spineContentHeight = height - topOffset - BOTTOM_PADDING;
            const topThreshold = topOffset + (spineContentHeight * 0.35);
            const bottomThreshold = height - BOTTOM_PADDING - (spineContentHeight * 0.35);

            const isNearTop = boxTop < topThreshold;
            const isNearBottom = boxBottom > bottomThreshold;

            // DEBUG: Log border decisions
            if (__DEV__) {
              console.log(`[AuthorBox] "${book.author?.substring(0, 15)}" boxTop=${boxTop.toFixed(0)} threshold=${topThreshold.toFixed(0)} isNearTop=${isNearTop} showTopBorder=${!isNearTop}`);
            }

            // Calculate which borders to show (facing inward toward center)
            // At top: no top border. At bottom: no bottom border.
            const showTopBorder = !isNearTop;
            const showBottomBorder = !isNearBottom;

            return (
              <View
                style={{
                  position: 'absolute',
                  left: authorBoxBounds.x - EDGE_PADDING,
                  top: authorBoxBounds.y - authorY,
                  width: authorBoxBounds.width,
                  height: authorBoxBounds.height,
                  // Explicitly set all border widths (not using borderWidth shorthand)
                  borderTopWidth: showTopBorder ? authorBoxConfig.strokeWidth : 0,
                  borderBottomWidth: showBottomBorder ? authorBoxConfig.strokeWidth : 0,
                  borderLeftWidth: authorBoxConfig.strokeWidth,
                  borderRightWidth: authorBoxConfig.strokeWidth,
                  borderTopColor: showTopBorder ? authorBoxConfig.strokeColor : 'transparent',
                  borderBottomColor: showBottomBorder ? authorBoxConfig.strokeColor : 'transparent',
                  borderLeftColor: authorBoxConfig.strokeColor,
                  borderRightColor: authorBoxConfig.strokeColor,
                  borderRadius: authorBoxConfig.borderRadius,
                }}
              />
            );
          })()}

          {(authorSplitNames || composition?.author?.orientation === 'stacked-words') && authorContent.includes(' ') ? (
            // ═══════════════════════════════════════════════════════════════
            // SPLIT NAMES: "WALTER / SPACEY" style - each name stacked
            // Creates the editorial book cover look
            // Triggered by: authorSplitNames boolean OR composition orientation
            // ═══════════════════════════════════════════════════════════════
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {authorContent.split(' ').map((namePart, i, arr) => {
                const nameFontSize = Math.min(
                  availableWidth * 0.85 / (namePart.length * 0.55),
                  (authorHeight - 8) / arr.length * 0.85  // More room for ascenders
                );
                // Use very tight line height (0.95x font size) for stacked names
                const stackedLineHeight = Math.max(9, nameFontSize * 0.95);

                return (
                  <Text
                    key={i}
                    style={{
                      fontFamily: resolvedFontFamily,
                      fontSize: Math.max(7, nameFontSize),
                      fontWeight: authorFontWeight as any,
                      color: spineTextColor,
                      textAlign: 'center',
                      letterSpacing: 0.5,
                      lineHeight: stackedLineHeight,
                      // Negative margin to pull names closer together
                      marginTop: i > 0 ? -2 : 0,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.4}
                  >
                    {namePart}
                  </Text>
                );
              })}
            </View>
          ) : authorLayout.orientation === 'vertical' ? (
            // ═══════════════════════════════════════════════════════════════
            // VERTICAL AUTHOR: Rotated text reads bottom-to-top
            // ═══════════════════════════════════════════════════════════════
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: authorHeight * 0.95,
                  transform: [{ rotate: '-90deg' }],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {authorLayout.lines.map((line, i) => {
                  const authorLetterSpacingPx = (typography.letterSpacing || 0) * line.fontSize * 0.5;

                  return (
                    <Text
                      key={i}
                      style={{
                        fontFamily: resolvedFontFamily,
                        fontSize: line.fontSize,
                        fontWeight: authorFontWeight as any,
                        fontStyle: typography.fontStyle || 'normal',
                        color: spineTextColor,
                        letterSpacing: authorLetterSpacingPx > 0 ? authorLetterSpacingPx : undefined,
                        textAlign: 'center',
                        lineHeight: line.fontSize * authorLineHeightMultiplier,  // Font-specific author line height
                        includeFontPadding: false,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.3}
                    >
                      {line.text}
                    </Text>
                  );
                })}
              </View>
            </View>
          ) : (
            // ═══════════════════════════════════════════════════════════════
            // HORIZONTAL AUTHOR: Standard stacked lines
            // ═══════════════════════════════════════════════════════════════
            authorLayout.lines.map((line, i) => {
              const authorLetterSpacingPx = (typography.letterSpacing || 0) * line.fontSize * 0.5;
              // Add extra height for ascenders (fonts extend ~15% above cap height)
              const lineContainerHeight = line.fontSize * 1.2;

              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    // Center the container at line.y, but give it extra height for ascenders
                    top: line.y - lineContainerHeight / 2,
                    height: lineContainerHeight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: resolvedFontFamily,
                      fontSize: line.fontSize,
                      fontWeight: authorFontWeight as any,
                      fontStyle: typography.fontStyle || 'normal',
                      color: spineTextColor,
                      letterSpacing: authorLetterSpacingPx > 0 ? authorLetterSpacingPx : undefined,
                      textAlign: 'center',
                      lineHeight: line.fontSize * authorLineHeightMultiplier,  // Font-specific author line height
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.3}
                  >
                    {line.text}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Progress/Series section at bottom */}
        <View
          style={[
            styles.progressSection,
            {
              position: 'absolute',
              left: EDGE_PADDING,
              top: progressY,
              width: availableWidth,
              height: progressHeight,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          {showProgress ? (
            isFinished ? (
              // Checkmark for finished books
              <Text style={{ fontSize: checkmarkSize, color: spineTextColor }}>✓</Text>
            ) : (
              // Progress percentage
              <Text
                style={{
                  fontFamily: resolvedFontFamily,
                  fontSize: progressFontSize,
                  fontWeight: '600',
                  color: spineTextColor,
                }}
              >
                {progressPercent}
              </Text>
            )
          ) : null}
        </View>

        {/* Side line decorations (vertical bars) - span the CENTER section only
            Not touching top or bottom edges of spine */}
        {compositionDecorElement === 'side-line' && (() => {
          // Calculate center section bounds (between first and last sections)
          const centerTop = authorFirst
            ? (authorY + authorHeight + SECTION_GAP)  // Below author when author is first
            : (titleY + titleHeight + SECTION_GAP);   // Below title when title is first
          const centerBottom = progressSectionPercent > 0
            ? progressY - SECTION_GAP                  // Above progress section
            : (authorFirst
                ? (titleY + titleHeight)               // Bottom of title when author is first
                : (authorY + authorHeight));           // Bottom of author when title is first

          return (
            <>
              <View
                style={{
                  position: 'absolute',
                  top: centerTop,
                  height: Math.max(0, centerBottom - centerTop),
                  left: 2,
                  width: compositionLineStyle === 'thick' ? 2 : 1,
                  backgroundColor: spineTextColor,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: centerTop,
                  height: Math.max(0, centerBottom - centerTop),
                  right: 2,
                  width: compositionLineStyle === 'thick' ? 2 : 1,
                  backgroundColor: spineTextColor,
                }}
              />
            </>
          );
        })()}

        {/* Corner marks decoration - facing INWARD toward center
            Top corners: no horizontal top line, vertical lines point down
            Bottom corners: no horizontal bottom line, vertical lines point up */}
        {compositionDecorElement === 'corner-marks' && (() => {
          // Calculate inward-facing corner positions
          const topSectionBottom = authorFirst ? (authorY + authorHeight) : (titleY + titleHeight);
          const bottomSectionTop = progressSectionPercent > 0
            ? progressY
            : (authorFirst ? titleY : authorY);

          return (
            <>
              {/* Top-left corner - faces DOWN and RIGHT (inward) */}
              <View style={{ position: 'absolute', top: topSectionBottom - 8, left: 3, width: 1, height: 8, backgroundColor: spineTextColor }} />
              <View style={{ position: 'absolute', top: topSectionBottom - 1, left: 3, width: 8, height: 1, backgroundColor: spineTextColor }} />
              {/* Top-right corner - faces DOWN and LEFT (inward) */}
              <View style={{ position: 'absolute', top: topSectionBottom - 8, right: 3, width: 1, height: 8, backgroundColor: spineTextColor }} />
              <View style={{ position: 'absolute', top: topSectionBottom - 1, right: 3, width: 8, height: 1, backgroundColor: spineTextColor }} />
              {/* Bottom-left corner - faces UP and RIGHT (inward) */}
              <View style={{ position: 'absolute', top: bottomSectionTop, left: 3, width: 1, height: 8, backgroundColor: spineTextColor }} />
              <View style={{ position: 'absolute', top: bottomSectionTop, left: 3, width: 8, height: 1, backgroundColor: spineTextColor }} />
              {/* Bottom-right corner - faces UP and LEFT (inward) */}
              <View style={{ position: 'absolute', top: bottomSectionTop, right: 3, width: 1, height: 8, backgroundColor: spineTextColor }} />
              <View style={{ position: 'absolute', top: bottomSectionTop, right: 3, width: 8, height: 1, backgroundColor: spineTextColor }} />
            </>
          );
        })()}

        {/* Bottom line decoration - positioned at TOP of last section (faces inward toward center)
            Not at the very bottom edge of spine */}
        {(compositionDecorElement === 'bottom-line' || compositionDecorElement === 'partial-border') && (
          <View
            style={{
              position: 'absolute',
              // Position at top of last section (progress if shown, otherwise author)
              top: progressSectionPercent > 0
                ? progressY + 2                    // Top of progress section
                : (authorFirst
                    ? titleY + 2                   // Top of title (when author is first)
                    : authorY + 2),                // Top of author section
              left: EDGE_PADDING + 4,
              right: EDGE_PADDING + 4,
              height: compositionLineStyle === 'thick' ? 2 : 1,
              backgroundColor: spineTextColor,
            }}
          />
        )}
          </>
        )}
      </View>

      {/* Progress BELOW the spine for template-rendered books */}
      {templateConfig && showProgress && (
        <View style={styles.progressBelowContainer}>
          {isFinished ? (
            <Text style={[styles.progressBelowText, { fontSize: progressFontSize * 0.8, color: colors.gray }]}>✓</Text>
          ) : (
            <Text style={[styles.progressBelowText, { fontSize: progressFontSize * 0.8, color: colors.gray }]}>
              {progressPercent}%
            </Text>
          )}
        </View>
      )}
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
    borderWidth: 1,
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
  progressBelowContainer: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  progressBelowText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  lastPlayedContainer: {
    position: 'absolute',
    top: -18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  lastPlayedText: {
    fontWeight: '600',
    textAlign: 'center',
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
