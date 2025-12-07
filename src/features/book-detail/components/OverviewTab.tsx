import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';

// Design constants matching HomeScreen
const ACCENT = '#c1f40c';
const MONO_FONT = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

interface OverviewTabProps {
  book: LibraryItem;
  showFullDetails?: boolean;
}

export function OverviewTab({ book, showFullDetails = false }: OverviewTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { loadBook } = usePlayerStore();

  const metadata = book.media.metadata as any;
  const description = metadata.description || '';
  const seriesName = metadata.seriesName || null;
  const publishedYear = metadata.publishedYear;
  const publisher = metadata.publisher;
  const language = metadata.language;

  const needsExpansion = description.length > 200;
  const displayDescription = needsExpansion && !isExpanded
    ? description.substring(0, 200) + '...'
    : description;

  const similarBooks: any[] = [];

  return (
    <View style={styles.container}>
      {description ? (
        <View style={styles.section}>
          <Text style={styles.description}>{displayDescription}</Text>
          {needsExpansion && (
            <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
              <Text style={styles.readMore}>{isExpanded ? 'Read Less' : 'Read More'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.noDescription}>No description available</Text>
        </View>
      )}

      {showFullDetails && (
        <View style={styles.detailsSection}>
          {seriesName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>SERIES</Text>
              <Text style={styles.detailValue}>{seriesName}</Text>
            </View>
          )}
          {publishedYear && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PUBLISHED</Text>
              <Text style={styles.detailValue}>{publishedYear}</Text>
            </View>
          )}
          {publisher && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PUBLISHER</Text>
              <Text style={styles.detailValue}>{publisher}</Text>
            </View>
          )}
          {language && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>LANGUAGE</Text>
              <Text style={styles.detailValue}>{language}</Text>
            </View>
          )}
        </View>
      )}

      {!showFullDetails && similarBooks.length > 0 && (
        <View style={styles.similarSection}>
          <View style={styles.similarHeader}>
            <Text style={styles.sectionTitle}>Similar Books</Text>
            <TouchableOpacity>
              <Text style={styles.moreLink}>More</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={similarBooks}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.similarBook}
                onPress={async () => {
                  try {
                    const fullBook = await apiClient.getItem(item.id);
                    await loadBook(fullBook, { autoPlay: false });
                  } catch {
                    await loadBook(item, { autoPlay: false });
                  }
                }}
              >
                <Image
                  source={apiClient.getItemCoverUrl(item.id)}
                  style={styles.similarCover}
                  contentFit="cover"
                  transition={200}
                />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.similarList}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },
  noDescription: {
    fontSize: 14,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
  },
  readMore: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
    marginTop: 8,
  },
  detailsSection: {
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  similarSection: {
    marginTop: 8,
  },
  similarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  moreLink: {
    fontSize: 12,
    fontFamily: MONO_FONT,
    color: 'rgba(255,255,255,0.5)',
  },
  similarList: {
    paddingHorizontal: 20,
  },
  similarBook: {
    width: 100,
    marginRight: 12,
  },
  similarCover: {
    width: 100,
    height: 150,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
