/**
 * src/shared/utils/bookDNA/index.ts
 *
 * Barrel export for BookDNA utilities.
 */

export {
  parseBookDNA,
  getDNAQuality,
  hasMoodScores,
  getDNAMoodScore,
  DNA_QUALITY_THRESHOLDS,
  getDNASummary,
  parseComparableTitles,
  calculateDNACompleteness,
  parseContentWarnings,
  getAgeGroup,
  isChildrensBook,
  normalizeTrope,
  normalizeTheme,
} from './parseBookDNA';

export type {
  BookDNA,
  Mood,
  ContentWarningCategory,
  AgeGroup,
} from './parseBookDNA';

export {
  scoreBookByVibe,
  parseCompVibes,
  formatCompVibe,
} from './vibeScoring';

export {
  scoreFeelingChip,
  filterByFeeling,
  clearFeelingCache,
} from './feelingScoring';
