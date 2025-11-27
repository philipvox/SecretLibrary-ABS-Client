/**
 * src/features/browse/screens/BrowseScreen.tsx
 */

import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SeriesListContent } from '../components/SeriesListContent';
import { AuthorsListContent } from '../components/AuthorsListContent';
import { NarratorsListContent } from '../components/NarratorsListContent';
import { CollectionsListContent } from '../components/CollectionsListContent';
import { TopNavBar } from '@/navigation/components/TopNavBar';
import { theme } from '@/shared/theme';

const TopTab = createMaterialTopTabNavigator();

export function BrowseScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
      
      <View style={{ paddingTop: insets.top }}>
        <TopNavBar />
      </View>

      <View style={styles.header}>
        {/*<Text style={styles.headerTitle}>Discover</Text>*/}
        {/*<Text style={styles.headerSubtitle}>Explore your collection</Text>*/}
      </View>

      <TopTab.Navigator
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary[500],
          tabBarInactiveTintColor: theme.colors.text.tertiary,
          tabBarIndicatorStyle: {
            backgroundColor: theme.colors.primary[500],
            height: 3,
            borderRadius: 1.5,
          },
          tabBarStyle: {
            backgroundColor: theme.colors.background.primary,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.light,
          },
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: '600',
            textTransform: 'none',
          },
          tabBarPressColor: theme.colors.overlay.light,
          tabBarScrollEnabled: true,
          tabBarItemStyle: {
            width: 'auto',
            paddingHorizontal: theme.spacing[4],
          },
        }}
      >
        <TopTab.Screen name="Series" component={SeriesListContent} />
        <TopTab.Screen name="Authors" component={AuthorsListContent} />
        <TopTab.Screen name="Narrators" component={NarratorsListContent} />
        <TopTab.Screen name="Collections" component={CollectionsListContent} />
      </TopTab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[3],
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
});