// Re-export metadata utilities (but not formatDuration to avoid conflict with format.ts)
export {
  extractBookMetadata,
  getAuthorName,
  getNarratorName,
  getNarratorNames,
  getDescription,
  getTitle,
  getDuration,
  getFormattedDuration,
  getSeriesName,
  getSeriesWithSequence,
  getPublishedYear,
  getGenres,
  type BookMetadataExtracted,
} from './metadata';
// Re-export audioDebug except formatDuration (use format.ts version)
export {
  audioLog,
  startTiming,
  endTiming,
  createTimer,
  logSection,
  logObject,
  TrackPlayerStateNames,
  getStateName,
  validateUrl,
  testUrlAccessibility,
  logChapters,
  logTracks,
  createDebugContext,
  logPositionSources,
  logDurationSources,
} from './audioDebug';
export * from './format';
export * from './logger';