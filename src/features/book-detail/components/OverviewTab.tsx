import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';

interface OverviewTabProps {
  book: LibraryItem;
  showFullDetails?: boolean;
}

export function OverviewTab({ book, showFullDetails = false }: OverviewTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigation = useNavigation();
  
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
      ) : null}

      {showFullDetails && (
        <View style={styles.detailsSection}>
          {seriesName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Series</Text>
              <Text style={styles.detailValue}>{seriesName}</Text>
            </View>
          )}
          {publishedYear && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Published</Text>
              <Text style={styles.detailValue}>{publishedYear}</Text>
            </View>
          )}
          {publisher && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Publisher</Text>
              <Text style={styles.detailValue}>{publisher}</Text>
            </View>
          )}
          {language && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Language</Text>
              <Text style={styles.detailValue}>{language}</Text>
            </View>
          )}
        </View>
      )}

      {!showFullDetails && similarBooks.length > 0 && (
        <View style={styles.similarSection}>
          <View style={styles.similarHeader}>
            <Text style={styles.sectionTitle}>Similar Category</Text>
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
                onPress={() => navigation.navigate('BookDetail' as never, { bookId: item.id } as never)}
              >
                <Image 
                  source={{ uri: apiClient.getItemCoverUrl(item.id) }} 
                  style={styles.similarCover} 
                  resizeMode="cover"
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
    paddingTop: theme.spacing[4],
  },
  section: {
    paddingHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[5],
  },
  description: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    lineHeight: 24,
  },
  readMore: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary[500],
    marginTop: theme.spacing[2],
  },
  detailsSection: {
    paddingHorizontal: theme.spacing[5],
    backgroundColor: theme.colors.neutral[50],
    paddingVertical: theme.spacing[4],
    marginHorizontal: theme.spacing[5],
    borderRadius: theme.radius.large,
    marginBottom: theme.spacing[5],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  similarSection: {
    marginTop: theme.spacing[2],
  },
  similarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[3],
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  moreLink: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
  },
  similarList: {
    paddingHorizontal: theme.spacing[5],
  },
  similarBook: {
    width: 100,
    marginRight: theme.spacing[3],
  },
  similarCover: {
    width: 100,
    height: 150,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.neutral[200],
  },
});