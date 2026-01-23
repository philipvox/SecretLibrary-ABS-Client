/**
 * src/features/home/components/BookSpineHorizontal.tsx
 *
 * Horizontal book spine component for stacked/lying flat displays.
 * Native horizontal layout - no rotation transforms needed.
 *
 * Layout variants:
 * - Title left, Author right (boxed) - default
 * - Author left, Title right
 * - Title spans full width with author below
 *
 * Features:
 * - SVG-based rendering for crisp text
 * - Genre-based styling (weight, case)
 * - No rotation = no clipping issues
 */

import React, { useMemo, useCallback } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Svg, { Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { useSecretLibraryColors } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
// MIGRATED: Functions now using new system via adapter
import {
  getTypographyForGenres,
  generateSpineComposition,
} from '../utils/spine/adapter';
import { SpineTypography } from '../utils/spineCalculations';

// =============================================================================
// TYPES
// =============================================================================

export interface BookSpineHorizontalData {
  id: string;
  title: string;
  author: string;
  genres?: string[];
  tags?: string[];
  duration?: number;
  seriesName?: string;
  seriesSequence?: number;
  progress?: number;
}

interface BookSpineHorizontalProps {
  book: BookSpineHorizontalData;
  /** Width of the horizontal spine (how wide the book appears lying flat) */
  width: number;
  /** Height/thickness of the spine */
  height: number;
  /** Custom background color (defaults to theme white) */
  backgroundColor?: string;
  /** Custom text color (defaults to theme black) */
  textColor?: string;
  /** Custom stroke/border color (defaults to theme black) */
  strokeColor?: string;
  onPress?: (book: BookSpineHorizontalData) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CORNER_RADIUS = 3;
const PADDING_X = 8;
const PADDING_Y = 4;
const AUTHOR_BOX_WIDTH_RATIO = 0.22; // Author box takes 22% of width
const MIN_AUTHOR_BOX_WIDTH = 28;
const MAX_AUTHOR_BOX_WIDTH = 50;
const DIVIDER_GAP = 6;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate optimal font size to fit text within available width.
 */
function calculateFontSize(
  text: string,
  availableWidth: number,
  availableHeight: number,
  minSize: number = 7,
  maxSize: number = 18
): number {
  // Estimate character width as 0.55 * fontSize (average for mixed case)
  const widthBasedSize = availableWidth / (text.length * 0.55);
  const heightBasedSize = availableHeight * 0.85;

  const optimalSize = Math.min(widthBasedSize, heightBasedSize, maxSize);
  return Math.max(minSize, Math.round(optimalSize * 2) / 2); // Round to 0.5
}

/**
 * Truncate text with ellipsis if too long.
 */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 1) + '…';
}

/**
 * Get font weight string from composition weight.
 */
function getFontWeight(weight: string): string {
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
 * Apply case transformation.
 */
function applyCase(text: string, textCase: string): string {
  switch (textCase) {
    case 'uppercase': return text.toUpperCase();
    case 'lowercase': return text.toLowerCase();
    case 'sentence-case':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    default: return text;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BookSpineHorizontal({
  book,
  width,
  height,
  backgroundColor,
  textColor,
  strokeColor,
  onPress,
}: BookSpineHorizontalProps) {
  const colors = useSecretLibraryColors();
  const genres = book.genres || [];

  // Use custom colors or fall back to theme defaults
  const bgColor = backgroundColor ?? colors.white;
  const txtColor = textColor ?? colors.black;
  const borderColor = strokeColor ?? colors.black;

  // Get typography settings for this genre
  const typography = useMemo(() => {
    return getTypographyForGenres(genres, book.id);
  }, [genres, book.id]);

  // Generate composition for styling choices
  // Pass width for smart layout constraints (horizontal only on wide spines)
  const composition = useMemo(() => {
    if (genres.length === 0) return null;
    return generateSpineComposition(
      book.id,
      book.title,
      book.author,
      genres,
      book.seriesName && book.seriesSequence
        ? { name: book.seriesName, number: book.seriesSequence }
        : undefined,
      width  // Pass spine width for smart orientation constraints
    );
  }, [book.id, book.title, book.author, genres, book.seriesName, book.seriesSequence, width]);

  // Calculate author box width
  const authorBoxWidth = useMemo(() => {
    const calculated = width * AUTHOR_BOX_WIDTH_RATIO;
    return Math.min(MAX_AUTHOR_BOX_WIDTH, Math.max(MIN_AUTHOR_BOX_WIDTH, calculated));
  }, [width]);

  // Available widths for title and author
  const titleAreaWidth = width - authorBoxWidth - PADDING_X * 2 - DIVIDER_GAP;
  const authorAreaHeight = height - PADDING_Y * 2;

  // Process text based on composition
  const titleText = useMemo(() => {
    if (composition) {
      return applyCase(book.title, composition.title.case);
    }
    return typography.titleTransform === 'uppercase'
      ? book.title.toUpperCase()
      : book.title;
  }, [book.title, composition, typography.titleTransform]);

  const authorText = useMemo(() => {
    if (composition) {
      // Apply author treatment
      let author = book.author;
      switch (composition.author.treatment) {
        case 'last-name-only':
          const parts = author.split(' ');
          author = parts[parts.length - 1] || author;
          break;
        case 'initials':
          author = author.split(' ').map(p => p[0]).join('.') + '.';
          break;
      }
      return applyCase(author, composition.author.case);
    }
    return typography.authorTransform === 'uppercase'
      ? book.author.toUpperCase()
      : book.author;
  }, [book.author, composition, typography.authorTransform]);

  // Calculate font sizes
  const titleFontSize = useMemo(() => {
    return calculateFontSize(titleText, titleAreaWidth, height - PADDING_Y * 2, 8, 16);
  }, [titleText, titleAreaWidth, height]);

  const authorFontSize = useMemo(() => {
    // For vertical author in box, height becomes width and vice versa
    const availableLength = authorAreaHeight;
    const availableThickness = authorBoxWidth - 6;
    return calculateFontSize(authorText, availableLength, availableThickness, 6, 11);
  }, [authorText, authorAreaHeight, authorBoxWidth]);

  // Font weights from composition
  const titleWeight = composition ? getFontWeight(composition.title.weight) : '600';
  const authorWeight = composition ? getFontWeight(composition.author.weight) : '400';

  // Truncate if needed
  const maxTitleChars = Math.floor(titleAreaWidth / (titleFontSize * 0.5));
  const displayTitle = truncateText(titleText, maxTitleChars);

  const maxAuthorChars = Math.floor(authorAreaHeight / (authorFontSize * 0.5));
  const displayAuthor = truncateText(authorText, maxAuthorChars);

  // Positions
  const titleX = PADDING_X;
  const titleY = height / 2;

  const authorBoxX = width - authorBoxWidth;
  const authorCenterX = authorBoxX + authorBoxWidth / 2;
  const authorCenterY = height / 2;

  // Divider line position
  const dividerX = authorBoxX - DIVIDER_GAP / 2;

  // Handle press
  const handlePress = useCallback(() => {
    haptics.selection();
    onPress?.(book);
  }, [book, onPress]);

  return (
    <Pressable onPress={onPress ? handlePress : undefined}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={CORNER_RADIUS}
          ry={CORNER_RADIUS}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={1}
        />

        {/* Divider line between title and author */}
        <Line
          x1={dividerX}
          y1={4}
          x2={dividerX}
          y2={height - 4}
          stroke={txtColor}
          strokeWidth={1}
          opacity={0.3}
        />

        {/* Title - horizontal, left-aligned */}
        <SvgText
          x={titleX}
          y={titleY}
          textAnchor="start"
          alignmentBaseline="central"
          fontSize={titleFontSize}
          fontFamily={typography.fontFamily}
          fontWeight={titleWeight}
          fill={txtColor}
        >
          {displayTitle}
        </SvgText>

        {/* Author box - vertical text on the right */}
        <G>
          {/* Author text - rotated -90° to read bottom-to-top */}
          <SvgText
            x={authorCenterX}
            y={authorCenterY}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={authorFontSize}
            fontFamily={typography.fontFamily}
            fontWeight={authorWeight}
            fill={txtColor}
            transform={`rotate(-90, ${authorCenterX}, ${authorCenterY})`}
          >
            {displayAuthor}
          </SvgText>
        </G>

        {/* Series number indicator (if in series) */}
        {book.seriesSequence && (
          <SvgText
            x={width - 6}
            y={8}
            textAnchor="end"
            alignmentBaseline="hanging"
            fontSize={7}
            fontFamily={typography.fontFamily}
            fontWeight="500"
            fill={txtColor}
            opacity={0.6}
          >
            #{book.seriesSequence}
          </SvgText>
        )}
      </Svg>
    </Pressable>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Currently unused - all styling via SVG
});

export default BookSpineHorizontal;
