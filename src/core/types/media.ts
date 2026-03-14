/**
 * src/core/types/media.ts
 * 
 * TypeScript interfaces for media-related models (books, podcasts, audio files).
 */

import { AudioFile, EbookFile } from './files';
import { Author, Series } from './metadata';

/**
 * Book media information
 */
export interface BookMedia {
  id: string;
  metadata: BookMetadata;
  coverPath?: string;
  tags: string[];
  audioFiles?: AudioFile[];   // Optional: not included in library items list API
  chapters?: BookChapter[];   // Optional: not included in library items list API
  numTracks?: number;         // Included in library items list API instead of audioFiles
  numAudioFiles?: number;     // Included in library items list API instead of audioFiles
  numChapters?: number;       // Included in library items list API instead of chapters
  ebookFile?: EbookFile;
  duration: number;
  size: number;
}

/**
 * Book metadata
 */
export interface BookMetadata {
  title: string;
  subtitle?: string;
  authors: Author[];
  narrators: string[];
  series: SeriesSequence[];
  genres: string[];
  publishedYear?: string;
  publishedDate?: string;
  publisher?: string;
  description?: string;
  isbn?: string;
  asin?: string;
  language?: string;
  explicit: boolean;
  // Computed field from server - "Series Name #1" format
  seriesName?: string;
  // Computed field from server - first author name for display
  authorName?: string;
  // Computed field from server - first narrator name for display
  narratorName?: string;
  // Optional rating fields (if ratings are enabled on server)
  rating?: number;
  ratingCount?: number;
}

/**
 * Book chapter
 */
export interface BookChapter {
  id: number;
  start: number;
  end: number;
  title: string;
}

/**
 * Podcast media information
 */
export interface PodcastMedia {
  id: string;
  metadata: PodcastMetadata;
  coverPath?: string;
  tags: string[];
  episodes: PodcastEpisode[];
  autoDownloadEpisodes: boolean;
  autoDownloadSchedule?: string;
  lastEpisodeCheck?: number;
  maxEpisodesToKeep: number;
  maxNewEpisodesToDownload: number;
  // Optional duration - computed from episodes when needed
  duration?: number;
  // Optional for compatibility with BookMedia properties
  audioFiles?: never[];
  chapters?: never[];
}

/**
 * Podcast metadata
 */
export interface PodcastMetadata {
  title: string;
  author?: string;
  description?: string;
  releaseDate?: string;
  genres: string[];
  feedUrl?: string;
  imageUrl?: string;
  itunesPageUrl?: string;
  itunesId?: string;
  itunesArtistId?: string;
  explicit: boolean;
  language?: string;
  type?: string;
}

/**
 * Podcast episode
 */
export interface PodcastEpisode {
  libraryItemId: string;
  id: string;
  index: number;
  season?: string;
  episode?: string;
  episodeType?: string;
  title: string;
  subtitle?: string;
  description?: string;
  enclosure?: EpisodeEnclosure;
  pubDate?: string;
  audioFile?: AudioFile;
  publishedAt?: number;
  addedAt: number;
  updatedAt: number;
}

/**
 * Episode enclosure (download info)
 */
export interface EpisodeEnclosure {
  url: string;
  type: string;
  length?: string;
}

/**
 * Media playback progress
 */
export interface MediaProgress {
  id: string;
  libraryItemId: string;
  episodeId?: string;
  duration: number;
  progress: number;
  currentTime: number;
  isFinished: boolean;
  hideFromContinueListening: boolean;
  lastUpdate: number;
  startedAt: number;
  finishedAt?: number;
}

/**
 * Bookmark for a specific time in media
 */
export interface Bookmark {
  libraryItemId: string;
  title: string;
  time: number;
  createdAt: number;
}

/**
 * Series with sequence number (for books in multiple series)
 */
export interface SeriesSequence {
  id: string;
  name: string;
  sequence?: string;
}

/**
 * Active playback session
 */
export interface PlaybackSession {
  id: string;
  userId: string;
  libraryId: string;
  libraryItemId: string;
  episodeId?: string;
  mediaType: 'book' | 'podcast';
  mediaMetadata: BookMetadata | PodcastMetadata;
  chapters: BookChapter[];
  displayTitle: string;
  displayAuthor: string;
  coverPath?: string;
  duration: number;
  playMethod: number;
  mediaPlayer: string;
  deviceInfo: any; // Using any temporarily to avoid circular dependency
  serverVersion: string;
  date: string;
  dayOfWeek: string;
  timeListening: number;
  startTime: number;
  currentTime: number;
  startedAt: number;
  updatedAt: number;
}
