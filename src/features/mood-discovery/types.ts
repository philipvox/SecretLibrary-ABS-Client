/**
 * src/features/mood-discovery/types.ts
 *
 * Types for the 4-Step Discovery Quiz.
 * Uses orthogonal dimensions for precise recommendations:
 * 1. Mood - What emotional experience you want (required)
 * 2. Pace - How fast the story moves (optional)
 * 3. Weight - How emotionally demanding (optional)
 * 4. World - Setting and reality type (optional)
 */

// ============================================================================
// STEP 1: MOOD (Required)
// ============================================================================

/**
 * Mood represents the primary emotional experience the user is seeking.
 * This is the core filter - every book must match the mood.
 * Reduced to 4 core moods for simpler UX.
 */
export type Mood =
  | 'comfort'   // Warm and reassuring
  | 'thrills'   // Edge-of-your-seat tension
  | 'escape'    // Transported to another world
  | 'feels';    // Emotionally powerful

export interface MoodConfig {
  id: Mood;
  label: string;
  icon: string;
  iconSet: 'lucide';
  description: string;
}

export const MOODS: MoodConfig[] = [
  {
    id: 'comfort',
    label: 'Comfort',
    icon: 'Armchair',
    iconSet: 'lucide',
    description: 'Cozy, warm, familiar',
  },
  {
    id: 'thrills',
    label: 'Thrills',
    icon: 'Zap',
    iconSet: 'lucide',
    description: 'Heart racing, page-turner',
  },
  {
    id: 'escape',
    label: 'Escape',
    icon: 'Sparkles',
    iconSet: 'lucide',
    description: 'Another world entirely',
  },
  {
    id: 'feels',
    label: 'Feels',
    icon: 'Heart',
    iconSet: 'lucide',
    description: 'Emotional and moving',
  },
];

// ============================================================================
// STEP 2: PACE (Optional)
// ============================================================================

/**
 * Pace determines how fast the story moves.
 * Affects listening context fit (commuting vs bedtime).
 */
export type Pace = 'slow' | 'steady' | 'fast' | 'any';

export interface PaceConfig {
  id: Pace;
  label: string;
  icon: string;
  iconSet: 'lucide';
  description: string;
  isDefault?: boolean;
}

export const PACES: PaceConfig[] = [
  {
    id: 'slow',
    label: 'Slow burn',
    icon: 'Moon',
    iconSet: 'lucide',
    description: 'Leisurely, atmospheric',
  },
  {
    id: 'steady',
    label: 'Steady',
    icon: 'Activity',
    iconSet: 'lucide',
    description: 'Balanced pace',
  },
  {
    id: 'fast',
    label: 'Fast',
    icon: 'Flame',
    iconSet: 'lucide',
    description: 'Page-turner',
  },
  {
    id: 'any',
    label: 'Surprise me',
    icon: 'Shuffle',
    iconSet: 'lucide',
    description: 'Mix it up',
    // Tier 2.2: Removed isDefault - no pre-selection
  },
];

// ============================================================================
// STEP 3: WEIGHT (Optional)
// ============================================================================

/**
 * Weight is about emotional and cognitive demand.
 * How much energy does the book require?
 */
export type Weight = 'light' | 'balanced' | 'heavy' | 'any';

export interface WeightConfig {
  id: Weight;
  label: string;
  icon: string;
  iconSet: 'lucide';
  description: string;
  isDefault?: boolean;
}

export const WEIGHTS: WeightConfig[] = [
  {
    id: 'light',
    label: 'Light',
    icon: 'Sun',
    iconSet: 'lucide',
    description: 'Feel-good, uplifting',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    icon: 'CloudSun',
    iconSet: 'lucide',
    description: 'Mix of light and dark',
  },
  {
    id: 'heavy',
    label: 'Heavy',
    icon: 'CloudRain',
    iconSet: 'lucide',
    description: 'Intense, emotional',
  },
  {
    id: 'any',
    label: 'Surprise me',
    icon: 'Shuffle',
    iconSet: 'lucide',
    description: 'Mix it up',
    // Tier 2.2: Removed isDefault - no pre-selection
  },
];

// ============================================================================
// STEP 4: WORLD (Optional)
// ============================================================================

/**
 * World determines the setting/genre family.
 */
export type World = 'contemporary' | 'historical' | 'fantasy' | 'scifi' | 'any';

export interface WorldConfig {
  id: World;
  label: string;
  icon: string;
  iconSet: 'lucide';
  description: string;
  isDefault?: boolean;
}

export const WORLDS: WorldConfig[] = [
  {
    id: 'contemporary',
    label: 'Modern',
    icon: 'Building2',
    iconSet: 'lucide',
    description: 'Present day',
  },
  {
    id: 'historical',
    label: 'Historical',
    icon: 'Castle',
    iconSet: 'lucide',
    description: 'Past eras',
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    icon: 'Wand2',
    iconSet: 'lucide',
    description: 'Magic and myth',
  },
  {
    id: 'scifi',
    label: 'Sci-Fi',
    icon: 'Rocket',
    iconSet: 'lucide',
    description: 'Future and space',
  },
  {
    id: 'any',
    label: 'Surprise me',
    icon: 'Shuffle',
    iconSet: 'lucide',
    description: 'Any setting',
    // Tier 2.2: Removed isDefault - no pre-selection
  },
];

// ============================================================================
// STEP 5: LENGTH PREFERENCE (Optional)
// ============================================================================

export type LengthPreference = 'short' | 'medium' | 'long' | 'any';

export interface LengthConfig {
  id: LengthPreference;
  label: string;
  icon: string;
  iconSet: 'lucide';
  description: string;
  minHours?: number;
  maxHours?: number;
  isDefault?: boolean;
}

export const LENGTHS: LengthConfig[] = [
  {
    id: 'short',
    label: 'Short',
    icon: 'Timer',
    iconSet: 'lucide',
    description: 'Under 6 hours',
    maxHours: 6,
  },
  {
    id: 'medium',
    label: 'Medium',
    icon: 'Clock',
    iconSet: 'lucide',
    description: '6-12 hours',
    minHours: 6,
    maxHours: 12,
  },
  {
    id: 'long',
    label: 'Long',
    icon: 'BookOpen',
    iconSet: 'lucide',
    description: '12+ hours',
    minHours: 12,
  },
  {
    id: 'any',
    label: 'Surprise me',
    icon: 'Shuffle',
    iconSet: 'lucide',
    description: 'Any length',
    // Tier 2.2: Removed isDefault - no pre-selection
  },
];

// Legacy export for backwards compatibility
export const LENGTH_OPTIONS = LENGTHS;

// ============================================================================
// MOOD SESSION
// ============================================================================

/**
 * A mood session captures the user's current preferences.
 * Sessions have soft and hard expiry (Tier 2.4):
 * - Soft (24hr): Results accessible, prompts refresh
 * - Hard (48hr): Session fully expires
 */
export interface MoodSession {
  /** Primary mood (required) */
  mood: Mood;
  /** Flavor/sub-category based on mood (Step 2) */
  flavor: string | null;
  /** Seed book ID - "book you wish you could read again" (Step 3) */
  seedBookId: string | null;
  /** Pace preference */
  pace: Pace;
  /** Weight preference */
  weight: Weight;
  /** World preference */
  world: World;
  /** Length preference (can be adjusted on results) */
  length: LengthPreference;
  /** Whether to exclude children's/juvenile books */
  excludeChildrens: boolean;
  /** When the session was created (timestamp) */
  createdAt: number;
  /** When the session soft-expires (Tier 2.4) - prompts refresh but results accessible */
  softExpiresAt: number;
  /** When the session fully expires (timestamp) */
  expiresAt: number;
}

/**
 * Default session duration in milliseconds (24 hours)
 */
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Soft expiry duration (Tier 2.4)
 * After this time, session becomes "soft" (results accessible but prompts refresh)
 */
export const SESSION_SOFT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Hard expiry duration (Tier 2.4)
 * After this time, session is fully expired
 */
export const SESSION_HARD_EXPIRY_MS = 48 * 60 * 60 * 1000;

/**
 * Session state (Tier 2.4)
 * - active: Normal state, results are fresh
 * - soft: Session is stale, shows "Refresh your mood?" but results accessible
 * - expired: Session is gone, must start new quiz
 */
export type SessionState = 'active' | 'soft' | 'expired';

// ============================================================================
// GENRE MAPPINGS
// ============================================================================

/**
 * Maps moods to genre keywords for filtering/scoring.
 */
export const MOOD_GENRE_MAP: Record<Mood, string[]> = {
  comfort: [
    'cozy',
    'cozy mystery',
    'romance',
    'contemporary romance',
    'women\'s fiction',
    'slice of life',
    'heartwarming',
    'feel-good',
    'comfort read',
    'sweet romance',
    'light romance',
    'humor',        // Absorbed from laughs
    'lighthearted',
    'funny',
  ],
  thrills: [
    'thriller',
    'mystery',
    'suspense',
    'crime',
    'detective',
    'spy',
    'psychological thriller',
    'police procedural',
    'legal thriller',
    'conspiracy',
    'action',
  ],
  escape: [
    'fantasy',
    'science fiction',
    'adventure',
    'epic fantasy',
    'urban fantasy',
    'space opera',
    'portal fantasy',
    'world-building',
    'immersive',
    'atmospheric',
  ],
  feels: [
    'emotional',
    'drama',
    'literary fiction',
    'family saga',
    'love story',
    'grief',
    'coming of age',
    'bittersweet',
    'tearjerker',
    'moving',
    'thought-provoking', // Absorbed from thinking
    'philosophical',
    'reflective',
  ],
};

/**
 * Maps pace to indicators in book metadata/description.
 */
export const PACE_INDICATORS: Record<Exclude<Pace, 'any'>, string[]> = {
  slow: [
    'slow burn',
    'literary',
    'character study',
    'atmospheric',
    'meditative',
    'leisurely',
    'introspective',
    'contemplative',
  ],
  steady: [
    'well-paced',
    'balanced',
    'engaging',
  ],
  fast: [
    'page-turner',
    'fast-paced',
    'action-packed',
    'propulsive',
    'gripping',
    'unputdownable',
    'quick read',
    'thriller',
  ],
};

/**
 * Maps weight to indicators in book metadata/description.
 */
export const WEIGHT_INDICATORS: Record<Exclude<Weight, 'any'>, string[]> = {
  light: [
    'light',
    'easy read',
    'beach read',
    'comfort read',
    'feel-good',
    'lighthearted',
    'fun',
    'escapist',
    'cozy',
  ],
  balanced: [
    'engaging',
    'compelling',
    'well-crafted',
  ],
  heavy: [
    'dark',
    'intense',
    'gritty',
    'heavy',
    'challenging',
    'difficult',
    'brutal',
    'devastating',
    'heartbreaking',
    'raw',
    'unflinching',
  ],
};

/**
 * Maps world settings to genre keywords.
 */
export const WORLD_GENRE_MAP: Record<Exclude<World, 'any'>, string[]> = {
  contemporary: [
    'contemporary',
    'modern',
    'realistic',
    'literary fiction',
    'thriller',
    'mystery',
    'romance',
    'drama',
    'urban',
  ],
  historical: [
    'historical',
    'historical fiction',
    'period',
    'regency',
    'victorian',
    'medieval',
    'world war',
    'ancient',
    '19th century',
    '20th century',
  ],
  fantasy: [
    'fantasy',
    'epic fantasy',
    'urban fantasy',
    'paranormal',
    'mythology',
    'fairy tale',
    'magic',
    'magical realism',
    'dragons',
  ],
  scifi: [
    'sci-fi',
    'science fiction',
    'space opera',
    'cyberpunk',
    'dystopian',
    'post-apocalyptic',
    'time travel',
    'aliens',
    'space',
  ],
};

// ============================================================================
// THEMES & TROPES MAPPING
// ============================================================================

/**
 * Maps common book themes to moods for enhanced scoring.
 */
export const THEME_MOOD_MAP: Record<string, Mood[]> = {
  // Comfort themes
  'found family': ['comfort', 'feels'],
  'friendship': ['comfort'],
  'healing': ['comfort', 'feels'],
  'community': ['comfort'],
  'second chances': ['comfort', 'feels'],
  'small town': ['comfort'],
  'love': ['comfort', 'feels'],
  'hope': ['comfort', 'feels'],
  'humor': ['comfort'],
  'whimsy': ['comfort'],

  // Thrills themes
  'survival': ['thrills', 'feels'],
  'revenge': ['thrills', 'feels'],
  'conspiracy': ['thrills'],
  'justice': ['thrills', 'feels'],
  'danger': ['thrills'],
  'secrets': ['thrills'],
  'betrayal': ['thrills', 'feels'],
  'race against time': ['thrills'],

  // Escape themes
  'adventure': ['escape', 'thrills'],
  'quest': ['escape', 'thrills'],
  'exploration': ['escape'],
  'magic': ['escape', 'comfort'],
  'world-building': ['escape'],
  'destiny': ['escape', 'feels'],

  // Feels themes
  'grief': ['feels'],
  'loss': ['feels'],
  'sacrifice': ['feels', 'escape'],
  'redemption': ['feels'],
  'family': ['feels', 'comfort'],
  'forgiveness': ['feels'],
  'trauma': ['feels'],
  'coming of age': ['feels'],
  'morality': ['feels'],
  'identity': ['feels'],
  'human nature': ['feels'],
  'philosophy': ['feels'],
  'absurdity': ['feels', 'comfort'],
  'satire': ['feels'],
  'power': ['feels', 'escape'],
  'corruption': ['feels', 'thrills'],
  'society': ['feels'],
  'free will': ['feels'],
};

/**
 * Maps common book tropes to moods for enhanced scoring.
 */
export const TROPE_MOOD_MAP: Record<string, Mood[]> = {
  // Comfort tropes
  'found family': ['comfort', 'feels'],
  'slow burn': ['comfort', 'feels'],
  'friends to lovers': ['comfort', 'feels'],
  'small town romance': ['comfort'],
  'cozy mystery': ['comfort', 'thrills'],
  'fake dating': ['comfort'],
  'romcom': ['comfort'],
  'fish out of water': ['comfort'],
  'mistaken identity': ['comfort'],

  // Thrills tropes
  'unreliable narrator': ['thrills'],
  'whodunit': ['thrills'],
  'locked room mystery': ['thrills'],
  'cat and mouse': ['thrills'],
  'heist': ['thrills'],
  'political intrigue': ['thrills'],
  'reluctant hero': ['thrills', 'feels'],
  'antihero': ['thrills', 'feels'],
  'twist ending': ['thrills'],

  // Escape tropes
  'chosen one': ['escape'],
  'portal fantasy': ['escape'],
  'magic system': ['escape'],
  'dragons': ['escape'],
  'quest': ['escape', 'thrills'],
  'prophecy': ['escape'],

  // Feels tropes
  'enemies to lovers': ['feels', 'comfort'],
  'road trip': ['feels', 'comfort'],
  'star-crossed lovers': ['feels'],
  'forbidden love': ['feels'],
  'second chance romance': ['feels', 'comfort'],
  'redemption arc': ['feels'],
  'tragic backstory': ['feels'],
  'bittersweet ending': ['feels'],
  'morally grey': ['feels'],
  'allegory': ['feels'],
  'social commentary': ['feels'],
};

// ============================================================================
// SCORING TYPES
// ============================================================================

/**
 * Score breakdown for a book recommendation
 */
export interface MoodScore {
  /** Total score (higher = better match) */
  total: number;
  /** Score from primary mood matching */
  moodScore: number;
  /** Score from pace matching */
  paceScore: number;
  /** Score from weight matching */
  weightScore: number;
  /** Score from world matching */
  worldScore: number;
  /** Score from length matching */
  lengthScore: number;
  /** Bonus from theme matching */
  themeScore: number;
  /** Bonus from trope matching */
  tropeScore: number;
  /** Whether this is a primary mood match (vs secondary) */
  isPrimaryMoodMatch: boolean;
}

/**
 * Confidence level for a recommendation (Tier 2.3)
 * Based on metadata richness of the book
 */
export type MatchConfidence = 'high' | 'medium' | 'low';

/**
 * A book with its mood match score
 */
export interface ScoredBook {
  /** Full library item */
  item: import('@/core/types').LibraryItem;
  /** Calculated mood score */
  score: MoodScore;
  /** Match percentage (0-100) */
  matchPercent: number;
  /** Confidence in the match based on metadata richness (Tier 2.3) */
  confidence: MatchConfidence;
  /** Whether this book has BookDNA tags for accurate scoring */
  hasDNA?: boolean;
  /** Reasons why this book matched (for UI display) */
  matchReasons?: string[];
  /** Boost from user's reading history preferences */
  preferenceBoost?: number;
  /** Boost from similarity to seed book */
  seedSimilarityBoost?: number;
  /** Final score with all boosts applied (used for sorting) */
  boostedScore: number;
}

// ============================================================================
// DNA SCORING OPTIONS
// ============================================================================

/**
 * Options for DNA-aware mood recommendations.
 * Controls how books without BookDNA are handled.
 */
export type DNAFilterMode =
  | 'dna-only'      // Only show books WITH BookDNA tags (strictest)
  | 'dna-preferred' // Show DNA books first, then non-DNA books (default)
  | 'mixed';        // Mix DNA and non-DNA books by score only

// ============================================================================
// TIER 2.1: BRANCHING QUIZ LOGIC
// ============================================================================

/**
 * Follow-up dimension types for branching quiz
 */
export type FollowupDimension = 'pace' | 'weight' | 'world' | 'length';

/**
 * Maps each mood to its most relevant follow-up question.
 * This reduces the quiz from 5 steps to 2-3 by asking only what matters most.
 *
 * Rationale:
 * - thrills → Pace: Fast vs slow-burn thriller matters most
 * - comfort → Weight: Cozy vs bittersweet makes the biggest difference
 * - escape → World: Fantasy vs scifi vs historical is the key differentiator
 * - thinking → Length: Essay vs deep-dive determines the experience
 * - feels → Weight: Tearjerker vs hopeful matters most for emotional books
 * - laughs → Pace: Quick wit vs slow comedy changes the vibe
 */
export const MOOD_FOLLOWUP_MAP: Record<Mood, FollowupDimension> = {
  thrills: 'pace',
  comfort: 'weight',
  escape: 'world',
  feels: 'weight',
};

/**
 * Follow-up question config for each dimension
 */
export const FOLLOWUP_CONFIG: Record<FollowupDimension, { question: string; subtitle: string; label: string }> = {
  pace: {
    question: 'How fast should it move?',
    subtitle: 'Pick your tempo',
    label: 'PACE',
  },
  weight: {
    question: 'How heavy or light?',
    subtitle: 'Pick your tone',
    label: 'TONE',
  },
  world: {
    question: 'What kind of world?',
    subtitle: 'Pick your setting',
    label: 'SETTING',
  },
  length: {
    question: 'How long?',
    subtitle: 'Pick your commitment',
    label: 'LENGTH',
  },
};

// ============================================================================
// FLAVOR OPTIONS (Step 2 - Drill-down)
// ============================================================================

/**
 * Flavor config for mood drill-down options.
 */
export interface FlavorConfig {
  id: string;
  label: string;
  icon: string;
  iconSet: 'lucide';
  description: string;
  /** Tags/tropes that match this flavor */
  matchTags: string[];
}

/**
 * Flavor options for each mood.
 * These are sub-categories that refine the mood selection.
 */
export const MOOD_FLAVORS: Record<Mood, FlavorConfig[]> = {
  thrills: [
    { id: 'heist', label: 'Heists', icon: 'Vault', iconSet: 'lucide', description: 'Clever cons & capers', matchTags: ['heist', 'con artist', 'caper', 'theft'] },
    { id: 'cat-mouse', label: 'Cat & Mouse', icon: 'Crosshair', iconSet: 'lucide', description: 'Hunter vs hunted', matchTags: ['cat and mouse', 'pursuit', 'chase', 'hunter'] },
    { id: 'conspiracy', label: 'Conspiracy', icon: 'Network', iconSet: 'lucide', description: 'Deep rabbit holes', matchTags: ['conspiracy', 'political thriller', 'cover-up', 'secrets'] },
    { id: 'survival', label: 'Survival', icon: 'Mountain', iconSet: 'lucide', description: 'Against all odds', matchTags: ['survival', 'stranded', 'apocalypse', 'disaster'] },
  ],
  comfort: [
    { id: 'cozy-mystery', label: 'Cozy Mystery', icon: 'Search', iconSet: 'lucide', description: 'Low stakes sleuthing', matchTags: ['cozy mystery', 'amateur sleuth', 'village mystery'] },
    { id: 'small-town', label: 'Small Town', icon: 'TreePine', iconSet: 'lucide', description: 'Community warmth', matchTags: ['small town', 'community', 'slice of life'] },
    { id: 'second-chance', label: 'Second Chances', icon: 'RotateCcw', iconSet: 'lucide', description: 'Fresh starts', matchTags: ['second chance', 'starting over', 'redemption'] },
    { id: 'comfort-food', label: 'Comfort Food', icon: 'Coffee', iconSet: 'lucide', description: 'Warm & familiar', matchTags: ['comfort read', 'feel-good', 'heartwarming', 'cozy'] },
  ],
  escape: [
    { id: 'epic-quest', label: 'Epic Quest', icon: 'Compass', iconSet: 'lucide', description: 'Grand adventures', matchTags: ['quest', 'epic fantasy', 'adventure', 'journey'] },
    { id: 'magic-system', label: 'Magic Systems', icon: 'Sparkles', iconSet: 'lucide', description: 'Rules of wonder', matchTags: ['hard magic', 'magic system', 'magical'] },
    { id: 'portal', label: 'Portal Fantasy', icon: 'DoorOpen', iconSet: 'lucide', description: 'New worlds', matchTags: ['portal fantasy', 'isekai', 'transported'] },
    { id: 'space-opera', label: 'Space Opera', icon: 'Rocket', iconSet: 'lucide', description: 'Galaxy-spanning', matchTags: ['space opera', 'space', 'galactic', 'sci-fi'] },
  ],
  feels: [
    { id: 'redemption', label: 'Earned Redemption', icon: 'Sunrise', iconSet: 'lucide', description: 'Flawed heroes', matchTags: ['redemption arc', 'redemption', 'atonement'] },
    { id: 'grief', label: 'Beautiful Grief', icon: 'CloudRain', iconSet: 'lucide', description: 'Cathartic tears', matchTags: ['grief', 'loss', 'healing', 'tearjerker'] },
    { id: 'forbidden', label: 'Forbidden Love', icon: 'Lock', iconSet: 'lucide', description: 'Against all obstacles', matchTags: ['forbidden love', 'star-crossed', 'enemies to lovers'] },
    { id: 'family', label: 'Family Saga', icon: 'Home', iconSet: 'lucide', description: 'Generational stories', matchTags: ['family saga', 'family drama', 'multi-generational'] },
  ],
};

// ============================================================================
// QUIZ STATE
// ============================================================================

/**
 * Current step in the discovery quiz (3 steps):
 * Step 1: Mood selection (required) - "What are you in the mood for?"
 * Step 2: Flavor drill-down (optional) - Sub-categories for chosen mood
 * Step 3: Seed book (optional) - "What book do you wish you could read again?"
 */
export type QuizStep = 1 | 2 | 3;

/**
 * Total number of steps in the quiz
 */
export const TOTAL_QUIZ_STEPS = 3;

/**
 * Draft state while user is going through the quiz
 */
export interface QuizDraft {
  mood: Mood | null;
  flavor: string | null;       // Selected flavor from MOOD_FLAVORS
  seedBookId: string | null;   // Book ID for "read again" selection
  pace: Pace | null;
  weight: Weight | null;
  world: World | null;
  length: LengthPreference | null;
  excludeChildrens: boolean;
  currentStep: QuizStep;
}

/**
 * Initial draft state with no pre-selection
 */
export const INITIAL_QUIZ_DRAFT: QuizDraft = {
  mood: null,
  flavor: null,
  seedBookId: null,
  pace: null,
  weight: null,
  world: null,
  length: null,
  excludeChildrens: false,
  currentStep: 1,
};

// ============================================================================
// LEGACY COMPATIBILITY (for existing code during migration)
// ============================================================================

// These types are kept for backwards compatibility during migration
export type Vibe = Mood;
export type WorldSetting = World;
export const VIBES = MOODS;
export const WORLD_OPTIONS = WORLDS;
export const VIBE_GENRE_MAP = MOOD_GENRE_MAP;
