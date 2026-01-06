/**
 * src/features/narrator/components/NarratorCard.tsx
 *
 * Card displaying narrator information with book count.
 * Re-exports unified EntityCard from shared components.
 *
 * @deprecated Import EntityCard from '@/shared/components' instead
 */

import React, { memo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { EntityCard, EntityCardProps } from '@/shared/components/EntityCard';
import { NarratorInfo } from '../services/narratorAdapter';

interface NarratorCardProps {
  narrator: NarratorInfo;
}

function NarratorCardComponent({ narrator }: NarratorCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    (navigation as any).navigate('NarratorDetail', { narratorName: narrator.name });
  };

  return (
    <EntityCard
      type="narrator"
      name={narrator.name}
      bookCount={narrator.bookCount}
      onPress={handlePress}
    />
  );
}

// Memoize to prevent unnecessary re-renders in lists
export const NarratorCard = memo(NarratorCardComponent);

// Backward compatibility alias
export { NarratorCard as default };

// Re-export EntityCard type for backward compatibility
export type { EntityCardProps as NarratorCardBaseProps };
