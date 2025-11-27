/**
 * src/features/library/components/LibraryHeartButton.tsx
 * 
 * Reusable heart button for add/remove from library
 * Use this everywhere to maintain consistency
 */

import React, { useRef, useState } from 'react';
import { 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  View, 
  Text,
} from 'react-native';
import { useMyLibraryStore } from '../stores/myLibraryStore';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

interface LibraryHeartButtonProps {
  bookId: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'overlay' | 'plain';
  activeColor?: string;
  inactiveColor?: string;
  onToggle?: (inLibrary: boolean) => void;
}

const SIZES = {
  small: { icon: 12, button: 22 },
  medium: { icon: 16, button: 28 },
  large: { icon: 24, button: 40 },
};

export function LibraryHeartButton({ 
  bookId, 
  size = 'medium',
  variant = 'overlay',
  activeColor = '#EF4444',
  inactiveColor = theme.colors.text.secondary,
  onToggle,
}: LibraryHeartButtonProps) {
  const { isInLibrary, addToLibrary, removeFromLibrary } = useMyLibraryStore();
  const inLibrary = isInLibrary(bookId);
  
  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateX = useRef(new Animated.Value(10)).current;
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { icon: iconSize, button: buttonSize } = SIZES[size];

  const showAddedToast = (added: boolean) => {
    setToastMessage(added ? 'Added' : 'Removed');
    setShowToast(true);
    
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
          setShowToast(false);
        });
      }, 800);
    });
  };

  const handlePress = () => {
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

    const willBeInLibrary = !inLibrary;
    if (inLibrary) {
      removeFromLibrary(bookId);
    } else {
      addToLibrary(bookId);
    }
    
    showAddedToast(willBeInLibrary);
    onToggle?.(willBeInLibrary);
  };

  const heartIcon = (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Icon 
        name={inLibrary ? "heart" : "heart-outline"} 
        size={iconSize} 
        color={inLibrary ? activeColor : inactiveColor} 
        set="ionicons" 
      />
    </Animated.View>
  );

  const toast = showToast && (
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
      <View style={[
        styles.toastContent,
        { backgroundColor: inLibrary ? activeColor : theme.colors.neutral[600] }
      ]}>
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
  overlayButton: {
    backgroundColor: 'rgba(255,255,255,0.95)',
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