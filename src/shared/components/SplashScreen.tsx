/**
 * src/shared/components/SplashScreen.tsx
 * 
 * Loading screen displayed while checking authentication status.
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AudiobookShelf</Text>
      <ActivityIndicator size="large" color="#4A90E2" style={styles.spinner} />
      <Text style={styles.subtitle}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
