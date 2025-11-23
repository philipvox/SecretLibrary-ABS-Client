/**
 * Login screen with updated design system
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '@/core/auth';
import { Button } from '@/shared/components';
import { theme } from '@/shared/theme';

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

  const handleLogin = async () => {
    if (!validateInputs()) {
      return;
    }

    try {
      await login(serverUrl.trim(), username.trim(), password);
    } catch (err) {
      // Error handled by context
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
          {/* Server URL */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              placeholder="http://server:13378"
              placeholderTextColor={theme.colors.text.tertiary}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!isLoading}
            />
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              placeholderTextColor={theme.colors.text.tertiary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={theme.colors.text.tertiary}
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
          <Button
            title="Login"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            fullWidth
            size="large"
            style={styles.loginButton}
          />
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
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing[6],
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing[12],
  },
  title: {
    ...theme.textStyles.displayMedium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  subtitle: {
    ...theme.textStyles.body,
    color: theme.colors.text.secondary,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: theme.spacing[5],
  },
  label: {
    ...theme.textStyles.label,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  input: {
    ...theme.textStyles.body,
    backgroundColor: theme.colors.background.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.medium,
    padding: theme.spacing[4],
    color: theme.colors.text.primary,
  },
  loginButton: {
    marginTop: theme.spacing[2],
  },
  errorText: {
    ...theme.textStyles.bodySmall,
    color: theme.colors.semantic.error,
    marginTop: -theme.spacing[3],
    marginBottom: theme.spacing[3],
  },
  footer: {
    marginTop: theme.spacing[8],
    alignItems: 'center',
  },
  helpText: {
    ...theme.textStyles.bodySmall,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});