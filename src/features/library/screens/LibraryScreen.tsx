/**
 * src/features/library/screens/LibraryScreen.tsx
 * 
 * Placeholder library screen showing user info and logout button.
 * Will be replaced with actual library browsing in Stage 3.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@/core/auth';

export function LibraryScreen() {
  const { user, serverUrl, logout } = useAuth();

  /**
   * Handle logout with confirmation
   */
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (err) {
            Alert.alert('Logout Failed', 'Please try again');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.subtitle}>Coming soon in Stage 3</Text>
      </View>

      {/* User Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Logged in as</Text>
        <Text style={styles.infoValue}>{user?.username}</Text>

        {user?.email && (
          <>
            <Text style={[styles.infoLabel, styles.infoLabelSpaced]}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </>
        )}

        <Text style={[styles.infoLabel, styles.infoLabelSpaced]}>Server</Text>
        <Text style={styles.infoValue}>{serverUrl}</Text>

        <Text style={[styles.infoLabel, styles.infoLabelSpaced]}>Account Type</Text>
        <Text style={styles.infoValue}>{user?.type}</Text>
      </View>

      {/* Logout Button */}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>Logout</Text>
      </Pressable>

      {/* Coming Soon Message */}
      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonText}>
          📚 Library browsing and book details will be implemented in the next stage
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoLabelSpaced: {
    marginTop: 16,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#E53935',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: '#C62828',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoon: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'center',
    lineHeight: 20,
  },
});
