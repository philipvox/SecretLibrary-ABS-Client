/**
 * src/features/library/components/FannedSeriesCard.tsx
 *
 * Re-exports the unified SeriesCard from shared components.
 * This file exists for backward compatibility with existing imports.
 *
 * @deprecated Import SeriesCard from '@/shared/components' instead
 */

import { SeriesCard } from '@/shared/components/SeriesCard';

// Re-export as both names for backward compatibility
export { SeriesCard as FannedSeriesCard };
export default SeriesCard;

// Also re-export types
export type {
  SeriesCardProps,
  SeriesData,
  SeriesBook,
} from '@/shared/components/SeriesCard';

// Type alias for backward compatibility
export type FannedSeriesCardData = {
  name: string;
  books?: { id: string }[];
  bookCount?: number;
};
