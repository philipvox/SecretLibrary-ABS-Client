/**
 * metro.config.js
 *
 * Metro bundler configuration with performance optimizations.
 * @see https://docs.expo.dev/guides/customizing-metro
 */

const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ============================================================================
// WEB PLATFORM SHIMS
// ============================================================================

// No custom shims needed - expo-audio handles web platform natively

// ============================================================================
// TRANSFORMER OPTIMIZATIONS
// ============================================================================

config.transformer = {
  ...config.transformer,

  // Enable inline requires for faster startup
  // Modules are loaded on-demand instead of all at once
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true, // ⚡ Lazy load modules
    },
  }),

  // Minification options for production
  minifierConfig: {
    keep_classnames: false,
    keep_fnames: false,
    mangle: {
      keep_classnames: false,
      keep_fnames: false,
    },
    output: {
      ascii_only: true,
      quote_style: 3,
      wrap_iife: true,
    },
    sourceMap: {
      includeSources: false,
    },
    toplevel: false,
    compress: {
      // Aggressive compression for smaller bundles
      reduce_funcs: true,
      reduce_vars: true,
      drop_console: process.env.NODE_ENV === 'production', // Remove console.* in prod
      drop_debugger: true,
      pure_funcs: process.env.NODE_ENV === 'production'
        ? ['console.log', 'console.info', 'console.debug', 'console.warn']
        : [],
    },
  },
};

// ============================================================================
// RESOLVER OPTIMIZATIONS
// ============================================================================

config.resolver = {
  ...config.resolver,

  // Reduce bundle size by excluding unnecessary platforms
  resolverMainFields: ['react-native', 'browser', 'main'],

  // Asset extensions
  assetExts: [
    ...config.resolver.assetExts.filter(ext => ext !== 'wasm'),
    'wasm', // Required for expo-sqlite web support (wa-sqlite WASM binary)
  ],

  // Source extensions — filter out 'wasm' so Metro doesn't parse WASM as JS.
  // NOTE: Do NOT add 'native.*' extensions here. Metro handles .native.ts/.native.js
  // resolution automatically via its platform system (only for ios/android).
  // Adding them to sourceExts gives them priority on ALL platforms including web,
  // which causes web builds to incorrectly load native-only code (e.g. AsyncStorage).
  sourceExts: config.resolver.sourceExts.filter(ext => ext !== 'wasm'),

  // Package exports conditions per platform.
  // Web default is ["browser"] which causes zustand (and similar packages) to
  // resolve to ESM builds using `import.meta` — a syntax error in a regular
  // <script> tag. Adding "react-native" makes them resolve to CJS instead.
  unstable_conditionsByPlatform: {
    ...config.resolver.unstable_conditionsByPlatform,
    web: ['browser', 'react-native'],
  },

  // Block list - exclude test files from bundle
  blockList: [
    /.*\/__tests__\/.*/,
    /.*\.test\.(js|jsx|ts|tsx)$/,
    /.*\.spec\.(js|jsx|ts|tsx)$/,
    /.*\/node_modules\/.*\/examples\/.*/,
    /.*\/node_modules\/.*\/docs\/.*/,
  ],
};

// ============================================================================
// SERIALIZER OPTIMIZATIONS
// ============================================================================

// Note: Using default serializer config as custom createModuleIdFactory
// can cause compatibility issues with Expo's Metro setup

// ============================================================================
// SERVER OPTIMIZATIONS
// ============================================================================

config.server = {
  ...config.server,

  // Enable gzip compression for faster bundle transfer
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Add cache headers for static assets
      if (req.url?.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      return middleware(req, res, next);
    };
  },
};

// ============================================================================
// WATCHER OPTIMIZATIONS (Development)
// ============================================================================

config.watcher = {
  ...config.watcher,

  // Reduce watcher overhead
  watchman: {
    deferStates: ['hg.update'],
  },

  // Ignore directories that don't need watching
  additionalExts: config.resolver.assetExts,
};

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

config.cacheStores = config.cacheStores;

// Reset cache on config changes
config.resetCache = false;

module.exports = config;
