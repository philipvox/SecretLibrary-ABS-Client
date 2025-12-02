/**
 * src/features/home/components/HomeCard.tsx
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, Rect, LinearGradient, Stop, Path } from 'react-native-svg';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { getTitle } from '@/shared/utils/metadata';
import { GlassPanel } from './GlassPanel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = 540;
const CARD_PADDING = 5;
const COVER_HEIGHT = CARD_HEIGHT - 130;
const BORDER_RADIUS = 8;

const ART_SHADOW = {
  top:    { opacity: 0.6, depth: 0.12 },
  bottom: { opacity: 0.5, depth: 0.10 },
  left:   { opacity: 0.55, depth: 0.10 },
  right:  { opacity: 0.55, depth: 0.10 },
  sheen:  { opacity: 0.08, depth: 0.05 },
  border: { opacity: 0.4, width: 1 },
};

interface HomeCardProps {
  book: LibraryItem & {
    userMediaProgress?: {
      progress?: number;
      currentTime?: number;
      duration?: number;
    };
  };
  onPress: () => void;
  onDownload?: () => void;
  onHeart?: () => void;
  config?: any;
}

function DownloadIcon({ size = 22, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4V16M12 16L7 11M12 16L17 11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5 20H19" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function HeartIcon({ size = 22, color = '#CCFF00', filled = true }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 2}
      />
    </Svg>
  );
}

export function HomeCard({ book, onPress, onDownload, onHeart }: HomeCardProps) {
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book) || 'Unknown Title';

  const currentTime = book.userMediaProgress?.currentTime ?? 0;
  const chapters = book.media?.chapters ?? [];
  let chapterNumber = 1;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const nextCh = chapters[i + 1];
    if (currentTime >= ch.start && (!nextCh || currentTime < nextCh.start)) {
      chapterNumber = i + 1;
      break;
    }
  }

  return (
    <Pressable onPress={onPress}>
      <View style={styles.card}>
        <GlassPanel width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={BORDER_RADIUS} />

        <View style={styles.content}>
          <View style={styles.coverContainer}>
            <Image source={coverUrl} style={styles.coverImage} contentFit="cover" transition={200} />
            
            <View style={[styles.coverInnerShadow, { borderWidth: ART_SHADOW.border.width, borderColor: `rgba(0,0,0,${ART_SHADOW.border.opacity})` }]} pointerEvents="none">
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="homeArtTop" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="black" stopOpacity={ART_SHADOW.top.opacity} />
                    <Stop offset={ART_SHADOW.top.depth / 2} stopColor="black" stopOpacity={ART_SHADOW.top.opacity * 0.4} />
                    <Stop offset={ART_SHADOW.top.depth} stopColor="black" stopOpacity={0} />
                  </LinearGradient>
                  <LinearGradient id="homeArtBottom" x1="0" y1="1" x2="0" y2="0">
                    <Stop offset="0" stopColor="black" stopOpacity={ART_SHADOW.bottom.opacity} />
                    <Stop offset={ART_SHADOW.bottom.depth / 2} stopColor="black" stopOpacity={ART_SHADOW.bottom.opacity * 0.4} />
                    <Stop offset={ART_SHADOW.bottom.depth} stopColor="black" stopOpacity={0} />
                  </LinearGradient>
                  <LinearGradient id="homeArtLeft" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="black" stopOpacity={ART_SHADOW.left.opacity} />
                    <Stop offset={ART_SHADOW.left.depth / 2} stopColor="black" stopOpacity={ART_SHADOW.left.opacity * 0.4} />
                    <Stop offset={ART_SHADOW.left.depth} stopColor="black" stopOpacity={0} />
                  </LinearGradient>
                  <LinearGradient id="homeArtRight" x1="1" y1="0" x2="0" y2="0">
                    <Stop offset="0" stopColor="black" stopOpacity={ART_SHADOW.right.opacity} />
                    <Stop offset={ART_SHADOW.right.depth / 2} stopColor="black" stopOpacity={ART_SHADOW.right.opacity * 0.4} />
                    <Stop offset={ART_SHADOW.right.depth} stopColor="black" stopOpacity={0} />
                  </LinearGradient>
                  <LinearGradient id="homeArtSheen" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="white" stopOpacity={ART_SHADOW.sheen.opacity} />
                    <Stop offset={ART_SHADOW.sheen.depth / 2} stopColor="white" stopOpacity={ART_SHADOW.sheen.opacity * 0.3} />
                    <Stop offset={ART_SHADOW.sheen.depth} stopColor="white" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeArtTop)" />
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeArtBottom)" />
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeArtLeft)" />
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeArtRight)" />
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeArtSheen)" />
              </Svg>
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.textColumn}>
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
              <Text style={styles.chapter}>Chapter  {chapterNumber}</Text>
            </View>
            <View style={styles.iconsColumn}>
              <TouchableOpacity onPress={onDownload} hitSlop={8}>
                <DownloadIcon />
              </TouchableOpacity>
              <TouchableOpacity onPress={onHeart} hitSlop={8}>
                <HeartIcon />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: CARD_PADDING,
  },
  coverContainer: {
    height: COVER_HEIGHT,
    borderRadius: BORDER_RADIUS - 2,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverInnerShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BORDER_RADIUS - 2,
    overflow: 'hidden',
  },
  infoSection: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 12,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 6,
  },
  chapter: {
    fontFamily: 'Courier',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  iconsColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 16,
  },
});

export default HomeCard;