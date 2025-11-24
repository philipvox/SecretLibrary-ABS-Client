import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../stores/playerStore';
import { useImageColors } from '../hooks/useImageColors';
import { PlaybackControls } from '../components/PlaybackControls';
import { ProgressBar } from '../components/ProgressBar';
import { ChapterSheet } from '../components/ChapterSheet';
import { SpeedSelector } from '../components/SpeedSelector';
import { CoverWithProgress } from '../components/CoverWithProgress';
import { darkenColor } from '../utils/colorUtils';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_SIZE = SCREEN_WIDTH * 0.65;

export function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const [showChapters, setShowChapters] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);

  const {
    currentBook,
    isPlayerVisible,
    position,
    duration,
    playbackRate,
    closePlayer,
  } = usePlayerStore();

  const coverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : '';
  const { background, accent, isLight } = useImageColors(coverUrl, currentBook?.id || '');

  if (!isPlayerVisible || !currentBook) {
    return null;
  }

  const metadata = currentBook.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const chapters = currentBook.media.chapters || [];
  
  const progress = duration > 0 ? position / duration : 0;
  
  // Find current chapter
  const currentChapterIndex = chapters.findIndex(
    (ch, idx) =>
      position >= ch.start &&
      (idx === chapters.length - 1 || position < chapters[idx + 1].start)
  );
  const currentChapter = chapters[currentChapterIndex];
  const chapterTitle = currentChapter?.title || `Chapter ${currentChapterIndex + 1}`;

  const textColor = '#FFFFFF';
  const secondaryTextColor = 'rgba(255,255,255,0.7)';
  const tertiaryTextColor = 'rgba(255,255,255,0.5)';

  const gradientColors = [
    background,
    darkenColor(background, 0.3),
  ];

  return (
    <Modal
      visible={isPlayerVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closePlayer}
    >
      <LinearGradient colors={gradientColors} style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + theme.spacing[2] }]}>
          <TouchableOpacity onPress={closePlayer} style={styles.headerButton}>
            <Icon name="chevron-down" size={28} color={textColor} set="ionicons" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Now Playing</Text>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="ellipsis-horizontal" size={24} color={textColor} set="ionicons" />
          </TouchableOpacity>
        </View>

        {/* Cover with Progress Border */}
        <View style={styles.coverSection}>
          <CoverWithProgress
            coverUrl={coverUrl}
            progress={progress}
            size={COVER_SIZE}
            accentColor={accent}
          />
        </View>

        {/* Book Info */}
        <View style={styles.infoSection}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.author, { color: secondaryTextColor }]}>
            {author}
          </Text>
          <Text style={[styles.chapterInfo, { color: tertiaryTextColor }]}>
            {chapterTitle} • {Math.round(progress * 100)}% complete
          </Text>
        </View>

        {/* Progress Bar */}
        <ProgressBar
          textColor={tertiaryTextColor}
          trackColor="rgba(255,255,255,0.2)"
          fillColor={accent}
        />

        {/* Playback Controls */}
        <PlaybackControls
          buttonColor="#FFFFFF"
          iconColor={background}
          skipColor="rgba(255,255,255,0.6)"
        />

        {/* Speed Button */}
        <View style={styles.speedSection}>
          <TouchableOpacity
            style={[styles.speedButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
            onPress={() => setShowSpeed(true)}
          >
            <Text style={[styles.speedText, { color: textColor }]}>
              {playbackRate}×
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Actions */}
        <View style={[styles.bottomActions, { paddingBottom: insets.bottom + theme.spacing[6] }]}>
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="moon-outline" size={26} color={secondaryTextColor} set="ionicons" />
            <Text style={[styles.actionLabel, { color: tertiaryTextColor }]}>Sleep</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowChapters(true)}>
            <Icon name="list-outline" size={26} color={secondaryTextColor} set="ionicons" />
            <Text style={[styles.actionLabel, { color: tertiaryTextColor }]}>Chapters</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="bookmark-outline" size={26} color={secondaryTextColor} set="ionicons" />
            <Text style={[styles.actionLabel, { color: tertiaryTextColor }]}>Bookmark</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="share-outline" size={26} color={secondaryTextColor} set="ionicons" />
            <Text style={[styles.actionLabel, { color: tertiaryTextColor }]}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Modals */}
        <ChapterSheet
          visible={showChapters}
          onClose={() => setShowChapters(false)}
          chapters={chapters}
          currentPosition={position}
        />
        <SpeedSelector visible={showSpeed} onClose={() => setShowSpeed(false)} />
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[2],
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  coverSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing[6],
  },
  infoSection: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing[6],
    marginBottom: theme.spacing[4],
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing[1],
    letterSpacing: -0.3,
  },
  author: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: theme.spacing[2],
  },
  chapterInfo: {
    fontSize: 14,
    fontWeight: '400',
  },
  speedSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
  },
  speedButton: {
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
  },
  speedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing[6],
    marginTop: 'auto',
  },
  actionButton: {
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});