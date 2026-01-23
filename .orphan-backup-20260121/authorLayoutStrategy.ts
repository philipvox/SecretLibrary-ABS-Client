/**
 * src/features/home/utils/authorLayoutStrategy.ts
 *
 * Smart author layout strategy selector.
 * Tries multiple layout approaches and picks the best one that fits.
 *
 * Strategies:
 * 1. horizontal-single: Single line, reads left-to-right
 * 2. horizontal-stacked: 2-3 lines stacked, each sized independently
 * 3. vertical-single: Single line rotated -90°
 * 4. vertical-split: 2-3 vertical columns side by side
 */

// MIGRATED: Now using new spine system via adapter
import { FONT_CHAR_RATIOS } from './spine/adapter';

// =============================================================================
// TYPES
// =============================================================================

export interface LineConfig {
  text: string;
  fontSize: number;
  x: number;
  y: number;
}

export type AuthorLayoutStrategy =
  | { type: 'horizontal-single'; fontSize: number; text: string }
  | { type: 'horizontal-stacked'; lines: LineConfig[] }
  | { type: 'vertical-single'; fontSize: number; text: string; rotation: number }
  | { type: 'vertical-split'; lines: LineConfig[]; rotation: number };

interface LayoutAttempt {
  strategy: AuthorLayoutStrategy;
  score: number;
  fits: boolean;
}

type MeasureFunction = (text: string, fontSize: number) => number;

// =============================================================================
// TEXT MEASUREMENT (React Native compatible)
// =============================================================================

/**
 * Measure text width using character ratio estimation
 * This is the standard approach for React Native (no Canvas API)
 */
function createMeasureFunction(fontFamily: string): MeasureFunction {
  const ratio = FONT_CHAR_RATIOS[fontFamily] || FONT_CHAR_RATIOS['default'];

  return (text: string, fontSize: number): number => {
    if (!text) return 0;
    // Estimate width: characters × ratio × fontSize
    return text.length * ratio * fontSize;
  };
}

// =============================================================================
// AUTHOR NAME PARSING
// =============================================================================

const SURNAME_PARTICLES = [
  'van', 'von', 'de', 'du', 'del', 'della', 'di', 'da',
  'le', 'la', 'les', 'lo', 'mc', 'mac', "o'", 'st', 'saint',
  'bin', 'ibn', 'ben', 'al', 'el',
];

/**
 * Extract last name including particles
 * "Le Guin" from ["Ursula", "K.", "Le", "Guin"]
 */
function extractLastName(parts: string[]): string {
  let lastNameStart = parts.length - 1;

  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i].toLowerCase().replace(/[.,]/g, '');
    if (SURNAME_PARTICLES.includes(part)) {
      lastNameStart = i;
    } else {
      break;
    }
  }

  return parts.slice(lastNameStart).join(' ');
}

/**
 * Parse author into optimal line groupings
 * "Ursula K. Le Guin" → ["Ursula K.", "Le Guin"]
 * "George Raymond Richard Martin" → ["George R.R.", "Martin"] or 3 lines
 */
function parseAuthorIntoLines(author: string): string[] {
  const parts = author.trim().split(/\s+/);

  if (parts.length === 1) return [author];
  if (parts.length === 2) return parts;

  const lastName = extractLastName(parts);
  const lastNameParts = lastName.split(' ').length;
  const firstParts = parts.slice(0, parts.length - lastNameParts);

  if (firstParts.length <= 2) {
    return [firstParts.join(' '), lastName];
  }

  // 3 lines for very long names
  const mid = Math.ceil(firstParts.length / 2);
  return [
    firstParts.slice(0, mid).join(' '),
    firstParts.slice(mid).join(' '),
    lastName,
  ];
}

// =============================================================================
// INDIVIDUAL STRATEGY IMPLEMENTATIONS
// =============================================================================

/**
 * HORIZONTAL SINGLE LINE
 * Best for: short names on wide spines
 */
function tryHorizontalSingle(
  author: string,
  boxWidth: number,
  boxHeight: number,
  measure: MeasureFunction
): { fits: boolean; fontSize: number } {
  const usableWidth = boxWidth * 0.88; // 6% margin each side
  const maxFontHeight = boxHeight * 0.7;

  let fontSize = Math.min(16, maxFontHeight);

  while (fontSize >= 7) {
    const textWidth = measure(author, fontSize);
    if (textWidth <= usableWidth) {
      return { fits: true, fontSize };
    }
    fontSize -= 0.5;
  }

  return { fits: false, fontSize: 0 };
}

/**
 * HORIZONTAL STACKED (2-3 lines)
 * Best for: medium names on wider spines
 * Each line gets its own font size!
 */
function tryHorizontalStacked(
  author: string,
  boxWidth: number,
  boxHeight: number,
  measure: MeasureFunction
): { fits: boolean; lines: LineConfig[] } {
  const parsed = parseAuthorIntoLines(author);
  const usableWidth = boxWidth * 0.88;
  const lineCount = parsed.length;

  // Max font size per line (with room for gaps)
  const lineGap = 4; // pixel gap between lines
  const maxFontSize = (boxHeight - (lineCount - 1) * lineGap) / lineCount;

  if (maxFontSize < 7) {
    return { fits: false, lines: [] };
  }

  // First pass: calculate font sizes for each line
  const fontSizes: number[] = [];
  for (const text of parsed) {
    let fontSize = Math.min(16, maxFontSize);
    while (fontSize >= 7 && measure(text, fontSize) > usableWidth) {
      fontSize -= 0.5;
    }
    if (fontSize < 7) {
      return { fits: false, lines: [] };
    }
    fontSizes.push(fontSize);
  }

  // Calculate total height of text block
  const totalTextHeight = fontSizes.reduce((sum, fs) => sum + fs, 0) + (lineCount - 1) * lineGap;

  // Center the text block vertically within the box
  let currentY = (boxHeight - totalTextHeight) / 2;

  const lines: LineConfig[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const fontSize = fontSizes[i];
    // Position at center of this line (for alignmentBaseline="central")
    const y = currentY + fontSize / 2;

    lines.push({
      text: parsed[i],
      fontSize,
      x: boxWidth / 2,
      y,
    });

    // Move to next line
    currentY += fontSize + lineGap;
  }

  return { fits: true, lines };
}

/**
 * VERTICAL SINGLE LINE
 * Best for: any name on tall narrow spines
 */
function tryVerticalSingle(
  author: string,
  boxWidth: number,
  boxHeight: number,
  measure: MeasureFunction
): { fits: boolean; fontSize: number } {
  const usableHeight = boxHeight * 0.92; // Text length when rotated
  const maxFontSize = boxWidth * 0.75; // Font can't exceed spine width

  let fontSize = Math.min(14, maxFontSize);

  while (fontSize >= 7) {
    const textWidth = measure(author, fontSize);
    if (textWidth <= usableHeight) {
      return { fits: true, fontSize };
    }
    fontSize -= 0.5;
  }

  return { fits: false, fontSize: 0 };
}

/**
 * VERTICAL SPLIT (2-3 columns, all rotated)
 * Best for: long names on narrow spines
 */
function tryVerticalSplit(
  author: string,
  boxWidth: number,
  boxHeight: number,
  measure: MeasureFunction
): { fits: boolean; lines: LineConfig[] } {
  const parsed = parseAuthorIntoLines(author);
  if (parsed.length < 2) {
    return { fits: false, lines: [] };
  }

  // Each vertical line gets ~42% of width (with gap between)
  const lineWidth = boxWidth * 0.42;
  const usableHeight = boxHeight * 0.92;
  const maxFontSize = lineWidth * 0.85;

  const lines: LineConfig[] = [];

  // Position columns based on count
  const positions =
    parsed.length === 2
      ? [boxWidth * 0.27, boxWidth * 0.73]
      : [boxWidth * 0.2, boxWidth * 0.5, boxWidth * 0.8];

  for (let i = 0; i < parsed.length; i++) {
    const text = parsed[i];
    let fontSize = Math.min(12, maxFontSize);

    while (fontSize >= 6 && measure(text, fontSize) > usableHeight) {
      fontSize -= 0.5;
    }

    if (fontSize < 6) {
      return { fits: false, lines: [] };
    }

    lines.push({
      text,
      fontSize,
      x: positions[i],
      y: boxHeight / 2,
    });
  }

  return { fits: true, lines };
}

// =============================================================================
// SCORING FUNCTIONS (Creates variety!)
// =============================================================================

function scoreHorizontalSingle(
  fontSize: number,
  nameLength: number,
  aspectRatio: number
): number {
  let score = 100;

  // Penalize horizontal on tall narrow spines
  if (aspectRatio > 6) score -= 50;
  if (aspectRatio > 5) score -= 25;

  // Bonus for larger, readable fonts
  score += fontSize * 2;

  // Slight penalty for very short names (looks odd horizontal)
  if (nameLength < 8) score -= 10;

  // Bonus for "ideal" range
  if (fontSize >= 9 && fontSize <= 12) score += 15;

  return score;
}

function scoreHorizontalStacked(
  result: { lines: LineConfig[] },
  aspectRatio: number
): number {
  let score = 90; // Slightly prefer single line

  // Good for medium aspect ratios
  if (aspectRatio >= 4 && aspectRatio <= 6) score += 20;

  // Penalize on very tall spines
  if (aspectRatio > 7) score -= 30;

  // Bonus for balanced line lengths
  const lengths = result.lines.map((l) => l.text.length);
  const variance = Math.abs(lengths[0] - lengths[lengths.length - 1]);
  score -= variance * 2;

  // Bonus for readable font sizes
  const avgFontSize =
    result.lines.reduce((a, l) => a + l.fontSize, 0) / result.lines.length;
  score += avgFontSize * 1.5;

  return score;
}

function scoreVerticalSingle(fontSize: number, aspectRatio: number): number {
  let score = 85;

  // Vertical loves tall narrow spines
  if (aspectRatio > 6) score += 30;
  if (aspectRatio > 7) score += 20;

  // Penalize on wide spines
  if (aspectRatio < 4) score -= 25;

  // Font size bonus
  score += fontSize * 1.5;

  return score;
}

function scoreVerticalSplit(
  result: { lines: LineConfig[] },
  aspectRatio: number
): number {
  let score = 75; // Last resort usually

  // Good for very tall spines with long names
  if (aspectRatio > 7) score += 25;

  // Penalize on wider spines
  if (aspectRatio < 5) score -= 20;

  const avgFontSize =
    result.lines.reduce((a, l) => a + l.fontSize, 0) / result.lines.length;
  score += avgFontSize;

  return score;
}

// =============================================================================
// FALLBACK: Abbreviated
// =============================================================================

function createAbbreviatedFallback(
  author: string,
  boxWidth: number,
  boxHeight: number,
  measure: MeasureFunction
): AuthorLayoutStrategy {
  // Abbreviate: "Ursula K. Le Guin" → "U. Le Guin"
  const parts = author.split(' ');
  let abbreviated = author;

  if (parts.length > 2) {
    // Keep last name, abbreviate first names
    const lastName = extractLastName(parts);
    const firstInitial = parts[0][0] + '.';
    abbreviated = `${firstInitial} ${lastName}`;
  }

  // Try vertical single with abbreviated name
  const result = tryVerticalSingle(abbreviated, boxWidth, boxHeight, measure);

  if (result.fits) {
    return {
      type: 'vertical-single',
      fontSize: result.fontSize,
      text: abbreviated,
      rotation: -90,
    };
  }

  // Ultimate fallback: just initials
  const initials = parts.map((p) => p[0]).join('.');
  return {
    type: 'vertical-single',
    fontSize: Math.min(12, boxWidth * 0.6),
    text: initials,
    rotation: -90,
  };
}

// =============================================================================
// MAIN SELECTOR
// =============================================================================

/**
 * Select the best author layout strategy
 * Tries multiple approaches and picks the highest-scoring one that fits
 */
export function selectAuthorLayout(
  author: string,
  sectionWidth: number,
  sectionHeight: number,
  aspectRatio: number,
  fontFamily: string,
  authorRotation: number = -90
): AuthorLayoutStrategy {
  // Handle empty/missing author
  if (!author || author.trim() === '') {
    return {
      type: 'vertical-single',
      fontSize: 10,
      text: '',
      rotation: authorRotation,
    };
  }

  const measure = createMeasureFunction(fontFamily);
  const attempts: LayoutAttempt[] = [];

  // ═══════════════════════════════════════════════════════════
  // ATTEMPT 1: Horizontal Single Line
  // ═══════════════════════════════════════════════════════════
  const hSingle = tryHorizontalSingle(author, sectionWidth, sectionHeight, measure);
  if (hSingle.fits) {
    attempts.push({
      strategy: {
        type: 'horizontal-single',
        fontSize: hSingle.fontSize,
        text: author,
      },
      score: scoreHorizontalSingle(hSingle.fontSize, author.length, aspectRatio),
      fits: true,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ATTEMPT 2: Horizontal Stacked (2-3 lines)
  // ═══════════════════════════════════════════════════════════
  const hStacked = tryHorizontalStacked(author, sectionWidth, sectionHeight, measure);
  if (hStacked.fits) {
    attempts.push({
      strategy: { type: 'horizontal-stacked', lines: hStacked.lines },
      score: scoreHorizontalStacked(hStacked, aspectRatio),
      fits: true,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ATTEMPT 3: Vertical Single Line
  // ═══════════════════════════════════════════════════════════
  const vSingle = tryVerticalSingle(author, sectionWidth, sectionHeight, measure);
  if (vSingle.fits) {
    attempts.push({
      strategy: {
        type: 'vertical-single',
        fontSize: vSingle.fontSize,
        text: author,
        rotation: authorRotation,
      },
      score: scoreVerticalSingle(vSingle.fontSize, aspectRatio),
      fits: true,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ATTEMPT 4: Vertical Split (2-3 columns)
  // ═══════════════════════════════════════════════════════════
  const vSplit = tryVerticalSplit(author, sectionWidth, sectionHeight, measure);
  if (vSplit.fits) {
    // Add rotation to each line
    const linesWithRotation = vSplit.lines.map((line) => ({
      ...line,
    }));
    attempts.push({
      strategy: {
        type: 'vertical-split',
        lines: linesWithRotation,
        rotation: authorRotation,
      },
      score: scoreVerticalSplit(vSplit, aspectRatio),
      fits: true,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SELECT BEST
  // ═══════════════════════════════════════════════════════════
  if (attempts.length === 0) {
    return createAbbreviatedFallback(author, sectionWidth, sectionHeight, measure);
  }

  // Sort by score descending, pick best
  attempts.sort((a, b) => b.score - a.score);
  return attempts[0].strategy;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { parseAuthorIntoLines, extractLastName };
