/**
 * src/features/user/components/FavoriteButton.tsx
 *
 * Reusable favorite button with optimistic updates and offline support.
 * Uses React Query + SQLite caching via useFavorites hooks.
 */

import React, { useRef, useState } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFavorite, useToggleFavorite } from '../hooks/useFavorites';
import { theme } from '@/shared/theme';

interface FavoriteButtonProps {
  itemId: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'overlay' | 'plain';
  activeColor?: string;
  inactiveColor?: string;
  showToast?: boolean;
  onToggle?: (isFavorite: boolean) => void;
}

const SIZES = {
  small: { icon: 14, button: 24 },
  medium: { icon: 18, button: 32 },
  large: { icon: 24, button: 44 },
};

export function FavoriteButton({
  itemId,
  size = 'medium',
  variant = 'plain',
  activeColor = '#EF4444',
  inactiveColor = 'rgba(255, 255, 255, 0.6)',
  showToast = true,
  onToggle,
}: FavoriteButtonProps) {
  const isFavorite = useIsFavorite(itemId);
  const { mutate: toggleFavorite, isPending } = useToggleFavorite();

  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateX = useRef(new Animated.Value(10)).current;
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { icon: iconSize, button: buttonSize } = SIZES[size];

  const showToastMessage = (added: boolean) => {
    if (!showToast) return;

    setToastMessage(added ? 'Added' : 'Removed');
    setIsToastVisible(true);

    toastOpacity.setValue(0);
    toastTranslateX.setValue(10);

    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateX, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setIsToastVisible(false);
        });
      }, 800);
    });
  };

  const handlePress = () => {
    if (isPending) return;

    // Heart beat animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.7,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const willBeFavorite = !isFavorite;

    toggleFavorite(
      { itemId, isFavorite: willBeFavorite },
      {
        onSuccess: () => {
          showToastMessage(willBeFavorite);
          onToggle?.(willBeFavorite);
        },
      }
    );
  };

  if (isPending) {
    return (
      <View style={[styles.loadingContainer, { width: buttonSize, height: buttonSize }]}>
        <ActivityIndicator size="small" color={activeColor} />
      </View>
    );
  }

  const heartIcon = (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={iconSize}
        color={isFavorite ? activeColor : inactiveColor}
      />
    </Animated.View>
  );

  const toast = isToastVisible && (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity: toastOpacity,
          transform: [{ translateX: toastTranslateX }],
        },
      ]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.toastContent,
          { backgroundColor: isFavorite ? activeColor : theme.colors.neutral[600] },
        ]}
      >
        <Text style={styles.toastText}>{toastMessage}</Text>
      </View>
    </Animated.View>
  );

  if (variant === 'plain') {
    return (
      <View style={styles.container}>
        {toast}
        <TouchableOpacity
          onPress={handlePress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={isPending}
        >
          {heartIcon}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {toast}
      <TouchableOpacity
        style={[
          styles.overlayButton,
          { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
        ]}
        onPress={handlePress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        disabled={isPending}
      >
        {heartIcon}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toast: {
    position: 'absolute',
    right: '100%',
    marginRight: 6,
  },
  toastContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
