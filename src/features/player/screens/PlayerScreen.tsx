/**
 * src/features/player/screens/PlayerScreen.tsx
 *
 * Full player screen displayed as a modal.
 * Shows large cover, title, playback controls, progress bar, playback rate selector, and chapter list.
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
} from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { PlaybackControls } from '../components/PlaybackControls';
import { ProgressBar } from '../components/ProgressBar';
import { apiClient } from '@/core/api';
import { BookChapter } from '@/core/types';

/**
 * Playback rate options
 */
const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

/**
 * Format chapter duration
 */
function formatChapterDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Full player screen component
 */
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

  // Don't render if player is not visible or no book loaded
  if (!isPlayerVisible || !currentBook) {
    return null;
  }

  const metadata = currentBook.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata.narrators?.[0] || null;
  const chapters = currentBook.media.chapters || [];
  const coverUrl = apiClient.getItemCoverUrl(currentBook.id);

  /**
   * Handle playback rate selection
   */
  const handleSelectRate = async (rate: number) => {
    try {
      await setPlaybackRate(rate);
      setShowRateSelector(false);
    } catch (error) {
      console.error('Failed to set playback rate:', error);
    }
  };

  /**
   * Handle chapter selection
   */
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Header with Close Button */}
          <View style={styles.header}>
            <TouchableOpacity onPress={closePlayer} style={styles.closeButton}>
              <Text style={styles.closeIcon}>⌄</Text>
            </TouchableOpacity>
          </View>

          {/* Cover Image */}
          <View style={styles.coverContainer}>
            <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
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
              <Text style={styles.chaptersTitle}>Chapters ({chapters.length})</Text>

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

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 32,
    color: '#333333',
  },
  coverContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  cover: {
    width: 280,
    height: 280,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    elevation: 8,
  },
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  author: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },
  narrator: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  rateContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  rateButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
  },
  rateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  rateSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 32,
    paddingBottom: 16,
  },
  rateOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
  },
  rateOptionActive: {
    backgroundColor: '#007AFF',
  },
  rateOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  rateOptionTextActive: {
    color: '#FFFFFF',
  },
  chaptersContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  chaptersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chapterNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chapterNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 15,
    color: '#333333',
    marginBottom: 4,
  },
  chapterDuration: {
    fontSize: 13,
    color: '#888888',
  },
  bottomSpacing: {
    height: 32,
  },
});
