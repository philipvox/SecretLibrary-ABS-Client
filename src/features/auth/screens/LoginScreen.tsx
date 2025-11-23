/**
 * src/features/auth/screens/LoginScreen.tsx
 * 
 * Login screen for entering server URL and credentials.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '@/core/auth';

export function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuth();

  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  // Load last used server URL
  useEffect(() => {
    loadLastServerUrl();
  }, []);

  // Clear validation error when inputs change
  useEffect(() => {
    if (validationError) {
      setValidationError('');
    }
  }, [serverUrl, username, password]);

  // Show auth errors
  useEffect(() => {
    if (error) {
      Alert.alert('Login Failed', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  /**
   * Load last used server URL from storage
   */
  const loadLastServerUrl = async () => {
    try {
      const { authService } = await import('@/core/auth');
      const lastUrl = await authService.getStoredServerUrl();
      if (lastUrl) {
        setServerUrl(lastUrl);
      }
    } catch (err) {
      console.error('Failed to load last server URL:', err);
    }
  };

  /**
   * Validate inputs before submission
   */
  const validateInputs = (): boolean => {
    if (!serverUrl.trim()) {
      setValidationError('Please enter a server URL');
      return false;
    }

    if (!username.trim()) {
      setValidationError('Please enter a username');
      return false;
    }

    if (!password) {
      setValidationError('Please enter a password');
      return false;
    }

    return true;
  };

  /**
   * Handle login submission
   */
  const handleLogin = async () => {
    if (!validateInputs()) {
      return;
    }

    try {
      await login(serverUrl.trim(), username.trim(), password);
    } catch (err) {
      // Error is handled by context and shown via Alert
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>AudiobookShelf</Text>
          <Text style={styles.subtitle}>Connect to your server</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Server URL Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              placeholder="http://server:13378"
              placeholderTextColor="#999"
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!isLoading}
            />
          </View>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Validation Error */}
          {validationError ? (
            <Text style={styles.errorText}>{validationError}</Text>
          ) : null}

          {/* Login Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </Pressable>
        </View>

        {/* Help Text */}
        <View style={styles.footer}>
          <Text style={styles.helpText}>
            Enter the URL of your AudiobookShelf server and your login credentials
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
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
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    backgroundColor: '#3A7BC8',
  },
  buttonDisabled: {
    backgroundColor: '#A0C4E8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#E53935',
    fontSize: 14,
    marginTop: -8,
    marginBottom: 12,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
