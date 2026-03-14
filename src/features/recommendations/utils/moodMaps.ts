/**
 * src/features/recommendations/utils/moodMaps.ts
 *
 * Genre/indicator maps for mood-based scoring.
 * Extracted from the removed mood-discovery types for use by comprehensiveScoring.
 */

import { Mood } from '@/shared/utils/bookDNA';

type Pace = 'slow' | 'steady' | 'fast';
type Weight = 'light' | 'balanced' | 'heavy';
type World = 'contemporary' | 'historical' | 'fantasy' | 'scifi';

export const MOOD_GENRE_MAP: Record<Mood, string[]> = {
  comfort: ['cozy', 'cozy mystery', 'romance', 'contemporary romance', "women's fiction", 'slice of life', 'heartwarming', 'feel-good', 'comfort read', 'sweet romance', 'light romance', 'humor', 'lighthearted', 'funny'],
  thrills: ['thriller', 'mystery', 'suspense', 'crime', 'detective', 'spy', 'psychological thriller', 'police procedural', 'legal thriller', 'conspiracy', 'action'],
  escape: ['fantasy', 'science fiction', 'adventure', 'epic fantasy', 'urban fantasy', 'space opera', 'portal fantasy', 'world-building', 'immersive', 'atmospheric'],
  feels: ['emotional', 'drama', 'literary fiction', 'family saga', 'love story', 'grief', 'coming of age', 'bittersweet', 'tearjerker', 'moving', 'thought-provoking', 'philosophical', 'reflective'],
};

export const PACE_INDICATORS: Record<Pace, string[]> = {
  slow: ['slow burn', 'literary', 'character study', 'atmospheric', 'meditative', 'leisurely', 'introspective', 'contemplative'],
  steady: ['well-paced', 'balanced', 'engaging'],
  fast: ['page-turner', 'fast-paced', 'action-packed', 'propulsive', 'gripping', 'unputdownable', 'quick read', 'thriller'],
};

export const WEIGHT_INDICATORS: Record<Weight, string[]> = {
  light: ['light', 'easy read', 'beach read', 'comfort read', 'feel-good', 'lighthearted', 'fun', 'escapist', 'cozy'],
  balanced: ['engaging', 'compelling', 'well-crafted'],
  heavy: ['dark', 'intense', 'gritty', 'heavy', 'challenging', 'difficult', 'brutal', 'devastating', 'heartbreaking', 'raw', 'unflinching'],
};

export const WORLD_GENRE_MAP: Record<World, string[]> = {
  contemporary: ['contemporary', 'modern', 'realistic', 'literary fiction', 'thriller', 'mystery', 'romance', 'drama', 'urban'],
  historical: ['historical', 'historical fiction', 'period', 'regency', 'victorian', 'medieval', 'world war', 'ancient', '19th century', '20th century'],
  fantasy: ['fantasy', 'epic fantasy', 'urban fantasy', 'paranormal', 'mythology', 'fairy tale', 'magic', 'magical realism', 'dragons'],
  scifi: ['sci-fi', 'science fiction', 'space opera', 'cyberpunk', 'dystopian', 'post-apocalyptic', 'time travel', 'aliens', 'space'],
};
