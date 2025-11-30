/**
 * src/navigation/components/FloatingTabBar.tsx
 */

import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '@/features/player';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_GAP = 2;
const OUTER_PADDING = 2;
const TAB_RADIUS = 5;

const TAB_BG = '#FFFFFF';
const TAB_BG_ACTIVE = '#F0F0F0';
const ICON_COLOR = '#1C1C1E';

// Calculate square button size
const NUM_TABS = 5; // 4 tabs + search
const TOTAL_GAPS = BUTTON_GAP * (NUM_TABS - 1);
const BUTTON_SIZE = (SCREEN_WIDTH - (OUTER_PADDING * 2) - TOTAL_GAPS) / NUM_TABS;
const BUTTON_SIZE_WITH_PLAYER = (SCREEN_WIDTH - (OUTER_PADDING * 2) - (BUTTON_GAP * NUM_TABS)) / (NUM_TABS + 1);

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  LibraryTab: { active: 'library', inactive: 'library-outline' },
  DiscoverTab: { active: 'compass', inactive: 'compass-outline' },
  ProfileTab: { active: 'person', inactive: 'person-outline' },
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { currentBook, isPlaying, play, pause } = usePlayerStore();

  const isHomeTab = state.index === 0;
  const showPlayerButton = !!currentBook && !isHomeTab;

  // Animation values
  const buttonSize = useRef(new Animated.Value(showPlayerButton ? BUTTON_SIZE_WITH_PLAYER : BUTTON_SIZE)).current;
  const playerScale = useRef(new Animated.Value(showPlayerButton ? 1 : 0)).current;
  const playerOpacity = useRef(new Animated.Value(showPlayerButton ? 1 : 0)).current;

  useEffect(() => {
    if (showPlayerButton) {
      // First shrink tabs, then pop in player
      Animated.sequence([
        Animated.timing(buttonSize, {
          toValue: BUTTON_SIZE_WITH_PLAYER,
          duration: 50,
          useNativeDriver: false,
        }),
        Animated.parallel([
          Animated.spring(playerScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 150,
            friction: 8,
          }),
          Animated.timing(playerOpacity, {
            toValue: 1,
            duration: 50,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // First hide player, then expand tabs
      Animated.sequence([
        Animated.parallel([
          Animated.timing(playerScale, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(playerOpacity, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(buttonSize, {
          toValue: BUTTON_SIZE,
          duration: 50,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [showPlayerButton]);

  const handleSearchPress = () => {
    nav.navigate('Search');
  };

  const handleTabPress = (route: any, index: number, isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const handlePlayPress = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  const handlePlayLongPress = () => {
    usePlayerStore.getState().setPlayerVisible?.(true) ||
    usePlayerStore.setState({ isPlayerVisible: true });
  };

  const coverUrl = currentBook ? apiClient.getItemCoverUrl(currentBook.id) : null;

  return (
    <View style={[
      styles.wrapper,
      { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 },
    ]}>
      <View style={styles.container}>
        {/* All tab buttons */}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const icons = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
          const iconName = isFocused ? icons.active : icons.inactive;

          return (
            <Animated.View 
              key={route.key} 
              style={{ width: buttonSize, height: buttonSize }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={() => handleTabPress(route, index, isFocused)}
                style={[styles.tabButton, isFocused && styles.tabButtonActive]}
                activeOpacity={0.7}
              >
                <Icon
                  name={iconName}
                  size={24}
                  color={ICON_COLOR}
                  set="ionicons"
                />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Search button */}
        <Animated.View style={{ width: buttonSize, height: buttonSize }}>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={handleSearchPress}
            activeOpacity={0.7}
          >
            <Icon
              name="search-outline"
              size={24}
              color={ICON_COLOR}
              set="ionicons"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Player button - animated scale in */}
        {currentBook && (
          <Animated.View 
            style={{ 
              width: showPlayerButton ? BUTTON_SIZE_WITH_PLAYER : 0,
              height: BUTTON_SIZE_WITH_PLAYER,
              transform: [{ scale: playerScale }],
              opacity: playerOpacity,
              overflow: 'hidden',
            }}
          >
            <Pressable
              style={[styles.playerButton, { width: BUTTON_SIZE_WITH_PLAYER, height: BUTTON_SIZE_WITH_PLAYER }]}
              onPress={handlePlayPress}
              onLongPress={handlePlayLongPress}
              delayLongPress={300}
            >
              {coverUrl && (
                <Image
                  source={coverUrl}
                  style={styles.playerCover}
                  contentFit="cover"
                  transition={150}
                />
              )}
              <View style={styles.playerOverlay}>
                <Icon 
                  name={isPlaying ? 'pause' : 'play'} 
                  size={22} 
                  color="#FFFFFF" 
                  set="ionicons" 
                />
              </View>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: OUTER_PADDING,
    paddingTop: 10,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BUTTON_GAP,
  },
  tabButton: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: TAB_RADIUS,
    backgroundColor: TAB_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: TAB_BG_ACTIVE,
  },
  playerButton: {
    borderRadius: TAB_RADIUS,
    backgroundColor: '#333',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerCover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  playerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});