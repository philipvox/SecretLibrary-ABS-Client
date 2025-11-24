// File: src/features/player/screens/PlayerScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors } from 'react-native-image-colors';
import { usePlayerStore } from '../stores/playerStore';
import { PlaybackControls } from '../components/PlaybackControls';
import { ProgressBar } from '../components/ProgressBar';
import { ChapterSheet } from '../components/ChapterSheet';
import { SpeedSelector } from '../components/SpeedSelector';
import { CoverWithProgress } from '../components/CoverWithProgress';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_SIZE = SCREEN_WIDTH * 0.7;

function getComplementaryColor(hex: string): string {
  // Remove # if present
  const color = hex.replace('#', '');
  
  // Parse RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Get complementary (invert)
  const compR = 255 - r;
  const compG = 255 - g;
  const compB = 255 - b;
  
  return `#${compR.toString(16).padStart(2, '0')}${compG.toString(16).padStart(2, '0')}${compB.toString(16).padStart(2, '0')}`;
}

function getLighterColor(hex: string, factor: number = 0.3): string {
  const color = hex.replace('#', '');
  const r = Math.min(255, parseInt(color.substring(0, 2), 16) + Math.round(255 * factor));
  const g = Math.min(255, parseInt(color.substring(2, 4), 16) + Math.round(255 * factor));
  const b = Math.min(255, parseInt(color.substring(4, 6), 16) + Math.round(255 * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const [showChapters, setShowChapters] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [dominantColor, setDominantColor] = useState<string>(theme.colors.background.primary);
  const [complementaryColor, setComplementaryColor] = useState<string>(theme.colors.primary[500]);

  const {
    currentBook,
    isPlayerVisible,
    position,
    duration,
    playbackRate,
    closePlayer,
  } = usePlayerStore();

  const coverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : '';

  useEffect(() => {
    if (coverUrl) {
      extractColors();
    }
  }, [coverUrl]);

  const extractColors = async () => {
    try {
      const colors = await getColors(coverUrl, {
        fallback: theme.colors.background.primary,
        cache: true,
        key: coverUrl,
      });

      let dominant = theme.colors.background.primary;
      
      if (colors.platform === 'android') {
        dominant = colors.dominant || colors.average || dominant;
      } else if (colors.platform === 'ios') {
        dominant = colors.background || colors.primary || dominant;
      } else {
        dominant = (colors as any).dominant || (colors as any).vibrant || dominant;
      }

      // Make it lighter for background
      const bgColor = getLighterColor(dominant, 0.4);
      setDominantColor(bgColor);
      setComplementaryColor(getComplementaryColor(dominant));
    } catch (error) {
      console.error('Failed to extract colors:', error);
    }
  };

  if (!isPlayerVisible || !currentBook) {
    return null;
  }

  const metadata = currentBook.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata.narrators?.[0] || null;
  const chapters = currentBook.media.chapters || [];
  
  const progress = duration > 0 ? position / duration : 0;
  const isLight = isLightColor(dominantColor);
  const textColor = isLight ? theme.colors.text.primary : theme.colors.neutral[0];
  const secondaryTextColor = isLight ? theme.colors.text.secondary : 'rgba(255,255,255,0.7)';
  const tertiaryTextColor = isLight ? theme.colors.text.tertiary : 'rgba(255,255,255,0.5)';

  return (
    <Modal
      visible={isPlayerVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closePlayer}
    >
      <View style={[styles.container, { backgroundColor: dominantColor }]}>
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} />

        {/* Close Button */}
        <View style={[styles.header, { paddingTop: insets.top + theme.spacing[2] }]}>
          <TouchableOpacity 
            onPress={closePlayer} 
            style={[styles.closeButton, { backgroundColor: isLight ? theme.colors.neutral[200] : 'rgba(255,255,255,0.2)' }]}
          >
            <Icon name="chevron-down" size={24} color={textColor} set="ionicons" />
          </TouchableOpacity>
        </View>

        {/* Cover Art with Progress Border */}
        <View style={styles.coverContainer}>
          <CoverWithProgress
            coverUrl={coverUrl}
            progress={progress}
            size={COVER_SIZE}
            borderColor={complementaryColor}
          />
        </View>

        {/* Title & Author */}
        <View style={styles.infoContainer}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.author, { color: secondaryTextColor }]}>{author}</Text>
          {narrator && (
            <Text style={[styles.narrator, { color: tertiaryTextColor }]}>Narrated by {narrator}</Text>
          )}
        </View>

        {/* Progress Bar */}
        <ProgressBar textColor={tertiaryTextColor} trackColor={isLight ? theme.colors.neutral[300] : 'rgba(255,255,255,0.2)'} fillColor={textColor} />

        {/* Playback Controls */}
        <PlaybackControls 
          buttonColor={isLight ? theme.colors.neutral[0] : theme.colors.neutral[0]}
          iconColor={isLight ? theme.colors.text.primary : theme.colors.text.primary}
          skipColor={isLight ? theme.colors.neutral[400] : 'rgba(255,255,255,0.5)'}
        />

        {/* Speed Button */}
        <View style={styles.speedContainer}>
          <TouchableOpacity 
            style={[styles.speedButton, { backgroundColor: isLight ? theme.colors.neutral[200] : 'rgba(255,255,255,0.2)' }]} 
            onPress={() => setShowSpeed(true)}
          >
            <Text style={[styles.speedText, { color: textColor }]}>{playbackRate}x</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Actions */}
        <View style={[styles.bottomActions, { paddingBottom: insets.bottom + theme.spacing[4] }]}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowChapters(true)}>
            <Icon name="list" size={22} color={secondaryTextColor} set="ionicons" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="moon-outline" size={22} color={secondaryTextColor} set="ionicons" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="bookmark-outline" size={22} color={secondaryTextColor} set="ionicons" />
          </TouchableOpacity>
        </View>

        <ChapterSheet
          visible={showChapters}
          onClose={() => setShowChapters(false)}
          chapters={chapters}
          currentPosition={position}
        />
        
        <SpeedSelector visible={showSpeed} onClose={() => setShowSpeed(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    paddingBottom: theme.spacing[2],
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing[6],
  },
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing[8],
    marginBottom: theme.spacing[4],
  },
  title: {
    ...theme.textStyles.h2,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
  },
  author: {
    ...theme.textStyles.body,
    marginBottom: theme.spacing[1],
  },
  narrator: {
    ...theme.textStyles.bodySmall,
  },
  speedContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
  },
  speedButton: {
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.full,
  },
  speedText: {
    ...theme.textStyles.body,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing[8],
    marginTop: 'auto',
  },
  actionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});