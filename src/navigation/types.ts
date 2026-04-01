/**
 * src/navigation/types.ts
 *
 * Navigation type definitions for type-safe navigation throughout the app.
 * Defines the RootStackParamList used by createNativeStackNavigator and
 * screen-level useNavigation() hooks.
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Root stack param list — every screen registered in AppNavigator's Stack.Navigator.
 * Screens with no params use `undefined`.
 */
export type RootStackParamList = {
  Main: { screen?: string } | undefined;
  Search: undefined;
  SeriesList: undefined;
  AuthorsList: undefined;
  NarratorsList: undefined;
  GenresList: undefined;
  GenreDetail: { genreName: string };
  FilteredBooks: { filter?: string; title?: string } | undefined;
  AllBooks: { filter?: string } | undefined;
  DurationFilter: undefined;
  BrowsePage: undefined;
  SeriesDetail: { seriesName?: string; name?: string };
  AuthorDetail: { authorId?: string; authorName?: string; name?: string };
  NarratorDetail: { narratorName?: string; name?: string };
  CollectionDetail: { collectionId?: string; id?: string } | undefined;
  CollectionsList: undefined;
  BookDetail: { id: string; animationDirection?: string };
  Downloads: undefined;
  Stats: undefined;
  PlaybackSettings: undefined;
  DataStorageSettings: undefined;
  HapticSettings: undefined;
  DisplaySettings: undefined;
  PlaylistSettings: undefined;
  About: undefined;
  SpinePlayground: undefined;
  DeveloperSettings: undefined;
  DebugStressTest: undefined;
};

/** Convenience type for useNavigation() in screens within the root stack. */
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
