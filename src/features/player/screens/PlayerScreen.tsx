/**
 * Player screen - complete redesign
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { PlaybackControls } from '../components/PlaybackControls';
import { ProgressBar } from '../components/ProgressBar';
import { apiClient } from '@/core/api';
import { BookChapter } from '@/core/types';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

function formatChapterDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function PlayerScreen() {
  const {
    currentBook,
    isPlayerVisible,
    playbackRate,
    closePlayer,
    setPlaybackRate,
    jumpToChapter,
  } = usePlayerStore();

  const [showRateSelector, setShowRateSelector] = useState(false);

  if (!isPlayerVisible || !currentBook) {
    return null;
  }

  const metadata = currentBook.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata.narrators?.[0] || null;
  const chapters = currentBook.media.chapters || [];
  const coverUrl = apiClient.getItemCoverUrl(currentBook.id);

  const handleSelectRate = async (rate: number) => {
    try {
      await setPlaybackRate(rate);
      setShowRateSelector(false);
    } catch (error) {
      console.error('Failed to set playback rate:', error);
    }
  };

  const handleChapterPress = async (chapterIndex: number) => {
    try {
      await jumpToChapter(chapterIndex);
    } catch (error) {
      console.error('Failed to jump to chapter:', error);
    }
  };

  return (
    <Modal
      visible={isPlayerVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closePlayer}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
        
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Close Button */}
          <View style={styles.header}>
            <TouchableOpacity onPress={closePlayer} style={styles.closeButton}>
              <Icon name="chevron-down" size={28} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Cover */}
          <View style={styles.coverContainer}>
            <Image 
              source={{ uri: coverUrl }} 
              style={styles.cover} 
              resizeMode="cover" 
            />
          </View>

          {/* Book Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.author}>{author}</Text>
            {narrator && <Text style={styles.narrator}>Narrated by {narrator}</Text>}
          </View>

          {/* Progress Bar */}
          <ProgressBar />

          {/* Playback Controls */}
          <PlaybackControls />

          {/* Playback Rate */}
          <View style={styles.rateContainer}>
            <TouchableOpacity
              style={styles.rateButton}
              onPress={() => setShowRateSelector(!showRateSelector)}
            >
              <Text style={styles.rateText}>{playbackRate}x</Text>
            </TouchableOpacity>
          </View>

          {/* Rate Selector */}
          {showRateSelector && (
            <View style={styles.rateSelectorContainer}>
              {PLAYBACK_RATES.map((rate) => (
                <TouchableOpacity
                  key={rate}
                  style={[
                    styles.rateOption,
                    playbackRate === rate && styles.rateOptionActive,
                  ]}
                  onPress={() => handleSelectRate(rate)}
                >
                  <Text
                    style={[
                      styles.rateOptionText,
                      playbackRate === rate && styles.rateOptionTextActive,
                    ]}
                  >
                    {rate}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Chapters */}
          {chapters.length > 0 && (
            <View style={styles.chaptersContainer}>
              <Text style={styles.chaptersTitle}>Chapters</Text>

              {chapters.map((chapter, index) => {
                const duration = chapter.end - chapter.start;
                return (
                  <TouchableOpacity
                    key={chapter.id}
                    style={styles.chapterItem}
                    onPress={() => handleChapterPress(index)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.chapterNumber}>
                      <Text style={styles.chapterNumberText}>{index + 1}</Text>
                    </View>

                    <View style={styles.chapterInfo}>
                      <Text style={styles.chapterTitle} numberOfLines={2}>
                        {chapter.title || `Chapter ${index + 1}`}
                      </Text>
                      <Text style={styles.chapterDuration}>
                        {formatChapterDuration(duration)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing[8],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[5],
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.elevation.small,
  },
  coverContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing[8],
    paddingHorizontal: theme.spacing[8],
  },
  cover: {
    width: 280,
    height: 280,
    borderRadius: theme.radius.xlarge,
    backgroundColor: theme.colors.neutral[200],
    ...theme.elevation.large,
  },
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing[8],
    marginBottom: theme.spacing[4],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
    letterSpacing: -0.5,
  },
  author: {
    fontSize: 17,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing[1],
  },
  narrator: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
  },
  rateContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing[4],
  },
  rateButton: {
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.neutral[200],
    borderRadius: theme.radius.full,
  },
  rateText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  rateSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing[8],
    paddingBottom: theme.spacing[4],
    gap: theme.spacing[2],
  },
  rateOption: {
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[2],
    backgroundColor: theme.colors.neutral[200],
    borderRadius: theme.radius.full,
  },
  rateOptionActive: {
    backgroundColor: theme.colors.primary[500],
  },
  rateOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  rateOptionTextActive: {
    color: theme.colors.text.inverse,
  },
  chaptersContainer: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[8],
  },
  chaptersTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[5],
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  chapterNumber: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing[3],
  },
  chapterNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 15,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
    fontWeight: '500',
  },
  chapterDuration: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
  },
  bottomSpacing: {
    height: theme.spacing[8],
  },
});