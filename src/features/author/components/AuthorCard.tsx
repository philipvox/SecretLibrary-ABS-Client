/**
 * src/features/author/components/AuthorCard.tsx
 *
 * Card displaying author information with book count.
 * Re-exports unified EntityCard from shared components.
 *
 * @deprecated Import EntityCard from '@/shared/components' instead
 */

import React, { memo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { EntityCard, EntityCardProps } from '@/shared/components/EntityCard';
import { apiClient } from '@/core/api';
import type { Author } from '@/core/types';

interface AuthorInfo {
  id: string;
  name: string;
  description?: string;
  imagePath?: string;
  bookCount?: number;
}

interface AuthorCardProps {
  author: AuthorInfo | Author;
}

function AuthorCardComponent({ author }: AuthorCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    (navigation as any).navigate('AuthorDetail', { authorName: author.name });
  };

  const imageUrl = author.imagePath
    ? apiClient.getAuthorImageUrl(author.id)
    : undefined;

  const bookCount = (author as AuthorInfo).bookCount ?? 0;

  return (
    <EntityCard
      type="author"
      id={author.id}
      name={author.name}
      bookCount={bookCount}
      imageUrl={imageUrl}
      onPress={handlePress}
    />
  );
}

// Memoize to prevent unnecessary re-renders in lists
export const AuthorCard = memo(AuthorCardComponent);

// Re-export EntityCard type for backward compatibility
export type { EntityCardProps as AuthorCardBaseProps };
