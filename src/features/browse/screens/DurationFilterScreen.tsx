/**
 * src/features/browse/screens/DurationFilterScreen.tsx
 *
 * Screen for filtering books by duration range.
 */

import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { secretLibraryColors as staticColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { DURATION_RANGES } from '../hooks/useBrowseCounts';
import { useDurationCounts } from '../hooks/useDurationBooks';
import { DurationRangeCard } from '../components/DurationRangeCard';
import { TopNav, TopNavCloseIcon } from '@/shared/components';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { globalLoading } from '@/shared/stores/globalLoadingStore';

export function DurationFilterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Theme-aware colors
  const colors = useSecretLibraryColors();
  const isDarkMode = colors.isDark;

  const durationCounts = useDurationCounts();

  // Hide global loading overlay on mount
  useEffect(() => {
    globalLoading.hide();
  }, []);

  const handleRangePress = useCallback(
    (rangeId: string, minSeconds: number, maxSeconds: number) => {
      navigation.navigate('FilteredBooks', {
        filterType: 'duration',
        filterValue: rangeId,
        minDuration: minSeconds,
        maxDuration: maxSeconds,
      });
    },
    [navigation]
  );

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleLogoPress = useCallback(() => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.white} />

      {/* TopNav with skull logo */}
      <TopNav
        variant={isDarkMode ? 'dark' : 'light'}
        showLogo={true}
        onLogoPress={handleLogoPress}
        style={{ backgroundColor: colors.white }}
        circleButtons={[
          {
            key: 'close',
            icon: <TopNavCloseIcon color={colors.black} size={14} />,
            onPress: handleBack,
          },
        ]}
      />

      {/* Title Section */}
      <View style={[styles.titleSection, { borderBottomColor: colors.grayLine }]}>
        <Text style={[styles.headerTitle, { color: colors.black }]}>Duration</Text>
        <Text style={[styles.headerSubtitle, { color: colors.gray }]}>Filter by listening time</Text>
      </View>

      {/* Duration range cards */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {DURATION_RANGES.map((range) => (
          <DurationRangeCard
            key={range.id}
            label={range.label}
            description={range.description}
            bookCount={durationCounts[range.id]}
            onPress={() => handleRangePress(range.id, range.min, range.max)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.white,
  },
  titleSection: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: staticColors.grayLine,
  },
  headerTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(20),
    color: staticColors.black,
  },
  headerSubtitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: staticColors.gray,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
});
