/**
 * src/core/types/metadata.ts
 *
 * TypeScript interfaces for metadata models (authors, series, narrators).
 */

// Use 'import type' to avoid runtime circular dependency
// Types are erased at compile time so this doesn't cause import cycles
import type { LibraryItem } from './library';

/**
 * Author information
 */
export interface Author {
  id: string;
  asin?: string;
  name: string;
  description?: string;
  imagePath?: string;
  addedAt: number;
  updatedAt: number;
}

/**
 * Series information
 */
export interface Series {
  id: string;
  name: string;
  description?: string;
  addedAt: number;
  updatedAt: number;
  books?: LibraryItem[];
}
