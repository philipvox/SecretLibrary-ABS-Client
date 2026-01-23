/**
 * jest.config.js
 *
 * Jest configuration for React Native with Expo.
 * Supports both utility function tests and component tests.
 */

module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|react-native-svg|@react-native-async-storage/async-storage)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
    // Mock image imports
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Setup file runs before tests, after test framework is set up
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
  ],
  // Define globals before anything runs
  globals: {
    __DEV__: true,
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      // Set minimum thresholds to prevent coverage regression
      // Start conservative and increase as more tests are added
      branches: 20,
      functions: 25,
      lines: 30,
      statements: 30,
    },
  },
  // Increase timeout for component tests
  testTimeout: 10000,
  // Clear mocks between tests
  clearMocks: true,
};
