/**
 * src/core/services/chapterNormalizer.ts
 *
 * Client-side chapter name normalization for display purposes.
 * Based on analysis of 68,515 real chapter titles across 2,064 audiobooks.
 *
 * This service cleans up messy chapter names from various sources
 * (ID3 tags, filenames, metadata APIs) for a consistent, polished display
 * without modifying the original server data.
 */

// ============================================================
// TYPES
// ============================================================

export interface ParsedChapter {
  original: string;
  trackNumber: number | null;
  bookTitle: string | null;
  chapterType: 'chapter' | 'part' | 'book' | 'front_matter' | 'back_matter' | 'other';
  chapterNumber: number | null;
  chapterTitle: string | null;
  displayName: string;
  confidence: number;
}

export interface NormalizerOptions {
  level: 'off' | 'light' | 'standard' | 'aggressive';
  bookTitle?: string;
  preserveFrontBackMatter?: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

// Spelled-out numbers for parsing
const WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

// Front matter keywords (order matters for display)
const FRONT_MATTER = [
  'opening credits',
  'credits',
  'dedication',
  'epigraph',
  'foreword',
  'preface',
  'introduction',
  'intro',
  'prologue',
];

// Back matter keywords
const BACK_MATTER = [
  'epilogue',
  'conclusion',
  'afterword',
  'acknowledgements',
  'acknowledgments',
  "author's note",
  'authors note',
  'about the author',
  'end credits',
  'closing credits',
];

// ============================================================
// CHARACTER NORMALIZATION
// ============================================================

/**
 * Normalize Unicode characters to their ASCII equivalents
 */
export function normalizeCharacters(str: string): string {
  return (
    str
      // Normalize dashes (en-dash, em-dash, non-breaking hyphen → hyphen)
      .replace(/[–—‑]/g, '-')
      // Normalize non-breaking space to regular space
      .replace(/\u00A0/g, ' ')
      // Normalize curly quotes
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      // Normalize ellipsis
      .replace(/…/g, '...')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// ============================================================
// NUMBER PARSING
// ============================================================

/**
 * Convert Roman numerals to Arabic numbers
 */
function romanToArabic(roman: string): number {
  const values: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let result = 0;
  const upper = roman.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const current = values[upper[i]] || 0;
    const next = values[upper[i + 1]] || 0;
    result += current < next ? -current : current;
  }
  return result;
}

/**
 * Convert spelled-out numbers to digits
 */
function wordToNumber(word: string): number | null {
  const lower = word.toLowerCase().trim();

  // Direct match
  if (WORD_TO_NUMBER[lower]) {
    return WORD_TO_NUMBER[lower];
  }

  // Handle compound numbers like "twenty-three" or "twenty three"
  const parts = lower.split(/[-\s]+/);
  if (parts.length === 2) {
    const tens = WORD_TO_NUMBER[parts[0]];
    const ones = WORD_TO_NUMBER[parts[1]];
    if (tens && ones && tens >= 20 && ones < 10) {
      return tens + ones;
    }
  }

  // Handle "one hundred" or "one hundred five"
  if (parts.includes('hundred')) {
    let result = 100;
    const hundredIdx = parts.indexOf('hundred');
    // Check for multiplier before hundred (e.g., "two hundred")
    if (hundredIdx > 0) {
      const multiplier = WORD_TO_NUMBER[parts[hundredIdx - 1]];
      if (multiplier) result = multiplier * 100;
    }
    // Check for remainder after hundred
    if (hundredIdx < parts.length - 1) {
      const remainder = parts.slice(hundredIdx + 1).join(' ');
      const remainderNum = wordToNumber(remainder);
      if (remainderNum) result += remainderNum;
    }
    return result;
  }

  return null;
}

/**
 * Parse a chapter number from various formats
 */
function parseChapterNumber(str: string): number | null {
  // Try direct number
  const numMatch = str.match(/^\d+$/);
  if (numMatch) {
    return parseInt(numMatch[0], 10);
  }

  // Try Roman numeral
  const romanMatch = str.match(/^[IVXLCDM]+$/i);
  if (romanMatch) {
    return romanToArabic(romanMatch[0]);
  }

  // Try word number
  return wordToNumber(str);
}

// ============================================================
// PATTERN MATCHERS (Priority Order)
// ============================================================

/**
 * Pattern 1: Front/Back Matter
 * Matches: "Prologue", "Epilogue: Grey", "Opening Credits", etc.
 */
function matchFrontBackMatter(title: string): ParsedChapter | null {
  const lower = title.toLowerCase();

  for (const keyword of FRONT_MATTER) {
    if (lower.startsWith(keyword)) {
      const remainder = title
        .slice(keyword.length)
        .replace(/^[\s:\-–—]+/, '')
        .trim();
      // Title case the keyword
      const displayKeyword = keyword
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return {
        original: title,
        trackNumber: null,
        bookTitle: null,
        chapterType: 'front_matter',
        chapterNumber: null,
        chapterTitle: remainder || null,
        displayName: remainder ? `${displayKeyword}: ${remainder}` : displayKeyword,
        confidence: 1.0,
      };
    }
  }

  for (const keyword of BACK_MATTER) {
    if (lower.startsWith(keyword)) {
      const remainder = title
        .slice(keyword.length)
        .replace(/^[\s:\-–—]+/, '')
        .trim();
      const displayKeyword = keyword
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      // Handle "Epilogue 1", "Epilogue 2"
      const epilogueNum = remainder.match(/^(\d+)$/);
      if (epilogueNum) {
        return {
          original: title,
          trackNumber: null,
          bookTitle: null,
          chapterType: 'back_matter',
          chapterNumber: parseInt(epilogueNum[1], 10),
          chapterTitle: null,
          displayName: `${displayKeyword} ${epilogueNum[1]}`,
          confidence: 1.0,
        };
      }
      return {
        original: title,
        trackNumber: null,
        bookTitle: null,
        chapterType: 'back_matter',
        chapterNumber: null,
        chapterTitle: remainder || null,
        displayName: remainder ? `${displayKeyword}: ${remainder}` : displayKeyword,
        confidence: 1.0,
      };
    }
  }

  return null;
}

/**
 * Pattern 2: Track-based (N - BookTitle: Chapter X)
 * Most common pattern - ~50,000 occurrences in real libraries
 */
function matchTrackBased(title: string, bookTitle?: string): ParsedChapter | null {
  // Match: N - Content or N – Content or N — Content
  const trackMatch = title.match(/^(\d{1,3})\s*[-–—]\s*(.+)$/);
  if (!trackMatch) return null;

  const trackNum = parseInt(trackMatch[1], 10);
  const content = trackMatch[2].trim();

  // Check if content has BookTitle: Subtitle format
  const colonMatch = content.match(/^(.+?):\s*(.+)$/);
  if (colonMatch) {
    const beforeColon = colonMatch[1].trim();
    const afterColon = colonMatch[2].trim();

    // Check if afterColon is a chapter reference
    const chapterInSubtitle = afterColon.match(
      /^(?:CHAPTER|Chapter|chapter)\s+(\d+|[IVXLCDM]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty(?:[-\s]\w+)?|Thirty(?:[-\s]\w+)?|Forty(?:[-\s]\w+)?|Fifty(?:[-\s]\w+)?|Sixty(?:[-\s]\w+)?|Seventy(?:[-\s]\w+)?|Eighty(?:[-\s]\w+)?|Ninety(?:[-\s]\w+)?|(?:One\s+)?Hundred(?:\s+\w+)?)(?:\s*[:.\-–—]\s*(.+))?$/i
    );

    if (chapterInSubtitle) {
      const chapterNum = parseChapterNumber(chapterInSubtitle[1]);
      const chapterTitle = chapterInSubtitle[2]?.trim() || null;
      return {
        original: title,
        trackNumber: trackNum,
        bookTitle: beforeColon,
        chapterType: 'chapter',
        chapterNumber: chapterNum,
        chapterTitle,
        displayName: chapterTitle
          ? `Chapter ${chapterNum}: ${chapterTitle}`
          : `Chapter ${chapterNum}`,
        confidence: 0.95,
      };
    }

    // Check if afterColon is a Part reference
    const partInSubtitle = afterColon.match(
      /^(?:PART|Part|part)\s+(\d+|[IVXLCDM]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)(?:\s*[:.\-–—]\s*(.+))?$/i
    );

    if (partInSubtitle) {
      const partNum = parseChapterNumber(partInSubtitle[1]);
      const partTitle = partInSubtitle[2]?.trim() || null;
      return {
        original: title,
        trackNumber: trackNum,
        bookTitle: beforeColon,
        chapterType: 'part',
        chapterNumber: partNum,
        chapterTitle: partTitle,
        displayName: partTitle ? `Part ${partNum}: ${partTitle}` : `Part ${partNum}`,
        confidence: 0.95,
      };
    }

    // Check for numbered subtitle like "11. Aren" or "XIV: Zurich"
    const numberedSubtitle = afterColon.match(/^(\d+|[IVXLCDM]+)[.:\s]+(.+)$/i);
    if (numberedSubtitle) {
      const num = parseChapterNumber(numberedSubtitle[1]);
      const subtitle = numberedSubtitle[2].trim();
      return {
        original: title,
        trackNumber: trackNum,
        bookTitle: beforeColon,
        chapterType: 'chapter',
        chapterNumber: num,
        chapterTitle: subtitle,
        displayName: `Chapter ${num}: ${subtitle}`,
        confidence: 0.85,
      };
    }

    // Generic subtitle (not a chapter/part reference)
    // In aggressive mode, show just the subtitle; otherwise keep more context
    return {
      original: title,
      trackNumber: trackNum,
      bookTitle: beforeColon,
      chapterType: 'other',
      chapterNumber: null,
      chapterTitle: afterColon,
      displayName: afterColon,
      confidence: 0.8,
    };
  }

  // No colon - check if content itself is a chapter reference
  const directChapter = content.match(
    /^(?:CHAPTER|Chapter|chapter|Ch\.?|Chap\.?)\s*(\d+)(?:\s*[-–—:.\s]\s*(.+))?$/i
  );
  if (directChapter) {
    const chapterNum = parseInt(directChapter[1], 10);
    const chapterTitle = directChapter[2]?.trim() || null;
    return {
      original: title,
      trackNumber: trackNum,
      bookTitle: null,
      chapterType: 'chapter',
      chapterNumber: chapterNum,
      chapterTitle,
      displayName: chapterTitle
        ? `Chapter ${chapterNum}: ${chapterTitle}`
        : `Chapter ${chapterNum}`,
      confidence: 0.9,
    };
  }

  // Content is just a title/name (no chapter structure detected)
  return {
    original: title,
    trackNumber: trackNum,
    bookTitle: null,
    chapterType: 'other',
    chapterNumber: null,
    chapterTitle: content,
    displayName: content,
    confidence: 0.7,
  };
}

/**
 * Pattern 3: Direct Chapter reference (Chapter N...)
 */
function matchDirectChapter(title: string): ParsedChapter | null {
  // Chapter + Number (with optional title)
  const chapterNum = title.match(
    /^(?:CHAPTER|Chapter|chapter)\s+(\d+)(?:\s*[:.\-–—]\s*(.+))?$/
  );
  if (chapterNum) {
    const num = parseInt(chapterNum[1], 10);
    const chapterTitle = chapterNum[2]?.trim() || null;
    return {
      original: title,
      trackNumber: null,
      bookTitle: null,
      chapterType: 'chapter',
      chapterNumber: num,
      chapterTitle,
      displayName: chapterTitle ? `Chapter ${num}: ${chapterTitle}` : `Chapter ${num}`,
      confidence: 1.0,
    };
  }

  // Chapter + Word (spelled out number)
  const chapterWord = title.match(
    /^(?:CHAPTER|Chapter|chapter)\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty(?:[-\s]\w+)?|Thirty(?:[-\s]\w+)?|Forty(?:[-\s]\w+)?|Fifty(?:[-\s]\w+)?|Sixty(?:[-\s]\w+)?|Seventy(?:[-\s]\w+)?|Eighty(?:[-\s]\w+)?|Ninety(?:[-\s]\w+)?|(?:One\s+)?Hundred(?:\s+\w+)?)(?:\s*[:.\-–—]\s*(.+))?$/i
  );
  if (chapterWord) {
    const num = wordToNumber(chapterWord[1]);
    const chapterTitle = chapterWord[2]?.trim() || null;
    return {
      original: title,
      trackNumber: null,
      bookTitle: null,
      chapterType: 'chapter',
      chapterNumber: num,
      chapterTitle,
      displayName: chapterTitle ? `Chapter ${num}: ${chapterTitle}` : `Chapter ${num}`,
      confidence: 1.0,
    };
  }

  // Chapter + Number + Space + Title (no separator)
  const chapterSpace = title.match(/^(?:CHAPTER|Chapter|chapter)\s+(\d+)\s+([A-Za-z].+)$/);
  if (chapterSpace) {
    const num = parseInt(chapterSpace[1], 10);
    const chapterTitle = chapterSpace[2].trim();
    return {
      original: title,
      trackNumber: null,
      bookTitle: null,
      chapterType: 'chapter',
      chapterNumber: num,
      chapterTitle,
      displayName: `Chapter ${num}: ${chapterTitle}`,
      confidence: 0.9,
    };
  }

  return null;
}

/**
 * Pattern 4: Part reference
 */
function matchPart(title: string): ParsedChapter | null {
  const partMatch = title.match(
    /^(?:PART|Part|part)\s+(\d+|[IVXLCDM]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)(?:\s*[:.\-–—]\s*(.+))?$/i
  );
  if (!partMatch) return null;

  const num = parseChapterNumber(partMatch[1]);
  const partTitle = partMatch[2]?.trim() || null;

  return {
    original: title,
    trackNumber: null,
    bookTitle: null,
    chapterType: 'part',
    chapterNumber: num,
    chapterTitle: partTitle,
    displayName: partTitle ? `Part ${num}: ${partTitle}` : `Part ${num}`,
    confidence: 1.0,
  };
}

/**
 * Pattern 5: Book reference
 */
function matchBook(title: string): ParsedChapter | null {
  const bookMatch = title.match(
    /^(?:BOOK|Book|book)\s+(\d+|[IVXLCDM]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)(?:\s*[:.\-–—]\s*(.+))?$/i
  );
  if (!bookMatch) return null;

  const num = parseChapterNumber(bookMatch[1]);
  const bookTitle = bookMatch[2]?.trim() || null;

  return {
    original: title,
    trackNumber: null,
    bookTitle: null,
    chapterType: 'book',
    chapterNumber: num,
    chapterTitle: bookTitle,
    displayName: bookTitle ? `Book ${num}: ${bookTitle}` : `Book ${num}`,
    confidence: 1.0,
  };
}

/**
 * Pattern 6: Disc/Track codes (D01T01 format)
 */
function matchDiscTrack(title: string): ParsedChapter | null {
  // D##T## - BookTitle format
  const dtMatch = title.match(/^D(\d{2})T(\d{2})\s*[-–—]?\s*(.*)$/i);
  if (dtMatch) {
    const discNum = parseInt(dtMatch[1], 10);
    const trackNum = parseInt(dtMatch[2], 10);
    const remainder = dtMatch[3]?.trim() || null;

    // Calculate absolute track number (assuming ~20 tracks per disc)
    const absoluteTrack = (discNum - 1) * 20 + trackNum;

    return {
      original: title,
      trackNumber: absoluteTrack,
      bookTitle: remainder,
      chapterType: 'chapter',
      chapterNumber: absoluteTrack,
      chapterTitle: null,
      displayName: `Chapter ${absoluteTrack}`,
      confidence: 0.7,
    };
  }

  // Disc N Track N format
  const discTrackMatch = title.match(/^(?:Disc|CD)\s*(\d+)\s*(?:Track\s*(\d+))?\s*(.*)$/i);
  if (discTrackMatch) {
    const discNum = parseInt(discTrackMatch[1], 10);
    const trackNum = discTrackMatch[2] ? parseInt(discTrackMatch[2], 10) : 1;
    const remainder = discTrackMatch[3]?.trim() || null;
    const absoluteTrack = (discNum - 1) * 20 + trackNum;

    return {
      original: title,
      trackNumber: absoluteTrack,
      bookTitle: remainder,
      chapterType: 'chapter',
      chapterNumber: absoluteTrack,
      chapterTitle: null,
      displayName: remainder || `Chapter ${absoluteTrack}`,
      confidence: 0.6,
    };
  }

  // Track N or Track## format
  const trackOnly = title.match(/^Track\s*(\d+)\s*(.*)$/i);
  if (trackOnly) {
    const trackNum = parseInt(trackOnly[1], 10);
    const remainder = trackOnly[2]?.trim() || null;
    return {
      original: title,
      trackNumber: trackNum,
      bookTitle: null,
      chapterType: 'chapter',
      chapterNumber: trackNum,
      chapterTitle: remainder,
      displayName: remainder || `Chapter ${trackNum}`,
      confidence: 0.6,
    };
  }

  return null;
}

/**
 * Pattern 7: Number only
 */
function matchNumberOnly(title: string): ParsedChapter | null {
  const numMatch = title.match(/^(\d{1,3})$/);
  if (!numMatch) return null;

  const num = parseInt(numMatch[1], 10);
  return {
    original: title,
    trackNumber: num,
    bookTitle: null,
    chapterType: 'chapter',
    chapterNumber: num,
    chapterTitle: null,
    displayName: `Chapter ${num}`,
    confidence: 0.5,
  };
}

// ============================================================
// MAIN PARSER
// ============================================================

/**
 * Parse a single chapter title and return normalized display name
 */
export function parseChapterTitle(
  title: string,
  options: NormalizerOptions = { level: 'standard' }
): ParsedChapter {
  // Normalize characters first
  const normalized = normalizeCharacters(title);

  // If level is 'off', return as-is
  if (options.level === 'off') {
    return {
      original: title,
      trackNumber: null,
      bookTitle: null,
      chapterType: 'other',
      chapterNumber: null,
      chapterTitle: null,
      displayName: normalized,
      confidence: 1.0,
    };
  }

  // Try patterns in priority order
  let result: ParsedChapter | null = null;

  // 1. Front/Back Matter (always check first)
  result = matchFrontBackMatter(normalized);
  if (result) return result;

  // 2. Track-based patterns (most common - ~50k occurrences)
  result = matchTrackBased(normalized, options.bookTitle);
  if (result) {
    // In 'light' mode, only strip track numbers, keep book title
    if (options.level === 'light' && result.bookTitle) {
      result.displayName = `${result.bookTitle}: ${result.displayName}`;
    }
    return result;
  }

  // 3. Direct chapter patterns
  result = matchDirectChapter(normalized);
  if (result) return result;

  // 4. Part patterns
  result = matchPart(normalized);
  if (result) return result;

  // 5. Book patterns
  result = matchBook(normalized);
  if (result) return result;

  // 6. Disc/Track codes
  result = matchDiscTrack(normalized);
  if (result) return result;

  // 7. Number only
  result = matchNumberOnly(normalized);
  if (result) return result;

  // Fallback: return normalized string
  return {
    original: title,
    trackNumber: null,
    bookTitle: null,
    chapterType: 'other',
    chapterNumber: null,
    chapterTitle: null,
    displayName: normalized,
    confidence: 0.3,
  };
}

// ============================================================
// BATCH PROCESSING & SMART NUMBERING
// ============================================================

/**
 * Cache for normalized chapters to avoid re-parsing on every screen mount.
 * Key format: `${bookTitle || ''}-${level}-${chaptersHash}`
 * Limited to 50 entries to prevent memory bloat.
 */
const chapterCache = new Map<string, ParsedChapter[]>();
const MAX_CACHE_SIZE = 50;

/**
 * Generate a simple hash from chapter titles for cache key
 */
function hashChapterTitles(chapters: string[]): string {
  // Use first title + last title + count for a quick hash
  // This covers most cases without expensive full-array hashing
  if (chapters.length === 0) return '0';
  const first = chapters[0].slice(0, 20);
  const last = chapters[chapters.length - 1].slice(0, 20);
  return `${chapters.length}-${first}-${last}`;
}

/**
 * Normalize an array of chapter titles with smart duplicate handling
 */
export function normalizeChapters(
  chapters: string[],
  options: NormalizerOptions = { level: 'standard' }
): ParsedChapter[] {
  // Generate cache key
  const cacheKey = `${options.bookTitle || ''}-${options.level}-${hashChapterTitles(chapters)}`;

  // Check cache
  const cached = chapterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const parsed = chapters.map((ch) => parseChapterTitle(ch, options));

  // Smart numbering: if all chapters parsed to same display name,
  // append sequential numbers
  const displayNames = parsed.map((p) => p.displayName);
  const allSame = displayNames.every((n) => n === displayNames[0]);

  let result: ParsedChapter[];

  if (allSame && chapters.length > 1) {
    result = parsed.map((p, i) => ({
      ...p,
      displayName: `${p.displayName} ${i + 1}`,
      chapterNumber: i + 1,
    }));
  } else {
    // Check for duplicate display names and disambiguate
    const counts: Record<string, number> = {};
    const seen: Record<string, number> = {};

    for (const p of parsed) {
      counts[p.displayName] = (counts[p.displayName] || 0) + 1;
    }

    result = parsed.map((p) => {
      if (counts[p.displayName] > 1) {
        seen[p.displayName] = (seen[p.displayName] || 0) + 1;
        return {
          ...p,
          displayName: `${p.displayName} (${seen[p.displayName]})`,
        };
      }
      return p;
    });
  }

  // Store in cache (with size limit)
  if (chapterCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first key)
    const firstKey = chapterCache.keys().next().value;
    if (firstKey) chapterCache.delete(firstKey);
  }
  chapterCache.set(cacheKey, result);

  return result;
}

/**
 * Get a single normalized chapter display name (convenience function)
 */
export function getCleanChapterName(
  title: string,
  level: NormalizerOptions['level'] = 'standard'
): string {
  return parseChapterTitle(title, { level }).displayName;
}
