/**
 * src/features/collections/screens/CollectionDetailScreen.tsx
 *
 * Collection detail screen with stacked covers hero, stats, and book list.
 * Matches dark theme design pattern.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useCollectionDetails } from '../hooks/useCollectionDetails';
import { BookCard } from '@/shared/components/BookCard';
import { apiClient } from '@/core/api';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale, wp } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);

const BG_COLOR = colors.backgroundTertiary;
const ACCENT = colors.accent;

type CollectionDetailRouteParams = {
  CollectionDetail: {
    collectionId: string;
  };
};

type CollectionDetailRouteProp = RouteProp<CollectionDetailRouteParams, 'CollectionDetail'>;

// Format duration helper
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Stacked covers component for hero section
function StackedCovers({ coverUrls }: { coverUrls: string[] }) {
  const coverWidth = scale(100);
  const coverHeight = coverWidth * 1.4;

  if (coverUrls.length === 0) {
    return (
      <View style={[styles.stackedCovers, { height: coverHeight + scale(20) }]}>
        <View style={[styles.placeholderStack, { width: coverWidth, height: coverHeight }]}>
          <Ionicons name="albums" size={scale(40)} color="rgba(255,255,255,0.3)" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.stackedCovers, { height: coverHeight + scale(20) }]}>
      {coverUrls.slice(0, 4).reverse().map((url, reverseIndex) => {
        const index = Math.min(coverUrls.length - 1, 3) - reverseIndex;
        return (
          <View
            key={index}
            style={[
              styles.stackedCover,
              {
                width: coverWidth,
                height: coverHeight,
                left: SCREEN_WIDTH / 2 - coverWidth / 2 + index * scale(15) - scale(22),
                zIndex: 4 - index,
                transform: [{ rotate: `${(index - 1.5) * 4}deg` }],
              },
            ]}
          >
            <Image source={url} style={styles.coverImage} contentFit="cover" />
          </View>
        );
      })}
    </View>
  );
}

export function CollectionDetailScreen() {
  const route = useRoute<CollectionDetailRouteProp>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { collectionId } = route.params;
  const { collection, isLoading, error, refetch } = useCollectionDetails(collectionId);

  const books = collection?.books || [];

  // Calculate stats
  const totalDuration = useMemo(() => {
    return books.reduce((sum, book) => {
      return sum + ((book.media as any)?.duration || 0);
    }, 0);
  }, [books]);

  const completedBooks = useMemo(() => {
    return books.filter((book) => {
      const progress = (book as any).userMediaProgress?.progress || 0;
      return progress >= 0.95;
    }).length;
  }, [books]);

  // Get cover URLs for stacked display
  const coverUrls = useMemo(() => {
    return books.slice(0, 4).map((book) => apiClient.getItemCoverUrl(book.id));
  }, [books]);

  // First book cover for background
  const backgroundCoverUrl = coverUrls[0];

  const handleBookPress = useCallback(
    (bookId: string) => {
      navigation.navigate('BookDetail', { id: bookId });
    },
    [navigation]
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }, [navigation]);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={styles.loadingContainer}>
          <Ionicons name="albums" size={scale(48)} color="rgba(255,255,255,0.2)" />
          <Text style={styles.loadingText}>Loading collection...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error || !collection) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={scale(24)} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={scale(48)} color="rgba(255,255,255,0.2)" />
          <Text style={styles.errorTitle}>Collection not found</Text>
          <Text style={styles.errorSubtitle}>This collection may have been removed</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Hero Section with Background Blur */}
      <View style={styles.heroContainer}>
        {backgroundCoverUrl && (
          <>
            <Image
              source={backgroundCoverUrl}
              style={styles.backgroundImage}
              contentFit="cover"
              blurRadius={40}
            />
            {/* BlurView for Android (blurRadius only works on iOS) */}
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.backgroundOverlay} />
          </>
        )}

        {/* Back button */}
        <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT + scale(10) }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <BlurView intensity={40} style={styles.blurButton}>
              <Ionicons name="chevron-back" size={scale(22)} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Stacked covers */}
        <StackedCovers coverUrls={coverUrls} />

        {/* Collection info */}
        <View style={styles.heroInfo}>
          <Text style={styles.collectionName}>{collection.name}</Text>
          {collection.description && (
            <Text style={styles.description} numberOfLines={2}>
              {collection.description}
            </Text>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="book" size={scale(18)} color={ACCENT} />
            <View>
              <Text style={styles.statValue}>{books.length}</Text>
              <Text style={styles.statLabel}>Books</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="time" size={scale(18)} color={ACCENT} />
            <View>
              <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={scale(18)} color={ACCENT} />
            <View>
              <Text style={styles.statValue}>
                {completedBooks}/{books.length}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Bottom gradient */}
        <LinearGradient
          colors={['transparent', BG_COLOR]}
          style={styles.heroGradient}
        />
      </View>

      {/* Books section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Books in Collection</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {books.length > 0 ? (
        <FlatList
          data={books}
          renderItem={({ item }) => (
            <BookCard
              book={item}
              onPress={() => handleBookPress(item.id)}
              showListeningProgress={true}
            />
          )}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={ACCENT} />
          }
        />
      ) : (
        <>
          {renderHeader()}
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={scale(48)} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyTitle}>No books yet</Text>
            <Text style={styles.emptySubtitle}>
              Add books to this collection in AudiobookShelf
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  // Loading/Error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(16),
  },
  loadingText: {
    fontSize: scale(15),
    color: 'rgba(255,255,255,0.5)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(40),
  },
  errorTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  errorSubtitle: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: scale(20),
  },
  retryButton: {
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderRadius: scale(20),
    backgroundColor: ACCENT,
  },
  retryButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000',
  },
  // Hero section
  heroContainer: {
    position: 'relative',
    paddingBottom: scale(20),
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,26,26,0.6)',
  },
  header: {
    paddingHorizontal: scale(16),
    paddingBottom: scale(16),
    zIndex: 10,
  },
  backButton: {
    width: scale(40),
    height: scale(40),
  },
  blurButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  // Stacked covers
  stackedCovers: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: scale(20),
  },
  stackedCover: {
    position: 'absolute',
    borderRadius: scale(8),
    overflow: 'hidden',
    backgroundColor: '#262626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderStack: {
    borderRadius: scale(8),
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: {
    paddingHorizontal: scale(20),
    alignItems: 'center',
    marginBottom: scale(20),
  },
  collectionName: {
    fontSize: scale(24),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: scale(8),
  },
  description: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: scale(20),
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: scale(16),
    marginHorizontal: scale(16),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(12),
    zIndex: 5,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(12),
  },
  statValue: {
    fontSize: scale(16),
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
  },
  statDivider: {
    width: 1,
    height: scale(32),
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(60),
  },
  // Section
  sectionHeader: {
    paddingHorizontal: scale(16),
    paddingTop: scale(20),
    paddingBottom: scale(12),
  },
  sectionTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
  },
  // List
  listContent: {
    paddingTop: 0,
  },
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: scale(40),
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: scale(20),
  },
});
